// 面试领域模型（与前端 types/interview.uts 契约对齐，P1.1 移植）
// 来源：e:\LsqCoding\Mentorloop-app\types\interview.uts —— 保持同步

export type InterviewMode = 'quick' | 'standard' | 'deep'
export type Difficulty = 'junior' | 'mid' | 'senior'
export type PositionId = 'java-backend' | 'frontend' | 'golang-backend' | 'pm'
export type ExperienceLevel = 'fresh' | 'junior' | 'mid' | 'senior'
export type QuestionType = 'concept' | 'scenario' | 'project' | 'design' | 'behavioral'

export type FollowupIntent =
  'clarify' | 'evidence' | 'deepdive' | 'counterexample' | 'transfer' | 'wrapup'

export type InterviewStatus =
  | 'CREATED'
  | 'DEVICE_CHECK'
  | 'READY'
  | 'ASKING'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'FOLLOW_UP_DECISION'
  | 'NEXT_QUESTION'
  | 'WRAP_UP'
  | 'REPORT_GENERATING'
  | 'COMPLETED'

export type PositionBlueprint = {
  positionId: PositionId
  position: string
  experienceLevel: ExperienceLevel
  experienceRange: string
  companyType: string
  language: string
  target: string
}

export type QuestionItem = {
  id: string
  positionId: PositionId
  abilityDomain: string
  subAbility: string
  knowledgePoint: string
  content: string
  purpose: string
  difficulty: Difficulty
  type: QuestionType
  misconceptions: string[]
  expectedEvidence: string
  followupPrompts: string[]
  resumeRisk: boolean
}

export type TranscriptEntry = {
  questionId: string
  speaker: 'interviewer' | 'user'
  text: string
  timestamp: number
}

export type SessionRef = {
  sessionId: string
}

export type AnswerAck = {
  ok: boolean
}
