// 桌面账号互通单测：vip 解析/映射 + 绑定同步（stub 网关）+ 开关语义 + SQLite 容错
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv, Env } from './config.js'
import { getDb, closeDb, Db } from './db.js'
import {
  LONG_TERM_VIP_UNTIL,
  parseDesktopVip,
  desktopMemberUntil,
  createDesktopGateway,
  syncDesktopLink,
  DesktopIdentity
} from './services/desktop-link.js'
import type { UserRow } from './services/auth.js'

describe('桌面 vip 解析与映射（parseDesktopVip / desktopMemberUntil）', () => {
  it('字符串/对象/空值/坏 JSON 全容错', () => {
    expect(parseDesktopVip(null)).toEqual({ level: 0, expireAt: null })
    expect(parseDesktopVip('')).toEqual({ level: 0, expireAt: null })
    expect(parseDesktopVip('not-json')).toEqual({ level: 0, expireAt: null })
    expect(parseDesktopVip('{"level":1,"expireAt":1893456000000}')).toEqual({
      level: 1,
      expireAt: 1893456000000
    })
    // 桌面列为 MySQL JSON 类型：mysql2 可能已解析为对象
    expect(parseDesktopVip({ level: 3, expireAt: null })).toEqual({ level: 3, expireAt: null })
  })

  it('映射规则与桌面 effectiveVip 同义：level>0 且未过期；expireAt 空=长期；过期=0', () => {
    const future = Date.now() + 86400000
    const past = Date.now() - 86400000
    expect(desktopMemberUntil({ level: 1, expireAt: future })).toBe(future)
    expect(desktopMemberUntil({ level: 1, expireAt: past })).toBe(0)
    expect(desktopMemberUntil({ level: 1, expireAt: null })).toBe(LONG_TERM_VIP_UNTIL)
    expect(desktopMemberUntil({ level: 0, expireAt: future })).toBe(0)
    expect(desktopMemberUntil(null)).toBe(0)
    expect(desktopMemberUntil('garbage')).toBe(0)
  })
})

describe('syncDesktopLink 绑定与权益同步（stub 网关）', () => {
  let db: Db

  function makeGateway(hits: DesktopIdentity[], by: 'phone' | 'openid' = 'phone') {
    let calls = 0
    return {
      get calls() {
        return calls
      },
      findUsersByPhone: async (_p: string) => {
        calls++
        return by === 'phone' ? hits : []
      },
      findUsersByWechatOpenid: async (_o: string) => {
        calls++
        return by === 'openid' ? hits : []
      }
    }
  }

  async function insertUser(
    phone: string | null,
    memberUntil: number | null,
    openid: string | null = null
  ): Promise<UserRow> {
    const t = Date.now()
    const uid = 'u_dl_' + Math.random().toString(36).slice(2, 10)
    await db
      .prepare(
        `INSERT INTO users (uid, phone, openid, nickname, channel, free_quota_total, free_quota_used,
         single_quota_total, single_quota_used, member_until, desktop_user_id, created_at, updated_at)
         VALUES (?, ?, ?, '互通测试', 'phone', 3, 0, 0, 0, ?, NULL, ?, ?)`
      )
      .run(uid, phone, openid, memberUntil, t, t)
    return (await db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)) as UserRow
  }

  beforeAll(() => {
    const env = loadEnv()
    env.dbPath =
      './data/test-dl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
    db = getDb(env.dbPath)
  })

  afterAll(() => {
    closeDb()
  })

  it('唯一手机号命中：写 desktop_user_id + member_until=桌面 expireAt', async () => {
    const future = Date.now() + 86400000
    const user = await insertUser('13811110001', null)
    await syncDesktopLink(
      db,
      makeGateway([{ id: 'd_u_1', vip: { level: 1, expireAt: future } }]),
      user
    )
    const row = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(row.desktop_user_id).toBe('d_u_1')
    expect(row.member_until).toBe(future)
  })

  it('桌面非会员：只绑定身份，不动本地权益', async () => {
    const user = await insertUser('13811110002', null)
    await syncDesktopLink(
      db,
      makeGateway([{ id: 'd_u_2', vip: { level: 0, expireAt: null } }]),
      user
    )
    const row = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(row.desktop_user_id).toBe('d_u_2')
    expect(row.member_until).toBeNull()
  })

  it('权益取 max：本地更晚的 member_until 不回退', async () => {
    const later = Date.now() + 90 * 86400000
    const sooner = Date.now() + 30 * 86400000
    const user = await insertUser('13811110003', later)
    await syncDesktopLink(
      db,
      makeGateway([{ id: 'd_u_3', vip: { level: 1, expireAt: sooner } }]),
      user
    )
    const row = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(row.member_until).toBe(later)
  })

  it('多命中放弃绑定；零命中不动任何字段', async () => {
    const user1 = await insertUser('13811110004', null)
    await syncDesktopLink(
      db,
      makeGateway([
        { id: 'd_a', vip: { level: 1, expireAt: Date.now() + 86400000 } },
        { id: 'd_b', vip: { level: 1, expireAt: Date.now() + 86400000 } }
      ]),
      user1
    )
    const row1 = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user1.uid)) as UserRow
    expect(row1.desktop_user_id).toBeNull()
    expect(row1.member_until).toBeNull()

    const user2 = await insertUser('13811110005', null)
    await syncDesktopLink(db, makeGateway([]), user2)
    const row2 = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user2.uid)) as UserRow
    expect(row2.desktop_user_id).toBeNull()
    expect(row2.member_until).toBeNull()
  })

  it('幂等：重复调用结果一致，不再触发 UPDATE（幂等语义靠字段比对短路）', async () => {
    const future = Date.now() + 86400000
    const user = await insertUser('13811110006', null)
    const gw = makeGateway([{ id: 'd_u_6', vip: { level: 1, expireAt: future } }])
    await syncDesktopLink(db, gw, user)
    const first = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    await syncDesktopLink(db, gw, user)
    const second = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(second.desktop_user_id).toBe('d_u_6')
    expect(second.member_until).toBe(first.member_until)
    expect(second.updated_at).toBe(first.updated_at)
  })

  it('openid 路径（预留）：无手机号用户走 auth_identities 绑定', async () => {
    const user = await insertUser(null, null, 'o_wx_123')
    await syncDesktopLink(
      db,
      makeGateway([{ id: 'd_u_7', vip: { level: 3, expireAt: null } }], 'openid'),
      user
    )
    const row = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(row.desktop_user_id).toBe('d_u_7')
    expect(row.member_until).toBe(LONG_TERM_VIP_UNTIL)
  })

  it('网关为 null（互通关闭）时零调用零写入', async () => {
    const user = await insertUser('13811110008', null)
    await syncDesktopLink(db, null, user)
    const row = (await db.prepare('SELECT * FROM users WHERE uid = ?').get(user.uid)) as UserRow
    expect(row.desktop_user_id).toBeNull()
    expect(row.member_until).toBeNull()
  })
})

describe('网关开关与容错', () => {
  it('DESKTOP_DB_NAME 为空或非法标识符 → 网关为 null（互通关闭）', () => {
    const db = getDb(':memory:')
    const env: Env = loadEnv()
    env.desktopDbName = ''
    expect(createDesktopGateway(db, env)).toBeNull()
    env.desktopDbName = 'mentor;drop'
    expect(createDesktopGateway(db, env)).toBeNull()
    env.desktopDbName = 'mentorloop'
    expect(createDesktopGateway(db, env)).not.toBeNull()
    closeDb()
  })

  it('SQLite 下配置了桌面库：跨库查询失败被吞掉，登录链路不受影响（集成容错）', async () => {
    const env: Env = loadEnv()
    env.dbPath =
      './data/test-dl-int-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
    env.desktopDbName = 'mentorloop' // 本地 SQLite 无此库：SELECT 必然失败，必须不炸
    const app = buildApp({ env })
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/sms-code',
      payload: { phone: '13822220001' }
    })
    expect(r1.json().code).toBe(0)
    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13822220001', code: '123456' }
    })
    expect(r2.json().code).toBe(0)
    // 桌面无此用户 → 不绑定（SQLite 查询异常已被 syncDesktopLink 吞掉）
    const r3 = await app.inject({
      method: 'GET',
      url: '/membership/quota',
      headers: { authorization: 'Bearer ' + r2.json().data.token }
    })
    expect(r3.json().code).toBe(0)
    expect(r3.json().data.memberUntil).toBe(0)
    closeDb()
  })
})
