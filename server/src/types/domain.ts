// 简历领域模型（与前端 types/resume.uts 契约对齐，P1.1 移植）

export type ResumeParseResult = {
  contact: boolean
  projects: number
  techStack: string[]
  quantified: boolean
  gaps: string[]
  formatRisks: string[]
}

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
