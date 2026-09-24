// 微信支付 v3 封装（P1.3）：JSAPI 下单 / paySign / 回调验签 / resource 解密
// 纯算法实现，可用伪造密钥单测；真实联调依赖商户号/证书/回调域名（见 README）。
import {
  createPrivateKey,
  createPublicKey,
  createDecipheriv,
  createCipheriv,
  randomBytes,
  sign,
  verify
} from 'node:crypto'
import { Env } from '../config.js'

export type PayParams = {
  provider: string
  orderId: string
  prepayId: string
  nonceStr: string
  timeStamp: string
  sign: string
}

// 注入式 HTTP（测试用）
type FetchLike = (url: string, init: any) => Promise<any>
let injected: FetchLike | null = null
export function setWxFetchForTest(fn: FetchLike): void {
  injected = fn
}
export function resetWxFetchForTest(): void {
  injected = null
}
function doFetch(url: string, init: any): Promise<any> {
  if (injected != null) return injected(url, init)
  return fetch(url, init)
}

function pemKey(pem: string) {
  return pem
}

// RSA-SHA256 签名 → base64
export function signMessage(privateKeyPem: string, message: string): string {
  const key = createPrivateKey(pemKey(privateKeyPem))
  return sign('RSA-SHA256', Buffer.from(message, 'utf8'), key).toString('base64')
}

// 校验 RSA-SHA256 签名（微信回调验签）
export function verifySignature(
  publicKeyPem: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    const key = createPublicKey(pemKey(publicKeyPem))
    const sig = Buffer.from(signatureBase64, 'base64')
    return verify('RSA-SHA256', Buffer.from(message, 'utf8'), key, sig)
  } catch {
    return false
  }
}

// 客户端拉起支付签名串：appid\ntimeStamp\nnonceStr\nprepay_id=xxx\n
export function buildClientPaySignStr(
  appid: string,
  ts: string,
  nonce: string,
  prepayId: string
): string {
  return `${appid}\n${ts}\n${nonce}\nprepay_id=${prepayId}\n`
}

// JSAPI 下单：构造请求体、签名头、发起请求，返回 PayParams
export async function createJsapiOrder(
  env: Env,
  orderId: string,
  description: string,
  amountCent: number,
  openid: string
): Promise<PayParams> {
  const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi'
  const body = JSON.stringify({
    appid: env.wxAppId,
    mchid: env.wxMchId,
    description,
    out_trade_no: orderId,
    notify_url: env.wxNotifyUrl,
    amount: { total: amountCent, currency: 'CNY' },
    payer: { openid }
  })
  const ts = String(Math.floor(Date.now() / 1000))
  const nonce = randomBytes(16).toString('hex')
  const message = `POST\n/v3/pay/transactions/jsapi\n${ts}\n${nonce}\n${body}\n`
  const signature = signMessage(env.wxMchPrivateKey, message)
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${env.wxMchId}",nonce_str="${nonce}",` +
    `timestamp="${ts}",serial_no="${env.wxMchSerial}",signature="${signature}"`

  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body
  })
  if (res == null || typeof res.ok !== 'boolean' || !res.ok) throw new Error('WX_PRECREATE_FAILED')
  const json = await res.json()
  const prepayId = json?.prepay_id
  if (typeof prepayId !== 'string' || prepayId.length === 0) throw new Error('WX_PRECREATE_FAILED')

  const paySignStr = buildClientPaySignStr(env.wxAppId, ts, nonce, prepayId)
  const paySign = signMessage(env.wxMchPrivateKey, paySignStr)

  return {
    provider: 'wxpay',
    orderId,
    prepayId,
    nonceStr: nonce,
    timeStamp: ts,
    sign: paySign
  } as PayParams
}

// 回调验签：message = timestamp\nnonce\nrawBody\n
export function verifyNotifySignature(
  env: Env,
  timestamp: string,
  nonce: string,
  rawBody: string,
  signatureBase64: string
): boolean {
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`
  return verifySignature(env.wxPlatformPublicKey, message, signatureBase64)
}

export type WxNotifyResource = {
  ciphertext: string
  nonce: string
  associated_data?: string
  algorithm?: string
}

export type WxNotifyDetail = {
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  amount?: { total?: number; currency?: string }
}

// AES-256-GCM 解密 resource（ciphertext base64，尾 16 字节为 authTag）
export function decryptResource(apiV3Key: string, resource: WxNotifyResource): WxNotifyDetail {
  const buf = Buffer.from(resource.ciphertext, 'base64')
  if (buf.length <= 16) throw new Error('BAD_CIPHERTEXT')
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  )
  decipher.setAuthTag(tag)
  if (resource.associated_data != null && resource.associated_data.length > 0) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  }
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(plain) as WxNotifyDetail
}

// 测试辅助：用相同规范加密一段明文（生成 ciphertext/tag）
export function encryptResourceForTest(
  apiV3Key: string,
  nonce: string,
  aad: string,
  plain: string
): WxNotifyResource {
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(nonce, 'utf8')
  )
  if (aad.length > 0) cipher.setAAD(Buffer.from(aad, 'utf8'))
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    ciphertext: Buffer.concat([enc, cipher.getAuthTag()]).toString('base64'),
    nonce,
    associated_data: aad,
    algorithm: 'AEAD_AES_256_GCM'
  } as WxNotifyResource
}
