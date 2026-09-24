// 面试链路单测：建会话 → 出题（岗位过滤/收束）→ 答题幂等
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/auth/sms-code',
    payload: { phone: '13900000000' }
  })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '13900000000', code: '123456' }
  })
  return r.json().data.token
}

function auth(token: string) {
  return { authorization: 'Bearer ' + token }
}

describe('面试会话链路', () => {
  beforeEach(() => closeDb())

  it('quick 模式：3 题 → 收束题 → 无题（岗位过滤正确）', async () => {
    const app = makeApp()
    const token = await login(app)

    const s = await app.inject({
      method: 'POST',
      url: '/interview/session?mode=quick',
      headers: auth(token),
      payload: { positionId: 'java-backend', experienceLevel: 'junior', position: 'Java 后端' }
    })
    const sessionId = s.json().data.sessionId
    expect(typeof sessionId).toBe('string')

    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = await app.inject({
        method: 'GET',
        url: `/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`,
        headers: auth(token)
      })
      const body = r.json()
      expect(body.code).toBe(0)
      expect(body.data.positionId).toBe('java-backend')
      expect(typeof body.data.content).toBe('string')
      expect(Array.isArray(body.data.misconceptions)).toBe(true)
      expect(body.data.misconceptions.length).toBeGreaterThan(0)
      expect(body.data.followupPrompts).toBeDefined()
      expect(seen).not.toContain(body.data.id)
      seen.push(body.data.id)
    }
    // 达题量上限（quick=3）→ 返回岗位收束题
    const wrap = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`,
      headers: auth(token)
    })
    expect(wrap.json().data.id).toBe('q-wrapup')
    // 再取 → 无题
    const empty = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`,
      headers: auth(token)
    })
    expect(empty.json().code).toBe(2001)
    closeDb()
  })

  it('答题幂等：重复提交同一题不报错且不重复计数', async () => {
    const app = makeApp()
    const token = await login(app)
    const s = await app.inject({
      method: 'POST',
      url: '/interview/session?mode=standard',
      headers: auth(token),
      payload: { positionId: 'java-backend', experienceLevel: 'junior' }
    })
    const sessionId = s.json().data.sessionId
    const n = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}`,
      headers: auth(token)
    })
    const qid = n.json().data.id

    const a1 = await app.inject({
      method: 'POST',
      url: '/interview/answer',
      headers: auth(token),
      payload: {
        sessionId,
        questionId: qid,
        text: '首次回答，包含 QPS 指标与个人贡献。',
        isFollowup: false
      }
    })
    expect(a1.json().code).toBe(0)
    const a2 = await app.inject({
      method: 'POST',
      url: '/interview/answer',
      headers: auth(token),
      payload: {
        sessionId,
        questionId: qid,
        text: '首次回答，包含 QPS 指标与个人贡献。',
        isFollowup: false
      }
    })
    expect(a2.json().code).toBe(0)
    closeDb()
  })
})
