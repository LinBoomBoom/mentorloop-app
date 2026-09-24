// 面试引擎单测：题目选择器 / 追问引擎 / 评分量表 / 会话补传（推进计划 0.4–0.6）
// 纯逻辑，不依赖 UI / 后端 / uni API。
import { describe, it, expect } from 'vitest'
import { selectNext, getModeBudget, SelectorInput } from '../engine/question-selector.uts'
import { decideFollowup, AnswerSignal } from '../engine/followup-engine.uts'
import { confidenceBand, displayLevel } from '../engine/rubric.uts'
import { analyzeAnswer } from '../engine/answer-signal.uts'
import { scoreInterview } from '../engine/scorer.uts'
import { interviewSession } from '../store/interview-session.uts'
import { QUESTION_BANK, WRAPUP_QUESTION } from '../data/question-bank.uts'
import { QuestionItem, PositionBlueprint } from '../types/interview.uts'

const BLUEPRINT: PositionBlueprint = {
  positionId: 'java-backend',
  position: 'Java 后端',
  experienceLevel: 'junior',
  experienceRange: '1-3年',
  companyType: '互联网',
  language: '中文',
  target: '求职'
} as PositionBlueprint

function makeInput(
  asked: QuestionItem[],
  remainSeconds = 1200,
  topics: string[] = ['订单系统']
): SelectorInput {
  return {
    blueprint: BLUEPRINT,
    mode: 'standard',
    asked: asked,
    remainSeconds: remainSeconds,
    resumeRiskTopics: topics
  } as SelectorInput
}

describe('题目选择器（文档 02 §3.2）', () => {
  it('模式预算正确：快练3题/标准7题/深度12题', () => {
    expect(getModeBudget('quick').maxQuestions).toBe(3)
    expect(getModeBudget('standard').maxQuestions).toBe(7)
    expect(getModeBudget('deep').maxQuestions).toBe(12)
  })

  it('规则1：优先覆盖未触达的能力域且不重复出题', () => {
    const asked: QuestionItem[] = []
    const seen: string[] = []
    const domains = new Set<string>()
    for (let i = 0; i < 6; i++) {
      const out = selectNext(makeInput(asked))
      expect(out).not.toBeNull()
      expect(seen.includes(out!.question.id)).toBe(false)
      seen.push(out!.question.id)
      domains.add(out!.question.abilityDomain)
      asked.push(out!.question)
    }
    // 前 6 题应覆盖全部 6 个能力域
    expect(domains.size).toBe(6)
  })

  it('规则4/5：达到题目上限后返回收束题，收束题问完返回 null', () => {
    const asked: QuestionItem[] = []
    for (let i = 0; i < 7; i++) {
      const out = selectNext(makeInput(asked))
      expect(out).not.toBeNull()
      asked.push(out!.question)
    }
    const wrap = selectNext(makeInput(asked))
    expect(wrap).not.toBeNull()
    expect(wrap!.isWrapup).toBe(true)
    expect(wrap!.question.id).toBe(WRAPUP_QUESTION.id)
    asked.push(wrap!.question)
    expect(selectNext(makeInput(asked))).toBeNull()
  })

  it('规则5：剩余时间不足一题时直接收束', () => {
    const out = selectNext(makeInput([], 60))
    expect(out).not.toBeNull()
    expect(out!.isWrapup).toBe(true)
  })

  it('规则2：简历包含"性能优化/QPS"关键词 → 命中量化成果题 q-e02', () => {
    // 先出完 6 个能力域题（q-k01..q-c01 范围），触发规则2 简历验证题
    const asked: QuestionItem[] = []
    // 把 6 个能力域各出一道：直接从 BANK 中挑各域第一道
    const covered = new Set<string>()
    for (let i = 0; i < QUESTION_BANK.length && covered.size < 6; i++) {
      const q = QUESTION_BANK[i]
      if (covered.has(q.abilityDomain)) continue
      asked.push(q)
      covered.add(q.abilityDomain)
    }
    const out = selectNext(makeInput(asked, 1200, ['性能优化 把接口RT从300ms降到80ms QPS提升']))
    expect(out).not.toBeNull()
    expect(out!.isWrapup).toBe(false)
    // 应命中关键词"优化/QPS/提升/降低/RT" → q-e02 量化成果
    expect(out!.question.id).toBe('q-e02')
  })

  it('规则2：简历提到"独立负责模块" → 命中职责边界题 q-e03', () => {
    const asked: QuestionItem[] = []
    const covered = new Set<string>()
    for (let i = 0; i < QUESTION_BANK.length && covered.size < 6; i++) {
      const q = QUESTION_BANK[i]
      if (covered.has(q.abilityDomain)) continue
      asked.push(q)
      covered.add(q.abilityDomain)
    }
    const out = selectNext(makeInput(asked, 1200, ['独立负责支付模块 主导核心模块开发']))
    expect(out).not.toBeNull()
    expect(out!.question.id).toBe('q-e03')
  })

  it('规则2：无简历关键词时兜底返回第一道 resumeRisk 题，链路不中断', () => {
    const asked: QuestionItem[] = []
    const covered = new Set<string>()
    for (let i = 0; i < QUESTION_BANK.length && covered.size < 6; i++) {
      const q = QUESTION_BANK[i]
      if (covered.has(q.abilityDomain)) continue
      asked.push(q)
      covered.add(q.abilityDomain)
    }
    const out = selectNext(makeInput(asked, 1200, ['某普通项目描述']))
    expect(out).not.toBeNull()
    expect(out!.question.resumeRisk).toBe(true)
  })
})

describe('追问引擎（文档 02 §3.3）', () => {
  const projectQuestion = QUESTION_BANK.find((q) => q.id === 'q-e01')!

  function makeSignal(over: Partial<AnswerSignal>): AnswerSignal {
    return {
      questionId: 'q-e01',
      text: '我负责了订单系统的重构',
      isVague: false,
      hasMetrics: true,
      isAbsolute: false,
      contradictsPrevious: false,
      ...over
    } as AnswerSignal
  }

  it('硬约束：深挖达到 2 层后不再追问', () => {
    const d = decideFollowup(makeSignal({}), projectQuestion, 2)
    expect(d.shouldFollowup).toBe(false)
    expect(d.reason).toContain('最大深挖深度')
  })

  it('模糊回答 → 澄清意图', () => {
    const d = decideFollowup(makeSignal({ isVague: true }), projectQuestion, 0)
    expect(d.shouldFollowup).toBe(true)
    expect(d.intent).toBe('clarify')
  })

  it('绝对化表述 → 反例意图', () => {
    const d = decideFollowup(makeSignal({ isAbsolute: true }), projectQuestion, 0)
    expect(d.intent).toBe('counterexample')
  })

  it('项目题首层深挖、二层迁移', () => {
    const d0 = decideFollowup(makeSignal({}), projectQuestion, 0)
    expect(d0.intent).toBe('deepdive')
    expect(d0.depth).toBe(1)
    const d1 = decideFollowup(makeSignal({}), projectQuestion, 1)
    expect(d1.intent).toBe('transfer')
    expect(d1.depth).toBe(2)
  })

  it('禁则：隐私话题不追问', () => {
    const d = decideFollowup(makeSignal({ text: '关于婚育情况…' }), projectQuestion, 0)
    expect(d.shouldFollowup).toBe(false)
    expect(d.reason).toContain('隐私')
  })
})

describe('评分量表（文档 02 §3.4）', () => {
  it('置信度分级正确', () => {
    expect(confidenceBand(0.8)).toBe('high')
    expect(confidenceBand(0.6)).toBe('medium')
    expect(confidenceBand(0.3)).toBe('low')
  })

  it('低置信度不伪装精确分数', () => {
    expect(displayLevel('B', 0.3)).toContain('证据不足')
    expect(displayLevel('B', 0.8)).toBe('B')
  })
})

describe('会话补传队列与草稿（文档 04）', () => {
  it('事件进入待补传队列，确认后按幂等键移除', () => {
    interviewSession.reset('flush-test')
    interviewSession.transition('DEVICE_CHECK')
    interviewSession.transition('READY')
    expect(interviewSession.getPendingEvents().length).toBe(2)
    interviewSession.flushEvents(['flush-test-1'])
    const rest = interviewSession.getPendingEvents()
    expect(rest.length).toBe(1)
    expect(rest[0].idempotencyKey).toBe('flush-test-2')
  })

  it('作答草稿按题目覆盖更新', () => {
    interviewSession.reset('draft-test')
    interviewSession.saveDraft('q1', '第一版回答')
    interviewSession.saveDraft('q1', '第二版回答')
    expect(interviewSession.getDrafts().length).toBe(1)
    expect(interviewSession.getDraft('q1')!.text).toBe('第二版回答')
  })
})

describe('答案信号分析器', () => {
  it('过短回答判为模糊', () => {
    const s = analyzeAnswer('短', 'q1')
    expect(s.isVague).toBe(true)
  })

  it('含模糊词判为模糊', () => {
    const s = analyzeAnswer('这个我大概可能记不清了，应该是做过的', 'q1')
    expect(s.isVague).toBe(true)
  })

  it('含数字+单位视为有指标', () => {
    const s = analyzeAnswer('把接口 RT 从 300ms 优化到 50ms，QPS 提升了 3 倍', 'q1')
    expect(s.hasMetrics).toBe(true)
    expect(s.isVague).toBe(false)
  })

  it('纯数字无单位不视为指标', () => {
    const s = analyzeAnswer('做了一些事情，三个人一起', 'q1')
    expect(s.hasMetrics).toBe(false)
  })

  it('绝对化表述被识别', () => {
    const s = analyzeAnswer('这个方案绝对没有问题，所有情况都能覆盖', 'q1')
    expect(s.isAbsolute).toBe(true)
  })
})

describe('规则评分器', () => {
  // 造一组题目+对应"有内容"的回答，验证评分器能输出完整报告结构
  it('输出合法的 InterviewReport，维度数=6，等级在 A-D 之间', () => {
    const qs = QUESTION_BANK.slice(0, 6) // 6 道题覆盖多能力域
    const ts = []
    for (let i = 0; i < qs.length; i++) {
      ts.push({
        questionId: qs[i].id,
        speaker: 'interviewer',
        text: qs[i].content,
        timestamp: Date.now()
      })
      // 一道有"我负责""QPS 1000"等证据的"好回答"
      ts.push({
        questionId: qs[i].id,
        speaker: 'user',
        text: '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。我对比了两个方案，权衡了风险并做了降级兜底。过程中遇到过一次线上故障，我做了复盘并加了监控。',
        timestamp: Date.now()
      })
    }
    const r = scoreInterview(qs, ts as any)
    expect(r.overall.length).toBeGreaterThan(0)
    expect(r.dimensions.length).toBe(6)
    for (let i = 0; i < r.dimensions.length; i++) {
      const d = r.dimensions[i]
      expect(['A', 'B', 'C', 'D'].includes(d.level)).toBe(true)
      expect(d.confidence).toBeGreaterThanOrEqual(0)
      expect(d.confidence).toBeLessThanOrEqual(1)
    }
    expect(r.trainingPlan.length).toBeGreaterThan(0)
  })

  it('回答过短被识别为模糊：communication/knowledge 分数下降', () => {
    const qs = QUESTION_BANK.slice(0, 6)
    const ts = []
    for (let i = 0; i < qs.length; i++) {
      ts.push({
        questionId: qs[i].id,
        speaker: 'interviewer',
        text: qs[i].content,
        timestamp: Date.now()
      })
      ts.push({
        questionId: qs[i].id,
        speaker: 'user',
        text: '大概就是那样做的吧', // 过短+模糊
        timestamp: Date.now()
      })
    }
    const r = scoreInterview(qs, ts as any)
    const comm = r.dimensions.find((d: any) => d.dimension === 'communication')!
    // 短模糊回答 → communication 不超过 C
    expect(['C', 'D'].includes(comm.level)).toBe(true)
  })
})
