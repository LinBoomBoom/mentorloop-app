// 内容库同步（批次 A）：桌面库 mentorloop.interview_questions（只读）→ MP 库 questions（幂等重建）
// 运行位置：必须在与云 MySQL 同内网的环境执行（云托管容器启动钩子 / 本地能连云库的环境）
// CLI：cd server && npx tsx src/scripts/sync-content-questions.ts [--force]
// 容器内：由 server.ts 在服务启动后调用 runContentSync()（按适配层版本门控，见 ADAPTER_VERSION）
// 依赖环境变量：MYSQL_HOST/MYSQL_PORT/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE（目标=mentorloop_mp）
//              DESKTOP_DB_NAME（源库名，默认 mentorloop；须与目标同实例，账号对其有 SELECT 权限）
// 纪律：只读源库（仅 SELECT）；目标表结构幂等自建；同步后逐方向 count 校验，不一致即失败。
import mysql from 'mysql2/promise'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { translateUpsert } from '../db-driver.js'
import {
  mapRawQuestion,
  questionParams,
  type QuestionRow,
  type RawQuestion
} from '../services/content-mapper.js'

const TRACKS = ['frontend', 'backend', 'devops', 'ai']
// 单条语句写入行数：控制占位符数量（16 列 × 100 = 1600 个 ?）
const CHUNK = 100

// 适配层版本：**任何**影响落库结果的改动（字段映射 / 题面生成 / 六维分类 / tech 词表）
// 都必须在此 +1，容器下次启动即自动重建目标表 → 避免「改了适配层但线上仍是旧数据」。
const ADAPTER_VERSION = 'v2'

const META_KEY = 'adapter_version'

// 目标表列序（与 content-mapper.questionParams 输出顺序必须一致）
const COLS = [
  'id',
  'position_id',
  'track',
  'subtrack',
  'difficulty',
  'ability_domain',
  'content',
  'content_raw',
  'evidence',
  'knowledge_point',
  'keywords',
  'tech_token',
  'weight',
  'q_type',
  'license',
  'synced_at'
]

// 目标表 DDL（与 deploy/cloud/baseline-mp-mysql.sql 的 questions 段一致；MySQL 无
// CREATE INDEX IF NOT EXISTS，故按 information_schema 判断后建表/补索引）
const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS questions (
  id              VARCHAR(64)  NOT NULL COMMENT '源 id（bq37/aq44…）',
  position_id     VARCHAR(16)  NOT NULL COMMENT '适配：track（frontend/backend/devops/ai）',
  track           VARCHAR(64)  NOT NULL COMMENT '源 track（保留追溯）',
  subtrack        VARCHAR(64)  NULL COMMENT '源 subtrack（作 subAbility）',
  difficulty      VARCHAR(16)  NOT NULL COMMENT '适配：easy/medium/hard → junior/mid/senior',
  ability_domain  VARCHAR(32)  NOT NULL COMMENT '预计算：六维（dimension-classifier 输出）',
  content         TEXT         NOT NULL COMMENT '预计算：题面生成后的问句',
  content_raw     TEXT         NULL COMMENT '源 q（保留原标题）',
  evidence        MEDIUMTEXT   NULL COMMENT '源 a（摘要化截断）',
  knowledge_point VARCHAR(255) NULL,
  keywords        TEXT         NULL COMMENT '源 keywords（JSON 串，供分类追溯）',
  tech_token      VARCHAR(64)  NULL COMMENT '预计算：tech 中文名 → 词表 id（无对照 空串）',
  weight          INT          NOT NULL DEFAULT 3,
  q_type          VARCHAR(32)  NULL COMMENT '源 type（hot/special）',
  license         VARCHAR(64)  NULL COMMENT '源（默认不过滤，保留合规审计）',
  synced_at       BIGINT       NOT NULL,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`

// 同步元数据（记录已落库的适配层版本；与题面/分类逻辑的版本比对，决定是否需要重建）
const CREATE_META_SQL = `CREATE TABLE IF NOT EXISTS content_sync_meta (
  k VARCHAR(64)  NOT NULL,
  v VARCHAR(255) NOT NULL,
  PRIMARY KEY (k)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`

const META_UPSERT_SQL = translateUpsert(
  'INSERT INTO content_sync_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'
)

const INDEXES: { name: string; sql: string }[] = [
  {
    name: 'idx_questions_position_difficulty',
    sql: 'CREATE INDEX idx_questions_position_difficulty ON questions(position_id, difficulty)'
  },
  {
    name: 'idx_questions_position_domain',
    sql: 'CREATE INDEX idx_questions_position_domain ON questions(position_id, ability_domain)'
  },
  {
    name: 'idx_questions_position_subtrack',
    sql: 'CREATE INDEX idx_questions_position_subtrack ON questions(position_id, subtrack)'
  }
]

export type TrackCount = { track: string; src: number; dst: number; ok: boolean }

export type ContentSyncResult = {
  sourceRows: number
  mapped: number
  skipped: number
  written: number
  counts: TrackCount[]
  rebuilt: boolean
  skippedUpToDate: boolean
}

export type ContentSyncOptions = {
  // 忽略版本门控强制重建（CLI --force / 排障用）
  force?: boolean
  onLog?: (msg: string) => void
}

function required(name: string): string {
  const v = process.env[name]
  if (v == null || v.length === 0) throw new Error('缺少环境变量 ' + name)
  return v
}

function assertIdent(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('库名非法标识符：' + name)
  return name
}

async function tableExists(
  conn: mysql.PoolConnection,
  schema: string,
  table: string
): Promise<boolean> {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [schema, table]
  )
  return Number((rows as any[])[0].c) > 0
}

async function ensureSchema(
  conn: mysql.PoolConnection,
  target: string,
  log: (m: string) => void
): Promise<void> {
  if (!(await tableExists(conn, target, 'questions'))) {
    log('目标表 questions 不存在，先建表')
    await conn.query(CREATE_TABLE_SQL)
  }
  for (const idx of INDEXES) {
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
      [target, 'questions', idx.name]
    )
    if (Number((rows as any[])[0].c) === 0) {
      log('补建索引 ' + idx.name)
      await conn.query(idx.sql)
    }
  }
  if (!(await tableExists(conn, target, 'content_sync_meta'))) {
    log('同步元数据表不存在，先建表')
    await conn.query(CREATE_META_SQL)
  }
}

// 多行 VALUES 批量 upsert（幂等）：SQLite 记法经 translateUpsert 翻成 MySQL 方言
export function buildBatchUpsertSql(rowCount: number): string {
  const placeholder = '(' + COLS.map(() => '?').join(',') + ')'
  const values = new Array(rowCount).fill(placeholder).join(',')
  const setClause = COLS.filter((c) => c !== 'id')
    .map((c) => c + '=excluded.' + c)
    .join(', ')
  return translateUpsert(
    'INSERT INTO questions (' +
      COLS.join(', ') +
      ') VALUES ' +
      values +
      ' ON CONFLICT(id) DO UPDATE SET ' +
      setClause
  )
}

export async function runContentSync(opts: ContentSyncOptions = {}): Promise<ContentSyncResult> {
  const log = opts.onLog ?? ((m: string) => console.log('[content-sync] ' + m))
  const host = required('MYSQL_HOST')
  const user = required('MYSQL_USER')
  const password = process.env.MYSQL_PASSWORD ?? ''
  const port = parseInt(process.env.MYSQL_PORT ?? '3306', 10) || 3306
  const target = assertIdent(process.env.MYSQL_DATABASE ?? 'mentorloop_mp')
  const source = assertIdent(process.env.DESKTOP_DB_NAME ?? 'mentorloop')

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: target,
    connectionLimit: 3,
    jsonStrings: true
  })

  const result: ContentSyncResult = {
    sourceRows: 0,
    mapped: 0,
    skipped: 0,
    written: 0,
    counts: [],
    rebuilt: false,
    skippedUpToDate: false
  }

  try {
    const conn = await pool.getConnection()
    try {
      await ensureSchema(conn, target, log)

      // 版本门控：目标表已有数据且已落库的适配层版本与当前一致 → 跳过（幂等，重启零开销）
      if (opts.force !== true) {
        const [existing] = await conn.query('SELECT COUNT(*) AS c FROM questions')
        const c = Number((existing as any[])[0].c)
        const [metaRows] = (await conn.query('SELECT v FROM content_sync_meta WHERE k = ?', [
          META_KEY
        ])) as any[]
        const stored = metaRows.length > 0 ? String(metaRows[0].v) : ''
        if (c > 0 && stored === ADAPTER_VERSION) {
          log('目标表 ' + c + ' 行且适配层版本一致（' + ADAPTER_VERSION + '），跳过同步')
          result.skippedUpToDate = true
          return result
        }
        if (c > 0) {
          log(
            '适配层版本变化（落库 ' +
              (stored.length > 0 ? stored : '(空)') +
              ' → 当前 ' +
              ADAPTER_VERSION +
              '），将全量重建 ' +
              c +
              ' 行'
          )
        }
      }

      log('读取源库 ' + source + '.interview_questions（只读）')
      const [rawRows] = await conn.query(
        `SELECT id, track, type, q, a, keywords, weight, difficulty, tech, subtrack, skill, license
         FROM ${source}.interview_questions WHERE status = 'published'`
      )
      const raws = rawRows as any[]
      result.sourceRows = raws.length
      log('源库 published 行数：' + raws.length)

      const syncedAt = Date.now()
      const mapped: QuestionRow[] = []
      for (const raw of raws) {
        const row = mapRawQuestion(raw as RawQuestion, syncedAt)
        if (row == null) {
          result.skipped++
          continue
        }
        mapped.push(row)
      }
      result.mapped = mapped.length
      log('适配成功：' + mapped.length + '，跳过（方向/难度越界或题面为空）：' + result.skipped)

      await conn.beginTransaction()
      try {
        // 重建语义：目标 = f(源)。先清空再写，避免适配层调整后残留旧形态行
        await conn.query('DELETE FROM questions')
        for (let i = 0; i < mapped.length; i += CHUNK) {
          const part = mapped.slice(i, i + CHUNK)
          const flat: (string | number)[] = []
          for (const row of part) {
            for (const v of questionParams(row)) flat.push(v)
          }
          await conn.query(buildBatchUpsertSql(part.length), flat)
          result.written += part.length
        }
        await conn.query(META_UPSERT_SQL, [META_KEY, ADAPTER_VERSION])
        await conn.commit()
      } catch (e) {
        await conn.rollback()
        throw e
      }
      result.rebuilt = true
      log('写入完成：' + result.written + ' 行（适配层版本 ' + ADAPTER_VERSION + '）')

      // 逐方向 count 校验（源 vs 目标）
      let bad = 0
      for (const track of TRACKS) {
        const [srcRows] = await conn.query(
          `SELECT COUNT(*) AS c FROM ${source}.interview_questions WHERE status = 'published' AND track = ?`,
          [track]
        )
        const [dstRows] = await conn.query(
          'SELECT COUNT(*) AS c FROM questions WHERE position_id = ?',
          [track]
        )
        const src = Number((srcRows as any[])[0].c)
        const dst = Number((dstRows as any[])[0].c)
        const ok = src === dst
        if (!ok) bad++
        result.counts.push({ track, src, dst, ok })
        log('  ' + track + ': 源 ' + src + ' / 目标 ' + dst + (ok ? ' OK' : ' MISMATCH'))
      }
      if (bad > 0) throw new Error('同步校验失败：' + bad + ' 个方向 count 不一致')
      log('同步完成并通过逐方向 count 校验')
      return result
    } finally {
      conn.release()
    }
  } finally {
    await pool.end()
  }
}

// 仅当被直接执行（非 import）时才跑 CLI，避免启动钩子 import 时意外触发
function invokedDirectly(): boolean {
  const arg = process.argv[1]
  if (arg == null) return false
  try {
    return realpathSync(arg) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  const force = process.argv.includes('--force')
  runContentSync({ force: force })
    .then((r) => {
      console.log(
        '[sync-content-questions] 完成：源 ' +
          r.sourceRows +
          ' / 写入 ' +
          r.written +
          (r.skippedUpToDate ? '（版本一致，已跳过）' : '')
      )
    })
    .catch((e) => {
      console.error('[sync-content-questions] 失败：', e)
      process.exit(1)
    })
}
