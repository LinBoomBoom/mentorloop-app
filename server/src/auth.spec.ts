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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openid: 'o_code_1', session_key: 'sk_secret_1' })
      })
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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openid: 'o_code_2', session_key: 'sk_secret_2' })
      })
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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 40029, errmsg: 'invalid code' })
      })
    )
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'bad-code' }
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe(400)
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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openid: 'o_code_3', session_key: 'sk_secret_3' })
      })
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
})
