// 固定评测集运行器（文档 05 铁律：模型或评分规则变更必须运行固定评测集）
// 评测集本体：tests/evals/eval-set.ts（数据驱动，AI / CO / QA 可评审与扩充）
// 输出：按层（选题 / 追问 / 评分）分别给出通过结果，便于填入评测报告模板
import { describe, it, expect } from 'vitest'
import { EVAL_CASES, EVAL_SET_VERSION, EVAL_SET_FROZEN_AT, EvalCase } from './eval-set'
import { selectNext, SelectorInput } from '../../engine/question-selector.uts'
import { decideFollowup, AnswerSignal } from '../../engine/followup-engine.uts'
import { scoreInterview } from '../../engine/scorer.uts'
import { QUESTION_BANK } from '../../data/question-bank.uts'
import { QuestionItem, PositionBlueprint } from '../../types/interview.uts'

function casesOf(layer: string): EvalCase[] {
  return EVAL_CASES.filter((c) => c.layer === layer)
}

function questionById(id: string): QuestionItem {
  const q = QUESTION_BANK.find((item) => item.id === id)
  if (q == null) throw new Error('评测集引用了不存在的题目：' + id)
  return q
}

function runSelection(c: EvalCase) {
  const input: SelectorInput = {
    blueprint: c.blueprint as unknown as PositionBlueprint,
    mode: c.mode as unknown as SelectorInput['mode'],
    asked: (c.askedIds ?? []).map(questionById),
    remainSeconds: c.remainSeconds ?? 0,
    resumeRiskTopics: c.resumeRiskTopics ?? [],
    focusDomain: c.focusDomain ?? '',
    maxQuestions: c.maxQuestions ?? 0
  } as SelectorInput
  return selectNext(input)
}

function runFollowup(c: EvalCase) {
  const signal: AnswerSignal = {
    questionId: c.questionId ?? '',
    text: c.text ?? '',
    isVague: c.isVague ?? false,
    hasMetrics: c.hasMetrics ?? false,
    isAbsolute: c.isAbsolute ?? false,
    contradictsPrevious: c.contradictsPrevious ?? false
  } as AnswerSignal
  return decideFollowup(signal, questionById(c.questionId ?? ''), c.depth ?? 0)
}

function runScoring(c: EvalCase) {
  const count = c.scoringCount ?? 6
  const questions: QuestionItem[] = QUESTION_BANK.slice(0, count)
  const transcript = []
  for (let i = 0; i < questions.length; i++) {
    transcript.push({
      questionId: questions[i].id,
      speaker: 'interviewer',
      text: questions[i].content,
      timestamp: 0
    })
    transcript.push({
      questionId: questions[i].id,
      speaker: 'user',
      text: c.scoringAnswerText ?? '',
      timestamp: 0
    })
  }
  return scoreInterview(questions, transcript as any)
}

describe('固定评测集（元信息）', () => {
  it('评测集版本与用例数有效', () => {
    expect(EVAL_SET_VERSION.length).toBeGreaterThan(0)
    expect(EVAL_SET_FROZEN_AT.length).toBeGreaterThan(0)
    expect(EVAL_CASES.length).toBeGreaterThan(0)
  })
})

describe('固定评测集 · 选题器', () => {
  const cases = casesOf('selection')
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    it(c.id + ' ' + c.title, () => {
      const out = runSelection(c)
      if (c.expect.notNull === false) {
        expect(out).toBeNull()
        return
      }
      expect(out).not.toBeNull()
      const r = out!
      if (c.expect.isWrapup != null) expect(r.isWrapup).toBe(c.expect.isWrapup)
      if (c.expect.questionPositionId != null) {
        expect(r.question.positionId).toBe(c.expect.questionPositionId)
      }
      if (c.expect.questionAbilityDomain != null) {
        expect(r.question.abilityDomain).toBe(c.expect.questionAbilityDomain)
      }
    })
  }
})

describe('固定评测集 · 追问引擎', () => {
  const cases = casesOf('followup')
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    it(c.id + ' ' + c.title, () => {
      const d = runFollowup(c)
      if (c.expect.shouldFollowup != null) {
        expect(d.shouldFollowup).toBe(c.expect.shouldFollowup)
      }
      if (c.expect.intent != null) expect(d.intent).toBe(c.expect.intent)
      if (c.expect.followupDepth != null) expect(d.depth).toBe(c.expect.followupDepth)
      if (c.expect.reasonContains != null) expect(d.reason).toContain(c.expect.reasonContains)
    })
  }
})

describe('固定评测集 · 评分器', () => {
  const cases = casesOf('scoring')
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    it(c.id + ' ' + c.title, () => {
      const r = runScoring(c)
      if (c.expect.dimensionCount != null) {
        expect(r.dimensions.length).toBe(c.expect.dimensionCount)
      }
      if (c.expect.levelsIn != null) {
        for (let j = 0; j < r.dimensions.length; j++) {
          expect(c.expect.levelsIn.includes(r.dimensions[j].level)).toBe(true)
        }
      }
      if (c.expect.confidenceBetween != null) {
        const lo = c.expect.confidenceBetween[0]
        const hi = c.expect.confidenceBetween[1]
        for (let j = 0; j < r.dimensions.length; j++) {
          expect(r.dimensions[j].confidence).toBeGreaterThanOrEqual(lo)
          expect(r.dimensions[j].confidence).toBeLessThanOrEqual(hi)
        }
      }
      if (c.expect.dimensionLevelIn != null) {
        const keys = Object.keys(c.expect.dimensionLevelIn)
        for (let k = 0; k < keys.length; k++) {
          const dim = keys[k]
          const allowed = c.expect.dimensionLevelIn[dim]
          const found = r.dimensions.find((d: any) => d.dimension === dim)
          expect(found).toBeDefined()
          expect(allowed.includes(found!.level)).toBe(true)
        }
      }
      if (c.expect.trainingPlanMin != null) {
        expect(r.trainingPlan.length).toBeGreaterThanOrEqual(c.expect.trainingPlanMin)
      }
    })
  }
})
