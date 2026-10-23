// 购买前手机号绑定单测（契约 2026-10-23-phone-binding）
// 覆盖：鉴权 / 绑定成功 / 幂等 / 验证码失败 / 他人占用冲突 / 未绑定下单拦截
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb, getDb } from './db.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  env.wxMockLogin = true
  const app = buildApp({ env })
  ;(app as any).testEnv = env
  return app
}

// 直接写一条未消费验证码：绕开发码限流（60s/手机号），用于冲突场景二次发码
async function seedCode(app: any, phone: string) {
  const db = getDb(app.testEnv.dbPath)
  await db
    .prepare(
      `INSERT INTO sms_codes (phone, code, expires_at, consumed) VALUES (?, ?, ?, 0)
       ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, consumed = 0`
    )
    .run(phone, '123456', Date.now() + 300000)
}

function auth(token: string) {
  return { authorization: 'Bearer ' + token }
}

// 微信静默登录（WX_MOCK_LOGIN）：openid = 'wx_' + code，账号无手机号
async function loginWechat(app: any, code: string): Promise<{ token: string; uid: string }> {
  const r = await app.inject({ method: 'POST', url: '/auth/wechat', payload: { code } })
  const d = r.json().data
  return { token: d.token, uid: d.uid }
}

// 手机号验证码登录：账号自带 phone（App 端路径）
async function loginPhone(app: any, phone: string): Promise<{ token: string; uid: string }> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  const d = r.json().data
  return { token: d.token, uid: d.uid }
}

async function sendCode(app: any, phone: string) {
  return app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
}

async function bind(app: any, token: string, phone: string, code: string) {
  return app.inject({
    method: 'POST',
    url: '/me/phone',
    headers: auth(token),
    payload: { phone, code }
  })
}

function uniqPhone(prefix: string): string {
  return prefix + String(Date.now()).slice(-8)
}

describe('购买前手机号绑定 /me/phone', () => {
  beforeEach(() => closeDb())
  afterEach(() => closeDb())

  it('未登录访问 /me/phone 返回 401', async () => {
    const app = makeApp()
    const get = await app.inject({ method: 'GET', url: '/me/phone' })
    expect(get.statusCode).toBe(401)
    const post = await app.inject({
      method: 'POST',
      url: '/me/phone',
      payload: { phone: '13900000001', code: '123456' }
    })
    expect(post.statusCode).toBe(401)
  })

  it('微信账号绑定成功且 uid 不变；重复绑定幂等', async () => {
    const app = makeApp()
    const wx = await loginWechat(app, 'bind-ok')
    const phone = uniqPhone('135')

    const before = await app.inject({ method: 'GET', url: '/me/phone', headers: auth(wx.token) })
    expect(before.json().data.phone).toBe(null)

    await sendCode(app, phone)
    const r = await bind(app, wx.token, phone, '123456')
    expect(r.statusCode).toBe(200)
    expect(r.json().data.phone).toBe(phone)

    const after = await app.inject({ method: 'GET', url: '/me/phone', headers: auth(wx.token) })
    expect(after.json().data.phone).toBe(phone)

    // uid 未被切换：同一 token 仍指向原账号
    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: auth(wx.token) })
    expect(me.json().data.uid).toBe(wx.uid)

    // 幂等：已绑定同一手机号，即使验证码无效也返回成功
    const again = await bind(app, wx.token, phone, '000000')
    expect(again.statusCode).toBe(200)
    expect(again.json().data.phone).toBe(phone)
  })

  it('验证码错误返回 400，手机号不落库', async () => {
    const app = makeApp()
    const wx = await loginWechat(app, 'bind-bad-code')
    const phone = uniqPhone('136')
    await sendCode(app, phone)

    const r = await bind(app, wx.token, phone, '999999')
    expect(r.statusCode).toBe(400)
    expect(r.json().message).toBe('验证码不正确或已过期')

    const after = await app.inject({ method: 'GET', url: '/me/phone', headers: auth(wx.token) })
    expect(after.json().data.phone).toBe(null)
  })

  it('手机号已属其他账号返回 409/40901，不覆盖原归属', async () => {
    const app = makeApp()
    const phone = uniqPhone('137')
    const owner = await loginPhone(app, phone)
    const wx = await loginWechat(app, 'bind-conflict')

    await seedCode(app, phone)
    const r = await bind(app, wx.token, phone, '123456')
    expect(r.statusCode).toBe(409)
    expect(r.json().code).toBe(40901)

    // 原账号归属不变
    const ownerPhone = await app.inject({
      method: 'GET',
      url: '/me/phone',
      headers: auth(owner.token)
    })
    expect(ownerPhone.json().data.phone).toBe(phone)
    // 冲突方仍未绑定
    const wxPhone = await app.inject({ method: 'GET', url: '/me/phone', headers: auth(wx.token) })
    expect(wxPhone.json().data.phone).toBe(null)
  })

  it('未绑定手机号时下单返回 409/40902，绑定后可下单', async () => {
    const app = makeApp() // mpPayMode 默认 mock：下单即发放
    const wx = await loginWechat(app, 'order-gate')

    const blocked = await app.inject({
      method: 'POST',
      url: '/membership/order',
      headers: auth(wx.token),
      payload: { skuId: 'single_pack_3', platform: 'mp-weixin' }
    })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().code).toBe(40902)

    const phone = uniqPhone('138')
    await sendCode(app, phone)
    expect((await bind(app, wx.token, phone, '123456')).statusCode).toBe(200)

    const okOrder = await app.inject({
      method: 'POST',
      url: '/membership/order',
      headers: auth(wx.token),
      payload: { skuId: 'single_pack_3', platform: 'mp-weixin' }
    })
    expect(okOrder.statusCode).toBe(200)
    expect(typeof okOrder.json().data.orderId).toBe('string')
  })
})
