// 面试状态机单测（文档 04）
// 纯逻辑，不依赖 UI / 后端。.uts 由 vitest.config.ts 的 uts-as-typescript 插件转译。
import { describe, it, expect, beforeEach } from 'vitest'
import { interviewSession } from '../store/interview-session.uts'

describe('interview-session 状态机', () => {
  beforeEach(() => {
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
    interviewSession.pushQuestion({
      id: 'q1',
      abilityDomain: '并发与JVM',
      subAbility: '问题定位',
      content: '描述一次 OOM 定位',
      purpose: '验证项目深度',
      difficulty: 'mid',
      expectedEvidence: '指标、假设、验证、结果'
    })

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
    interviewSession.pushQuestion({
      id: 'q9',
      abilityDomain: '系统设计',
      subAbility: '容量估算',
      content: '设计一个短链服务',
      purpose: '评估权衡',
      difficulty: 'mid',
      expectedEvidence: '约束与取舍'
    })
    interviewSession.transition('DEVICE_CHECK')

    const ev = interviewSession.transition('READY')
    expect(ev!.questionId).toBe('q9')
  })
})
