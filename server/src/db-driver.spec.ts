// db-driver 单测：方言翻译 / 参数归一 / 双驱动接口形态一致性 + /auth/wechat 双鉴权源（冻结 §4 对账）
import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { translateSql, quoteReserved, normalizeParams, createSqliteDriver } from './db-driver.js'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

describe('translateSql 方言翻译（SQLite → MySQL）', () => {
  it('INSERT OR IGNORE / INSERT OR REPLACE', () => {
    expect(translateSql('INSERT OR IGNORE INTO t (a) VALUES (?)')).toBe(
      'INSERT IGNORE INTO t (a) VALUES (?)'
    )
    expect(translateSql('INSERT OR REPLACE INTO t (a) VALUES (?)')).toBe(
      'REPLACE INTO t (a) VALUES (?)'
    )
  })

  it('ON CONFLICT upsert → ON DUPLICATE KEY UPDATE + VALUES(col)', () => {
    const sql =
      'INSERT INTO sms_codes (phone, code, expires_at, consumed) VALUES (?, ?, ?, 0) ' +
      'ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, consumed = 0'
    const out = translateSql(sql)
    expect(out).toContain('ON DUPLICATE KEY UPDATE')
    expect(out).toContain('code = VALUES(code)')
    expect(out).toContain('expires_at = VALUES(expires_at)')
    expect(out).toContain('consumed = 0')
    expect(out).not.toContain('ON CONFLICT')
    expect(out).not.toContain('excluded')
  })

  it('ORDER BY rowid → ORDER BY id', () => {
    expect(translateSql('SELECT * FROM t ORDER BY rowid')).toBe('SELECT * FROM t ORDER BY id')
  })

  it('保留字反引号化，且不误伤字符串字面量', () => {
    expect(quoteReserved('SELECT "desc" FROM t')).toBe('SELECT `desc` FROM t')
    expect(quoteReserved('SELECT * FROM t WHERE note = \'he said "hi"\'')).toBe(
      'SELECT * FROM t WHERE note = \'he said "hi"\''
    )
  })
})

describe('normalizeParams 参数归一', () => {
  it('undefined → null', async () => {
    expect(await normalizeParams('INSERT INTO t VALUES (?, ?)', ['a', undefined])).toEqual([
      'a',
      null
    ])
  })

  it('LIMIT ? 数字字符串 → Number；普通字符串主键不动', async () => {
    expect(await normalizeParams('SELECT * FROM t LIMIT ?', ['10'])).toEqual([10])
    expect(await normalizeParams('SELECT * FROM t WHERE id = ? LIMIT ?', ['o_123', '5'])).toEqual([
      'o_123',
      5
    ])
  })
})

describe('sqlite 驱动（本地直通）接口形态', () => {
  it('get/all/run/exec 形态一致，run 归一为 {changes,lastInsertRowid} 数字', async () => {
    const raw = new DatabaseSync(':memory:')
    const db = createSqliteDriver(raw)
    expect(db.driver).toBe('sqlite')
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    const r = await db.prepare('INSERT INTO t (name) VALUES (?)').run('x')
    expect(r.changes).toBe(1)
    expect(r.lastInsertRowid).toBe(1)
    expect(typeof r.changes).toBe('number')
    const row = await db.prepare('SELECT * FROM t WHERE id = ?').get(1)
    expect(row.name).toBe('x')
    const rows = await db.prepare('SELECT * FROM t').all()
    expect(rows.length).toBe(1)
    expect(await db.prepare('SELECT * FROM t WHERE id = ?').get(999)).toBeUndefined()
    raw.close()
  })

  it('transaction：fn 内语句原子提交', async () => {
    const raw = new DatabaseSync(':memory:')
    const db = createSqliteDriver(raw)
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    await db.transaction(async () => {
      await db.prepare('INSERT INTO t (name) VALUES (?)').run('a')
      await db.prepare('INSERT INTO t (name) VALUES (?)').run('b')
    })()
    expect((await db.prepare('SELECT COUNT(*) AS c FROM t').get()).c).toBe(2)
    raw.close()
  })

  it('transaction：fn 抛错回滚', async () => {
    const raw = new DatabaseSync(':memory:')
    const db = createSqliteDriver(raw)
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    await expect(
      db.transaction(async () => {
        await db.prepare('INSERT INTO t (name) VALUES (?)').run('a')
        throw new Error('boom')
      })()
    ).rejects.toThrow('boom')
    expect((await db.prepare('SELECT COUNT(*) AS c FROM t').get()).c).toBe(0)
    raw.close()
  })

  it('transaction 嵌套：内层复用外层事务（不另起 BEGIN）', async () => {
    const raw = new DatabaseSync(':memory:')
    const db = createSqliteDriver(raw)
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    await db.transaction(async () => {
      await db.prepare('INSERT INTO t (name) VALUES (?)').run('a')
      await db.transaction(async () => {
        await db.prepare('INSERT INTO t (name) VALUES (?)').run('b')
      })()
      // 若内层另起 BEGIN 此处 SQLite 会因嵌套事务报错
    })()
    expect((await db.prepare('SELECT COUNT(*) AS c FROM t').get()).c).toBe(2)
    raw.close()
  })
})

// 冻结 §2.2/§4.2：/auth/wechat 两种鉴权源各自可用且出参同形
describe('/auth/wechat 双鉴权源', () => {
  beforeEach(() => closeDb())

  function makeApp() {
    const env = loadEnv()
    env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
    return buildApp({ env })
  }

  it('X-WX-OPENID 头直登（callContainer 私有链路），出参 {uid,nickname,token}', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      headers: { 'x-wx-openid': 'oXyz-header-openid' },
      payload: {}
    })
    const body = r.json()
    expect(body.code).toBe(0)
    expect(body.data.uid).toBeTruthy()
    expect(typeof body.data.nickname).toBe('string')
    expect(typeof body.data.token).toBe('string')

    // 同一 openid 二次登录 → 同一用户（uid 幂等）
    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      headers: { 'x-wx-openid': 'oXyz-header-openid' },
      payload: {}
    })
    expect(r2.json().data.uid).toBe(body.data.uid)
    closeDb()
  })

  it('body.code 兜底（mock：wx_ + code 作 openid），出参同形', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'mock-code-1' }
    })
    const body = r.json()
    expect(body.code).toBe(0)
    expect(typeof body.data.token).toBe('string')

    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/wechat',
      payload: { code: 'mock-code-1' }
    })
    expect(r2.json().data.uid).toBe(body.data.uid)
    closeDb()
  })

  it('头与 code 都缺失 → 业务 400', async () => {
    const app = makeApp()
    const r = await app.inject({ method: 'POST', url: '/auth/wechat', payload: {} })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe(400)
    closeDb()
  })
})
