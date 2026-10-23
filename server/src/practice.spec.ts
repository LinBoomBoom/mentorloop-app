// 做题模式取题单测（契约 2026-10-23-practice-subtrack）
// 覆盖：细分领域过滤 / 精确难度 / 旧调用兼容 / 未知细分领域返回空 / 非法难度 400
// 追加：做题记录 / SRS / 错题本 / 跨设备同步（契约 2026-10-23-practice-sync）
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

let seq = 0

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any): Promise<string> {
  seq++
  const phone = '134' + String(Date.now()).slice(-6) + String(seq).padStart(2, '0')
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

describe('做题记录 / SRS / 跨设备同步', () => {
  const DAY = 86400000

  beforeEach(() => closeDb())
  afterEach(() => closeDb())

  async function firstQuestion(app: any, token: string): Promise<any> {
    const r = await ask(app, token, {
      positionId: 'backend',
      experienceLevel: 'junior',
      subtrack: 'be-db',
      difficulty: 'senior',
      count: 1
    })
    return r.json().data.questions[0]
  }

  function post(app: any, token: string, records: any[]) {
    return app.inject({
      method: 'POST',
      url: '/practice/records',
      headers: token.length > 0 ? { authorization: 'Bearer ' + token } : {},
      payload: { records }
    })
  }

  it('未登录写入记录返回 401', async () => {
    const app = makeApp()
    const r = await post(app, '', [
      { questionId: 'x', subtrack: 'be-db', difficulty: 'senior', result: 'unknown' }
    ])
    expect(r.statusCode).toBe(401)
    expect(r.json().code).toBe(401)
  })

  it('「不会」入错题本与到期队列，「会」移出错题本并累加 attempts', async () => {
    const app = makeApp()
    const token = await login(app)
    const q = await firstQuestion(app, token)

    const r1 = await post(app, token, [
      {
        questionId: q.id,
        subtrack: q.subAbility,
        difficulty: q.difficulty,
        result: 'unknown',
        answeredAt: Date.now() - 3 * DAY
      }
    ])
    const s1 = r1.json().data.summary
    expect(s1.total).toBe(1)
    expect(s1.unknown).toBe(1)
    expect(s1.wrongCount).toBe(1)
    expect(s1.dueCount).toBe(1)

    const wrong = await app.inject({
      method: 'GET',
      url: '/practice/wrong',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(wrong.json().data.questions.length).toBe(1)
    expect(wrong.json().data.questions[0].id).toBe(q.id)

    const due = await app.inject({
      method: 'GET',
      url: '/practice/due?subtrack=be-db',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(due.json().data.dueCount).toBe(1)
    expect(due.json().data.questions[0].id).toBe(q.id)

    const r2 = await post(app, token, [
      {
        questionId: q.id,
        subtrack: q.subAbility,
        difficulty: q.difficulty,
        result: 'known'
      }
    ])
    const s2 = r2.json().data.summary
    expect(s2.known).toBe(1)
    expect(s2.unknown).toBe(0)
    expect(s2.wrongCount).toBe(0)
    expect(s2.dueCount).toBe(0)

    const records = await app.inject({
      method: 'GET',
      url: '/practice/records',
      headers: { authorization: 'Bearer ' + token }
    })
    const rec = records.json().data.records[0]
    expect(rec.attempts).toBe(2)
    expect(rec.result).toBe('known')
    expect(rec.intervalDays).toBe(1)

    const wrong2 = await app.inject({
      method: 'GET',
      url: '/practice/wrong',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(wrong2.json().data.questions.length).toBe(0)
  })

  it('跨用户隔离：另一账号看不到本题记录与错题', async () => {
    const app = makeApp()
    const tokenA = await login(app)
    const q = await firstQuestion(app, tokenA)
    await post(app, tokenA, [
      { questionId: q.id, subtrack: q.subAbility, difficulty: q.difficulty, result: 'unknown' }
    ])

    const tokenB = await login(app)
    const summaryB = await app.inject({
      method: 'GET',
      url: '/practice/summary',
      headers: { authorization: 'Bearer ' + tokenB }
    })
    expect(summaryB.json().data.summary.total).toBe(0)
    const wrongB = await app.inject({
      method: 'GET',
      url: '/practice/wrong',
      headers: { authorization: 'Bearer ' + tokenB }
    })
    expect(wrongB.json().data.questions.length).toBe(0)
  })

  it('过期补传不覆盖较新记录', async () => {
    const app = makeApp()
    const token = await login(app)
    const q = await firstQuestion(app, token)
    const base = {
      questionId: q.id,
      subtrack: q.subAbility,
      difficulty: q.difficulty
    }
    await post(app, token, [{ ...base, result: 'known', answeredAt: Date.now() }])
    await post(app, token, [{ ...base, result: 'unknown', answeredAt: Date.now() - 5 * DAY }])

    const summary = await app.inject({
      method: 'GET',
      url: '/practice/summary',
      headers: { authorization: 'Bearer ' + token }
    })
    expect(summary.json().data.summary.known).toBe(1)
    expect(summary.json().data.summary.unknown).toBe(0)
  })
})
