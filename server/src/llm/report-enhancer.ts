// 报告解释器（P1.2）：以规则评分为锚点，LLM 只生成解释性文本与优秀示例
// 铁律（文档 02 §3.5）：模型不得改变已经确认的原始证据与分数来源。
// 仅覆盖：overall（总体判断文案）与各个维度的 exampleAnswer（优秀回答示例）；
// 分数/等级/置信度/证据/训练计划保持规则输出不变。任何失败返回 null → 报告保持纯规则。

import { InterviewReport } from '../types/scoring.js'
import { LmEnvs, chatComplete, ChatMessage } from './client.js'

export type LmInterpretation = {
  overall: string
  examples: { [dimension: string]: string }
}

const VALID_DIMS = [
  'knowledge',
  'engineering',
  'analysis',
  'communication',
  'learning',
  'motivation'
]

// 从文本中提取 JSON（模型偶尔会包 ```json 前缀，做容错）
function extractJson(text: string): any | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.substring(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function buildPrompt(report: InterviewReport): ChatMessage[] {
  const dimsText = report.dimensions
    .map(
      (d) =>
        `- ${d.dimension}（等级 ${d.level}，置信度 ${d.confidence}）证据：${d.evidence}${d.missingEvidence !== '无' ? '；待补：' + d.missingEvidence : ''} 建议加练：${d.suggestQuestions.join('、')}`
    )
    .join('\n')

  const system =
    '你是 MentorLoop 的面试报告解释官。分数、等级、置信度与证据均由可溯源的规则引擎自动计算，' +
    '你只能基于它们撰写解释性文字，绝对不能质疑、修改或猜测这些分数。只输出 JSON，不含其他文字。'
  const user = `请为以下求职者的面试评分结果生成解释（规则分数仅供参考，不直接复述数字）：
要求：
1. overall：1–2 句中文总体判断，体现意图要具体、自然，不堆术语。
2. examples：为每个维度给出一段"优秀回答示例"（中文，60–120 字，可含具体指标与技术细节），示范该维度 A 级回答的样子。
只输出 JSON，形如：{"overall":"...","examples":{"knowledge":"...",...}}

评分结果：
${report.overall}

各维度：
${dimsText}`

  return [
    { role: 'system', content: system } as ChatMessage,
    { role: 'user', content: user } as ChatMessage
  ]
}

export async function interpretReport(
  envs: LmEnvs,
  report: InterviewReport
): Promise<LmInterpretation | null> {
  if (!envs.baseUrl || !envs.model) return null
  const messages = buildPrompt(report)
  const res = await chatComplete(envs, messages)
  if (res == null) return null
  const json = extractJson(res.content)
  if (json == null) return null

  const examples: { [dimension: string]: string } = {}
  if (json.examples != null && typeof json.examples === 'object') {
    for (const dim of VALID_DIMS) {
      const v = json.examples[dim]
      if (typeof v === 'string' && v.length > 0) examples[dim] = v
    }
  }
  const overall = typeof json.overall === 'string' ? json.overall.trim() : ''
  if (overall.length === 0 && Object.keys(examples).length === 0) return null
  return { overall, examples }
}

// 合并解释到规则报告（仅覆盖解释字段；分数/证据不动）
export function mergeInterpretation(
  report: InterviewReport,
  interp: LmInterpretation
): InterviewReport {
  if (interp.overall.length > 0) report.overall = interp.overall
  for (const dim of report.dimensions) {
    const ex = interp.examples[dim.dimension]
    if (ex != null && ex.length > 0) dim.exampleAnswer = ex
  }
  return report
}
