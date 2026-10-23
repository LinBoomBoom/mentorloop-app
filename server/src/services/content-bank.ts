// 内容库仓储（批次 A）：出题候选池 / 单题回查，全部只读本库 questions 表（无跨库）。
// 云端由同步脚本（scripts/sync-content-questions.mjs）灌入；本地由 fixture 灌入（见 db.ts 自举）。

import { Db } from '../db.js'
import { QuestionItem } from '../types/interview.js'
import { QuestionRow, toQuestionItem } from './content-mapper.js'

// 单次出题预取的候选规模（设计稿 §7：LIMIT 预取后在内存按难度/能力域筛选）
export const CANDIDATE_LIMIT = 240

const SELECT_COLS =
  'id, position_id, track, subtrack, difficulty, ability_domain, content, content_raw, evidence, knowledge_point, keywords, tech_token, weight, q_type, license, synced_at'

// 候选池：本方向随机取 CANDIDATE_LIMIT 条（随机=同一用户多场不重样；跨场次精确去重见批次 B）
// 随机函数按驱动选：MySQL RAND() / SQLite RANDOM()（translateSql 不做该映射）
export async function loadCandidates(
  db: Db,
  positionId: string,
  limit: number = CANDIDATE_LIMIT,
  subtrack: string = '',
  difficulty: string = ''
): Promise<QuestionItem[]> {
  const order = db.driver === 'mysql' ? 'RAND()' : 'RANDOM()'
  // 做题模式：细分领域 / 精确难度过滤（契约 2026-10-23-practice-subtrack）
  let sql = `SELECT ${SELECT_COLS} FROM questions WHERE position_id = ?`
  const params: (string | number)[] = [positionId]
  if (subtrack.length > 0) {
    sql += ' AND subtrack = ?'
    params.push(subtrack)
  }
  if (difficulty.length > 0) {
    sql += ' AND difficulty = ?'
    params.push(difficulty)
  }
  sql += ` ORDER BY ${order} LIMIT ?`
  params.push(limit)
  const rows = (await db.prepare(sql).all(...params)) as QuestionRow[]
  const out: QuestionItem[] = []
  for (let i = 0; i < rows.length; i++) out.push(toQuestionItem(rows[i]))
  return out
}

// 单题回查（会话已答列表还原；不在库中返回 null）
export async function findQuestionById(db: Db, id: string): Promise<QuestionItem | null> {
  const row = (await db
    .prepare(`SELECT ${SELECT_COLS} FROM questions WHERE id = ?`)
    .get(id)) as QuestionRow | null
  return row != null ? toQuestionItem(row) : null
}

export async function countQuestions(db: Db, positionId: string): Promise<number> {
  const r = (await db
    .prepare('SELECT COUNT(*) AS c FROM questions WHERE position_id = ?')
    .get(positionId)) as { c: number }
  return r != null ? Number(r.c) : 0
}
