// 简历草稿领域单测（P0-2.2 简历线闭环）
// 纯逻辑：buildResumeContent 采用标记 / 岗位注入 / 证据提示，不依赖 uni API。
import { describe, it, expect } from 'vitest'
import { buildResumeContent } from '../store/resume-draft.uts'

describe('简历草稿领域（P0-2.2 简历线闭环）', () => {
  const suggs: any[] = [
    {
      original: '负责订单系统日常维护',
      suggested: '主导订单系统重构，接口 RT 降低 60%',
      reason: '补充量化成果',
      needsUserEvidence: true
    }
  ]

  it('采用标记决定版本内容：采用建议稿，未采用保留原文', () => {
    const adopted = buildResumeContent('resume.pdf', 'Java 后端', suggs, [true], '标准版')
    expect(adopted.includes('主导订单系统重构')).toBe(true)
    expect(adopted.includes('负责订单系统日常维护')).toBe(false)
    const raw = buildResumeContent('resume.pdf', 'Java 后端', suggs, [false], '标准版')
    expect(raw.includes('负责订单系统日常维护')).toBe(true)
  })

  it('版本内容包含目标岗位与文件名（投递版本随岗位动态生成）', () => {
    const content = buildResumeContent('my-resume.pdf', 'Go 后端', [], [], '技术深挖版')
    expect(content.includes('Go 后端')).toBe(true)
    expect(content.includes('my-resume.pdf')).toBe(true)
    expect(content.includes('技术深挖版')).toBe(true)
  })

  it('需补充证据的建议在版本中给出提示，不虚构数据', () => {
    const content = buildResumeContent('r.pdf', 'Java 后端', suggs, [true], '标准版')
    expect(content.includes('需补充真实数据')).toBe(true)
  })
})
