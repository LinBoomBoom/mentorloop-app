// 题目选择器 v3（文档 02 §3.2 + 岗位方向 / 经验等级个性化 + 专项训练定向）
// 输入：岗位蓝图、简历风险、已答题目、剩余时间、实时可信度
// 输出：下一道题及提问目的
// 选择规则（v1 原有 5 条 + v2 方向/等级过滤 + v3 训练定向）：
// 0. 岗位过滤：只抽 positionId 与 blueprint.positionId 匹配的题；
//    难度过滤：只抽 blueprint.experienceLevel 允许的难度，按档位优先级顺序选题
// 0b. 训练定向（v3）：focusDomain 非空时，优先出该能力域的题（报告薄弱项 → 定向训练）
// 1. 先覆盖岗位最低门槛能力（图谱能力域优先）
// 2. 对简历中的高价值项目做验证性追问（resumeRisk 题）
// 3. 对回答模糊、绝对化、缺少指标或前后矛盾的内容深挖（由追问引擎处理）
// 4. 保留至少一道开放题评估学习能力与复盘能力（WRAPUP_QUESTION）
// 5. 依据时间预算动态收束，避免无止境追问

import {
  QuestionItem,
  InterviewMode,
  PositionBlueprint,
  Difficulty,
  ExperienceLevel
} from '../types/interview.js'
import { QUESTION_BANK, getWrapupForPosition } from '../data/question-bank.js'
import { getDomainIds } from '../data/domain-ids.js'
import { DIFFICULTY_PRIORITY, getExperienceOption } from '../data/position-options.js'

export type SelectorInput = {
  blueprint: PositionBlueprint
  mode: InterviewMode
  asked: QuestionItem[] // 已答题目
  remainSeconds: number // 剩余时间
  resumeRiskTopics: string[] // 简历高价值项目关键词（命中 resumeRisk 题优先）
  focusDomain: string // '' = 不限维度（正式面试）；非空 = 专项训练定向能力域
  maxQuestions: number // 0 = 使用 mode 预算；>0 = 覆盖（专项训练按任务题量控制）
}

export type SelectorOutput = {
  question: QuestionItem
  purpose: string // 提问目的（展示给数字人播报与报告）
  isWrapup: boolean
}

// 各模式的题目预算与时间预算（文档 02 §2.2：快练5/标准20/深度40分钟）
export type ModeBudget = {
  maxQuestions: number
  totalSeconds: number
}

export function getModeBudget(mode: InterviewMode): ModeBudget {
  if (mode === 'quick') return { maxQuestions: 3, totalSeconds: 300 } as ModeBudget
  if (mode === 'deep') return { maxQuestions: 12, totalSeconds: 2400 } as ModeBudget
  return { maxQuestions: 7, totalSeconds: 1200 } as ModeBudget
}

// 单题平均耗时估算（秒），用于时间预算收束（规则5）
const AVG_QUESTION_SECONDS = 150

function isAsked(asked: QuestionItem[], id: string): boolean {
  for (let i = 0; i < asked.length; i++) {
    if (asked[i].id === id) return true
  }
  return false
}

// 规则0a：题目是否属于当前岗位方向
function matchesPosition(q: QuestionItem, blueprint: PositionBlueprint): boolean {
  return q.positionId === blueprint.positionId
}

// 规则0b：题目难度是否在该经验档位白名单内
function difficultyAllowed(diff: Difficulty, level: ExperienceLevel): boolean {
  const opt = getExperienceOption(level)
  if (opt == null) return true
  const allow = opt.allowedDifficulties
  for (let i = 0; i < allow.length; i++) {
    if (allow[i] === diff) return true
  }
  return false
}

// 题目是否同时满足"岗位 + 难度"双重过滤
function eligible(q: QuestionItem, blueprint: PositionBlueprint): boolean {
  if (!matchesPosition(q, blueprint)) return false
  if (!difficultyAllowed(q.difficulty, blueprint.experienceLevel)) return false
  return true
}

// 已覆盖的能力域集合（仅统计当前岗位方向的题）
function coveredDomains(asked: QuestionItem[], blueprint: PositionBlueprint): string[] {
  const domains: string[] = []
  for (let i = 0; i < asked.length; i++) {
    if (!matchesPosition(asked[i], blueprint)) continue
    const d = asked[i].abilityDomain
    if (!domains.includes(d)) domains.push(d)
  }
  return domains
}

// 按档位难度优先级顺序遍历题库，返回第一道符合条件的题
function pickByDifficultyPriority(
  candidates: QuestionItem[],
  blueprint: PositionBlueprint
): QuestionItem | null {
  const order = DIFFICULTY_PRIORITY[blueprint.experienceLevel]
  for (let p = 0; p < order.length; p++) {
    const want = order[p]
    for (let i = 0; i < candidates.length; i++) {
      const q = candidates[i]
      if (!eligible(q, blueprint)) continue
      if (q.difficulty === want) return q
    }
  }
  // 白名单内都没有时，放宽到所有难度，保证链路不中断
  for (let i = 0; i < candidates.length; i++) {
    if (matchesPosition(candidates[i], blueprint)) return candidates[i]
  }
  return null
}

// 规则1：找第一个尚未覆盖的门槛能力域中的题目
function pickForCoverage(asked: QuestionItem[], blueprint: PositionBlueprint): QuestionItem | null {
  const covered = coveredDomains(asked, blueprint)
  const allDomains = getDomainIds()
  const pool: QuestionItem[] = []
  for (let i = 0; i < allDomains.length; i++) {
    const domainId = allDomains[i]
    if (covered.includes(domainId)) continue
    // 收集该能力域下所有未答的题，按难度优先级排序选
    const forDomain: QuestionItem[] = []
    for (let j = 0; j < QUESTION_BANK.length; j++) {
      const q = QUESTION_BANK[j]
      if (q.abilityDomain === domainId && !isAsked(asked, q.id)) forDomain.push(q)
    }
    const picked = pickByDifficultyPriority(forDomain, blueprint)
    if (picked != null) return picked
    // 若该域无符合要求的题，保留到 pool 兜底
    for (let k = 0; k < forDomain.length; k++) pool.push(forDomain[k])
  }
  return pickByDifficultyPriority(pool, blueprint)
}

// 规则2：简历高价值项目验证题
// 为 resumeRisk 题配置关键词表，按命中分数挑最贴合简历项目的题
// 未命中任何关键词时，按序兜底返回第一道未答的 resumeRisk 题，保证追问链路不中断
const RESUME_RISK_KEYWORDS: Record<string, string[]> = {
  'q-e01': ['决策', '选型', '方案', '架构', '设计', '重构', '技术栈'],
  'q-e02': [
    '优化',
    '性能',
    'QPS',
    'RT',
    '提升',
    '下降',
    '节省',
    '指标',
    '数据',
    '成果',
    '效果',
    '耗时',
    '降低'
  ],
  'q-e03': ['负责', '主导', '独立', '模块', 'owner', 'Owner', '牵头', '承担'],
  'q-e04': ['难点', '困难', '问题', '排查', '解决', 'bug', 'Bug', '故障', '瓶颈', '坑', '异常']
}

function hitCount(text: string, keywords: string[]): number {
  let n = 0
  for (let i = 0; i < keywords.length; i++) {
    if (text.indexOf(keywords[i]) !== -1) n++
  }
  return n
}

function pickResumeRisk(
  asked: QuestionItem[],
  topics: string[],
  blueprint: PositionBlueprint
): QuestionItem | null {
  if (topics.length === 0) return null
  const merged = topics.join(',')

  let best: QuestionItem | null = null
  let bestScore = 0
  let fallback: QuestionItem | null = null

  for (let j = 0; j < QUESTION_BANK.length; j++) {
    const q = QUESTION_BANK[j]
    if (!q.resumeRisk || isAsked(asked, q.id)) continue
    if (!matchesPosition(q, blueprint)) continue
    if (fallback == null && difficultyAllowed(q.difficulty, blueprint.experienceLevel)) fallback = q

    const kw = RESUME_RISK_KEYWORDS[q.id]
    if (kw == null) continue
    // 同时在题目 content/knowledgePoint/purpose 中做一次兜底命中
    const haystack = merged + ',' + q.knowledgePoint + ',' + q.content + ',' + q.purpose
    const score = hitCount(haystack, kw)
    if (score > bestScore && difficultyAllowed(q.difficulty, blueprint.experienceLevel)) {
      bestScore = score
      best = q
    }
  }

  if (best != null && bestScore > 0) return best
  if (fallback != null) return fallback
  // 难度白名单内没有合适的 resumeRisk 题时，放宽到任意难度
  for (let j = 0; j < QUESTION_BANK.length; j++) {
    const q = QUESTION_BANK[j]
    if (q.resumeRisk && !isAsked(asked, q.id) && matchesPosition(q, blueprint)) return q
  }
  return null
}

// 兜底：任选一道未答、符合岗位+难度的题
function pickAny(asked: QuestionItem[], blueprint: PositionBlueprint): QuestionItem | null {
  const unasked: QuestionItem[] = []
  for (let i = 0; i < QUESTION_BANK.length; i++) {
    if (!isAsked(asked, QUESTION_BANK[i].id)) unasked.push(QUESTION_BANK[i])
  }
  return pickByDifficultyPriority(unasked, blueprint)
}

// 规则0b：专项训练定向 —— 优先出目标能力域内未答、且满足岗位+难度的题
// 返回 null 表示该能力域已出完（调用方放宽到全量，保证训练链路不中断）
function pickForFocusDomain(
  asked: QuestionItem[],
  blueprint: PositionBlueprint,
  domain: string
): QuestionItem | null {
  if (domain.length === 0) return null
  const forDomain: QuestionItem[] = []
  for (let j = 0; j < QUESTION_BANK.length; j++) {
    const q = QUESTION_BANK[j]
    if (q.abilityDomain !== domain) continue
    if (!eligible(q, blueprint)) continue
    if (isAsked(asked, q.id)) continue
    forDomain.push(q)
  }
  return pickByDifficultyPriority(forDomain, blueprint)
}

export function selectNext(input: SelectorInput): SelectorOutput | null {
  const budget = getModeBudget(input.mode)
  // 专项训练可通过 maxQuestions 覆盖模式预算（训练房间按任务题量控制收尾）
  const budgetMax = input.maxQuestions > 0 ? input.maxQuestions : budget.maxQuestions

  // 规则5：时间预算收束 —— 剩余时间不足以再完整进行一题时，返回收束题
  const timeShort = input.remainSeconds < AVG_QUESTION_SECONDS
  // 规则4/5：题目数达上限或时间不足 → 收束（收束题为岗位专属）
  if (input.asked.length >= budgetMax || timeShort) {
    const wrap = getWrapupForPosition(input.blueprint.positionId)
    if (!isAsked(input.asked, wrap.id) && matchesPosition(wrap, input.blueprint)) {
      return {
        question: wrap,
        purpose: wrap.purpose,
        isWrapup: true
      } as SelectorOutput
    }
    return null // 收束题也已问完，面试应进入 WRAP_UP
  }

  // 规则0b：训练定向优先（报告薄弱项 → 该能力域题目）
  if (input.focusDomain.length > 0) {
    const focused = pickForFocusDomain(input.asked, input.blueprint, input.focusDomain)
    if (focused != null) {
      return {
        question: focused,
        purpose: focused.purpose,
        isWrapup: false
      } as SelectorOutput
    }
    // 目标能力域已出完：放宽到下面规则兜底，避免训练中断
  }

  // 规则1：优先覆盖未触达的能力域
  const coverage = pickForCoverage(input.asked, input.blueprint)
  if (coverage != null) {
    return {
      question: coverage,
      purpose: coverage.purpose,
      isWrapup: false
    } as SelectorOutput
  }

  // 规则2：简历验证题
  const risk = pickResumeRisk(input.asked, input.resumeRiskTopics, input.blueprint)
  if (risk != null) {
    return {
      question: risk,
      purpose: '验证简历项目：' + risk.purpose,
      isWrapup: false
    } as SelectorOutput
  }

  // 兜底
  const any = pickAny(input.asked, input.blueprint)
  if (any != null) {
    return { question: any, purpose: any.purpose, isWrapup: false } as SelectorOutput
  }
  return null
}
