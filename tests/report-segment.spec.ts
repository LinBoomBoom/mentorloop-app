// 跨 tab 分段意图单测（任务卡 2026-10-15-report-segment-deeplink 验收项）
// 覆盖：无意图返回空串 / 写入后可读 / 一次性消费后清空
import { describe, it, expect, beforeEach } from 'vitest'
import { reportSegmentIntent } from '../store/report-segment.uts'

describe('report-segment 跨 tab 分段意图', () => {
  beforeEach(() => {
    reportSegmentIntent.consume()
  })

  it('无意图时返回空串', () => {
    expect(reportSegmentIntent.consume()).toBe('')
  })

  it('写入后可读一次', () => {
    reportSegmentIntent.set('growth')
    expect(reportSegmentIntent.consume()).toBe('growth')
  })

  it('消费后清空，不重复生效', () => {
    reportSegmentIntent.set('growth')
    reportSegmentIntent.consume()
    expect(reportSegmentIntent.consume()).toBe('')
  })
})
