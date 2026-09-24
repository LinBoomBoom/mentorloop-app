// 评分与报告领域模型（与前端 types/scoring.uts 契约对齐，P1.1 移植）

export type ScoreDimension =
  'knowledge' | 'engineering' | 'analysis' | 'communication' | 'learning' | 'motivation'

export type ScoreLevel = 'A' | 'B' | 'C' | 'D'

export type DimensionScore = {
  dimension: ScoreDimension
  level: ScoreLevel
  confidence: number
  evidence: string
  missingEvidence: string
  suggestQuestions: string[]
}

export type TrainingTask = {
  id: string
  title: string
  durationMin: number
  priority: number
}

export type InterviewReport = {
  overall: string
  strongest: string
  topPriority: string
  dimensions: DimensionScore[]
  riskQuestions: string[]
  trainingPlan: TrainingTask[]
}

export type StringMap = { [key: string]: string }
export type NumberMap = { [key: string]: number }

export const DIMENSION_WEIGHT: NumberMap = {
  knowledge: 0.25,
  engineering: 0.25,
  analysis: 0.2,
  communication: 0.15,
  learning: 0.1,
  motivation: 0.05
}

export const DIMENSION_LABEL: StringMap = {
  knowledge: '岗位知识与正确性',
  engineering: '项目与工程实践',
  analysis: '问题分析与权衡',
  communication: '表达与沟通',
  learning: '学习与复盘',
  motivation: '职业动机与匹配'
}
