// LLM 报告解释器单测（P1.2）：解析 / 合并不篡改分数 / 失败回退
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { interpretReport, mergeInterpretation, LmInterpretation } from './report-enhancer.js'
import { setFetchForTest, resetFetchForTest } from './client.js'
import { InterviewReport, DimensionScore } from '../types/scoring.js'

const ENVS = { baseUrl: 'https://llm.test/v1', apiKey: 'sk-test', model: 'm', timeoutMs: 30000 }

function fakeFetch(content: string, ok = true) {
  return async (_url: string, _init: any) => {
    return { ok, json: async () => ({ choices: [{ message: { content } }] }) }
  }
}

function buildReport(): InterviewReport {
  const dims: DimensionScore[] = [
    {
      dimension: 'knowledge',
      level: 'B',
      confidence: 0.85,
      evidence: '回答有展开',
      missingEvidence: '无',
      suggestQuestions: ['题A'],
      exampleAnswer: ''
    },
    {
      dimension: 'communication',
      level: 'C',
      confidence: 0.2,
      evidence: '无明显正向证据',
      missingEvidence: '回答过短',
      suggestQuestions: ['题B'],
      exampleAnswer: ''
    }
  ]
  return {
    overall: '规则总评',
    strongest: '岗位知识与正确性',
    topPriority: '表达与沟通',
    dimensions: dims,
    riskQuestions: [],
    trainingPlan: []
  } as InterviewReport
}

describe('LLM 报告解释器', () => {
  beforeEach(() => resetFetchForTest())
  afterEach(() => resetFetchForTest())

  it('解析 LLM JSON（容忍代码块包裹）', async () => {
    setFetchForTest(
      fakeFetch(
        '```json\n{"overall":"整体扎实","examples":{"knowledge":"示例A","communication":"示例B"}}\n```'
      )
    )
    const interp = await interpretReport(ENVS, buildReport())
    expect(interp).not.toBeNull()
    expect(interp!.overall).toBe('整体扎实')
    expect(interp!.examples.knowledge).toBe('示例A')
    expect(interp!.examples.communication).toBe('示例B')
  })

  it('合并只覆盖解释字段，分数/等级/置信度/证据不变', async () => {
    setFetchForTest(fakeFetch('{"overall":"L","examples":{"knowledge":"K示例"}}'))
    const interp = (await interpretReport(ENVS, buildReport())) as LmInterpretation
    const before = buildReport()
    const snapshot = JSON.stringify({
      levels: before.dimensions.map((d) => d.level),
      confidences: before.dimensions.map((d) => d.confidence),
      evidences: before.dimensions.map((d) => d.evidence),
      missing: before.dimensions.map((d) => d.missingEvidence)
    })
    mergeInterpretation(before, interp)
    expect(before.overall).toBe('L')
    expect(before.dimensions[0].exampleAnswer).toBe('K示例')
    expect(before.dimensions[1].exampleAnswer).toBe('') // 无对应示例保持空
    expect(
      JSON.stringify({
        levels: before.dimensions.map((d) => d.level),
        confidences: before.dimensions.map((d) => d.confidence),
        evidences: before.dimensions.map((d) => d.evidence),
        missing: before.dimensions.map((d) => d.missingEvidence)
      })
    ).toBe(snapshot)
  })

  it('LLM 失败（非 2xx / 坏 JSON / 网络异常）→ 返回 null（规则报告兜底）', async () => {
    setFetchForTest(fakeFetch('not json', false))
    expect(await interpretReport(ENVS, buildReport())).toBeNull()

    setFetchForTest(async () => {
      throw new Error('network down')
    })
    expect(await interpretReport(ENVS, buildReport())).toBeNull()

    setFetchForTest(fakeFetch('{"bad": 1}'))
    const empty = await interpretReport(ENVS, buildReport())
    expect(empty).toBeNull()
  })

  it('未配置 LLM（空 baseUrl/model）→ 直接返回 null，不发起请求', async () => {
    setFetchForTest(async () => {
      throw new Error('should not be called')
    })
    expect(
      await interpretReport({ baseUrl: '', apiKey: '', model: '', timeoutMs: 1000 }, buildReport())
    ).toBeNull()
    expect(
      await interpretReport(
        { baseUrl: 'https://x/v1', apiKey: '', model: '', timeoutMs: 1000 },
        buildReport()
      )
    ).toBeNull()
  })
})
