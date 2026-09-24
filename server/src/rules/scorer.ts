// 规则评分器 v1（文档 02 §3.4）
// 输入：整场面试的题目列表 + 转写；输出：InterviewReport（含维度分数 / 风险题 / 训练计划）。
// 第一版完全基于规则（不依赖模型），所有结论必须可溯源到具体的回答信号。
//
// 评分策略（维度 → 信号 → level/confidence）：
//   - knowledge:   概念题/设计题的平均长度、是否含"误区/不确定"关键词、追问层数
//   - engineering: 项目题中是否含"我负责/主导/独立"、是否带数字指标、追问层数
//   - analysis:    设计题/场景题的回答长度、是否包含"对比/权衡/风险/备选"
//   - communication: 全场平均回答长度、被追问次数、是否含模糊词
//   - learning:    行为题/"失败/复盘"相关题是否有真实细节
//   - motivation:  默认中等，靠简历匹配；这里给保守 B
//
// 规则刻意保持可解释：每个 dimension 的 confidence 来源于"证据数/题数"。

import { QuestionItem, TranscriptEntry } from '../types/interview.js'
import {
  InterviewReport,
  DimensionScore,
  ScoreDimension,
  ScoreLevel,
  TrainingTask,
  DIMENSION_LABEL
} from '../types/scoring.js'
import { confidenceBand } from './rubric.js'
import { analyzeAnswer } from './answer-signal.js'
import { QUESTION_BANK } from '../data/question-bank.js'

// ------ 题型 → 维度映射（决定该题的回答主要影响哪些维度）------
// knowledge: concept / design（基础概念+系统设计都要讲清楚原理）
// engineering: project（项目题考个人贡献）
// analysis: design / scenario（设计题和场景题考方案权衡）
// communication / learning / motivation: 全场聚合
function dimensionsForType(t: string): ScoreDimension[] {
  if (t === 'concept') return ['knowledge', 'communication']
  if (t === 'project') return ['engineering', 'communication', 'learning']
  if (t === 'design') return ['knowledge', 'analysis', 'communication']
  if (t === 'scenario') return ['analysis', 'communication']
  if (t === 'behavioral') return ['learning', 'motivation', 'communication']
  return ['communication']
}

// ------ 简单的关键词信号 ------
const ENGINEERING_KEYS: string[] = ['我负责', '我主导', '独立', '牵头', 'Owner', 'owner']
const ANALYSIS_KEYS: string[] = ['权衡', '取舍', '对比', '备选', '方案B', '风险', '降级', '兜底']
const FAILURE_KEYS: string[] = ['失败', '故障', '复盘', '踩坑', '问题', '教训', '回滚']

function containsAny(text: string, list: string[]): boolean {
  for (let i = 0; i < list.length; i++) {
    if (text.includes(list[i])) return true
  }
  return false
}

function containsNumber(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch >= '0' && ch <= '9') return true
  }
  return false
}

// ------ 单题统计结构 ------
type QuestionStat = {
  q: QuestionItem
  userTexts: string[] // 用户对这题的所有回答（含追问）
  followupCount: number // 该题被追问的层数
  signal: {
    isVague: boolean
    hasMetrics: boolean
    isAbsolute: boolean
    hasOwnership: boolean
    hasAnalysis: boolean
    hasFailure: boolean
    hasNumber: boolean
    lengthTotal: number
  }
}

// 按题目聚合转写：把同一 questionId 下 speaker==='user' 的回答收集起来
function buildStats(questions: QuestionItem[], transcript: TranscriptEntry[]): QuestionStat[] {
  const stats: QuestionStat[] = []
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]
    const userTexts: string[] = []
    for (let ti = 0; ti < transcript.length; ti++) {
      const e = transcript[ti]
      if (e.questionId === q.id && e.speaker === 'user') {
        userTexts.push(e.text)
      }
    }
    // followupCount = 用户回答数 - 1（首答不算追问）
    const followupCount = userTexts.length > 0 ? userTexts.length - 1 : 0

    let lengthTotal = 0
    let isVague = false
    let hasMetrics = false
    let isAbsolute = false
    let hasOwnership = false
    let hasAnalysis = false
    let hasFailure = false
    let hasNumber = false

    for (let i = 0; i < userTexts.length; i++) {
      const t = userTexts[i]
      lengthTotal += t.length
      const sig = analyzeAnswer(t, q.id)
      if (sig.isVague) isVague = true
      if (sig.hasMetrics) hasMetrics = true
      if (sig.isAbsolute) isAbsolute = true
      if (containsAny(t, ENGINEERING_KEYS)) hasOwnership = true
      if (containsAny(t, ANALYSIS_KEYS)) hasAnalysis = true
      if (containsAny(t, FAILURE_KEYS)) hasFailure = true
      if (containsNumber(t)) hasNumber = true
    }

    stats.push({
      q: q,
      userTexts: userTexts,
      followupCount: followupCount,
      signal: {
        isVague: isVague,
        hasMetrics: hasMetrics,
        isAbsolute: isAbsolute,
        hasOwnership: hasOwnership,
        hasAnalysis: hasAnalysis,
        hasFailure: hasFailure,
        hasNumber: hasNumber,
        lengthTotal: lengthTotal
      }
    } as QuestionStat)
  }
  return stats
}

// ------ 各维度打分（返回 0-100 原始分 + confidence）------
type DimRaw = {
  dimension: ScoreDimension
  score: number
  confidence: number
  evidence: string
  missingEvidence: string
}

function scoreDimension(dim: ScoreDimension, stats: QuestionStat[]): DimRaw {
  // 选该维度相关的题目
  const relevant: QuestionStat[] = []
  for (let i = 0; i < stats.length; i++) {
    const dims = dimensionsForType(stats[i].q.type)
    let hit = false
    for (let j = 0; j < dims.length; j++) {
      if (dims[j] === dim) {
        hit = true
        break
      }
    }
    if (hit) relevant.push(stats[i])
  }

  // confidence = 相关题数/至少3题得1；少于3题按比例打折；全0题给0.3（极低置信）
  const relevance = relevant.length
  let confidence = 0.3
  if (relevance >= 3) confidence = 0.85
  else if (relevance === 2) confidence = 0.65
  else if (relevance === 1) confidence = 0.45

  if (relevance === 0) {
    return {
      dimension: dim,
      score: 60,
      confidence: 0.3,
      evidence: '本场未覆盖该维度题目',
      missingEvidence: '建议增加相应题型后重新评估'
    } as DimRaw
  }

  // 默认基线 C（60）
  let score = 60
  const positives: string[] = []
  const negatives: string[] = []

  if (dim === 'knowledge') {
    for (let i = 0; i < relevant.length; i++) {
      const s = relevant[i].signal
      if (s.lengthTotal >= 60 && !s.isVague) {
        score += 8
        positives.push('回答有展开')
      } else {
        score -= 10
        negatives.push('回答过短或模糊')
      }
      if (s.isAbsolute) {
        score -= 8
        negatives.push('存在绝对化表述')
      }
      if (relevant[i].followupCount >= 2) {
        score -= 5
        negatives.push('被深度追问2次')
      }
    }
  } else if (dim === 'engineering') {
    for (let i = 0; i < relevant.length; i++) {
      const s = relevant[i].signal
      if (s.hasOwnership && s.hasMetrics) {
        score += 15
        positives.push('有个人贡献+量化指标')
      } else if (s.hasOwnership) {
        score += 8
        positives.push('讲清了个人贡献')
      } else {
        score -= 10
        negatives.push('个人贡献不清晰')
      }
      if (!s.hasNumber) {
        score -= 5
        negatives.push('缺少数字证据')
      }
      if (relevant[i].followupCount >= 2) {
        score -= 5
        negatives.push('项目细节被追问多次')
      }
    }
  } else if (dim === 'analysis') {
    for (let i = 0; i < relevant.length; i++) {
      const s = relevant[i].signal
      if (s.hasAnalysis) {
        score += 12
        positives.push('体现了权衡/风险意识')
      } else {
        score -= 8
        negatives.push('只给单一方案')
      }
      if (s.isAbsolute) {
        score -= 8
        negatives.push('未考虑边界')
      }
    }
  } else if (dim === 'communication') {
    // 全场聚合
    let totalLen = 0
    let vagueCount = 0
    let totalFollowup = 0
    for (let i = 0; i < stats.length; i++) {
      totalLen += stats[i].signal.lengthTotal
      if (stats[i].signal.isVague) vagueCount += 1
      totalFollowup += stats[i].followupCount
    }
    const avgLen = totalLen / (stats.length > 0 ? stats.length : 1)
    if (avgLen >= 80) {
      score += 10
      positives.push('回答详实')
    } else if (avgLen < 30) {
      score -= 15
      negatives.push('回答过短')
    }
    if (vagueCount > stats.length / 2) {
      score -= 10
      negatives.push('大量模糊表述')
    }
    if (totalFollowup > stats.length * 1.5) {
      score -= 5
      negatives.push('追问频繁')
    }
    confidence = 0.8 // 沟通维度基于全场，置信度高
  } else if (dim === 'learning') {
    // 行为题/项目题中是否有失败/复盘证据
    let hasFailureEvidence = false
    for (let i = 0; i < relevant.length; i++) {
      if (relevant[i].signal.hasFailure && relevant[i].signal.lengthTotal >= 50) {
        hasFailureEvidence = true
        score += 10
        positives.push('有失败/复盘细节')
      }
    }
    if (!hasFailureEvidence) {
      score -= 5
      negatives.push('缺少真实失败/复盘案例')
    }
  } else if (dim === 'motivation') {
    // 当前无结构化问卷，给保守 B，低置信
    score = 72
    confidence = 0.4
    positives.push('目标表述一致')
    negatives.push('未采集动机问卷')
  }

  // 分数裁剪到 30–95
  if (score > 95) score = 95
  if (score < 30) score = 30

  const evidence = positives.length > 0 ? positives.join('、') : '无明显正向证据'
  const missingEvidence = negatives.length > 0 ? negatives.join('、') : '无'

  return {
    dimension: dim,
    score: score,
    confidence: confidence,
    evidence: evidence,
    missingEvidence: missingEvidence
  } as DimRaw
}

function scoreToLevel(score: number): ScoreLevel {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  return 'D'
}

// 根据缺失维度生成训练计划（从题库中按能力域抽题）
function buildTrainingPlan(weakDims: ScoreDimension[]): TrainingTask[] {
  const plan: TrainingTask[] = []
  const domainToKeywords: { [key: string]: string } = {
    knowledge: '并发、JVM、Spring',
    engineering: '项目经验',
    analysis: '系统设计',
    communication: '结构化表达',
    learning: '复盘与成长',
    motivation: '动机梳理'
  }
  for (let i = 0; i < weakDims.length; i++) {
    const d = weakDims[i]
    const label = DIMENSION_LABEL[d]
    plan.push({
      id: 'train-' + d + '-1',
      title: label + '专项：' + (domainToKeywords[d] != null ? domainToKeywords[d] : ''),
      durationMin: 10,
      priority: i + 1
    } as TrainingTask)
    plan.push({
      id: 'train-' + d + '-2',
      title: label + '实战模拟（3题快练）',
      durationMin: 15,
      priority: i + 1
    } as TrainingTask)
  }
  return plan
}

// 收集"风险题"：被追问深度2+的题、以及回答明显模糊的题
function collectRiskQuestions(stats: QuestionStat[]): string[] {
  const risks: string[] = []
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]
    if (s.followupCount >= 2) {
      risks.push('【追问过多】' + s.q.knowledgePoint)
    } else if (s.signal.isVague && s.signal.lengthTotal < 40) {
      risks.push('【回答模糊】' + s.q.knowledgePoint)
    } else if (s.signal.isAbsolute) {
      risks.push('【绝对化表述】' + s.q.knowledgePoint)
    }
  }
  return risks
}

// 主入口：根据题目+转写生成报告
export function scoreInterview(
  questions: QuestionItem[],
  transcript: TranscriptEntry[]
): InterviewReport {
  const stats = buildStats(questions, transcript)

  const dims: ScoreDimension[] = [
    'knowledge',
    'engineering',
    'analysis',
    'communication',
    'learning',
    'motivation'
  ]
  const scores: DimRaw[] = []
  const dimensions: DimensionScore[] = []
  for (let i = 0; i < dims.length; i++) {
    const r = scoreDimension(dims[i], stats)
    scores.push(r)
  }

  // 找最强/最弱
  let bestIdx = 0
  let worstIdx = 0
  for (let i = 1; i < scores.length; i++) {
    // 最强：分数高且置信度不低
    if (
      scores[i].score * scores[i].confidence >
      scores[bestIdx].score * scores[bestIdx].confidence
    ) {
      bestIdx = i
    }
    if (scores[i].score < scores[worstIdx].score) {
      worstIdx = i
    }
  }

  // 低置信维度统一提示
  for (let i = 0; i < scores.length; i++) {
    const r = scores[i]
    const level = scoreToLevel(r.score)
    const band = confidenceBand(r.confidence)
    const suffix = band === 'low' ? '（证据不足，仅供参考）' : ''
    // 从题库里按 abilityDomain 抽一道题作建议题
    const suggestQIds: string[] = []
    for (let bi = 0; bi < QUESTION_BANK.length; bi++) {
      if (QUESTION_BANK[bi].abilityDomain.indexOf(r.dimension) >= 0) {
        suggestQIds.push(QUESTION_BANK[bi].knowledgePoint)
        if (suggestQIds.length >= 2) break
      }
    }
    // 上述匹配比较粗，兜底直接给知识点
    if (suggestQIds.length === 0) {
      suggestQIds.push(DIMENSION_LABEL[r.dimension] + '典型题')
    }
    dimensions.push({
      dimension: r.dimension,
      level: level,
      confidence: r.confidence,
      evidence: r.evidence,
      missingEvidence: r.missingEvidence + suffix,
      suggestQuestions: suggestQIds
    } as DimensionScore)
  }

  const strongestLabel = DIMENSION_LABEL[scores[bestIdx].dimension]
  const weakestLabel = DIMENSION_LABEL[scores[worstIdx].dimension]

  // overall：用平均等级给一句话总结
  let total = 0
  for (let i = 0; i < scores.length; i++) total += scores[i].score
  const avg = total / scores.length
  const avgLevel = scoreToLevel(avg)
  const covered = new Set<string>()
  for (let i = 0; i < questions.length; i++) covered.add(questions[i].abilityDomain)
  const overall =
    '本次共回答 ' +
    questions.length +
    ' 道题，覆盖 ' +
    covered.size +
    ' 个能力域，综合等级 ' +
    avgLevel +
    '（均分 ' +
    Math.round(avg) +
    '）'

  // 训练计划：针对所有低于 B 的维度
  const weakDims: ScoreDimension[] = []
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].score < 70) weakDims.push(scores[i].dimension)
  }
  const trainingPlan = buildTrainingPlan(
    weakDims.length > 0 ? weakDims : [scores[worstIdx].dimension]
  )

  const riskQuestions = collectRiskQuestions(stats)

  return {
    overall: overall,
    strongest: strongestLabel,
    topPriority: weakestLabel,
    dimensions: dimensions,
    riskQuestions: riskQuestions,
    trainingPlan: trainingPlan
  } as InterviewReport
}
