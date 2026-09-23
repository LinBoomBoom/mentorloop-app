// 面试状态机单测（文档 04）
// 纯逻辑，不依赖 UI / 后端。.uts 由 vitest.config.ts 的 uts-as-typescript 插件转译。
import { describe, it, expect, beforeEach } from 'vitest'
import { interviewSession } from '../store/interview-session.uts'

// ---- 为 Node 环境 mock uni 存储 API（interview-session 的快照依赖 uni.setStorageSync 等）----
const storage: Record<string, string> = {}
const uniMock = {
  setStorageSync(key: string, val: string) {
    storage[key] = val
  },
  getStorageSync(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null
  },
  removeStorageSync(key: string) {
    delete storage[key]
  }
}
// @ts-expect-error uni 全局由 uni-app 提供，Node 测试环境用 mock 注入
globalThis.uni = uniMock

function makeQ(id: string) {
  return {
    id,
    abilityDomain: 'knowledge',
    subAbility: 'sub',
    knowledgePoint: 'kp',
    content: 'q',
    purpose: 'p',
    difficulty: 'mid',
    type: 'concept',
    misconceptions: [],
    expectedEvidence: 'e',
    followupPrompts: [],
    resumeRisk: false
  }
}

describe('interview-session 状态机', () => {
  beforeEach(() => {
    // 清空 mock storage，避免用例间污染
    for (const k of Object.keys(storage)) delete storage[k]
    interviewSession.reset('session-1')
  })

  it('初始态为 CREATED', () => {
    expect(interviewSession.getStatus()).toBe('CREATED')
  })

  it('按合法路径推进并生成幂等键', () => {
    const a = interviewSession.transition('DEVICE_CHECK')
    const b = interviewSession.transition('READY')

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(interviewSession.getStatus()).toBe('READY')
    expect(a!.idempotencyKey).toBe('session-1-1')
    expect(b!.idempotencyKey).toBe('session-1-2')
    expect(b!.eventSeq).toBe(2)
  })

  it('非法迁移返回 null 且不改变状态', () => {
    const bad = interviewSession.transition('ASKING') // CREATED 只能到 DEVICE_CHECK
    expect(bad).toBeNull()
    expect(interviewSession.getStatus()).toBe('CREATED')
  })

  it('canTransition 反映合法边', () => {
    expect(interviewSession.canTransition('DEVICE_CHECK')).toBe(true)
    expect(interviewSession.canTransition('COMPLETED')).toBe(false)
  })

  it('题目与转写可累积', () => {
    interviewSession.pushQuestion(makeQ('q1'))

    interviewSession.appendTranscript({
      questionId: 'q1',
      speaker: 'user',
      text: '通过 heap dump 定位',
      timestamp: Date.now()
    })

    expect(interviewSession.getQuestions().length).toBe(1)
    expect(interviewSession.getTranscript().length).toBe(1)
  })

  it('事件携带当前题目 ID', () => {
    interviewSession.pushQuestion(makeQ('q9'))
    interviewSession.transition('DEVICE_CHECK')

    const ev = interviewSession.transition('READY')
    expect(ev!.questionId).toBe('q9')
  })

  it('追问深度：reset 为 0，increment +1，切题时应手动 resetDepth', () => {
    expect(interviewSession.getDepth()).toBe(0)
    interviewSession.incrementDepth()
    expect(interviewSession.getDepth()).toBe(1)
    interviewSession.incrementDepth()
    expect(interviewSession.getDepth()).toBe(2)
    interviewSession.resetDepth()
    expect(interviewSession.getDepth()).toBe(0)
  })

  it('快照保存/恢复包含追问深度', () => {
    interviewSession.pushQuestion(makeQ('q1'))
    interviewSession.incrementDepth()
    interviewSession.saveSnapshot()

    interviewSession.reset('session-2')
    expect(interviewSession.getDepth()).toBe(0)

    const snap = interviewSession.restoreSnapshot()
    expect(snap).not.toBeNull()
    expect(interviewSession.getDepth()).toBe(1)
    expect(interviewSession.getQuestions().length).toBe(1)

    interviewSession.clearSnapshot()
    expect(interviewSession.restoreSnapshot()).toBeNull()
  })
})
