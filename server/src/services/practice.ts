// 做题记录与 SRS（Phase 2.1：服务端权威记录 + 跨设备同步 + 云端错题本）
// 契约：docs/contracts/2026-10-23-practice-sync.freeze.md
// 排程：不会 → 1 天；模糊 → 1 天且不降间隔；会 → 1/2/4/7/15/30/60 天递进
import { Db } from '../db.js'
import { QuestionItem } from '../types/interview.js'
import { findQuestionById } from './content-bank.js'

export type PracticeResult = 'known' | 'fuzzy' | 'unknown'

export type PracticeAnswerInput = {
  questionId: string
  subtrack: string
  difficulty: string
  result: PracticeResult
  answeredAt: number
}

export type PracticeRecordView = {
  questionId: string
  subtrack: string
  difficulty: string
  result: PracticeResult
  attempts: number
  correctStreak: number
  intervalDays: number
  dueAt: number
  updatedAt: number
}

export type SubtrackStatView = {
  subtrack: string
  total: number
  known: number
  fuzzy: number
  unknown: number
  wrong: number
  due: number
}

export type PracticeSummary = {
  total: number
  known: number
  fuzzy: number
  unknown: number
  wrongCount: number
  dueCount: number
  subtracks: SubtrackStatView[]
}

const DAY_MS = 86400000
const INTERVALS = [1, 2, 4, 7, 15, 30, 60]

type PrevState = { correct_streak: number; interval_days: number; updated_at: number }

function nextState(
  prevStreak: number,
  prevInterval: number,
  result: PracticeResult,
  now: number
): { streak: number; interval: number; dueAt: number } {
  if (result === 'unknown') return { streak: 0, interval: 1, dueAt: now + DAY_MS }
  if (result === 'fuzzy') {
    return {
      streak: prevStreak,
      interval: Math.max(prevInterval, 1),
      dueAt: now + Math.max(prevInterval, 1) * DAY_MS
    }
  }
  const streak = prevStreak + 1
  const interval = INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)]
  return { streak: streak, interval: interval, dueAt: now + interval * DAY_MS }
}

async function numericUserId(db: Db, uid: string): Promise<number | null> {
  const row = (await db.prepare('SELECT id FROM users WHERE uid = ?').get(uid)) as {
    id: number
  } | null
  return row != null ? Number(row.id) : null
}

// 批量写入作答结果；同一题重复作答按 SRS 递进。answeredAt 早于本地 updated_at 的条目视为过期跳过。
export async function recordAnswers(
  db: Db,
  uid: string,
  items: PracticeAnswerInput[]
): Promise<PracticeSummary> {
  const userId = await numericUserId(db, uid)
  if (userId == null) return emptySummary()

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const prev = (await db
      .prepare(
        'SELECT correct_streak, interval_days, updated_at FROM practice_records WHERE user_id = ? AND question_id = ?'
      )
      .get(userId, it.questionId)) as PrevState | null
    const now = it.answeredAt > 0 ? Math.min(it.answeredAt, Date.now()) : Date.now()
    if (prev != null && now < Number(prev.updated_at)) continue
    const prevStreak = prev != null ? Number(prev.correct_streak) : 0
    const prevInterval = prev != null ? Number(prev.interval_days) : 1
    const next = nextState(prevStreak, prevInterval, it.result, now)
    await db
      .prepare(
        `INSERT INTO practice_records
           (user_id, question_id, subtrack, difficulty, result, attempts, correct_streak, interval_days, due_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT(user_id, question_id) DO UPDATE SET
           subtrack = excluded.subtrack,
           difficulty = excluded.difficulty,
           result = excluded.result,
           attempts = practice_records.attempts + 1,
           correct_streak = excluded.correct_streak,
           interval_days = excluded.interval_days,
           due_at = excluded.due_at,
           updated_at = excluded.updated_at`
      )
      .run(
        userId,
        it.questionId,
        it.subtrack,
        it.difficulty,
        it.result,
        next.streak,
        next.interval,
        next.dueAt,
        now
      )
  }
  return summaryOf(db, uid)
}

export async function listRecords(db: Db, uid: string): Promise<PracticeRecordView[]> {
  const userId = await numericUserId(db, uid)
  if (userId == null) return []
  const rows = (await db
    .prepare(
      `SELECT question_id, subtrack, difficulty, result, attempts, correct_streak, interval_days, due_at, updated_at
         FROM practice_records WHERE user_id = ? ORDER BY updated_at DESC LIMIT 2000`
    )
    .all(userId)) as any[]
  const out: PracticeRecordView[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    out.push({
      questionId: String(r.question_id),
      subtrack: String(r.subtrack),
      difficulty: String(r.difficulty),
      result: String(r.result) as PracticeResult,
      attempts: Number(r.attempts),
      correctStreak: Number(r.correct_streak),
      intervalDays: Number(r.interval_days),
      dueAt: Number(r.due_at),
      updatedAt: Number(r.updated_at)
    })
  }
  return out
}

export function emptySummary(): PracticeSummary {
  return {
    total: 0,
    known: 0,
    fuzzy: 0,
    unknown: 0,
    wrongCount: 0,
    dueCount: 0,
    subtracks: []
  }
}

export async function summaryOf(db: Db, uid: string): Promise<PracticeSummary> {
  const userId = await numericUserId(db, uid)
  if (userId == null) return emptySummary()
  const now = Date.now()
  const rows = (await db
    .prepare(
      `SELECT subtrack,
              COUNT(*) AS total,
              SUM(CASE WHEN result = 'known' THEN 1 ELSE 0 END) AS known,
              SUM(CASE WHEN result = 'fuzzy' THEN 1 ELSE 0 END) AS fuzzy,
              SUM(CASE WHEN result = 'unknown' THEN 1 ELSE 0 END) AS unknown,
              SUM(CASE WHEN result = 'unknown' THEN 1 ELSE 0 END) AS wrong,
              SUM(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) AS due
         FROM practice_records
         WHERE user_id = ?
         GROUP BY subtrack`
    )
    .all(now, userId)) as any[]
  const out = emptySummary()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const s: SubtrackStatView = {
      subtrack: String(r.subtrack),
      total: Number(r.total),
      known: Number(r.known),
      fuzzy: Number(r.fuzzy),
      unknown: Number(r.unknown),
      wrong: Number(r.wrong),
      due: Number(r.due)
    }
    out.subtracks.push(s)
    out.total += s.total
    out.known += s.known
    out.fuzzy += s.fuzzy
    out.unknown += s.unknown
    out.wrongCount += s.wrong
    out.dueCount += s.due
  }
  return out
}

// 错题本：结果为「不会」的题（按最近作答倒序），返回完整题目用于复习
export async function wrongQuestions(
  db: Db,
  uid: string,
  limit: number = 100
): Promise<QuestionItem[]> {
  const userId = await numericUserId(db, uid)
  if (userId == null) return []
  const rows = (await db
    .prepare(
      `SELECT question_id FROM practice_records
         WHERE user_id = ? AND result = 'unknown'
         ORDER BY updated_at DESC LIMIT ?`
    )
    .all(userId, limit)) as any[]
  const out: QuestionItem[] = []
  for (let i = 0; i < rows.length; i++) {
    const q = await findQuestionById(db, String(rows[i].question_id))
    if (q != null) out.push(q)
  }
  return out
}

// 到期复习队列（SRS）；subtrack 为空表示全部细分领域
export async function dueQuestions(
  db: Db,
  uid: string,
  subtrack: string,
  limit: number = 10
): Promise<{ dueCount: number; questions: QuestionItem[] }> {
  const userId = await numericUserId(db, uid)
  if (userId == null) return { dueCount: 0, questions: [] }
  const now = Date.now()
  let countRow: any = null
  let rows: any[] = []
  if (subtrack.length > 0) {
    countRow = await db
      .prepare(
        'SELECT COUNT(*) AS c FROM practice_records WHERE user_id = ? AND subtrack = ? AND due_at <= ?'
      )
      .get(userId, subtrack, now)
    rows = (await db
      .prepare(
        `SELECT question_id FROM practice_records
           WHERE user_id = ? AND subtrack = ? AND due_at <= ?
           ORDER BY due_at ASC LIMIT ?`
      )
      .all(userId, subtrack, now, limit)) as any[]
  } else {
    countRow = await db
      .prepare('SELECT COUNT(*) AS c FROM practice_records WHERE user_id = ? AND due_at <= ?')
      .get(userId, now)
    rows = (await db
      .prepare(
        `SELECT question_id FROM practice_records
           WHERE user_id = ? AND due_at <= ?
           ORDER BY due_at ASC LIMIT ?`
      )
      .all(userId, now, limit)) as any[]
  }
  const questions: QuestionItem[] = []
  for (let i = 0; i < rows.length; i++) {
    const q = await findQuestionById(db, String(rows[i].question_id))
    if (q != null) questions.push(q)
  }
  return { dueCount: countRow != null ? Number(countRow.c) : 0, questions: questions }
}
