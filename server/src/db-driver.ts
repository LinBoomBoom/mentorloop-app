// 双驱动 DB 原语层（对齐云托管：node:sqlite ↔ mysql2）
//
// 设计（对应契约冻结 2026-10-08-mp-cloud-alignment.freeze.md §2.3）：
// - 本地：node:sqlite DatabaseSync 直通包装，接口 Promise 化（await 对同步结果是 no-op），
//   调用侧写法与云端完全一致：`await db.prepare(sql).get(...)` / `await db.transaction(fn)()`。
// - 云端（MYSQL_HOST 存在）：mysql2/promise 连接池，事务内语句经 AsyncLocalStorage
//   路由到同一连接（否则连接池会拆散事务）。
// - run() 返回统一归一为 { changes: number; lastInsertRowid: number }。
// - JSON 列两侧均为 TEXT 存 JSON 字符串，读写语义零差。
//
// 方言翻译（SQLite → MySQL）集中在 translateSql：
//   INSERT OR IGNORE INTO → INSERT IGNORE INTO
//   INSERT OR REPLACE INTO → REPLACE INTO
//   ORDER BY rowid → ORDER BY id
//   ON CONFLICT(col) DO UPDATE SET a = excluded.a → ON DUPLICATE KEY UPDATE a = VALUES(a)
import { DatabaseSync } from 'node:sqlite'
import { AsyncLocalStorage } from 'node:async_hooks'
import mysql from 'mysql2/promise'

// 驱动选择：云端容器注入 MYSQL_HOST；本地开发/测试不注入，走 node:sqlite。
export const isCloudDb = !!process.env.MYSQL_HOST

/* ---------------- SQL 方言翻译 ---------------- */

// 把 SQLite 双引号保留字标识符（"desc"/"explain" 等，M1 前科）转成 MySQL 反引号。
// 仅处理已知保留字，不做全局双引号改写（避免误伤字符串字面量）。
const RESERVED_ID = new Set(['explain', 'right', 'key', 'desc'])

export function quoteReserved(sql: string): string {
  // 按 '...' 字符串字面量分段，仅替换字面量外的 "id"，避免误伤字面量内容
  return sql
    .split(/('(?:[^']|'')*')/g)
    .map((seg) =>
      seg.startsWith("'")
        ? seg
        : seg.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, (m, id: string) =>
            RESERVED_ID.has(id.toLowerCase()) ? '`' + id + '`' : m
          )
    )
    .join('')
}

// SQLite upsert → MySQL：
//   ON CONFLICT(phone) DO UPDATE SET code = excluded.code, consumed = 0
//   → ON DUPLICATE KEY UPDATE code = VALUES(code), consumed = 0
export function translateUpsert(sql: string): string {
  return sql.replace(
    /ON\s+CONFLICT\s*\(([^)]*)\)\s+DO\s+UPDATE\s+SET\s+([\s\S]*)$/i,
    (_m, _cols: string, set: string) => {
      const mysqlSet = set.replace(
        /(\b[A-Za-z_][A-Za-z0-9_]*\s*=\s*)excluded\.([A-Za-z_][A-Za-z0-9_]*)/gi,
        (_m2, lhs: string, col: string) => lhs + 'VALUES(' + col + ')'
      )
      return 'ON DUPLICATE KEY UPDATE ' + mysqlSet
    }
  )
}

export function translateSql(sql: string): string {
  let out = quoteReserved(sql)
  out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO')
  out = out.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO')
  out = out.replace(/ORDER\s+BY\s+rowid/gi, 'ORDER BY id')
  out = translateUpsert(out)
  return out
}

/* ---------------- 参数归一 ----------------
 * - undefined → null（MySQL 侧显式落 NULL，避免 "Bind parameters must not contain
 *   undefined" 直接 500；语义上等价于既有的列默认值写入习惯）
 * - LIMIT/OFFSET 占位符若绑定了数字字符串（query 参数直接透传的场景）归一为 Number，
 *   否则 mysql2 会转义成 LIMIT '10' 语法错误。其余字符串一律保持原样（VARCHAR 主键如 '123' 不能动）。
 */

// 找出 SQL 中所有 ? 占位符的位置（跳过字符串字面量内 / 转义的 ??）
function placeholderIndexes(sql: string): number[] {
  const pos: number[] = []
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      i++
      while (i < sql.length && sql[i] !== q) {
        if (sql[i] === '\\') i++
        i++
      }
      continue
    }
    if (c === '?') {
      if (sql[i + 1] === '?') {
        i++
        continue
      }
      pos.push(i)
    }
  }
  return pos
}

export function normalizeParams(sql: string, params: any[]): any[] {
  const out = params.map((p) => (p === undefined ? null : p))
  const idx = placeholderIndexes(sql)
  const limitRe = /\bLIMIT\s+\?/gi
  const offsetRe = /\bOFFSET\s+\?/gi
  for (const re of [limitRe, offsetRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(sql))) {
      const phIdx = idx.findIndex((p) => p >= m!.index + m![0].length - 1)
      if (phIdx >= 0 && phIdx < out.length) {
        const v = out[phIdx]
        if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) out[phIdx] = Number(v)
      }
    }
  }
  return out
}

// 调用侧既支持 stmt.get(a, b) 也支持 stmt.get([a, b])（node:sqlite 两种都收）
function flatArgs(args: any[]): any[] {
  return args.length === 1 && Array.isArray(args[0]) ? args[0] : args
}

/* ---------------- 句柄形态（双驱动统一） ---------------- */

export type RunResult = { changes: number; lastInsertRowid: number }
export type StatementFacade = {
  get: (...params: any[]) => Promise<any>
  all: (...params: any[]) => Promise<any[]>
  run: (...params: any[]) => Promise<RunResult>
}
export type DbDriver = {
  driver: 'sqlite' | 'mysql'
  prepare: (sql: string) => StatementFacade
  exec: (sql: string) => Promise<void>
  // 用法：await db.transaction(async () => { ... })()；嵌套调用复用外层事务
  transaction: (fn: (...args: any[]) => any) => (...args: any[]) => Promise<any>
  close: () => void
}

export type MysqlConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  poolSize: number
}

/* ---------------- 云端：mysql2 连接池门面 ---------------- */

export function createMysqlDriver(cfg: MysqlConfig): DbDriver {
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: cfg.poolSize,
    enableKeepAlive: true,
    // JSON 列按字符串返回（与 SQLite TEXT 存取语义一致，handler 的 JSON.parse 不受影响）
    jsonStrings: true
  })

  // 事务上下文：fn 内部 prepare 的语句必须路由到同一连接
  const als = new AsyncLocalStorage<any>()

  async function exec(method: 'get' | 'all' | 'run', sql: string, params: any[]): Promise<any> {
    const conn: any = als.getStore() || pool
    const [rows] = await conn.query(translateSql(sql), normalizeParams(sql, params))
    if (method === 'all') return rows as any[]
    if (method === 'get') return (rows as any[])[0]
    const r: any = Array.isArray(rows) ? rows[0] : rows
    return { changes: r?.affectedRows ?? 0, lastInsertRowid: r?.insertId ?? 0 }
  }

  function stmt(sql: string): StatementFacade {
    return {
      get: async (...a) => await exec('get', sql, flatArgs(a)),
      all: async (...a) => await exec('all', sql, flatArgs(a)),
      run: async (...a) => await exec('run', sql, flatArgs(a))
    }
  }

  return {
    driver: 'mysql',
    prepare: stmt,
    exec: async (sql) => {
      await pool.query(translateSql(sql))
    },
    transaction:
      (fn) =>
      async (...args) => {
        if (als.getStore()) return fn(...args) // 嵌套调用：复用当前事务（不另起 BEGIN）
        const conn: any = await pool.getConnection()
        try {
          await conn.beginTransaction()
          const r = await als.run(conn, () => fn(...args))
          await conn.commit()
          return r
        } catch (e) {
          try {
            await conn.rollback()
          } catch {
            /* 连接已断等场景，释放即可 */
          }
          throw e
        } finally {
          conn.release()
        }
      },
    close: () => {
      void pool.end()
    }
  }
}

/* ---------------- 本地：node:sqlite 直通包装（Promise 化） ----------------
 * prepare 原样返回同步 Statement 的异步门面（调用侧 await 为 no-op，本地行为零变化）；
 * transaction 用手工 BEGIN/COMMIT 包住 async fn：fn 内的 await 都是对同步 node:sqlite
 * 调用的 no-op，微任务排空后才会 COMMIT，原子性与旧行为一致。
 */
export function createSqliteDriver(raw: DatabaseSync): DbDriver {
  let txDepth = 0
  function stmt(sql: string): StatementFacade {
    const s = raw.prepare(sql)
    return {
      get: async (...a) => s.get(...flatArgs(a)),
      all: async (...a) => s.all(...flatArgs(a)),
      run: async (...a) => {
        const r = s.run(...flatArgs(a)) as {
          changes?: number | bigint
          lastInsertRowid?: number | bigint
        }
        return { changes: Number(r.changes ?? 0), lastInsertRowid: Number(r.lastInsertRowid ?? 0) }
      }
    }
  }
  return {
    driver: 'sqlite',
    prepare: stmt,
    exec: async (sql) => {
      raw.exec(sql)
    },
    transaction:
      (fn) =>
      async (...args) => {
        if (txDepth > 0) return fn(...args) // 嵌套：SQLite 单连接共用外层事务
        raw.exec('BEGIN')
        txDepth++
        try {
          const r = await fn(...args)
          raw.exec('COMMIT')
          return r
        } catch (e) {
          try {
            raw.exec('ROLLBACK')
          } catch {
            /* BEGIN 失败时 ROLLBACK 会再抛，吞掉保留原错误 */
          }
          throw e
        } finally {
          txDepth--
        }
      },
    close: () => {
      try {
        raw.close()
      } catch {
        // 忽略关闭异常
      }
    }
  }
}
