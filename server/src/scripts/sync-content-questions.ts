// 内容库同步（批次 A）：桌面库 mentorloop.interview_questions（只读）→ MP 库 questions（幂等 upsert）
// 运行位置：与云 MySQL 同内网（云托管容器或本地能连云库的环境）
// 用法：cd server && npx tsx src/scripts/sync-content-questions.ts
// 依赖环境变量：MYSQL_HOST/MYSQL_PORT/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE（目标=mentorloop_mp）
//              DESKTOP_DB_NAME（源库名，默认 mentorloop；须与目标同实例，账号对其有 SELECT 权限）
// 纪律：只读源库（仅 SELECT）；同步后逐方向 count 校验，不一致即非零退出。
import mysql from 'mysql2/promise'
import { translateUpsert } from '../db-driver.js'
import {
  mapRawQuestion,
  questionParams,
  QUESTION_UPSERT_SQL,
  QUESTION_COLUMNS,
  RawQuestion
} from '../services/content-mapper.js'

const TRACKS = ['frontend', 'backend', 'devops', 'ai']
const CHUNK = 200

function required(name: string): string {
  const v = process.env[name]
  if (v == null || v.length === 0) throw new Error('缺少环境变量 ' + name)
  return v
}

async function main(): Promise<void> {
  const host = required('MYSQL_HOST')
  const user = required('MYSQL_USER')
  const password = process.env.MYSQL_PASSWORD ?? ''
  const port = parseInt(process.env.MYSQL_PORT ?? '3306', 10) || 3306
  const target = process.env.MYSQL_DATABASE ?? 'mentorloop_mp'
  const source = process.env.DESKTOP_DB_NAME ?? 'mentorloop'
  if (!/^[A-Za-z0-9_]+$/.test(source) || !/^[A-Za-z0-9_]+$/.test(target)) {
    throw new Error('库名非法标识符：' + source + ' / ' + target)
  }

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: target,
    connectionLimit: 5,
    jsonStrings: true
  })

  const [rawRows] = await pool.query(
    `SELECT id, track, type, q, a, keywords, weight, difficulty, tech, subtrack, skill, license
     FROM ${source}.interview_questions WHERE status = 'published'`
  )
  const raws = rawRows as RawQuestion[]
  console.log('源库 published 行数：' + raws.length)

  const syncedAt = Date.now()
  let skipped = 0
  const mapped = []
  for (const raw of raws) {
    const row = mapRawQuestion(raw, syncedAt)
    if (row == null) {
      skipped++
      continue
    }
    mapped.push(row)
  }
  console.log('适配成功：' + mapped.length + '，跳过（方向/难度越界或题面为空）：' + skipped)

  const upsertSql = translateUpsert(QUESTION_UPSERT_SQL)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (let i = 0; i < mapped.length; i += CHUNK) {
      const part = mapped.slice(i, i + CHUNK)
      for (const row of part) {
        await conn.execute(upsertSql, questionParams(row))
      }
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
  console.log('upsert 完成：' + mapped.length + ' 行')

  // 逐方向 count 校验（源 vs 目标）
  let bad = 0
  for (const track of TRACKS) {
    const [srcRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM ${source}.interview_questions WHERE status = 'published' AND track = ?`,
      [track]
    )
    const [dstRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM ${target}.questions WHERE position_id = ?`,
      [track]
    )
    const src = Number((srcRows as any[])[0].c)
    const dst = Number((dstRows as any[])[0].c)
    const ok = src === dst
    if (!ok) bad++
    console.log(`  ${track}: 源 ${src} / 目标 ${dst} ${ok ? 'OK' : 'MISMATCH'}`)
  }
  await pool.end()
  console.log('列：' + QUESTION_COLUMNS.split(',').length + ' 列')
  if (bad > 0) {
    console.error('同步校验失败：' + bad + ' 个方向 count 不一致')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[sync-content-questions] 失败：', e)
  process.exit(1)
})
