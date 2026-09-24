// 认证单测：sms-code → login → me（JWT 鉴权链路）
import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

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
