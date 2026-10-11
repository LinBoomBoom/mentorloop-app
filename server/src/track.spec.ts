// 埋点链路回归（2026-10-12 P0 修复）：
// 1) /track/batch 加鉴权（匿名通道此前可被公网刷爆）
// 2) uid 解析为 users.id 数值入库（此前字符串直插 BIGINT，MySQL 严格模式
//    报 1265 被 catch 吞 → 云端埋点 100% 静默丢失）
// 3) 批量与单条上限
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { getDb, closeDb } from './db.js'

let dbPath = ''

function makeApp() {
  const env = loadEnv()
  env.dbPath =
    './data/test-track-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  dbPath = env.dbPath
  return buildApp({ env })
}

async function registerAndToken(app: any, phone: string): Promise<{ token: string; uid: string }> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  return { token: r.json().data.token, uid: r.json().data.uid as string }
}

describe('/track/batch 鉴权与入库', () => {
  beforeEach(() => closeDb())

  it('匿名请求被拒绝（401）', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      payload: { events: ['{"event":"app_launch"}'] }
    })
    expect(r.statusCode).toBe(401)
    closeDb()
  })

  it('已注册用户：uid 解析为数值 user_id 入库（云端 MySQL 不再丢数据）', async () => {
    const app = makeApp()
    const { token, uid } = await registerAndToken(app, '138' + String(Date.now()).slice(-8))
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { authorization: 'Bearer ' + token },
      payload: {
        events: [
          JSON.stringify({ event: 'app_launch', userId: uid, platform: 'app', timestamp: 1 }),
          JSON.stringify({ event: 'interview_start', userId: uid, sessionId: 's_1', mode: 'quick' })
        ]
      }
    })
    expect(r.json().code).toBe(0)
    const db = getDb(dbPath)
    const rows = (await db
      .prepare('SELECT user_id, event, payload FROM tracking_events ORDER BY id')
      .all()) as any[]
    expect(rows.length).toBe(2)
    // user_id 必须是数值（users.id），不是 'u_xxx' 字符串
    expect(typeof rows[0].user_id).toBe('number')
    expect(rows[0].user_id as number).toBeGreaterThan(0)
    expect(rows[1].event).toBe('interview_start')
    // body.userId 不入 payload（身份以鉴权 uid 为准）
    expect(String(rows[0].payload).indexOf('userId') === -1).toBe(true)
    closeDb()
  })

  it('未注册 uid：事件仍入库（user_id 为 NULL，不丢数据）', async () => {
    const app = makeApp()
    // 直接签发 token（不注册用户）；register 异步，ready 后 jwt 装饰器才可用
    await app.ready()
    const token = (app as any).jwt.sign({ uid: 'u_ghost_1' })
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { authorization: 'Bearer ' + token },
      payload: { events: ['{"event":"app_launch"}'] }
    })
    expect(r.json().code).toBe(0)
    const db = getDb(dbPath)
    const rows = (await db.prepare('SELECT user_id FROM tracking_events').all()) as any[]
    expect(rows.length).toBe(1)
    expect(rows[0].user_id == null).toBe(true)
    closeDb()
  })

  it('超过 100 条/批被拒绝（400）', async () => {
    const app = makeApp()
    await app.ready()
    const token = (app as any).jwt.sign({ uid: 'u_ghost_2' })
    const events: string[] = []
    for (let i = 0; i < 101; i++) events.push('{"event":"e"}')
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { authorization: 'Bearer ' + token },
      payload: { events }
    })
    // 全局错误处理器把 4xx 压为 HTTP 200 + 业务码 400
    expect(r.json().code).toBe(400)
    closeDb()
  })

  it('单条超 4096 字符被拒绝（400）', async () => {
    const app = makeApp()
    await app.ready()
    const token = (app as any).jwt.sign({ uid: 'u_ghost_3' })
    const big = '{"event":"e","pad":"' + 'x'.repeat(5000) + '"}'
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { authorization: 'Bearer ' + token },
      payload: { events: [big] }
    })
    expect(r.json().code).toBe(400)
    closeDb()
  })
})
