// 报告服务：由服务端答案生成评分报告（幂等缓存）并扣减面试额度
import { Db } from '../db.js'
import { now } from '../util.js'
import { Env } from '../config.js'
import { scoreInterview } from '../rules/scorer.js'
import { findQuestionById } from './content-bank.js'
import { findWrapupById } from '../data/wrapup.js'
import { QuestionItem, TranscriptEntry } from '../types/interview.js'
import { InterviewReport } from '../types/scoring.js'
import { consumeInterview } from './quota.js'
import { requireSessionOwner } from './session-access.js'
import { interpretReport, mergeInterpretation } from '../llm/report-enhancer.js'

type AnswerRow = {
  question_id: string
  user_answer_index: number
  is_followup: number
  text: string
  created_at: number
}

// 幂等重算评分报告：已存在则返回缓存；首次生成时扣减一次面试额度
// P1.2：规则评分为锚点；启用 LLM 时仅覆盖解释与优秀示例，失败回退纯规则。
// IDOR 防护：属主校验必须先于缓存查询（否则缓存命中即泄漏他人报告）。
export async function getReport(
  db: Db,
  uid: string,
  sessionId: string,
  env?: Env
): Promise<InterviewReport> {
  await requireSessionOwner(db, sessionId, uid)
  const cached = (await db
    .prepare('SELECT payload FROM reports WHERE session_id = ?')
    .get(sessionId)) as { payload: string } | undefined
  if (cached != null) {
    return JSON.parse(cached.payload) as InterviewReport
  }

  const rows = (await db
    .prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId)) as unknown[]
  const answers = rows.map((r) => r as AnswerRow)

  // 恢复题目对象 + 构造转写（面试官发语句=题面）
  const questions: QuestionItem[] = []
  const transcript: TranscriptEntry[] = []
  for (const a of answers) {
    // 题目权威源 = 内容库；收束题不在库中，按 id 回查固定模板兜底
    const q = (await findQuestionById(db, a.question_id)) ?? findWrapupById(a.question_id)
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

  // 规则分锚点不变；LLM 只补充解释与优秀示例（失败/关闭时保持纯规则）
  if (env != null && env.llmEnabled) {
    try {
      const interp = await interpretReport(
        {
          baseUrl: env.llmBaseUrl,
          apiKey: env.llmApiKey,
          model: env.llmModel,
          timeoutMs: env.llmTimeoutMs
        },
        report
      )
      if (interp != null) mergeInterpretation(report, interp)
    } catch {
      // LLM 失败不回滚规则报告，不阻断接口
    }
  }

  if (uid != null) {
    await db
      .prepare(
        `INSERT INTO reports (session_id, user_id, payload, generated_at) VALUES (?, (SELECT id FROM users WHERE uid = ?), ?, ?)`
      )
      .run(sessionId, uid, JSON.stringify(report), now())
    // 完成一场面试 → 扣减额度（会员不扣，单次包优先；幂等：仅在首次生成时）
    await consumeInterview(db, env, uid)
  }
  return report
}
