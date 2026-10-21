// 简历领域模型（与前端 types/resume.uts 契约对齐；2026-10-21 深度评审版）
export type ResumeIssueSeverity = 'high' | 'medium' | 'low'
export type ResumeIssueCategory =
  'quantification' | 'ownership' | 'techMatch' | 'format' | 'language' | 'completeness'

export type ResumeIssue = {
  issueId: string
  severity: ResumeIssueSeverity
  category: ResumeIssueCategory
  page: number // PDF 页码（1 起）；DOCX 为 0
  paragraph: number // DOCX 段落序号（0 起）；PDF 为 -1
  quote: string // 必须在原文中精确命中
  original: string
  suggested: string
  reason: string
  needsUserEvidence: boolean
}

export type ResumeParseResult = {
  resumeId: string
  fileName: string
  fileType: 'pdf' | 'docx'
  pages: number
  contact: boolean
  projects: number
  techStack: string[]
  quantified: boolean
  gaps: string[]
  formatRisks: string[]
  issues: ResumeIssue[]
  mode: 'full' | 'preview'
  cached: boolean
}

export type ResumeQuota = {
  memberMonthlyTotal: number
  memberMonthlyLeft: number
  singleLeft: number
  freePreviewLeftToday: number
  canFull: boolean
}

export type ResumeHistoryItem = {
  resumeId: string
  fileName: string
  fileType: 'pdf' | 'docx'
  createdAt: number
  mode: 'full' | 'preview'
  issuesHigh: number
  issuesTotal: number
  projects: number
  quantified: boolean
}

// 旧投递版本入口保留（/resume/optimize 出参零变更）
export type ResumeSuggestion = {
  original: string
  suggested: string
  reason: string
  needsUserEvidence: boolean
}

// 认证领域模型（与前端 types/auth.uts 契约对齐）
export type AuthResult = {
  uid: string
  nickname: string
  token: string
}
