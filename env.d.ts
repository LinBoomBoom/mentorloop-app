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
  // engine/followup-engine
  export function decideFollowup(...args: any[]): any
  export type AnswerSignal = any
  // engine/rubric
  export function confidenceBand(...args: any[]): any
  export function displayLevel(...args: any[]): any
  // engine/answer-signal
  export function analyzeAnswer(...args: any[]): any
  // engine/scorer
  export function scoreInterview(...args: any[]): any
  // store/interview-session
  export const interviewSession: any
  // data/question-bank
  export const QUESTION_BANK: any[]
  export const WRAPUP_QUESTION: any
  // types/interview
  export type PositionBlueprint = any
  export type QuestionItem = any
}
