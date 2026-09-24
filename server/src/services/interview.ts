// 面试会话服务：建会话 / 出题（复用移植的题目选择器）/ 答题幂等
import { Db } from '../db.js'
import { newId, now } from '../util.js'
import { selectNext, SelectorInput, getModeBudget } from '../rules/question-selector.js'
import { getQuestionById } from '../data/question-bank.js'
import {
  PositionBlueprint,
  QuestionItem,
  InterviewMode,
  ExperienceLevel,
  PositionId
} from '../types/interview.js'
import { getPositionName, getExperienceRange } from '../data/position-options.js'

export type NewSessionInput = {
  positionId: PositionId
  position: string
  experienceLevel: ExperienceLevel
  experienceRange: string
}

export function createSession(db: Db, uid: string, mode: string, body: NewSessionInput): string {
  const sessionId = newId('s')
  const t = now()
  db.prepare(
    `INSERT INTO sessions (id, user_id, position_id, position_name, experience_level, experience_range, mode, status, question_seq, created_at)
     VALUES (?, (SELECT id FROM users WHERE uid = ?), ?, ?, ?, ?, ?, 'CREATED', 0, ?)`
  ).run(
    sessionId,
    uid,
    body.positionId,
    body.position,
    body.experienceLevel,
    body.experienceRange,
    mode,
    t
  )
  return sessionId
}

function getSession(
  db: Db,
  sessionId: string
): {
  id: string
  user_id: number
  position_id: string
  position_name: string | null
  experience_level: string
  experience_range: string | null
  mode: string
} | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
  return row != null ? (row as any) : null
}

// 该会话已出过的题目（出题即记录，去重；收束题不在 QUESTION_BANK，
// 还原失败时以仅含 id 的最小桩参与去重）
function askedQuestions(db: Db, sessionId: string): QuestionItem[] {
  const rows = db
    .prepare('SELECT question_id FROM session_asked WHERE session_id = ?')
    .all(sessionId) as { question_id: string }[]
  const out: QuestionItem[] = []
  for (const r of rows) {
    const q = getQuestionById(r.question_id)
    if (q != null) {
      out.push(q)
    } else {
      out.push({
        id: r.question_id,
        positionId: 'java-backend',
        abilityDomain: '',
        subAbility: '',
        knowledgePoint: '',
        content: '',
        purpose: '',
        difficulty: 'junior',
        type: 'concept',
        misconceptions: [],
        expectedEvidence: '',
        followupPrompts: [],
        resumeRisk: false
      } as QuestionItem)
    }
  }
  return out
}

export type NextQuestionParams = {
  sessionId: string
  mode: string
  askedComma: string // 客户端已答题 id（逗号串，作为参考，权威以服务端为准）
  remainSeconds: number
  resumeRiskTopicsComma: string
}

export function nextQuestion(db: Db, p: NextQuestionParams): QuestionItem {
  const session = getSession(db, p.sessionId)
  if (session == null) throw new Error('SESSION_NOT_FOUND')

  const asked = askedQuestions(db, p.sessionId)
  // 出题权威以服务端 answers 为准；客户端传入的 asked 仅作参考，忽略不合并（避免状态分叉）

  const blueprint: PositionBlueprint = {
    positionId: session.position_id as PositionId,
    position: session.position_name ?? getPositionName(session.position_id as PositionId),
    experienceLevel: session.experience_level as ExperienceLevel,
    experienceRange:
      session.experience_range ?? getExperienceRange(session.experience_level as ExperienceLevel),
    companyType: '互联网',
    language: '中文',
    target: '求职'
  }

  const mode = (
    ['quick', 'standard', 'deep'].includes(p.mode) ? p.mode : 'standard'
  ) as InterviewMode
  const budget = getModeBudget(mode)
  const remainSeconds =
    p.remainSeconds > 0 ? p.remainSeconds : budget.totalSeconds - asked.length * 150
  const topics =
    p.resumeRiskTopicsComma.length > 0 ? p.resumeRiskTopicsComma.split(',') : DEFAULT_TOPICS

  const input: SelectorInput = {
    blueprint,
    mode,
    asked,
    remainSeconds,
    resumeRiskTopics: topics,
    focusDomain: '',
    maxQuestions: 0
  }
  const out = selectNext(input)
  if (out == null) throw new Error('NO_MORE_QUESTIONS')

  db.prepare(
    `UPDATE sessions SET current_question_id = ?, question_seq = question_seq + 1 WHERE id = ?`
  ).run(out.question.id, p.sessionId)
  // 出题即记录（服务端权威去重；UNIQUE 防并发重复）
  const seq = db.prepare('SELECT question_seq FROM sessions WHERE id = ?').get(p.sessionId) as {
    question_seq: number
  }
  try {
    db.prepare('INSERT INTO session_asked (session_id, question_id, seq) VALUES (?, ?, ?)').run(
      p.sessionId,
      out.question.id,
      seq.question_seq
    )
  } catch {
    // 并发重复出题：忽略
  }
  return out.question
}

// 与服务端 mock 层一致的默认简历关键词（详见 api/mock/interview.mock.uts）
const DEFAULT_TOPICS: string[] = ['订单系统', '性能优化', '架构设计']

export function submitAnswer(
  db: Db,
  sessionId: string,
  questionId: string,
  text: string,
  isFollowup: boolean
): boolean {
  const t = now()
  const idxRow = db
    .prepare('SELECT COUNT(*) AS c FROM answers WHERE session_id = ? AND question_id = ?')
    .get(sessionId, questionId) as { c: number }
  const userAnswerIndex = idxRow.c
  const idemKey = `${sessionId}:${questionId}:${userAnswerIndex}`
  try {
    db.prepare(
      `INSERT INTO answers (session_id, question_id, user_answer_index, is_followup, speaker, text, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`
    ).run(sessionId, questionId, userAnswerIndex, isFollowup ? 1 : 0, text, idemKey, t)
  } catch {
    // UNIQUE 冲突 → 幂等重放，不报错
    return true
  }
  return true
}
