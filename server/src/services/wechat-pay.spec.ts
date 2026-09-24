// 微信支付 v3 纯算法单测（P1.3，伪造密钥，不依赖真实商户）
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  signMessage,
  verifySignature,
  buildClientPaySignStr,
  createJsapiOrder,
  verifyNotifySignature,
  decryptResource,
  encryptResourceForTest,
  setWxFetchForTest,
  resetWxFetchForTest
} from './wechat-pay.js'
import { loadEnv } from '../config.js'
import type { Env } from '../config.js'

function makeKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    publicKey: publicKey.export({ type: 'pkcs1', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
  }
}

function wxEnv(keys: { publicKey: string; privateKey: string }): Env {
  const env = loadEnv()
  env.payMode = 'wx'
  env.wxAppId = 'wx-test'
  env.wxMchId = '1900000001'
  env.wxMchSerial = 'SERIAL1'
  env.wxApiV3Key = '0123456789abcdef0123456789abcdef' // 32 字节
  env.wxMchPrivateKey = keys.privateKey
  env.wxPlatformPublicKey = keys.publicKey
  env.wxNotifyUrl = 'https://example.com/notify'
  return env
}

describe('wechat-pay 算法', () => {
  beforeEach(() => resetWxFetchForTest())
  afterEach(() => resetWxFetchForTest())

  it('signMessage / verifySignature 往返一致', () => {
    const keys = makeKeys()
    const msg = 'a\nb\nc\n'
    const sig = signMessage(keys.privateKey, msg)
    expect(verifySignature(keys.publicKey, msg, sig)).toBe(true)
    expect(verifySignature(keys.publicKey, msg + 'x', sig)).toBe(false)
  })

  it('前端拉起支付 paySign 格式：appid\nts\nnonce\nprepay_id=..\n 可验证', () => {
    const keys = makeKeys()
    const str = buildClientPaySignStr('wx-app', '1234567890', 'nonce1', 'wx1122')
    expect(str).toBe('wx-app\n1234567890\nnonce1\nprepay_id=wx1122\n')
    const sig = signMessage(keys.privateKey, str)
    expect(verifySignature(keys.publicKey, str, sig)).toBe(true)
  })

  it('createJsapiOrder：请求签名头正确，返回 PayParams 且 paySign 可验回', async () => {
    const keys = makeKeys()
    const env = wxEnv(keys)
    let capturedAuth = ''
    setWxFetchForTest(async (_url: string, init: any) => {
      capturedAuth = init.headers.Authorization
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body)
      expect(body.out_trade_no).toBe('o_test1')
      expect(body.amount.total).toBe(3900)
      expect(body.payer.openid).toBe('openid1')
      return { ok: true, json: async () => ({ prepay_id: 'prepay_123' }) }
    })
    const params = await createJsapiOrder(env, 'o_test1', 'MentorLoop 会员', 3900, 'openid1')
    expect(capturedAuth.startsWith('WECHATPAY2-SHA256-RSA2048 mchid="1900000001"')).toBe(true)
    expect(params.provider).toBe('wxpay')
    expect(params.prepayId).toBe('prepay_123')
    expect(params.orderId).toBe('o_test1')
    const signStr = buildClientPaySignStr(
      env.wxAppId,
      params.timeStamp,
      params.nonceStr,
      params.prepayId
    )
    expect(verifySignature(keys.publicKey, signStr, params.sign)).toBe(true)
  })

  it('回调验签：正确签名通过，篡改 body 失败', () => {
    const keys = makeKeys()
    const env = wxEnv(keys)
    const ts = '1700000000'
    const nonce = 'n1'
    const raw = '{"resource":{}}'
    const message = `${ts}\n${nonce}\n${raw}\n`
    const sig = signMessage(keys.privateKey, message)
    expect(verifyNotifySignature(env, ts, nonce, raw, sig)).toBe(true)
    expect(verifyNotifySignature(env, ts, nonce, raw + 'x', sig)).toBe(false)
  })

  it('AES-256-GCM 加解密往返一致；错误 key 解密抛错', () => {
    const key = '0123456789abcdef0123456789abcdef'
    const nonce = 'abcdef012345' // AES-GCM IV：12 字节
    const aad = 'transaction'
    const plain = JSON.stringify({
      out_trade_no: 'o1',
      transaction_id: 'T1',
      trade_state: 'SUCCESS',
      amount: { total: 3900 }
    })
    const resource = encryptResourceForTest(key, nonce, aad, plain)
    const detail = decryptResource(key, resource)
    expect(detail.out_trade_no).toBe('o1')
    expect(detail.trade_state).toBe('SUCCESS')
    expect(detail.amount?.total).toBe(3900)
    expect(() => decryptResource('00000000000000000000000000000000', resource)).toThrow()
  })
})
