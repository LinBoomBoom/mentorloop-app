// 报告与配额单测：答题 → 报告生成（幂等、六维结构）→ 面试额度扣减
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
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13900000001' } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '13900000001', code: '123456' }
  })
  return r.json().data.token
}

const GOOD_ANSWER =
  '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。我对比了两个方案，权衡了风险并做了降级兜底。中间遇到过线上故障，我做了复盘并加了监控。'

describe('报告与配额', () => {
  beforeEach(() => closeDb())

  it('答题后生成合法报告（六维、等级在 A-D 间），重复生成幂等', async () => {
    const app = makeApp()
    const token = await login(app)
    const s = await app.inject({
      method: 'POST',
      url: '/interview/session?mode=standard',
      headers: { authorization: 'Bearer ' + token },
      payload: { positionId: 'java-backend', experienceLevel: 'junior' }
    })
    const sessionId = s.json().data.sessionId

    // 答 4 题（覆盖多能力域）
    for (let i = 0; i < 4; i++) {
      const n = await app.inject({
        method: 'GET',
        url: `/interview/next?sessionId=${sessionId}`,
        headers: { authorization: 'Bearer ' + token }
      })
      const qid = n.json().data.id
      await app.inject({
        method: 'POST',
        url: '/interview/answer',
        headers: { authorization: 'Bearer ' + token },
        payload: { sessionId, questionId: qid, text: GOOD_ANSWER, isFollowup: false }
      })
    }

    const r = await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + token }
    })
    const report = r.json().data
    expect(report).not.toBeNull()
    expect(report.overall.length).toBeGreaterThan(0)
    expect(report.dimensions.length).toBe(6)
    for (const d of report.dimensions) {
      expect(['A', 'B', 'C', 'D']).toContain(d.level)
      expect(typeof d.confidence).toBe('number')
      expect(Array.isArray(d.suggestQuestions)).toBe(true)
    }
    expect(report.trainingPlan.length).toBeGreaterThan(0)

    // 幂等：二次获取结构与首次一致且不重复扣减
    const r2 = await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + token }
    })
    expect(JSON.stringify(r2.json().data)).toBe(JSON.stringify(report))
    closeDb()
  })

  it('完成一场面试后免费额度从 3 → 2', async () => {
    const app = makeApp()
    const token = await login(app)
    const q0 = await app.inject({
      method: 'GET',
      url: '/membership/quota',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(q0.json().data.freeInterviewsLeft).toBe(3)

    const s = await app.inject({
      method: 'POST',
      url: '/interview/session?mode=quick',
      headers: { authorization: 'Bearer ' + token },
      payload: { positionId: 'java-backend', experienceLevel: 'junior' }
    })
    const sessionId = s.json().data.sessionId
    const n = await app.inject({
      method: 'GET',
      url: `/interview/next?sessionId=${sessionId}&mode=quick`,
      headers: { authorization: 'Bearer ' + token }
    })
    const qid = n.json().data.id
    await app.inject({
      method: 'POST',
      url: '/interview/answer',
      headers: { authorization: 'Bearer ' + token },
      payload: { sessionId, questionId: qid, text: GOOD_ANSWER, isFollowup: false }
    })
    await app.inject({
      method: 'GET',
      url: `/report?sessionId=${sessionId}`,
      headers: { authorization: 'Bearer ' + token }
    })

    const q1 = await app.inject({
      method: 'GET',
      url: '/membership/quota',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(q1.json().data.freeInterviewsLeft).toBe(2)
    closeDb()
  })
})
