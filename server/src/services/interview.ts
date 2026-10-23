// 面试会话服务：建会话 / 出题（复用移植的题目选择器）/ 答题幂等
import { Db } from '../db.js'
import { newId, now } from '../util.js'
import { selectNext, SelectorInput, getModeBudget } from '../rules/question-selector.js'
import { loadCandidates, findQuestionById } from './content-bank.js'
import {
  PositionBlueprint,
  QuestionItem,
  InterviewMode,
  ExperienceLevel,
  PositionId
} from '../types/interview.js'
import { getPositionName, getExperienceRange } from '../data/position-options.js'
import { requireSessionOwner } from './session-access.js'

export type NewSessionInput = {
  positionId: PositionId
  position: string
  experienceLevel: ExperienceLevel
  experienceRange: string
}

export async function createSession(
  db: Db,
  uid: string,
  mode: string,
  body: NewSessionInput
): Promise<string> {
  const sessionId = newId('s')
  const t = now()
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, position_id, position_name, experience_level, experience_range, mode, status, question_seq, created_at)
     VALUES (?, (SELECT id FROM users WHERE uid = ?), ?, ?, ?, ?, ?, 'CREATED', 0, ?)`
    )
    .run(
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

async function getSession(
  db: Db,
  sessionId: string
): Promise<{
  id: string
  user_id: number
  position_id: string
  position_name: string | null
  experience_level: string
  experience_range: string | null
  mode: string
} | null> {
  const row = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
  return row != null ? (row as any) : null
}

// 该会话已出过的题目（出题即记录，去重；收束题不在内容库，
// 回查失败时以仅含 id 的最小桩参与去重）
async function askedQuestions(db: Db, sessionId: string): Promise<QuestionItem[]> {
  const rows = (await db
    .prepare('SELECT question_id FROM session_asked WHERE session_id = ?')
    .all(sessionId)) as { question_id: string }[]
  const out: QuestionItem[] = []
  for (const r of rows) {
    const q = await findQuestionById(db, r.question_id)
    if (q != null) {
      out.push(q)
    } else {
      out.push({
        id: r.question_id,
        positionId: 'backend',
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
        resumeRisk: false,
        techStack: ''
      } as QuestionItem)
    }
  }
  return out
}

// 跨场次去重窗口（契约 2026-10-24）：最近 90 天 / 300 题不重复
const ASKED_HISTORY_DAYS = 90
const ASKED_HISTORY_LIMIT = 300

// 读取当前用户最近出过的题 id；表未就绪时降级为不去重，不阻断出题
async function loadRecentAskedIds(db: Db, userId: number): Promise<string[]> {
  try {
    const cutoff = now() - ASKED_HISTORY_DAYS * 24 * 60 * 60 * 1000
    const rows = (await db
      .prepare(
        'SELECT question_id FROM user_asked_history WHERE user_id = ? AND asked_at >= ? ORDER BY asked_at DESC LIMIT ?'
      )
      .all(userId, cutoff, ASKED_HISTORY_LIMIT)) as { question_id: string }[]
    const ids: string[] = []
    for (let i = 0; i < rows.length; i++) ids.push(rows[i].question_id)
    return ids
  } catch (e: any) {
    console.warn(
      '[interview] 读取出题历史失败，本次跳过跨场去重',
      e != null && e.message != null ? e.message : e
    )
    return []
  }
}

// 出题即写入历史（幂等；失败不影响本次出题）
async function recordAskedHistory(
  db: Db,
  userId: number,
  questionId: string,
  positionId: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO user_asked_history (user_id, question_id, position_id, asked_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, question_id) DO UPDATE SET
           asked_at = excluded.asked_at,
           position_id = excluded.position_id`
      )
      .run(userId, questionId, positionId, now())
  } catch (e: any) {
    console.warn('[interview] 写取出题历史失败', e != null && e.message != null ? e.message : e)
  }
}

export type NextQuestionParams = {
  sessionId: string
  mode: string
  askedComma: string // 客户端已答题 id（逗号串，作为参考，权威以服务端为准）
  remainSeconds: number
  resumeRiskTopicsComma: string
  resumeTechStacksComma: string
  maxQuestions: number // 0 = 模式预算；1–12 = 覆盖（续题）
}

export async function nextQuestion(
  db: Db,
  uid: string,
  p: NextQuestionParams
): Promise<QuestionItem> {
  // IDOR 防护：非本人会话与不存在会话同报 404
  await requireSessionOwner(db, p.sessionId, uid)
  const session = await getSession(db, p.sessionId)
  if (session == null) throw new Error('SESSION_NOT_FOUND')

  const asked = await askedQuestions(db, p.sessionId)
  const recentAsked = await loadRecentAskedIds(db, session.user_id)
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
  // 简历技术栈（2026-10-18 契约冻结）：空数组=不过滤（现状兼容）；非空=非通用题须命中栈
  const stacks = p.resumeTechStacksComma.length > 0 ? p.resumeTechStacksComma.split(',') : []
  // 候选池：内容库本方向预取（批次 A：出题数据源切换为云端内容库）
  const candidates = await loadCandidates(db, session.position_id)

  const input: SelectorInput = {
    blueprint,
    mode,
    asked,
    remainSeconds,
    resumeRiskTopics: topics,
    resumeTechStacks: stacks,
    focusDomain: '',
    maxQuestions: p.maxQuestions > 0 ? Math.min(p.maxQuestions, 12) : 0,
    candidates
  }
  const out = selectNext(input, recentAsked)
  if (out == null) throw new Error('NO_MORE_QUESTIONS')
  if (!out.isWrapup && recentAsked.indexOf(out.question.id) >= 0) {
    console.warn('[interview] 候选池不足，回退最近已出题：' + out.question.id)
  }

  await db
    .prepare(
      `UPDATE sessions SET current_question_id = ?, question_seq = question_seq + 1 WHERE id = ?`
    )
    .run(out.question.id, p.sessionId)
  // 出题即记录（服务端权威去重；UNIQUE 防并发重复）
  const seq = (await db
    .prepare('SELECT question_seq FROM sessions WHERE id = ?')
    .get(p.sessionId)) as {
    question_seq: number
  }
  try {
    await db
      .prepare('INSERT INTO session_asked (session_id, question_id, seq) VALUES (?, ?, ?)')
      .run(p.sessionId, out.question.id, seq.question_seq)
  } catch {
    // 并发重复出题：忽略
  }
  // 仅内容库题目写入跨场历史；收束题为岗位固定桩，不参与去重
  if (!out.isWrapup) {
    await recordAskedHistory(db, session.user_id, out.question.id, session.position_id)
  }
  return out.question
}

// 与服务端 mock 层一致的默认简历关键词（详见 api/mock/interview.mock.uts）
const DEFAULT_TOPICS: string[] = ['订单系统', '性能优化', '架构设计']

export async function submitAnswer(
  db: Db,
  uid: string,
  sessionId: string,
  questionId: string,
  text: string,
  isFollowup: boolean
): Promise<boolean> {
  // IDOR 防护：禁止向他人会话写入答案
  await requireSessionOwner(db, sessionId, uid)
  const t = now()
  const idxRow = (await db
    .prepare('SELECT COUNT(*) AS c FROM answers WHERE session_id = ? AND question_id = ?')
    .get(sessionId, questionId)) as { c: number }
  const userAnswerIndex = idxRow.c
  const idemKey = `${sessionId}:${questionId}:${userAnswerIndex}`
  try {
    await db
      .prepare(
        `INSERT INTO answers (session_id, question_id, user_answer_index, is_followup, speaker, text, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`
      )
      .run(sessionId, questionId, userAnswerIndex, isFollowup ? 1 : 0, text, idemKey, t)
  } catch {
    // UNIQUE 冲突 → 幂等重放，不报错
    return true
  }
  return true
}
