// 小程序虚拟支付（个人主体 · 道具直购）payData 组装与双签名（W3）
// 契约：docs/contracts/2026-10-21-virtual-pay.freeze.md §3 / §11
// 官方算法（2026-10-22 抓取《虚拟支付：个人》§5.5）：
//   paySig    = HMAC-SHA256(AppKey,  "requestVirtualPayment" + "&" + signData)
//   signature = HMAC-SHA256(sessionKey, signData)
// 约束：
//   - signData 必须以 JSON 字符串下发，且与实际请求体逐字一致（不格式化、不改键序）；
//   - AppKey / sessionKey 均为密钥：不写日志、不下发、不进埋点；
//   - 金额只认 skus.ts（priceCent），客户端不得传价。
import { createHmac } from 'node:crypto'
import type { Env } from '../config.js'
import type { SkuSpec } from '../data/skus.js'
import { wxApiRequestLoose, type WxHttpResponse } from './wx-http.js'
import { getWxAccessToken } from './wx-access-token.js'

// 道具直购固定取值（官方 b2）
export const VIRTUAL_PAY_MODE = 'short_series_goods'
export const VIRTUAL_PAY_URI = 'requestVirtualPayment'
export const VIRTUAL_PAY_ENV = 0
export const VIRTUAL_PAY_CURRENCY = 'CNY'

export type VirtualSignData = {
  offerId: string
  buyQuantity: number
  env: number
  currencyType: string
  productId: string
  goodsPrice: number
  outTradeNo: string
  attach: string
}

export type VirtualPayParams = {
  provider: 'virtual'
  orderId: string
  mode: string
  signData: string
  paySig: string
  signature: string
}

// 签名就绪判定：OfferID 与现网 AppKey 缺一不可
export function isVirtualPayReady(env: Env): boolean {
  return env.mpOfferId.length > 0 && env.mpAppKey.length > 0
}

// 生成 signData（字段顺序即官方示例顺序，签名与下发共用同一字符串）
export function buildSignData(sku: SkuSpec, orderId: string, offerId: string): VirtualSignData {
  return {
    offerId: offerId,
    buyQuantity: 1,
    env: VIRTUAL_PAY_ENV,
    currencyType: VIRTUAL_PAY_CURRENCY,
    productId: sku.wxProductId,
    goodsPrice: sku.priceCent,
    outTradeNo: orderId,
    attach: orderId
  } as VirtualSignData
}

export function toSignDataString(signData: VirtualSignData): string {
  return JSON.stringify(signData)
}

function hmacSha256Hex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('hex')
}

// 支付签名（AppKey）：uri 固定 requestVirtualPayment
export function calcPaySig(appKey: string, signData: string): string {
  return hmacSha256Hex(appKey, VIRTUAL_PAY_URI + '&' + signData)
}

// 用户态签名（sessionKey）
export function calcSignature(sessionKey: string, signData: string): string {
  return hmacSha256Hex(sessionKey, signData)
}

// 组装客户端 wx.requestVirtualPayment 所需 payData
export function createVirtualPayParams(
  env: Env,
  sku: SkuSpec,
  orderId: string,
  sessionKey: string
): VirtualPayParams {
  const signData = toSignDataString(buildSignData(sku, orderId, env.mpOfferId))
  return {
    provider: 'virtual',
    orderId: orderId,
    mode: VIRTUAL_PAY_MODE,
    signData: signData,
    paySig: calcPaySig(env.mpAppKey, signData),
    signature: calcSignature(sessionKey, signData)
  } as VirtualPayParams
}

// ---------------- 服务端查单（W4 兜底） ----------------
// 官方：POST https://api.weixin.qq.com/xpay/query_order?access_token=..&pay_sig=..
// B 端 uri 为实际接口路径（≠ C 端 requestVirtualPayment）
export const QUERY_ORDER_URI = '/xpay/query_order'
export const QUERY_ORDER_URL = 'https://api.weixin.qq.com/xpay/query_order'

export type QueryOrderResult = {
  status: number // 2 已支付待发货 / 3 发货中 / 4 已发货 / 5 已退款 / 8 用户退款完成
  orderFee: number
  paidFee: number
  wxOrderId: string
  raw: any
}

export function buildQueryPaySig(appKey: string, postBody: string): string {
  return hmacSha256Hex(appKey, QUERY_ORDER_URI + '&' + postBody)
}

// 测试注入（默认走 wxApiRequestLoose / 共享 access_token 缓存）
type PostLike = (url: string, body: string, timeoutMs: number) => Promise<WxHttpResponse>
let injectedPost: PostLike | null = null
let injectedToken: string = ''
export function setVirtualPayTransportForTest(fn: PostLike | null, token: string = ''): void {
  injectedPost = fn
  injectedToken = token
}

// 测试注入：可感知 force 的 token 获取器（验证 40001 强制刷新重试）
export type VirtualTokenGetter = (force: boolean) => Promise<string>
let injectedTokenGetter: VirtualTokenGetter | null = null
export function setVirtualPayTokenGetterForTest(fn: VirtualTokenGetter | null): void {
  injectedTokenGetter = fn
}

async function postJson(url: string, body: string, timeoutMs: number): Promise<WxHttpResponse> {
  if (injectedPost != null) return injectedPost(url, body, timeoutMs)
  return wxApiRequestLoose({
    url: url,
    method: 'POST',
    // 必须发送与签名原文逐字一致的字节：用 rawBody 而非 jsonBody（后者会再次序列化）
    rawBody: Buffer.from(body, 'utf8'),
    contentType: 'application/json',
    timeoutMs: timeoutMs
  })
}

// 带 token 的查单（测试可直接注入 token，避免真实换取）
export async function queryVirtualOrderWithToken(
  env: Env,
  accessToken: string,
  openid: string,
  orderId: string,
  timeoutMs: number = 10000,
  onErrcode: ((code: number) => void) | null = null
): Promise<QueryOrderResult | null> {
  if (openid.length === 0 || orderId.length === 0) return null
  // 请求体必须与签名原文逐字一致
  const body = JSON.stringify({ openid: openid, env: VIRTUAL_PAY_ENV, order_id: orderId })
  const url =
    QUERY_ORDER_URL +
    '?access_token=' +
    encodeURIComponent(accessToken) +
    '&pay_sig=' +
    encodeURIComponent(buildQueryPaySig(env.mpAppKey, body))
  let res: WxHttpResponse
  try {
    res = await postJson(url, body, timeoutMs)
  } catch (e: any) {
    console.warn('[virtual-pay] query_order 网络失败', e instanceof Error ? e.message : e)
    return null
  }
  if (res.status < 200 || res.status >= 300) {
    console.warn('[virtual-pay] query_order HTTP', res.status)
    return null
  }
  let json: any = null
  try {
    json = JSON.parse(res.body)
  } catch {
    return null
  }
  if (json == null || json.errcode !== 0 || json.order == null) {
    const code = json != null && typeof json.errcode === 'number' ? json.errcode : -1
    const msg = json != null && json.errmsg != null ? String(json.errmsg) : ''
    console.warn('[virtual-pay] query_order errcode =', code, msg)
    if (onErrcode != null) onErrcode(code)
    return null
  }
  const o = json.order
  return {
    status: typeof o.status === 'number' ? o.status : -1,
    orderFee: typeof o.order_fee === 'number' ? o.order_fee : -1,
    paidFee: typeof o.paid_fee === 'number' ? o.paid_fee : -1,
    wxOrderId: typeof o.wx_order_id === 'string' ? o.wx_order_id : '',
    raw: o
  } as QueryOrderResult
}

// 生产入口：自动换取 access_token（进程内缓存，复用 ASR/TTS 通道）
// 40001（凭据失效）→ 强制刷新 token 后重试一次：
// 滚动发布 / 多副本会各自缓存 token，旧实例可能持有已被顶掉的凭据。
export async function queryVirtualOrder(
  env: Env,
  openid: string,
  orderId: string
): Promise<QueryOrderResult | null> {
  // token 来源优先级：测试 getter > 测试固定 token > 真实换取
  const getToken = async (force: boolean): Promise<string> => {
    if (injectedTokenGetter != null) return injectedTokenGetter(force)
    if (injectedToken.length > 0) return injectedToken
    return getWxAccessToken({
      appId: env.wxAppId,
      secret: env.wxSecret,
      timeoutMs: 10000,
      force: force
    })
  }
  if (
    injectedToken.length === 0 &&
    injectedTokenGetter == null &&
    (env.wxAppId.length === 0 || env.wxSecret.length === 0)
  ) {
    return null
  }
  let token = ''
  try {
    token = await getToken(false)
  } catch (e: any) {
    console.warn('[virtual-pay] access_token 获取失败', e instanceof Error ? e.message : e)
    return null
  }
  let tokenInvalid = false
  const first = await queryVirtualOrderWithToken(
    env,
    token,
    openid,
    orderId,
    10000,
    (code: number) => {
      if (code === 40001) tokenInvalid = true
    }
  )
  if (first != null || !tokenInvalid) return first
  // 固定 token 的测试注入无法刷新，不再重试
  if (injectedTokenGetter == null && injectedToken.length > 0) return null
  console.warn('[virtual-pay] query_order 40001，强制刷新 access_token 后重试一次')
  try {
    token = await getToken(true)
  } catch (e: any) {
    console.warn('[virtual-pay] access_token 强制刷新失败', e instanceof Error ? e.message : e)
    return null
  }
  return queryVirtualOrderWithToken(env, token, openid, orderId)
}
