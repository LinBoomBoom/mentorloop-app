// 双端规则一致性 golden 测试（P1 防漂移杠杆）
// 客户端 engine/*.uts（UTS，vitest 插件按 TS 转译）与服务端 server/src/rules/*.ts +
// server/src/data/*.ts 是人工镜像的双份维护（SOP：同一任务双侧同步）。本测试对同一组
// 固定输入断言双端输出完全一致（题库/图谱/选项全量 deep-equal + 选题序列 + 评分报告），
// 任何一侧单独修改都会在此处失败 —— 这是防 drift 的最低成本守卫。
// 注：followup-engine 为客户端独有（服务端有意未移植，见 server/src/rules/answer-signal.ts 头注释）。
import { describe, it, expect } from 'vitest'

// ---- 客户端侧（.uts，经 env.d.ts 宽松声明）----
import {
  selectNext as cSelectNext,
  getModeBudget as cGetModeBudget
} from '../engine/question-selector.uts'
import { scoreInterview as cScoreInterview } from '../engine/scorer.uts'
import {
  confidenceBand as cConfidenceBand,
  displayLevel as cDisplayLevel,
  RUBRIC as cRubric
} from '../engine/rubric.uts'
import { analyzeAnswer as cAnalyzeAnswer } from '../engine/answer-signal.uts'
import { rephraseQuestion as cRephrase } from '../engine/rephrase.uts'
import { QUESTION_BANK as cBank } from '../data/question-bank.uts'
import {
  WRAPUP_QUESTION as cWrapup,
  FRONTEND_WRAPUP_QUESTION as cFeWrapup,
  AI_WRAPUP_QUESTION as cAiWrapup,
  getWrapupForPosition as cWrapupFor
} from '../data/wrapup.uts'
import {
  POSITION_OPTIONS as cPositions,
  EXPERIENCE_OPTIONS as cExperiences,
  DIFFICULTY_PRIORITY as cDiffPriority
} from '../data/position-options.uts'
import { getDomainIds as cDomainIds } from '../data/backend-map.uts'
import { classifyDimension as cClassify } from '../engine/dimension-classifier.uts'
import { phraseQuestion as cPhrase } from '../engine/question-phrasing.uts'
import {
  DIMENSION_RULES as cDimRules,
  SUBTRACK_DOMAIN as cSubtrackDomain
} from '../data/dimension-rules.uts'

// ---- 服务端侧（纯 TS）----
import {
  selectNext as sSelectNext,
  getModeBudget as sGetModeBudget,
  SelectorInput as SSelectorInput
} from '../server/src/rules/question-selector'
import { scoreInterview as sScoreInterview } from '../server/src/rules/scorer'
import {
  confidenceBand as sConfidenceBand,
  displayLevel as sDisplayLevel,
  RUBRIC as sRubric
} from '../server/src/rules/rubric'
import { analyzeAnswer as sAnalyzeAnswer } from '../server/src/rules/answer-signal'
import { rephraseQuestion as sRephrase } from '../server/src/rules/rephrase'
import { QUESTION_BANK as sBank } from '../server/src/data/question-bank'
import {
  WRAPUP_QUESTION as sWrapup,
  FRONTEND_WRAPUP_QUESTION as sFeWrapup,
  AI_WRAPUP_QUESTION as sAiWrapup,
  getWrapupForPosition as sWrapupFor
} from '../server/src/data/wrapup'
import {
  POSITION_OPTIONS as sPositions,
  EXPERIENCE_OPTIONS as sExperiences,
  DIFFICULTY_PRIORITY as sDiffPriority
} from '../server/src/data/position-options'
import { getDomainIds as sDomainIds } from '../server/src/data/domain-ids'
import { classifyDimension as sClassify } from '../server/src/rules/dimension-classifier'
import { phraseQuestion as sPhrase } from '../server/src/rules/question-phrasing'
import {
  DIMENSION_RULES as sDimRules,
  SUBTRACK_DOMAIN as sSubtrackDomain
} from '../server/src/data/dimension-rules'
import type { PositionBlueprint } from '../server/src/types/interview'

const BACKEND_BLUEPRINT: PositionBlueprint = {
  positionId: 'backend',
  position: '后端',
  experienceLevel: 'junior',
  experienceRange: '1-3年',
  companyType: '互联网',
  language: '中文',
  target: '求职'
}

const FRONTEND_BLUEPRINT: PositionBlueprint = {
  ...BACKEND_BLUEPRINT,
  positionId: 'frontend',
  position: '前端'
}

function makeInput(over: {
  blueprint?: PositionBlueprint
  mode?: 'quick' | 'standard' | 'deep'
  asked?: any[]
  remainSeconds?: number
  topics?: string[]
  focusDomain?: string
  maxQuestions?: number
}): SSelectorInput {
  return {
    blueprint: over.blueprint ?? BACKEND_BLUEPRINT,
    mode: over.mode ?? 'standard',
    asked: over.asked ?? [],
    remainSeconds: over.remainSeconds ?? 1200,
    resumeRiskTopics: over.topics ?? [],
    resumeTechStacks: [],
    focusDomain: over.focusDomain ?? '',
    maxQuestions: over.maxQuestions ?? 0,
    candidates: sBank
  }
}

// 贪心跑到收束/返回 null，采集完整出题序列（含完整 QuestionItem 对象）
function collectSequence(
  select: (input: SSelectorInput) => any,
  input: SSelectorInput,
  cap = 16
): any[] {
  const out: any[] = []
  const asked: any[] = []
  for (let i = 0; i < cap; i++) {
    const step = select({ ...input, asked } as SSelectorInput)
    if (step == null) break
    out.push(step)
    if (step.isWrapup === true) break
    asked.push(step.question)
  }
  return out
}

describe('双端数据镜像：题库 / 收束题 / 岗位选项 / 能力域', () => {
  it('QUESTION_BANK 逐字段一致', () => {
    expect(cBank).toEqual(sBank)
  })

  it('收束题（后端/前端/AI）逐字段一致', () => {
    expect(cWrapup).toEqual(sWrapup)
    expect(cFeWrapup).toEqual(sFeWrapup)
    expect(cAiWrapup).toEqual(sAiWrapup)
    expect(cWrapupFor('backend')).toEqual(sWrapupFor('backend'))
    expect(cWrapupFor('frontend')).toEqual(sWrapupFor('frontend'))
    expect(cWrapupFor('ai')).toEqual(sWrapupFor('ai'))
  })

  it('岗位/经验选项与难度优先级一致', () => {
    expect(cPositions).toEqual(sPositions)
    expect(cExperiences).toEqual(sExperiences)
    expect(cDiffPriority).toEqual(sDiffPriority)
  })

  it('能力域 id 清单一致（前端图谱 vs 服务端硬编码）', () => {
    expect(cDomainIds()).toEqual(sDomainIds())
  })

  it('评分量表 RUBRIC 一致', () => {
    expect(cRubric).toEqual(sRubric)
  })
})

describe('双端选题器：模式预算与出题序列', () => {
  it('getModeBudget 三模式一致', () => {
    expect(cGetModeBudget('quick')).toEqual(sGetModeBudget('quick'))
    expect(cGetModeBudget('standard')).toEqual(sGetModeBudget('standard'))
    expect(cGetModeBudget('deep')).toEqual(sGetModeBudget('deep'))
  })

  it('后端 standard 全序列一致（直至收束）', () => {
    const input = makeInput({ blueprint: BACKEND_BLUEPRINT })
    expect(collectSequence(cSelectNext, input)).toEqual(collectSequence(sSelectNext, input))
  })

  it('前端 standard 全序列一致（岗位隔离不漂移）', () => {
    const input = makeInput({ blueprint: FRONTEND_BLUEPRINT })
    expect(collectSequence(cSelectNext, input)).toEqual(collectSequence(sSelectNext, input))
  })

  it('quick 模式（3 题即收束）一致', () => {
    const input = makeInput({ mode: 'quick', remainSeconds: 300 })
    expect(collectSequence(cSelectNext, input)).toEqual(collectSequence(sSelectNext, input))
  })

  it('deep 模式前 5 题一致', () => {
    const input = makeInput({ mode: 'deep', remainSeconds: 2400 })
    const cap5 = (select: any) => {
      const out: any[] = []
      let asked: any[] = []
      for (let i = 0; i < 5; i++) {
        const step = select({ ...input, asked } as SSelectorInput)
        if (step == null) break
        out.push(step)
        asked = [...asked, step.question]
      }
      return out
    }
    expect(cap5(cSelectNext)).toEqual(cap5(sSelectNext))
  })

  it('简历风险关键词命中（q-e02/q-e03 场景）一致', () => {
    const seeded: any[] = []
    const seenDomains = new Set<string>()
    for (const q of sBank) {
      if (seenDomains.size >= 6) break
      if (seenDomains.has(q.abilityDomain)) continue
      seenDomains.add(q.abilityDomain)
      seeded.push(q)
    }
    const cases = [
      ['性能优化 把接口RT从300ms降到80ms QPS提升'],
      ['独立负责支付模块 主导核心模块开发'],
      ['某普通项目描述']
    ]
    for (const topics of cases) {
      const input = makeInput({ asked: seeded, topics })
      const c = cSelectNext(input)
      const s = sSelectNext(input)
      expect(c).not.toBeNull()
      expect(s).not.toBeNull()
      expect(c).toEqual(s)
    }
  })

  it('focusDomain 定向训练出题序列一致', () => {
    const input = makeInput({ remainSeconds: 9999, focusDomain: 'analysis' })
    expect(collectSequence(cSelectNext, input)).toEqual(collectSequence(sSelectNext, input))
  })

  it('剩余时间不足收束判断一致（remainSeconds=60）', () => {
    const input = makeInput({ remainSeconds: 60 })
    const c = cSelectNext(input)
    const s = sSelectNext(input)
    expect(c).not.toBeNull()
    expect(s).not.toBeNull()
    expect(c).toEqual(s)
  })

  it('maxQuestions 覆盖预算收束判断一致（maxQuestions=2）', () => {
    const input = makeInput({ remainSeconds: 9999, maxQuestions: 2 })
    expect(collectSequence(cSelectNext, input)).toEqual(collectSequence(sSelectNext, input))
  })
})

describe('双端答案信号与量表映射', () => {
  const texts = [
    '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。',
    '大概就是那样做的吧',
    '这个方案绝对没有问题，所有情况都能覆盖',
    '做了一些事情，三个人一起',
    '这个我大概可能记不清了，应该是做过的'
  ]
  it('analyzeAnswer 信号逐字段一致', () => {
    for (const text of texts) {
      expect(cAnalyzeAnswer(text, 'q-e01')).toEqual(sAnalyzeAnswer(text, 'q-e01'))
    }
  })

  it('confidenceBand / displayLevel 边界一致', () => {
    for (const v of [0, 0.3, 0.49, 0.5, 0.6, 0.74, 0.75, 0.8, 1]) {
      expect(cConfidenceBand(v)).toBe(sConfidenceBand(v))
      expect(cDisplayLevel('B', v)).toBe(sDisplayLevel('B', v))
      expect(cDisplayLevel('D', v)).toBe(sDisplayLevel('D', v))
    }
  })
})

describe('双端评分器：完整报告一致', () => {
  function transcript(style: 'good' | 'vague'): any[] {
    const qs = sBank.slice(0, 6)
    const ts: any[] = []
    for (let i = 0; i < qs.length; i++) {
      ts.push({
        questionId: qs[i].id,
        speaker: 'interviewer',
        text: qs[i].content,
        timestamp: i * 1000
      })
      ts.push({
        questionId: qs[i].id,
        speaker: 'user',
        text:
          style === 'good'
            ? '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。我对比了两个方案，权衡了风险并做了降级兜底。过程中遇到过一次线上故障，我做了复盘并加了监控。'
            : '大概就是那样做的吧',
        timestamp: i * 1000 + 500
      })
    }
    return ts
  }

  it('good 回答：六维报告全字段一致', () => {
    const qs = sBank.slice(0, 6)
    const ts = transcript('good')
    expect(cScoreInterview(qs, ts)).toEqual(sScoreInterview(qs, ts))
  })

  it('vague 回答：扣分路径一致', () => {
    const qs = sBank.slice(0, 6)
    const ts = transcript('vague')
    expect(cScoreInterview(qs, ts)).toEqual(sScoreInterview(qs, ts))
  })
})

describe('双端换一种说法：澄清句一致且不泄题', () => {
  const cases = [
    { knowledgePoint: '线程池参数', purpose: '评估参数决策是否有依据' },
    { knowledgePoint: '锁与并发安全', purpose: '' },
    { knowledgePoint: '', purpose: '' }
  ]

  it('rephraseQuestion 双端输出逐字一致', () => {
    for (const c of cases) {
      expect(cRephrase(c)).toBe(sRephrase(c))
    }
  })

  it('题库全量：澄清句不含 expectedEvidence（防泄题）', () => {
    for (const q of cBank) {
      const out = cRephrase({ knowledgePoint: q.knowledgePoint, purpose: q.purpose })
      if (q.expectedEvidence.length > 0) {
        expect(out.includes(q.expectedEvidence)).toBe(false)
      }
    }
  })
})

describe('双端内容适配规则：六维分类器 / 题面生成（批次 A）', () => {
  it('DIMENSION_RULES 与 SUBTRACK_DOMAIN 逐字段一致', () => {
    expect(cDimRules).toEqual(sDimRules)
    expect(cSubtrackDomain).toEqual(sSubtrackDomain)
  })

  // 覆盖三条路径：关键词命中（多者取胜）/ special 兜底 analysis / subtrack 兜底
  const cases = [
    { keywords: ['优先级', 'specificity', '层叠'], subtrack: 'fe-web', tech: 'CSS', qType: 'hot' },
    { keywords: ['限流', '降级', '容量'], subtrack: 'be-web', tech: '系统设计', qType: 'hot' },
    { keywords: ['单测', 'CI', '发布流程'], subtrack: 'be-test', tech: '自动化测试', qType: 'hot' },
    { keywords: ['DNS', '解析'], subtrack: 'be-web', tech: '网络', qType: 'hot' },
    { keywords: ['未知词'], subtrack: 'be-micro', tech: '微服务', qType: 'hot' },
    { keywords: [], subtrack: 'ai-app', tech: 'RAG', qType: 'hot' },
    { keywords: ['不可能的短语zzz'], subtrack: 'ai-algo', tech: '', qType: 'special' }
  ]

  it('classifyDimension 双端逐例一致', () => {
    for (const c of cases) {
      expect(cClassify(c)).toBe(sClassify(c))
    }
  })

  it('classifyDimension 输出恒为六维之一', () => {
    const domains = [
      'knowledge',
      'engineering',
      'analysis',
      'communication',
      'learning',
      'motivation'
    ]
    for (const c of cases) {
      expect(domains.includes(sClassify(c))).toBe(true)
    }
  })

  it('phraseQuestion 双端逐字一致（hot/special）', () => {
    const titles = [
      'DNS 解析过程',
      'K8s 中 Pod 的探针',
      'CSS 优先级与层叠规则',
      '',
      // 问句型：命中设问特征 → 直通不包装（ISS-20261019-01）
      '错误消息会跨进程透传给调用方，为什么必须脱敏？请举例说明哪些内容绝对不能放进 error message。',
      '什么是闭包？'
    ]
    for (const t of titles) {
      expect(cPhrase(t, 'hot')).toBe(sPhrase(t, 'hot'))
      expect(cPhrase(t, 'special')).toBe(sPhrase(t, 'special'))
    }
  })
})
