// DB 连接层：双驱动（本地 node:sqlite ↔ 云端 mysql2），接口统一 Promise 化。
// 驱动选择：传入 mysql 配置（MYSQL_HOST 存在时由 app.ts 注入）→ 云端 mysql2 连接池，
// schema 由 deploy/cloud/baseline-mp-mysql.sql 外部建库，不做自举；否则本地 node:sqlite 直通。
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createSqliteDriver,
  createMysqlDriver,
  type DbDriver,
  type MysqlConfig
} from './db-driver.js'
import {
  mapRawQuestion,
  questionParams,
  QUESTION_UPSERT_SQL,
  type RawQuestion
} from './services/content-mapper.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let instance: Db | null = null
let instanceKey = ''

export class Db {
  readonly driver: 'sqlite' | 'mysql'
  private d: DbDriver

  constructor(path: string, mysql: MysqlConfig | null) {
    if (mysql != null) {
      this.driver = 'mysql'
      this.d = createMysqlDriver(mysql)
    } else {
      this.driver = 'sqlite'
      const raw = new DatabaseSync(path)
      raw.exec('PRAGMA journal_mode = WAL;')
      raw.exec('PRAGMA foreign_keys = ON;')
      const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
      raw.exec(schema)
      this.migrate(raw)
      // 内存库（单测自备数据）不灌 fixture；文件库（本地开发/集成测试）自举内容库
      if (path !== ':memory:') this.seedQuestions(raw)
      this.d = createSqliteDriver(raw)
    }
  }

  // 轻量列迁移（仅本地 SQLite）：兼容升级前创建的旧库（新库 CREATE TABLE 已含新列，ALTER 重复会被忽略）
  private migrate(raw: DatabaseSync): void {
    try {
      raw.exec('ALTER TABLE orders ADD COLUMN transaction_id TEXT')
    } catch {
      // 列已存在，忽略
    }
    try {
      raw.exec('ALTER TABLE orders ADD COLUMN paid_at INTEGER')
    } catch {
      // 列已存在，忽略
    }
    try {
      raw.exec('ALTER TABLE users ADD COLUMN desktop_user_id TEXT')
    } catch {
      // 列已存在，忽略
    }
  }

  // 本地内容库自举（仅 SQLite 文件库）：questions 表为空时用 fixture 灌入。
  // 云端由同步脚本（server/src/scripts/sync-content-questions.ts）灌真库，不走此路径。
  private seedQuestions(raw: DatabaseSync): void {
    try {
      const c = raw.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number | bigint }
      if (Number(c.c) > 0) return
      const text = readFileSync(join(__dirname, 'data', 'content-fixture.json'), 'utf8')
      const raws = JSON.parse(text) as RawQuestion[]
      const syncedAt = Date.now()
      const stmt = raw.prepare(QUESTION_UPSERT_SQL)
      let n = 0
      raw.exec('BEGIN')
      try {
        for (const r of raws) {
          const row = mapRawQuestion(r, syncedAt)
          if (row == null) continue
          stmt.run(...questionParams(row))
          n++
        }
        raw.exec('COMMIT')
      } catch (e) {
        raw.exec('ROLLBACK')
        throw e
      }
      console.log('[db] 本地内容库 fixture 灌入 ' + n + ' 题')
    } catch (e) {
      console.warn('[db] 内容库 fixture 灌入跳过（缺失或异常，生产由同步脚本灌入）：', e)
    }
  }

  prepare(sql: string) {
    return this.d.prepare(sql)
  }

  exec(sql: string): Promise<void> {
    return this.d.exec(sql)
  }

  // 用法：await db.transaction(async () => { ... })()
  transaction(fn: (...args: any[]) => any): (...args: any[]) => Promise<any> {
    return this.d.transaction(fn)
  }

  close(): void {
    this.d.close()
  }
}

export function getDb(path: string, mysql: MysqlConfig | null = null): Db {
  const key = mysql != null ? 'mysql:' + mysql.database : 'sqlite:' + path
  if (instance != null) {
    if (instanceKey === key) return instance
    instance.close()
    instance = null
  }
  instance = new Db(path, mysql)
  instanceKey = key
  return instance
}

export function closeDb(): void {
  if (instance != null) {
    instance.close()
    instance = null
    instanceKey = ''
  }
}
