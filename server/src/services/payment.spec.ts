// 支付与会员集成单测（P1.3）：mock 下单发放 / 会员叠加 / 回调幂等 / 金额校验
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { buildApp } from '../app.js'
import { loadEnv } from '../config.js'
import type { Env } from '../config.js'
import { closeDb } from '../db.js'
import {
  signMessage,
  encryptResourceForTest,
  setWxFetchForTest,
  resetWxFetchForTest
} from './wechat-pay.js'

function makeApp(env: Env) {
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13900000088' } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '13900000088', code: '123456' }
  })
  return r.json().data.token
}

async function quota(app: any, token: string): Promise<any> {
  const r = await app.inject({
    method: 'GET',
    url: '/membership/quota',
    headers: { authorization: 'Bearer ' + token }
  })
  return r.json().data
}

async function orderMock(app: any, token: string, skuId: string): Promise<any> {
  const r = await app.inject({
    method: 'POST',
    url: '/membership/order',
    headers: { authorization: 'Bearer ' + token },
    payload: { skuId }
  })
  return r.json()
}

describe('支付与权益（P1.3）', () => {
  beforeEach(() => {
    closeDb()
    resetWxFetchForTest()
  })
  afterEach(() => resetWxFetchForTest())

  it('mock 下单即发放：会员生效，单次包累加场次', async () => {
    const env = loadEnv() // payMode 默认 mock
    const app = makeApp(env)
    const token = await login(app)

    const r1 = await orderMock(app, token, 'member_monthly')
    expect(r1.code).toBe(0)
    expect(r1.data.payParams).toBeNull()
    expect(typeof r1.data.orderId).toBe('string')
    const q1 = await quota(app, token)
    expect(q1.memberUntil).toBeGreaterThan(0)

    const r2 = await orderMock(app, token, 'single_pack_10')
    expect(r2.code).toBe(0)
    const q2 = await quota(app, token)
    expect(q2.singleCreditsLeft).toBeGreaterThanOrEqual(10)
  })

  it('会员叠加：连续两次月卡 ≈ 60 天', async () => {
    const env = loadEnv()
    const app = makeApp(env)
    const token = await login(app)
    await orderMock(app, token, 'member_monthly')
    const q1 = await quota(app, token)
    await orderMock(app, token, 'member_monthly')
    const q2 = await quota(app, token)
    const diffDays = (q2.memberUntil - q1.memberUntil) / 86400000
    expect(Math.abs(diffDays - 30)).toBeLessThan(1)
  })

  it('wx 模式：订单返回 payParams；回调幂等只发放一次', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const priv = keys.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
    const pub = keys.publicKey.export({ type: 'pkcs1', format: 'pem' }) as string
    const env = loadEnv()
    env.payMode = 'wx'
    env.wxAppId = 'wxtest'
    env.wxMchId = 'm1'
    env.wxMchSerial = 's1'
    env.wxApiV3Key = '0123456789abcdef0123456789abcdef'
    env.wxMchPrivateKey = priv
    env.wxPlatformPublicKey = pub
    env.wxNotifyUrl = 'https://example.com/notify'
    setWxFetchForTest(async () => ({ ok: true, json: async () => ({ prepay_id: 'prepay_x' }) }))

    const app = makeApp(env)
    const token = await login(app)
    const r = await app.inject({
      method: 'POST',
      url: '/membership/order',
      headers: { authorization: 'Bearer ' + token },
      payload: { skuId: 'member_monthly' }
    })
    const order = r.json()
    expect(order.code).toBe(0)
    expect(order.data.payParams).not.toBeNull()
    expect(order.data.payParams.prepayId).toBe('prepay_x')

    // 构造一次回调：签名 + AES 加密 resource
    const ts = String(Math.floor(Date.now() / 1000))
    const nonce = 'abcdef012345'
    const detail = JSON.stringify({
      out_trade_no: order.data.orderId,
      transaction_id: 'T1',
      trade_state: 'SUCCESS',
      amount: { total: 3900, currency: 'CNY' }
    })
    const body = JSON.stringify({
      resource: encryptResourceForTest(env.wxApiV3Key, nonce, 'transaction', detail)
    })
    const message = `${ts}\n${nonce}\n${body}\n`
    const signature = signMessage(priv, message)
    const h = {
      'content-type': 'application/json',
      'wechatpay-timestamp': ts,
      'wechatpay-nonce': nonce,
      'wechatpay-signature': signature
    }
    const before = await quota(app, token)

    const n1 = await app.inject({
      method: 'POST',
      url: '/membership/order/notify',
      headers: h,
      payload: body
    })
    expect(n1.statusCode).toBe(200)
    expect(n1.json().code).toBe('SUCCESS')
    const mid = await quota(app, token)
    expect(mid.memberUntil - before.memberUntil).toBeGreaterThan(0)

    // 重复回调：仍 SUCCESS，但不重复发放
    const n2 = await app.inject({
      method: 'POST',
      url: '/membership/order/notify',
      headers: h,
      payload: body
    })
    expect(n2.json().code).toBe('SUCCESS')
    const after = await quota(app, token)
    expect(after.memberUntil - mid.memberUntil).toBe(0)
  })

  it('金额不一致拒绝发放', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const priv = keys.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
    const pub = keys.publicKey.export({ type: 'pkcs1', format: 'pem' }) as string
    const env = loadEnv()
    env.payMode = 'wx'
    env.wxAppId = 'wxtest'
    env.wxMchId = 'm1'
    env.wxMchSerial = 's1'
    env.wxApiV3Key = '0123456789abcdef0123456789abcdef'
    env.wxMchPrivateKey = priv
    env.wxPlatformPublicKey = pub
    setWxFetchForTest(async () => ({ ok: true, json: async () => ({ prepay_id: 'prepay_x' }) }))

    const app = makeApp(env)
    const token = await login(app)
    const r = await app.inject({
      method: 'POST',
      url: '/membership/order',
      headers: { authorization: 'Bearer ' + token },
      payload: { skuId: 'single_pack_3' }
    })
    const orderId = r.json().data.orderId
    const ts = String(Math.floor(Date.now() / 1000))
    const nonce = 'abcdef012345'
    const detail = JSON.stringify({
      out_trade_no: orderId,
      transaction_id: 'T2',
      trade_state: 'SUCCESS',
      amount: { total: 9999 }
    })
    const body = JSON.stringify({
      resource: encryptResourceForTest(env.wxApiV3Key, nonce, 'transaction', detail)
    })
    const signature = signMessage(priv, `${ts}\n${nonce}\n${body}\n`)
    const before = await quota(app, token)
    const n = await app.inject({
      method: 'POST',
      url: '/membership/order/notify',
      headers: {
        'content-type': 'application/json',
        'wechatpay-timestamp': ts,
        'wechatpay-nonce': nonce,
        'wechatpay-signature': signature
      },
      payload: body
    })
    expect(n.statusCode).toBe(400)
    const after = await quota(app, token)
    expect(after.singleCreditsLeft - before.singleCreditsLeft).toBe(0)
  })
})
