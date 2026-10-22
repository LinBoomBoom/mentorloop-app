/// <reference types="@dcloudio/types" />

// uvue 模块声明，供 vue-tsc 与 ESLint 识别
declare module '*.uvue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// .uts 本质是 TS：运行时由 vitest 插件按 ts 转译。
// TS 无法直接加载 .uts，这里将测试实际使用的符号宽松声明为 any；
// 新增导入符号时在此追加一行即可。真实编译与类型由 uni 编译器保证。
declare module '*.uts' {
  // engine/question-selector
  export function selectNext(...args: any[]): any
  export function getModeBudget(...args: any[]): any
  export type SelectorInput = any
  export type SelectorOutput = any
  // engine/followup-engine
  export function decideFollowup(...args: any[]): any
  export type AnswerSignal = any
  // engine/rubric
  export function confidenceBand(...args: any[]): any
  export function displayLevel(...args: any[]): any
  // engine/answer-signal
  export function analyzeAnswer(...args: any[]): any
  // engine/rephrase（房间「换一种说法」）
  export function rephraseQuestion(...args: any[]): any
  export type RephraseInput = any
  // engine/dimension-classifier（批次 A 六维分类，双端镜像）
  export function classifyDimension(...args: any[]): any
  export type DimensionInput = any
  // engine/question-phrasing（批次 A 题面生成，双端镜像）
  export function phraseQuestion(...args: any[]): any
  // data/dimension-rules（批次 A）
  export const DIMENSION_RULES: any[]
  export const SUBTRACK_DOMAIN: any
  export const DOMAIN_LABEL: any
  // engine/scorer
  export function scoreInterview(...args: any[]): any
  // store/interview-session
  export const interviewSession: any
  // store/report-history（/me/reports 拉取节流）
  export const reportHistory: any
  // store/training-history（P0-1 训练闭环）
  export function reasonForAnswer(...args: any[]): any
  export function domainOfTaskId(...args: any[]): any
  export const SKIP_REASON: any
  // store/resume-draft（P0-2.2 简历线闭环）
  export function buildResumeContent(...args: any[]): any
  // data/question-bank
  export const QUESTION_BANK: any[]
  export const WRAPUP_QUESTION: any
  export const FRONTEND_WRAPUP_QUESTION: any
  export function getWrapupForPosition(...args: any[]): any
  export function getQuestionById(...args: any[]): any
  // data/position-options（rules-consistency.spec）
  export const POSITION_OPTIONS: any[]
  export const EXPERIENCE_OPTIONS: any[]
  export const DIFFICULTY_PRIORITY: any
  // data/backend-map（rules-consistency.spec）
  export function getDomainIds(...args: any[]): any
  // engine/rubric（rules-consistency.spec）
  export const RUBRIC: any[]
  // types/interview
  export type PositionBlueprint = any
  export type QuestionItem = any
  // api/virtual-pay（W5 客户端拉起）
  export const PAY_CANCELLED: string
  export function isWechatVersionAtLeast(...args: any[]): any
  export function describeVirtualPayError(...args: any[]): any
  export function isSessionExpiredCode(...args: any[]): any
  export function isDuplicateOrderCode(...args: any[]): any
}
