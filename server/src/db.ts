// SQLite 连接（Node 内置 node:sqlite，零原生依赖；可注入路径，测试用 ':memory:'）
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let instance: Db | null = null
let instancePath = ''

// 打开（或复用）连接并执行 schema；schema.sql 与 config 中 DDL 同步。
export class Db {
  private db: DatabaseSync
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
    this.db.exec(schema)
    this.migrate()
  }

  // 轻量列迁移：兼容升级前创建的旧库（新库 CREATE TABLE 已含新列，ALTER 重复会被忽略）
  private migrate(): void {
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN transaction_id TEXT')
    } catch {
      // 列已存在，忽略
    }
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN paid_at INTEGER')
    } catch {
      // 列已存在，忽略
    }
  }

  prepare(sql: string): any {
    return this.db.prepare(sql)
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      // 忽略关闭异常
    }
  }
}

export function getDb(path: string): Db {
  if (instance != null) {
    if (instancePath === path) return instance
    instance.close()
    instance = null
  }
  instance = new Db(path)
  instancePath = path
  return instance
}

export function closeDb(): void {
  if (instance != null) {
    instance.close()
    instance = null
    instancePath = ''
  }
}
