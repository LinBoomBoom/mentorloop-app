// 评分量表 v1（服务端移植，与前端 engine/rubric.uts 一致）
// 置信度分级与低置信度展示约束：低置信度不伪装为精确分数。
import { ScoreDimension } from '../types/scoring.js'

export type RubricLevelDef = { level: 'A' | 'B' | 'C' | 'D'; anchor: string }
export type RubricDimension = {
  dimension: ScoreDimension
  weight: number
  evidenceRequirement: string
  levels: RubricLevelDef[]
}

export const RUBRIC: RubricDimension[] = [
  {
    dimension: 'knowledge',
    weight: 0.25,
    evidenceRequirement: '概念、原理、边界条件的准确表述',
    levels: [
      { level: 'A', anchor: '概念准确且能说明边界条件与失效模式' },
      { level: 'B', anchor: '概念准确，边界条件说明不完整' },
      { level: 'C', anchor: '概念基本正确但有明显遗漏或混淆' },
      { level: 'D', anchor: '概念错误或仅能背诵定义' }
    ]
  },
  {
    dimension: 'engineering',
    weight: 0.25,
    evidenceRequirement: '个人贡献、指标、工具与结果',
    levels: [
      { level: 'A', anchor: '个人贡献清晰，有量化指标与完整决策链' },
      { level: 'B', anchor: '贡献清晰但量化不足' },
      { level: 'C', anchor: '贡献描述模糊，团队与个人边界不清' },
      { level: 'D', anchor: '无法说明个人实际参与' }
    ]
  },
  {
    dimension: 'analysis',
    weight: 0.2,
    evidenceRequirement: '假设、方案比较、风险控制',
    levels: [
      { level: 'A', anchor: '能澄清约束、给出备选方案并说明取舍与风险' },
      { level: 'B', anchor: '有方案比较但风险分析不足' },
      { level: 'C', anchor: '只给单一方案，无比较' },
      { level: 'D', anchor: '无法拆解问题' }
    ]
  },
  {
    dimension: 'communication',
    weight: 0.15,
    evidenceRequirement: '结构、清晰度、回应追问能力',
    levels: [
      { level: 'A', anchor: '结论先行、证据充分、追问回应准确' },
      { level: 'B', anchor: '结构清晰但结论不够先行' },
      { level: 'C', anchor: '叙述流水账，需要追问才能获取关键信息' },
      { level: 'D', anchor: '表达混乱，追问后仍无法澄清' }
    ]
  },
  {
    dimension: 'learning',
    weight: 0.1,
    evidenceRequirement: '失败经验、纠偏、成长路径',
    levels: [
      { level: 'A', anchor: '有真实失败案例、具体纠偏与可验证的成长' },
      { level: 'B', anchor: '有复盘意识但案例深度不足' },
      { level: 'C', anchor: '复盘流于表面，归因外部' },
      { level: 'D', anchor: '无反思或包装失败为成功' }
    ]
  },
  {
    dimension: 'motivation',
    weight: 0.05,
    evidenceRequirement: '目标一致性与诚实边界',
    levels: [
      { level: 'A', anchor: '目标与岗位、简历一致，表述诚实' },
      { level: 'B', anchor: '目标基本一致，个别表述含糊' },
      { level: 'C', anchor: '目标与简历存在矛盾' },
      { level: 'D', anchor: '明显夸大或虚构动机' }
    ]
  }
]

export type ConfidenceBand = 'high' | 'medium' | 'low'

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

export function displayLevel(level: string, confidence: number): string {
  if (confidenceBand(confidence) === 'low') return level + '（证据不足，仅供参考）'
  return level
}

export function getRubricDimension(d: ScoreDimension): RubricDimension | null {
  for (let i = 0; i < RUBRIC.length; i++) {
    if (RUBRIC[i].dimension === d) return RUBRIC[i]
  }
  return null
}
