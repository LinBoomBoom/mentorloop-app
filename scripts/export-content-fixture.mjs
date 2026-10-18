// 内容库 fixture 导出（批次 A · 本地桩）
// 源：桌面端只读库 E:/LsqCoding/MentorLoop/data/devmentor.db（禁写；仅 SELECT）
// 出：server/src/data/content-fixture.json（原始源行快照，供本地开发/单测/evals；
//     适配（六维/题面/tech 归一）在灌库时由 content-mapper 统一完成，保证与生产同一条代码路径）
// 用法：node scripts/export-content-fixture.mjs [--per=50]
// 纪律：fixture 为采样快照，生产不消费；云端由 sync-content-questions.mjs 同步真库。

import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DB = 'E:/LsqCoding/MentorLoop/data/devmentor.db'
const OUT = join(__dirname, '..', 'server', 'src', 'data', 'content-fixture.json')

const perArg = process.argv.find((a) => a.startsWith('--per='))
const PER = perArg != null ? parseInt(perArg.split('=')[1], 10) || 50 : 50

// 证据字段按适配上限预截断：适配层（content-mapper EVIDENCE_MAX）同样截断，
// 产物零差，但仓库体积从 ~1.8MB 降到 ~0.35MB。
const EVIDENCE_MAX = 400
const TRACKS = ['frontend', 'backend', 'devops', 'ai']
const DIFFICULTIES = ['easy', 'medium', 'hard']

const db = new DatabaseSync(SRC_DB, { readOnly: true })
const rows = []
for (const track of TRACKS) {
  for (const difficulty of DIFFICULTIES) {
    const part = db
      .prepare(
        `SELECT id, track, type, q, a, keywords, weight, difficulty, tech, subtrack, skill, license
         FROM interview_questions
         WHERE status = 'published' AND track = ? AND difficulty = ?
         ORDER BY id LIMIT ?`
      )
      .all(track, difficulty, PER)
    for (const r of part) {
      if (typeof r.a === 'string' && r.a.length > EVIDENCE_MAX) r.a = r.a.slice(0, EVIDENCE_MAX)
      rows.push(r)
    }
  }
}
db.close()

writeFileSync(OUT, JSON.stringify(rows, null, 0) + '\n', 'utf8')

const byTrack = {}
for (const r of rows) byTrack[r.track] = (byTrack[r.track] ?? 0) + 1
console.log('导出 ' + rows.length + ' 行 → ' + OUT)
console.log('分布：' + JSON.stringify(byTrack))
