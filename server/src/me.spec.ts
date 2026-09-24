// 我的报告历史（跨设备同步）+ 账号自助删除 单测
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

async function login(app: any, phone: string): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  return r.json().data.token
}

function auth(token: string) {
  return { authorization: 'Bearer ' + token }
}

const GOOD_ANSWER =
  '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。我对比了两个方案，权衡了风险并做了降级兜底。'

async function finishOneInterview(app: any, token: string): Promise<string> {
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
  await app.inject({
    method: 'POST',
    url: '/interview/answer',
    headers: auth(token),
    payload: { sessionId, questionId: qid, text: GOOD_ANSWER, isFollowup: false }
  })
  await app.inject({
    method: 'GET',
    url: `/report?sessionId=${sessionId}`,
    headers: auth(token)
  })
  return sessionId
}

describe('跨设备报告历史 /me/reports', () => {
  beforeEach(() => closeDb())

  it('无登录返回 401', async () => {
    const app = makeApp()
    const r = await app.inject({ method: 'GET', url: '/me/reports' })
    expect(r.json().code).toBe(401)
    closeDb()
  })

  it('生成报告后列表按时间倒序返回，overall 非空', async () => {
    const app = makeApp()
    const token = await login(app, '13900000002')

    const before = await app.inject({
      method: 'GET',
      url: '/me/reports',
      headers: auth(token)
    })
    expect(before.json().data.length).toBe(0)

    const s1 = await finishOneInterview(app, token)
    const s2 = await finishOneInterview(app, token)

    const r = await app.inject({ method: 'GET', url: '/me/reports', headers: auth(token) })
    const list = r.json().data
    expect(list.length).toBe(2)
    // 倒序：最近一场在前
    expect(list[0].sessionId).toBe(s2)
    expect(list[1].sessionId).toBe(s1)
    for (const it of list) {
      expect(typeof it.at).toBe('number')
      expect(it.report.overall.length).toBeGreaterThan(0)
      expect(it.report.dimensions.length).toBe(6)
    }
    closeDb()
  })

  it('报告对他人不可见（跨设备隔离）', async () => {
    const app = makeApp()
    const tokenA = await login(app, '13900000003')
    const tokenB = await login(app, '13900000004')
    await finishOneInterview(app, tokenA)

    const mine = await app.inject({ method: 'GET', url: '/me/reports', headers: auth(tokenA) })
    expect(mine.json().data.length).toBe(1)
    const other = await app.inject({ method: 'GET', url: '/me/reports', headers: auth(tokenB) })
    expect(other.json().data.length).toBe(0)
    closeDb()
  })
})

describe('账号自助删除 DELETE /me/account', () => {
  beforeEach(() => closeDb())

  it('无登录返回 401', async () => {
    const app = makeApp()
    const r = await app.inject({ method: 'DELETE', url: '/me/account' })
    expect(r.json().code).toBe(401)
    closeDb()
  })

  it('删除后全部业务数据清空，重复调用幂等', async () => {
    const app = makeApp()
    const token = await login(app, '13900000005')
    await finishOneInterview(app, token)

    const db = (app as any).db
    const count = (sql: string, ...args: unknown[]): number =>
      (db.prepare(sql).get(...args) as any).c as number

    expect(count('SELECT COUNT(*) AS c FROM users WHERE phone = ?', '13900000005')).toBe(1)
    expect(count('SELECT COUNT(*) AS c FROM sessions')).toBeGreaterThan(0)
    expect(count('SELECT COUNT(*) AS c FROM answers')).toBeGreaterThan(0)
    expect(count('SELECT COUNT(*) AS c FROM session_asked')).toBeGreaterThan(0)
    expect(count('SELECT COUNT(*) AS c FROM reports')).toBeGreaterThan(0)

    const r1 = await app.inject({ method: 'DELETE', url: '/me/account', headers: auth(token) })
    expect(r1.json().code).toBe(0)

    expect(count('SELECT COUNT(*) AS c FROM users WHERE phone = ?', '13900000005')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM answers')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM session_asked')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM reports')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM resumes')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM orders')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM tracking_events')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM sms_codes WHERE phone = ?', '13900000005')).toBe(0)

    // 幂等：同 token 再删仍返回 ok
    const r2 = await app.inject({ method: 'DELETE', url: '/me/account', headers: auth(token) })
    expect(r2.json().code).toBe(0)
    closeDb()
  })

  it('删除用户间隔离：只删自己的数据', async () => {
    const app = makeApp()
    const tokenA = await login(app, '13900000006')
    const tokenB = await login(app, '13900000007')
    await finishOneInterview(app, tokenA)
    await finishOneInterview(app, tokenB)

    const r = await app.inject({ method: 'DELETE', url: '/me/account', headers: auth(tokenA) })
    expect(r.json().code).toBe(0)

    const db = (app as any).db
    const count = (sql: string): number => (db.prepare(sql).get() as any).c as number
    expect(count("SELECT COUNT(*) AS c FROM users WHERE phone = '13900000006'")).toBe(0)
    expect(count("SELECT COUNT(*) AS c FROM users WHERE phone = '13900000007'")).toBe(1)
    expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(1)
    closeDb()
  })

  it('删除磁盘简历文件（original_url 为 resumes/ 前缀时）', async () => {
    const env = loadEnv()
    env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
    env.uploadDir = './data/test-uploads-' + Math.random().toString(36).slice(2, 8)
    const app = await buildApp({ env })

    const token = await login(app, '13900000008')
    const db = (app as any).db
    mkdirSync(env.uploadDir, { recursive: true })
    const rel = 'u_000008_' + Date.now() + '_resume.pdf'
    writeFileSync(env.uploadDir + '/' + rel, 'fake-pdf')
    db.prepare(
      `INSERT INTO resumes (user_id, original_url, parse_payload, optimize_payload, created_at)
       VALUES ((SELECT id FROM users WHERE uid = (SELECT uid FROM users WHERE phone = '13900000008')), ?, NULL, NULL, ?)`
    ).run('resumes/' + rel, Date.now())

    const filePath = env.uploadDir + '/' + rel
    expect(existsSync(filePath)).toBe(true)

    const r = await app.inject({ method: 'DELETE', url: '/me/account', headers: auth(token) })
    expect(r.json().code).toBe(0)
    expect(existsSync(filePath)).toBe(false)
    expect((db.prepare('SELECT COUNT(*) AS c FROM resumes').get() as any).c).toBe(0)
    closeDb()
  })
})
