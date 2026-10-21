// 简历评审单测：确定性统计 / PII 脱敏 / 锚点校验 / LLM 结构化输出与失败降级
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectResumeStats,
  maskPii,
  validateIssues,
  reviewResumeWithLlm
} from './services/resume-review.js'
import { resetFetchForTest, setFetchForTest } from './llm/client.js'
import type { Env } from './config.js'
import type { ExtractedResume, ExtractedUnit } from './services/resume-extract.js'

const extracted: ExtractedResume = {
  fileType: 'pdf',
  pages: 1,
  text:
    '张三 13800138000 zhangsan@example.com\n' +
    '4 年 Java 后端经验，负责订单系统重构，将平均响应时间从 800ms 降到 220ms，QPS 提升到 5000。\n' +
    '技术栈：Java、Spring Boot、MySQL、Redis。',
  units: [
    {
      page: 1,
      paragraph: -1,
      text: '张三 [手机号] zhangsan@example.com 4 年 Java 后端经验，负责订单系统重构，将平均响应时间从 800ms 降到 220ms，QPS 提升到 5000。技术栈：Java、Spring Boot、MySQL、Redis。'
    } as ExtractedUnit
  ]
} as ExtractedResume

const env = (overrides: any = {}): Env =>
  ({
    llmEnabled: true,
    llmBaseUrl: 'https://llm.test/v1',
    llmApiKey: 'sk-test',
    llmModel: 'm',
    llmTimeoutMs: 2000,
    ...overrides
  }) as Env

afterEach(() => resetFetchForTest())

describe('collectResumeStats', () => {
  it('识别联系方式 / 量化成果 / 技术栈 / 动作段', () => {
    const s = collectResumeStats(extracted)
    expect(s.contact).toBe(true)
    expect(s.quantified).toBe(true)
    expect(s.techStack).toContain('Java')
    expect(s.techStack).toContain('Redis')
    expect(s.projects).toBeGreaterThan(0)
    expect(s.gaps).not.toContain('联系方式缺失')
    expect(s.gaps).not.toContain('缺少量化成果')
  })

  it('缺联系方式与量化时进入 gaps', () => {
    const s = collectResumeStats({
      fileType: 'pdf',
      pages: 1,
      text: '负责系统开发与维护，参与团队项目。',
      units: []
    } as ExtractedResume)
    expect(s.contact).toBe(false)
    expect(s.quantified).toBe(false)
    expect(s.gaps).toContain('联系方式缺失')
    expect(s.gaps).toContain('缺少量化成果')
  })
})

describe('maskPii', () => {
  it('手机号与邮箱脱敏', () => {
    const masked = maskPii('联系 13800138000 / a.b@example.com')
    expect(masked).toContain('[手机号]')
    expect(masked).toContain('[邮箱]')
    expect(masked.indexOf('13800138000')).toBe(-1)
  })
})

describe('validateIssues', () => {
  const units: ExtractedUnit[] = [
    {
      page: 1,
      paragraph: -1,
      text: '负责订单系统重构，将响应时间从 800ms 降到 220ms。'
    } as ExtractedUnit
  ]

  it('quote 命中原文才保留；未命中/重复/空建议丢弃', () => {
    const out = validateIssues(
      [
        {
          unit: 'P1',
          severity: 'high',
          category: 'quantification',
          quote: '将响应时间从 800ms 降到 220ms',
          original: '将响应时间从 800ms 降到 220ms',
          suggested: '将响应时间从 800ms 降到 220ms，QPS 提升 3 倍（请补充真实数据）',
          reason: '量化结果能体现影响范围',
          needsUserEvidence: true
        },
        {
          unit: 'P1',
          severity: 'low',
          category: 'language',
          quote: '不存在的句子',
          original: '不存在的句子',
          suggested: '改写',
          reason: '理由',
          needsUserEvidence: false
        },
        {
          unit: 'P1',
          severity: 'medium',
          category: 'ownership',
          quote: '负责订单系统重构',
          original: '负责订单系统重构',
          suggested: '',
          reason: '理由',
          needsUserEvidence: false
        }
      ],
      units
    )
    expect(out.length).toBe(1)
    expect(out[0].page).toBe(1)
    expect(out[0].paragraph).toBe(-1)
    expect(out[0].severity).toBe('high')
    expect(out[0].needsUserEvidence).toBe(true)
    expect(out[0].issueId.indexOf('ri_')).toBe(0)
  })

  it('严密度排序 high → low', () => {
    const out = validateIssues(
      [
        {
          unit: 'P1',
          severity: 'low',
          category: 'language',
          quote: '负责订单系统重构',
          suggested: 'a',
          reason: 'r'
        },
        {
          unit: 'P1',
          severity: 'high',
          category: 'quantification',
          quote: '将响应时间从 800ms 降到 220ms',
          suggested: 'b',
          reason: 'r'
        }
      ],
      units
    )
    expect(out[0].severity).toBe('high')
    expect(out[1].severity).toBe('low')
  })
})

describe('reviewResumeWithLlm', () => {
  it('LLM 返回 JSON → 只保留锚点命中的建议', async () => {
    setFetchForTest(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [
                  {
                    unit: 'P1',
                    severity: 'high',
                    category: 'quantification',
                    quote: '将平均响应时间从 800ms 降到 220ms',
                    original: '将平均响应时间从 800ms 降到 220ms',
                    suggested: '补充 QPS 与影响用户规模（请补充真实数据）',
                    reason: '量化影响范围',
                    needsUserEvidence: true
                  },
                  {
                    unit: 'P1',
                    severity: 'medium',
                    category: 'ownership',
                    quote: '原文没有这句',
                    suggested: 'x',
                    reason: 'y',
                    needsUserEvidence: false
                  }
                ]
              })
            }
          }
        ]
      })
    }))
    const issues = await reviewResumeWithLlm(env(), extracted, '后端')
    expect(issues).not.toBeNull()
    expect(issues!.length).toBe(1)
    expect(issues![0].quote).toContain('800ms')
  })

  it('LLM 未配置 → null；请求失败 → null（不伪造建议）', async () => {
    expect(await reviewResumeWithLlm(env({ llmEnabled: false }), extracted, '后端')).toBeNull()
    setFetchForTest(async () => ({ ok: false, json: async () => ({}) }))
    expect(await reviewResumeWithLlm(env(), extracted, '后端')).toBeNull()
  })
})
