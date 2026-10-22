// 专项训练取题服务（2026-10-22 契约冻结：/training/questions）
// 数据源：questions 内容库（只读）；选择规则复用正式面试的题目选择器，保证训练与面试同一口径。
// 与正式面试的区别：不建会话、不写 session_asked / answers、不扣面试额度。

import { Db } from '../db.js'
import { loadCandidates } from './content-bank.js'
import { selectNext, SelectorInput } from '../rules/question-selector.js'
import { QuestionItem, PositionBlueprint, PositionId, ExperienceLevel } from '../types/interview.js'
import { getPositionName, getExperienceRange } from '../data/position-options.js'

export type TrainingQuestionsInput = {
  positionId: PositionId
  experienceLevel: ExperienceLevel
  domain: string // '' = 不限维度
  count: number
}

export const MIN_TRAINING_QUESTIONS = 1
export const MAX_TRAINING_QUESTIONS = 10

// 按岗位 / 经验等级 / 能力域，从内容库抽 count 道训练题
// 返回实际可用题量（内容库不足时可能少于 count，甚至为空）
export async function loadTrainingQuestions(
  db: Db,
  input: TrainingQuestionsInput
): Promise<QuestionItem[]> {
  const count = Math.max(
    MIN_TRAINING_QUESTIONS,
    Math.min(MAX_TRAINING_QUESTIONS, Math.floor(input.count))
  )
  const blueprint: PositionBlueprint = {
    positionId: input.positionId,
    position: getPositionName(input.positionId),
    experienceLevel: input.experienceLevel,
    experienceRange: getExperienceRange(input.experienceLevel),
    companyType: '互联网',
    language: '中文',
    target: '求职'
  } as PositionBlueprint

  const candidates = await loadCandidates(db, input.positionId)
  const asked: QuestionItem[] = []
  const out: QuestionItem[] = []
  for (let i = 0; i < count; i++) {
    const res = selectNext({
      blueprint,
      mode: 'quick',
      asked,
      remainSeconds: 9999, // 训练不吃时间预算
      resumeRiskTopics: [],
      resumeTechStacks: [],
      focusDomain: input.domain,
      maxQuestions: count,
      candidates
    } as SelectorInput)
    if (res == null || res.isWrapup) break
    out.push(res.question)
    asked.push(res.question)
  }
  return out
}
