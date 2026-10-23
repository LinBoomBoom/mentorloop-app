// 做题模式取题单测（契约 2026-10-23-practice-subtrack）
// 覆盖：细分领域过滤 / 精确难度 / 旧调用兼容 / 未知细分领域返回空 / 非法难度 400
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any): Promise<string> {
  const phone = '134' + String(Date.now()).slice(-8)
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  return r.json().data.token
}

async function ask(app: any, token: string, body: any) {
  return app.inject({
    method: 'POST',
    url: '/training/questions',
    headers: { authorization: 'Bearer ' + token },
    payload: body
  })
}

describe('做题模式 /training/questions', () => {
  beforeEach(() => closeDb())
  afterEach(() => closeDb())

  it('细分领域 + 精确难度：返回题目全部匹配', async () => {
    const app = makeApp()
    const token = await login(app)
    const r = await ask(app, token, {
      positionId: 'backend',
      experienceLevel: 'junior', // 旧白名单只到 mid；精确难度应覆盖
      subtrack: 'be-db',
      difficulty: 'senior',
      count: 5
    })
    const body = r.json()
    expect(body.code).toBe(0)
    const qs = body.data.questions
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(q.subAbility).toBe('be-db')
      expect(q.difficulty).toBe('senior')
    }
  })

  it('旧调用（不传 subtrack/difficulty）行为不变', async () => {
    const app = makeApp()
    const token = await login(app)
    const r = await ask(app, token, {
      positionId: 'frontend',
      experienceLevel: 'junior',
      count: 3
    })
    const body = r.json()
    expect(body.code).toBe(0)
    expect(body.data.questions.length).toBeGreaterThan(0)
  })

  it('未知细分领域返回空数组，不报 500', async () => {
    const app = makeApp()
    const token = await login(app)
    const r = await ask(app, token, {
      positionId: 'backend',
      experienceLevel: 'junior',
      subtrack: 'not-a-subtrack',
      count: 3
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().data.questions.length).toBe(0)
  })

  it('非法难度被 schema 拒绝（400）', async () => {
    const app = makeApp()
    const token = await login(app)
    const r = await ask(app, token, {
      positionId: 'backend',
      experienceLevel: 'junior',
      difficulty: 'expert',
      count: 3
    })
    // 统一响应：schema 失败以 HTTP 200 + 业务码 400 返回
    expect(r.statusCode).toBe(200)
    expect(r.json().code).toBe(400)
  })
})
