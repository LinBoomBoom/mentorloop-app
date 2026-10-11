// 安全回归测试（2026-10-11 安全三件套）：
// 1) IDOR：所有按 sessionId 的接口必须校验属主，非本人统一 404
// 2) /auth/wechat：身份源门禁（头信任开关 / code2session 配置 / mock 豁免）
// 3) 短信限流与登录爆破防护
// 4) 云端启动安全守卫（assertCloudSafety）
import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

function makeApp(patch: { wxMockLogin?: boolean; trustWxHeaders?: boolean } = {}) {
  const env = loadEnv()
  env.dbPath =
    './data/test-sec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  if (patch.wxMockLogin != null) env.wxMockLogin = patch.wxMockLogin
  if (patch.trustWxHeaders != null) env.trustWxHeaders = patch.trustWxHeaders
  return buildApp({ env })
}

async function registerAndLogin(app: any, phone: string): Promise<string> {
  const r1 = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  expect(r1.json().code).toBe(0)
  const r2 = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  expect(r2.json().code).toBe(0)
  return r2.json().data.token as string
}

describe('IDOR：sessionId 属主校验', () => {
  it('非本人访问 next / answer / report 统一 404，属主正常', async () => {
    const app = makeApp()
    const phoneA = '138' + String(Date.now()).slice(-8)
    const phoneB = '139' + String(Date.now()).slice(-8)
    const tokenA = await registerAndLogin(app, phoneA)
    const tokenB = await registerAndLogin(app, phoneB)

    const s = await app.inject({
      method: 'POST',
      url: '/interview/session?mode=quick',
      headers: { authorization: 'Bearer ' + tokenA },
      payload: { positionId: 'backend', experienceLevel: 'junior', position: '后端' }
    })
    const sessionId = s.json().data.sessionId as string
    expect(typeof sessionId).toBe('string')

    // B（非属主）→ 404，防探测
    const nextB = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`,
      headers: { authorization: 'Bearer ' + tokenB }
    })
    expect(nextB.statusCode).toBe(404)
    const ansB = await app.inject({
      method: 'POST',
      url: '/interview/answer',
      headers: { authorization: 'Bearer ' + tokenB },
      payload: { sessionId, questionId: 'q-k01', text: '入侵写入', isFollowup: false }
    })
    expect(ansB.statusCode).toBe(404)
    const repB = await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + tokenB }
    })
    expect(repB.statusCode).toBe(404)

    // 属主 A 正常出题/作答/报告
    const nextA = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`,
      headers: { authorization: 'Bearer ' + tokenA }
    })
    expect(nextA.json().code).toBe(0)
    const qid = nextA.json().data.id as string
    const ansA = await app.inject({
      method: 'POST',
      url: '/interview/answer',
      headers: { authorization: 'Bearer ' + tokenA },
      payload: {
        sessionId,
        questionId: qid,
        text: '我负责设计，RT 从 300ms 降到 80ms',
        isFollowup: false
      }
    })
    expect(ansA.json().code).toBe(0)

    // 生成报告后，缓存命中分支同样不得泄漏给非属主
    const repA = await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + tokenA }
    })
    expect(repA.json().code).toBe(0)
    const repB2 = await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + tokenB }
    })
    expect(repB2.statusCode).toBe(404)
    closeDb()
  })

  it('不存在的 sessionId 同样 404（与越权不可区分）', async () => {
    const app = makeApp()
    const token = await registerAndLogin(app, '137' + String(Date.now()).slice(-8))
    const r = await app.inject({
      method: 'GET',
      url: '/interview/next?sessionId=s_not_exist&mode=quick&remainSeconds=600',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(r.statusCode).toBe(404)
    closeDb()
  })
})

describe('/auth/wechat 身份源门禁', () => {
  it('默认剥离 X-WX-OPENID 头：仅带头（伪造）无法登录', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      headers: { 'x-wx-openid': 'victim-openid' },
      payload: {}
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().message).toBe('缺少微信身份凭证')
    closeDb()
  })

  it('默认拒绝 body.code（未配置 WX_SECRET 且未开 mock）', async () => {
    const app = makeApp()
    const r = await app.inject({ method: 'POST', url: '/auth/wechat', payload: { code: 'abc' } })
    expect(r.statusCode).toBe(400)
    expect(r.json().message).toBe('微信登录未配置')
    closeDb()
  })

  it('WX_MOCK_LOGIN=true 时 code 兜底可用（本地联调）', async () => {
    const app = makeApp({ wxMockLogin: true })
    const r1 = await app.inject({ method: 'POST', url: '/auth/wechat', payload: { code: 'dev-1' } })
    expect(r1.json().code).toBe(0)
    expect(typeof r1.json().data.token).toBe('string')
    const r2 = await app.inject({ method: 'POST', url: '/auth/wechat', payload: { code: 'dev-1' } })
    // 同一 code → 同一假 openid → 同一账号（幂等）
    expect(r2.json().data.uid).toBe(r1.json().data.uid)
    closeDb()
  })

  it('TRUST_WX_HEADERS=true 时采信注入头（云托管链路）', async () => {
    const app = makeApp({ trustWxHeaders: true })
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      headers: { 'x-wx-openid': 'oWx-cloud-1' },
      payload: {}
    })
    expect(r.json().code).toBe(0)
    expect(typeof r.json().data.token).toBe('string')
    closeDb()
  })
})

describe('短信限流与登录爆破防护', () => {
  it('同一手机号 60s 内重复发码被拒绝', async () => {
    const app = makeApp()
    const phone = '136' + String(Date.now()).slice(-8)
    const r1 = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    expect(r1.json().code).toBe(0)
    const r2 = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    expect(r2.statusCode).toBe(400)
    expect(r2.json().message).toContain('频繁')
    closeDb()
  })

  it('连续登录失败达到上限后拒绝尝试', async () => {
    const app = makeApp()
    const phone = '135' + String(Date.now()).slice(-8)
    // 先发码确保记录存在（失败原因恒为验证码错误）
    await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    let blocked = false
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { phone, code: '000000' }
      })
      if (r.json().message === '尝试过于频繁，请稍后再试') {
        blocked = true
        break
      }
    }
    expect(blocked).toBe(true)
    closeDb()
  })
})

describe('云端启动安全守卫（assertCloudSafety）', () => {
  function cloudEnv() {
    const env = loadEnv()
    env.mysqlHost = '10.0.0.1'
    env.dbPath = ':memory:'
    return env
  }

  it('默认 JWT_SECRET + 万能验证码：拒绝启动', () => {
    expect(() => buildApp({ env: cloudEnv() })).toThrow(/JWT_SECRET[\s\S]*MOCK_SMS_CODE|123456/)
    closeDb()
  })

  it('WX_MOCK_LOGIN 在云模式被拒绝', () => {
    const env = cloudEnv()
    env.jwtSecret = 'a-strong-secret-for-cloud'
    env.mockSmsCode = '830211'
    env.wxMockLogin = true
    expect(() => buildApp({ env })).toThrow(/WX_MOCK_LOGIN/)
    closeDb()
  })

  it('配置齐全的云模式可正常构建', () => {
    const env = cloudEnv()
    env.jwtSecret = 'a-strong-secret-for-cloud'
    env.mockSmsCode = '830211'
    const app = buildApp({ env })
    expect(app != null).toBe(true)
    closeDb()
  })

  it('本地 SQLite（无 MYSQL_HOST）不受守卫影响', () => {
    const app = makeApp()
    expect(app != null).toBe(true)
    closeDb()
  })
})
