// 专项训练取题单测（契约：docs/contracts/2026-10-22-training-online-question-bank.freeze.md）
// 数据源必须是 questions 内容库（fixture 自举），不得回退本地静态题库。
import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any, phone: string): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: phone, code: '123456' }
  })
  return r.json().data.token as string
}

describe('training 取题链路', () => {
  it('从内容库按岗位与能力域返回训练题', async () => {
    const app = makeApp()
    const token = await login(app, '13800001001')
    const r = await app.inject({
      method: 'POST',
      url: '/training/questions',
      headers: { authorization: 'Bearer ' + token },
      payload: {
        positionId: 'frontend',
        experienceLevel: 'junior',
        domain: 'knowledge',
        count: 3
      }
    })
    const body = r.json()
    expect(body.code).toBe(0)
    const questions = body.data.questions as any[]
    expect(Array.isArray(questions)).toBe(true)
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.length).toBeLessThanOrEqual(3)
    for (const q of questions) {
      expect(typeof q.id).toBe('string')
      // 内容库 id（fq1 / rq-f-... ）；静态题库 id 形如 q-k01 / f-k01
      expect(q.id.startsWith('q-')).toBe(false)
      expect(q.id.startsWith('f-')).toBe(false)
      expect(q.positionId).toBe('frontend')
      expect(q.abilityDomain).toBe('knowledge')
      expect(q.content.length).toBeGreaterThan(0)
    }
    closeDb()
  })

  it('缺少鉴权返回 401', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/training/questions',
      payload: {
        positionId: 'backend',
        experienceLevel: 'junior',
        domain: '',
        count: 3
      }
    })
    expect(r.json().code).toBe(401)
    closeDb()
  })
})
