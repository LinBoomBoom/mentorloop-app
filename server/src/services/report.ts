// 报告服务：由服务端答案生成评分报告（幂等缓存）并扣减面试额度
import { Db } from '../db.js'
import { now } from '../util.js'
import { scoreInterview } from '../rules/scorer.js'
import { getQuestionById } from '../data/question-bank.js'
import { QuestionItem, TranscriptEntry } from '../types/interview.js'
import { InterviewReport } from '../types/scoring.js'
import { consumeInterview } from './quota.js'

type AnswerRow = {
  question_id: string
  user_answer_index: number
  is_followup: number
  text: string
  created_at: number
}

function sessionUserId(db: Db, sessionId: string): string | null {
  const row = db
    .prepare(`SELECT u.uid AS uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(sessionId) as { uid: string } | undefined
  return row != null ? row.uid : null
}

// 幂等重算评分报告：已存在则返回缓存；首次生成时扣减一次面试额度
export function getReport(db: Db, sessionId: string): InterviewReport {
  const cached = db.prepare('SELECT payload FROM reports WHERE session_id = ?').get(sessionId) as
    { payload: string } | undefined
  const uid = sessionUserId(db, sessionId)
  if (cached != null) {
    return JSON.parse(cached.payload) as InterviewReport
  }

  const rows = db
    .prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as unknown[]
  const answers = rows.map((r) => r as AnswerRow)

  // 恢复题目对象 + 构造转写（面试官发语句=题面）
  const questions: QuestionItem[] = []
  const transcript: TranscriptEntry[] = []
  for (const a of answers) {
    const q = getQuestionById(a.question_id)
    if (q == null) continue
    if (!questions.some((x) => x.id === q.id)) questions.push(q)
    transcript.push({
      questionId: q.id,
      speaker: 'interviewer',
      text: q.content,
      timestamp: a.created_at - 1
    })
    transcript.push({
      questionId: q.id,
      speaker: 'user',
      text: a.text,
      timestamp: a.created_at
    })
  }

  const report = scoreInterview(questions, transcript)

  if (uid != null) {
    db.prepare(
      `INSERT INTO reports (session_id, user_id, payload, generated_at) VALUES (?, (SELECT id FROM users WHERE uid = ?), ?, ?)`
    ).run(sessionId, uid, JSON.stringify(report), now())
    // 完成一场面试 → 扣减额度（会员不扣，单次包优先；幂等：仅在首次生成时）
    consumeInterview(db, uid)
  }
  return report
}
