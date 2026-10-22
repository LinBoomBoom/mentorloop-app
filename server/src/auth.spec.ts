// 认证单测：sms-code → login → me（JWT 鉴权链路）+ 微信 session_key 链路
import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'
import { getSessionKey, getFreshSessionKey, SESSION_KEY_MAX_AGE_MS } from './services/auth.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

// wxApiFetch 读 res.status + res.text()（微信通道统一入口），测试桩需按此形态返回
function wxRes(obj: any): any {
  return { status: 200, ok: true, text: async () => JSON.stringify(obj) }
}

describe('auth 认证链路', () => {
  it('sms-code + login + /auth/me 全链路', async () => {
    const app = makeApp()
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/sms-code',
      payload: { phone: '13800000001' }
    })
    expect(r1.json().code).toBe(0)

    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13800000001', code: '123456' }
    })
    const login = r2.json()
    expect(login.code).toBe(0)
    expect(typeof login.data.token).toBe('string')
    expect(login.data.token.length).toBeGreaterThan(0)

    const r3 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer ' + login.data.token }
    })
    const me = r3.json()
    expect(me.code).toBe(0)
    expect(me.data.uid).toBe(login.data.uid)
    expect(me.data.quota.freeInterviewsLeft).toBe(3)
    closeDb()
  })

  it('错误验证码被拒绝', async () => {
    const app = makeApp()
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/sms-code',
      payload: { phone: '13800000002' }
    })
    expect(r1.json().code).toBe(0)

    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13800000002', code: '000000' }
    })
    expect(r2.statusCode).toBe(400)
    expect(r2.json().code).toBe(400)
    closeDb()
  })

  it('无 token 访问受保护接口返回业务 401', async () => {
    const app = makeApp()
    const r = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(r.statusCode).toBe(401)
    expect(r.json().code).toBe(401)
    closeDb()
  })
})

describe('微信登录与 session_key', () => {
  // 必须在 buildApp 前设置：app 层 onRequest 是否剥离 X-WX-* 头在注册时决定
  function makeWxApp() {
    const env = loadEnv()
    env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
    env.wxAppId = 'test-appid'
    env.wxSecret = 'test-secret'
    env.trustWxHeaders = true
    return buildApp({ env })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    closeDb()
  })

  it('code 换取 session_key 落库，响应与日志均不含该字段', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_code_1', session_key: 'sk_secret_1' }))
    )
    const logs: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-1' },
      headers: { 'x-wx-openid': 'o_code_1' }
    })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.code).toBe(0)
    expect(typeof body.data.token).toBe('string')
    expect(body.data.session_key).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('sk_secret_1')
    expect(logs.join(' ')).not.toContain('sk_secret_1')

    const db = (app as any).db as import('./db.js').Db
    const info = await getSessionKey(db, body.data.uid)
    expect(info?.sessionKey).toBe('sk_secret_1')
    expect(info?.updatedAt ?? 0).toBeGreaterThan(0)
  })

  it('header 与 code 换取的 openid 不一致时拒绝，且日志不含 session_key', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_code_2', session_key: 'sk_secret_2' }))
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-2' },
      headers: { 'x-wx-openid': 'o_header_2' }
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe(400)
    const logged = warn.mock.calls.map((c) => c.join(' ')).join(' ')
    expect(logged).toContain('openid mismatch')
    expect(logged).not.toContain('sk_secret_2')
  })

  it('微信返回错误码时登录失败', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ errcode: 40029, errmsg: 'invalid code' }))
    )
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'bad-code' }
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe(400)
    // 诊断口径：回包带微信 errcode（不含密钥）
    expect(r.json().message).toContain('40029')
  })

  it('jscode2session 网络失败时登录失败', async () => {
    const app = makeWxApp()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-net-fail' }
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe(400)
    expect(r.json().message).toContain('-1')
  })

  it('无 code 时 header 兜底登录，不写 session_key', async () => {
    const app = makeWxApp()
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: {},
      headers: { 'x-wx-openid': 'o_header_only' }
    })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    const db = (app as any).db as import('./db.js').Db
    expect(await getSessionKey(db, body.data.uid)).toBeNull()
  })

  it('超过新鲜度窗口的 session_key 不被返回', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_code_3', session_key: 'sk_secret_3' }))
    )
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-3' }
    })
    const body = r.json()
    const db = (app as any).db as import('./db.js').Db
    await db
      .prepare('UPDATE users SET session_key_updated_at = ? WHERE uid = ?')
      .run(Date.now() - SESSION_KEY_MAX_AGE_MS - 1000, body.data.uid)
    expect(await getFreshSessionKey(db, body.data.uid)).toBeNull()
    expect(await getSessionKey(db, body.data.uid)).not.toBeNull()
  })

  it('带 token 时把 openid/session_key 绑定到既有账号，uid 不变', async () => {
    const app = makeWxApp()
    // 1) 手机号登录（该账号无 openid/session_key）
    await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13800000011' } })
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13800000011', code: '123456' }
    })
    const phoneAuth = login.json().data
    const db = (app as any).db as import('./db.js').Db
    expect(await getSessionKey(db, phoneAuth.uid)).toBeNull()

    // 2) 虚拟支付 409 后的重登：带 token 换 code
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_bind_1', session_key: 'sk_bind_1' }))
    )
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-bind-1' },
      headers: { authorization: 'Bearer ' + phoneAuth.token }
    })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.data.uid).toBe(phoneAuth.uid)
    expect((await getSessionKey(db, phoneAuth.uid))?.sessionKey).toBe('sk_bind_1')
    const row = (await db.prepare('SELECT openid FROM users WHERE uid = ?').get(phoneAuth.uid)) as
      { openid?: string | null } | undefined
    expect(row?.openid).toBe('o_bind_1')
  })

  it('openid 被静默登录空壳占用时转移到手机号账号，uid 不变', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_shell', session_key: 'sk_shell' }))
    )
    // 1) 匿名微信登录先创建只有 openid 的空壳账号
    const first = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-shell-1' }
    })
    const shellUid = first.json().data.uid
    // 2) 手机号登录 → 带 token 绑定同一 openid
    await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13800000012' } })
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13800000012', code: '123456' }
    })
    const phoneAuth = login.json().data
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-shell-2' },
      headers: { authorization: 'Bearer ' + phoneAuth.token }
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().data.uid).toBe(phoneAuth.uid)
    const db = (app as any).db as import('./db.js').Db
    expect((await getSessionKey(db, phoneAuth.uid))?.sessionKey).toBe('sk_shell')
    const mine = (await db.prepare('SELECT openid FROM users WHERE uid = ?').get(phoneAuth.uid)) as
      { openid?: string | null } | undefined
    expect(mine?.openid).toBe('o_shell')
    const shell = (await db.prepare('SELECT openid FROM users WHERE uid = ?').get(shellUid)) as
      { openid?: string | null } | undefined
    expect(shell?.openid).toBeNull()
  })

  it('openid 被有数据的账号占用时，数据合并到手机号账号后完成绑定', async () => {
    const app = makeWxApp()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(wxRes({ openid: 'o_owned', session_key: 'sk_owned' }))
    )
    // 1) 匿名微信登录创建账号，并制造真实数据（消耗免费额度 + 一笔已支付订单）
    const first = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-owned-1' }
    })
    const wechatUid = first.json().data.uid
    const db = (app as any).db as import('./db.js').Db
    const ownerRow = (await db.prepare('SELECT id FROM users WHERE uid = ?').get(wechatUid)) as {
      id: number
    }
    await db.prepare('UPDATE users SET free_quota_used = 1 WHERE id = ?').run(ownerRow.id)
    await db
      .prepare(
        `INSERT INTO orders (id, user_id, sku_id, sku_kind, amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run('o_merge_1', ownerRow.id, 'single_pack_3', 'single', 2900, 'PAID', Date.now())

    // 2) 手机号登录 → 带 token 绑定同一 openid（应合并而不是拒绝）
    await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13800000013' } })
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13800000013', code: '123456' }
    })
    const phoneAuth = login.json().data
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'code-owned-2' },
      headers: { authorization: 'Bearer ' + phoneAuth.token }
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().data.uid).toBe(phoneAuth.uid)
    expect((await getSessionKey(db, phoneAuth.uid))?.sessionKey).toBe('sk_owned')

    const target = (await db
      .prepare('SELECT id, openid, free_quota_used FROM users WHERE uid = ?')
      .get(phoneAuth.uid)) as { id: number; openid?: string | null; free_quota_used: number }
    expect(target.openid).toBe('o_owned')
    expect(target.free_quota_used).toBe(1)
    // 订单改挂到当前账号
    const order = (await db
      .prepare('SELECT user_id FROM orders WHERE id = ?')
      .get('o_merge_1')) as {
      user_id: number
    }
    expect(order.user_id).toBe(target.id)
    // 被合并账号释放身份键
    const owner = (await db
      .prepare('SELECT openid, phone FROM users WHERE uid = ?')
      .get(wechatUid)) as { openid?: string | null; phone?: string | null }
    expect(owner.openid).toBeNull()
    expect(owner.phone).toBeNull()
  })
})
