// 虚拟支付下单路由单测（W3）：platform 分流 / 409 会话校验 / signData 取值
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv, isAppPayEnabled } from './config.js'
import type { Env } from './config.js'
import { closeDb, getDb } from './db.js'

function makeApp(env: Env) {
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any): Promise<{ token: string; uid: string; phone: string }> {
  const phone = '137' + String(Date.now()).slice(-8)
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  const d = r.json().data
  return { token: d.token, uid: d.uid, phone }
}

async function setSessionKey(env: Env, uid: string, key: string): Promise<void> {
  const db = getDb(env.dbPath)
  await db
    .prepare('UPDATE users SET session_key = ?, session_key_updated_at = ? WHERE uid = ?')
    .run(key, Date.now(), uid)
}

function virtualEnv(): Env {
  const env = loadEnv()
  env.mpPayMode = 'virtual'
  env.mpOfferId = '1450672438'
  env.mpAppKey = 'test-app-key'
  return env
}

async function order(app: any, token: string, body: any) {
  const r = await app.inject({
    method: 'POST',
    url: '/membership/order',
    headers: { authorization: 'Bearer ' + token },
    payload: body
  })
  return { status: r.statusCode, json: r.json() }
}

describe('虚拟支付下单（W3）', () => {
  beforeEach(() => closeDb())
  afterEach(() => closeDb())

  it('platform 缺失 → 400 平台参数不合法', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await login(app)
    const r = await order(app, token, { skuId: 'single_pack_3' })
    expect(r.status).toBe(400)
    expect(r.json.message).toBe('平台参数不合法')
  })

  it('mp-weixin + virtual + 有 session_key → 返回虚拟支付 payData 且价格取服务端', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token, uid } = await login(app)
    await setSessionKey(env, uid, 'SK_TEST')

    const r = await order(app, token, { skuId: 'single_pack_3', platform: 'mp-weixin' })
    expect(r.status).toBe(200)
    expect(r.json.code).toBe(0)
    const p = r.json.data.payParams
    expect(p.provider).toBe('virtual')
    expect(p.mode).toBe('short_series_goods')
    expect(typeof p.signData).toBe('string')
    const sd = JSON.parse(p.signData)
    expect(sd.productId).toBe('single_pack_3')
    expect(sd.goodsPrice).toBe(2900)
    expect(sd.outTradeNo).toBe(r.json.data.orderId)
    expect(sd.attach).toBe(r.json.data.orderId)
    expect(sd.offerId).toBe('1450672438')
    expect(sd.env).toBe(0)
    expect(p.paySig).toHaveLength(64)
    expect(p.signature).toHaveLength(64)
    // 不得下发任何密钥
    expect(JSON.stringify(r.json)).not.toContain('SK_TEST')
    expect(JSON.stringify(r.json)).not.toContain('test-app-key')
  })

  it('mp-weixin + virtual 但无 session_key → 409（客户端需重登）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await login(app)
    const r = await order(app, token, { skuId: 'single_pack_3', platform: 'mp-weixin' })
    expect(r.status).toBe(409)
    expect(r.json.message).toBe('微信会话已过期，请重新进入小程序')
  })

  it('mp-weixin + virtual + 未知 skuId → 400 商品不存在（不建单）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token, uid } = await login(app)
    await setSessionKey(env, uid, 'SK_TEST')
    const r = await order(app, token, { skuId: 'not_exist', platform: 'mp-weixin' })
    expect(r.status).toBe(400)
    expect(r.json.message).toBe('商品不存在')
  })

  it('platform=app 走原有 mock 分支：payParams=null 且权益已发放（回归）', async () => {
    const env = loadEnv() // payMode 默认 mock
    const app = makeApp(env)
    const { token } = await login(app)
    const r = await order(app, token, { skuId: 'single_pack_3', platform: 'app' })
    expect(r.status).toBe(200)
    expect(r.json.data.payParams).toBeNull()
    const q = await app.inject({
      method: 'GET',
      url: '/membership/quota',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(q.json().data.singleCreditsLeft).toBe(3)
  })

  it('mp-weixin + MP_PAY_MODE=mock 仍按 mock 发放（回退开关有效）', async () => {
    const env = loadEnv()
    env.mpPayMode = 'mock'
    const app = makeApp(env)
    const { token } = await login(app)
    const r = await order(app, token, { skuId: 'member_monthly', platform: 'mp-weixin' })
    expect(r.status).toBe(200)
    expect(r.json.data.payParams).toBeNull()
  })

  it('云端未配置 App 商户凭据时 App 端下单不可用（不免费发放）', () => {
    const env = loadEnv() // payMode 默认 mock
    // 本地/测试：允许 mock 下单
    expect(isAppPayEnabled(env)).toBe(true)
    // 云端：无 MYSQL_HOST 时不判定；显式置云端地址后应禁用
    env.mysqlHost = '10.0.0.1'
    expect(isAppPayEnabled(env)).toBe(false)
    // 配置真实商户凭据后恢复可用
    env.payMode = 'wx'
    expect(isAppPayEnabled(env)).toBe(true)
  })
})
