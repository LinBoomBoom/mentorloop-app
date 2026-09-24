// MentorLoop 固定评测集（数据驱动）
// 用途：模型或评分规则变更时必须运行（文档 05 铁律）；由 AI / CO / QA 共同评审与扩充。
// 纪律：修改任一条用例即视为评测集版本升级，须显式更新 EVAL_SET_VERSION。
// 运行：pnpm test（tests/evals/eval.spec.ts 逐层执行并给出分层结果）

export const EVAL_SET_VERSION = '1.0.0'
export const EVAL_SET_FROZEN_AT = '2026-09-24'

export type EvalLayer = 'selection' | 'followup' | 'scoring'

export type EvalBlueprint = {
  positionId: string
  position: string
  experienceLevel: string
  experienceRange: string
  companyType: string
  language: string
  target: string
}

export type EvalExpect = {
  // selection
  notNull?: boolean
  isWrapup?: boolean
  questionPositionId?: string
  questionAbilityDomain?: string
  // followup
  shouldFollowup?: boolean
  intent?: string
  followupDepth?: number
  reasonContains?: string
  // scoring
  dimensionCount?: number
  levelsIn?: string[]
  confidenceBetween?: number[]
  dimensionLevelIn?: { [key: string]: string[] }
  trainingPlanMin?: number
}

export type EvalCase = {
  id: string
  layer: EvalLayer
  title: string
  // selection 输入
  blueprint?: EvalBlueprint
  mode?: string
  askedIds?: string[]
  remainSeconds?: number
  resumeRiskTopics?: string[]
  focusDomain?: string
  maxQuestions?: number
  // followup 输入
  questionId?: string
  text?: string
  isVague?: boolean
  hasMetrics?: boolean
  isAbsolute?: boolean
  contradictsPrevious?: boolean
  depth?: number
  // scoring 输入
  scoringCount?: number
  scoringAnswerText?: string
  // 期望
  expect: EvalExpect
}

const JAVA: EvalBlueprint = {
  positionId: 'java-backend',
  position: 'Java 后端',
  experienceLevel: 'junior',
  experienceRange: '1-3年',
  companyType: '互联网',
  language: '中文',
  target: '求职'
}

const FRONTEND: EvalBlueprint = {
  positionId: 'frontend',
  position: '前端',
  experienceLevel: 'junior',
  experienceRange: '1-3年',
  companyType: '互联网',
  language: '中文',
  target: '求职'
}

// 评分用例统一使用的两种回答：有证据 vs 短模糊
export const ANSWER_WITH_EVIDENCE =
  '我负责了这个模块的设计，上线后把 RT 从 300ms 优化到 80ms，QPS 提升到 5000。我对比了两个方案，权衡了风险并做了降级兜底。过程中遇到过一次线上故障，我做了复盘并加了监控。'
export const ANSWER_VAGUE_SHORT = '大概就是那样做的吧'

export const EVAL_CASES: EvalCase[] = [
  // ---------------- 选题器（文档 02 §3.2） ----------------
  {
    id: 'sel-001',
    layer: 'selection',
    title: '首题非收束、属岗位、覆盖首个未触达能力域',
    blueprint: JAVA,
    mode: 'standard',
    askedIds: [],
    remainSeconds: 1200,
    resumeRiskTopics: [],
    focusDomain: '',
    maxQuestions: 0,
    expect: {
      notNull: true,
      isWrapup: false,
      questionPositionId: 'java-backend',
      questionAbilityDomain: 'knowledge'
    }
  },
  {
    id: 'sel-002',
    layer: 'selection',
    title: '剩余时间不足一题 → 直接收束（规则5）',
    blueprint: JAVA,
    mode: 'standard',
    askedIds: [],
    remainSeconds: 60,
    resumeRiskTopics: [],
    focusDomain: '',
    maxQuestions: 0,
    expect: { notNull: true, isWrapup: true }
  },
  {
    id: 'sel-003',
    layer: 'selection',
    title: '题量达上限 → 返回收束题（规则4）',
    blueprint: JAVA,
    mode: 'standard',
    askedIds: ['q-k01'],
    remainSeconds: 9999,
    resumeRiskTopics: [],
    focusDomain: '',
    maxQuestions: 1,
    expect: { notNull: true, isWrapup: true }
  },
  {
    id: 'sel-004',
    layer: 'selection',
    title: '训练定向 → 只出目标能力域的题（规则0b）',
    blueprint: JAVA,
    mode: 'standard',
    askedIds: [],
    remainSeconds: 9999,
    resumeRiskTopics: [],
    focusDomain: 'analysis',
    maxQuestions: 0,
    expect: { notNull: true, isWrapup: false, questionAbilityDomain: 'analysis' }
  },
  {
    id: 'sel-005',
    layer: 'selection',
    title: '岗位隔离：前端蓝图只出前端题（规则0a）',
    blueprint: FRONTEND,
    mode: 'standard',
    askedIds: [],
    remainSeconds: 9999,
    resumeRiskTopics: [],
    focusDomain: '',
    maxQuestions: 0,
    expect: { notNull: true, isWrapup: false, questionPositionId: 'frontend' }
  },

  // ---------------- 追问引擎（文档 02 §3.3） ----------------
  {
    id: 'fu-001',
    layer: 'followup',
    title: '深挖达 2 层 → 不再追问（硬约束）',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: false,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: false,
    depth: 2,
    expect: { shouldFollowup: false, reasonContains: '最大深挖深度' }
  },
  {
    id: 'fu-002',
    layer: 'followup',
    title: '隐私话题 → 禁止追问（禁则）',
    questionId: 'q-e01',
    text: '关于婚育情况我不太方便说',
    isVague: false,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: false,
    depth: 0,
    expect: { shouldFollowup: false, reasonContains: '隐私' }
  },
  {
    id: 'fu-003',
    layer: 'followup',
    title: '与先前回答矛盾 → 澄清意图',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: false,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: true,
    depth: 0,
    expect: { shouldFollowup: true, intent: 'clarify' }
  },
  {
    id: 'fu-004',
    layer: 'followup',
    title: '回答模糊 → 澄清意图',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: true,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: false,
    depth: 0,
    expect: { shouldFollowup: true, intent: 'clarify' }
  },
  {
    id: 'fu-005',
    layer: 'followup',
    title: '绝对化表述 → 反例意图',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: false,
    hasMetrics: true,
    isAbsolute: true,
    contradictsPrevious: false,
    depth: 0,
    expect: { shouldFollowup: true, intent: 'counterexample' }
  },
  {
    id: 'fu-006',
    layer: 'followup',
    title: '项目题首层 → 深挖（动机与替代方案）',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: false,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: false,
    depth: 0,
    expect: { shouldFollowup: true, intent: 'deepdive', followupDepth: 1 }
  },
  {
    id: 'fu-007',
    layer: 'followup',
    title: '项目题二层 → 迁移（方法迁移到新场景）',
    questionId: 'q-e01',
    text: '我负责了订单系统的重构',
    isVague: false,
    hasMetrics: true,
    isAbsolute: false,
    contradictsPrevious: false,
    depth: 1,
    expect: { shouldFollowup: true, intent: 'transfer', followupDepth: 2 }
  },

  // ---------------- 评分器（文档 02 §3.4） ----------------
  {
    id: 'sc-001',
    layer: 'scoring',
    title: '报告结构合法：6 维度、等级 A-D、置信度 0-1、有训练计划',
    scoringCount: 6,
    scoringAnswerText: ANSWER_WITH_EVIDENCE,
    expect: {
      dimensionCount: 6,
      levelsIn: ['A', 'B', 'C', 'D'],
      confidenceBetween: [0, 1],
      trainingPlanMin: 1
    }
  },
  {
    id: 'sc-002',
    layer: 'scoring',
    title: '短模糊回答 → 沟通维度不高于 C',
    scoringCount: 6,
    scoringAnswerText: ANSWER_VAGUE_SHORT,
    expect: { dimensionCount: 6, dimensionLevelIn: { communication: ['C', 'D'] } }
  }
]
