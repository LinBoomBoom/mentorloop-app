// 简历评审：确定性结构统计（免费预览）+ LLM 证据锚定建议（付费完整版）
// 铁律：每条建议的 quote 必须能在对应抽取单元中精确命中，否则丢弃（防模型幻觉）
// 隐私：送 LLM 前对手机号/邮箱脱敏；正文不写日志
import type { Env } from '../config.js'
import { chatComplete, type ChatMessage } from '../llm/client.js'
import type { ExtractedResume, ExtractedUnit } from './resume-extract.js'
import { normalizeText } from './resume-extract.js'
import type { ResumeIssue, ResumeIssueCategory, ResumeIssueSeverity } from '../types/domain.js'
import { newId } from '../util.js'

export const RESUME_PROMPT_VERSION = 'resume-review-v1'
export const MAX_ISSUES = 8
// 免费预览：只展示最严重的 3 条；首条给完整改写，其余锁定（不下发 suggested）
export const MAX_PREVIEW_ISSUES = 3

export type ResumeStats = {
  contact: boolean
  projects: number
  techStack: string[]
  quantified: boolean
  gaps: string[]
  formatRisks: string[]
}

const TECH_KEYWORDS = [
  'Java',
  'Spring',
  'Spring Boot',
  'MySQL',
  'Redis',
  'Kafka',
  'RabbitMQ',
  'Elasticsearch',
  'Docker',
  'Kubernetes',
  'K8s',
  'Linux',
  'Go',
  'Golang',
  'Python',
  'Node.js',
  'Node',
  'TypeScript',
  'JavaScript',
  'React',
  'Vue',
  'Angular',
  'Flutter',
  'Android',
  'iOS',
  'Swift',
  'Kotlin',
  'C++',
  'C#',
  'PHP',
  'Ruby',
  'Rust',
  'AWS',
  'Azure',
  'GCP',
  'TensorFlow',
  'PyTorch',
  'LLM',
  'RAG',
  '微服务',
  '分布式',
  '高并发',
  '性能优化'
]

const METRIC_RE =
  /(\d+(\.\d+)?\s*(%|ms|s|秒|分钟|小时|天|万|亿|倍|人|个|次|QPS|TPS|DAU|MAU|PV|UV|GB|MB))/i
const CONTACT_RE = /(1[3-9]\d{9}|[\w.+-]+@[\w-]+(\.[\w-]+)+)/
const PHONE_RE = /1[3-9]\d{9}/g
const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g

export function maskPii(text: string): string {
  return text.replace(PHONE_RE, '[手机号]').replace(EMAIL_RE, '[邮箱]')
}

// 确定性结构统计：不调用 LLM，供免费预览与所有模式的摘要字段
export function collectResumeStats(extracted: ExtractedResume): ResumeStats {
  const text = extracted.text
  const contact = CONTACT_RE.test(text)
  const quantified = METRIC_RE.test(text)
  const techStack: string[] = []
  const lower = text.toLowerCase()
  for (const t of TECH_KEYWORDS) {
    if (lower.indexOf(t.toLowerCase()) >= 0 && techStack.indexOf(t) < 0) techStack.push(t)
  }
  // 项目段数：以「负责/主导/参与/设计/开发/搭建」动作句计数，最多 9 段
  const actions = text.match(/(负责|主导|参与|设计并|从零搭建|开发|搭建)/g)
  const projects = Math.min(9, actions != null ? actions.length : 0)
  const gaps: string[] = []
  if (!contact) gaps.push('联系方式缺失')
  if (!quantified) gaps.push('缺少量化成果')
  if (text.replace(/\s/g, '').length < 300) gaps.push('内容过少，项目细节不足')
  if (!/(19|20)\d{2}[.\-/年]/.test(text)) gaps.push('时间信息不完整')
  const formatRisks: string[] = []
  if (extracted.fileType === 'pdf' && extracted.pages > 2) formatRisks.push('PDF 超过 2 页')
  if (text.length > 6000) formatRisks.push('内容过密，建议精简到一页')
  if (contact && text.indexOf('@') < 0) formatRisks.push('未提供邮箱')
  return {
    contact: contact,
    projects: projects,
    techStack: techStack,
    quantified: quantified,
    gaps: gaps,
    formatRisks: formatRisks
  } as ResumeStats
}

export function isResumeLlmReady(env: Env): boolean {
  return env.llmEnabled && env.llmBaseUrl.length > 0 && env.llmModel.length > 0
}

// 从模型输出中提取 JSON（容忍 ```json 包裹）
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

function unitLabel(u: ExtractedUnit): string {
  return u.page > 0 ? 'P' + u.page : 'D' + u.paragraph
}

function buildPrompt(
  position: string,
  maskedUnits: ExtractedUnit[],
  maxIssues: number = MAX_ISSUES
): ChatMessage[] {
  const body = maskedUnits.map((u) => '[' + unitLabel(u) + '] ' + u.text).join('\n')
  const system =
    '你是 MentorLoop 的资深简历顾问。你只能基于用户提供的简历原文提出修改建议，' +
    '绝对不得编造原文不存在的经历、公司、指标或技术。每条建议必须给出原文精确片段 quote，' +
    '并说明问题与可执行改法。只输出 JSON，不含其他文字。'
  const user = `目标岗位：${position.length > 0 ? position : '未指定（按通用技术岗评审）'}

简历原文（已脱敏；[P数字] 为 PDF 页码，[D数字] 为 DOCX 段落）：
${body}

请输出最多 ${maxIssues} 条建议，按严重度从高到低：
{"issues":[{"unit":"P1","severity":"high|medium|low","category":"quantification|ownership|techMatch|format|language|completeness","quote":"原文逐字片段","original":"原句","suggested":"改后的句子（中文，具体可执行）","reason":"为什么改、改完收益（1-2 句）","needsUserEvidence":true|false}]}

要求：
1. quote 必须逐字来自对应 unit，不得改写、不得跨 unit 拼接；找不到就放弃该条。
2. suggested 不得编造数字；需要用户补真实数据时 needsUserEvidence=true，并在 suggested 中用「（请补充真实数据）」标注。
3. 优先指出：量化缺失、职责边界模糊、技术栈与岗位不匹配、格式/篇幅问题、表达冗余。
4. 没有明显问题时返回 {"issues":[]}。`
  return [
    { role: 'system', content: system } as ChatMessage,
    { role: 'user', content: user } as ChatMessage
  ]
}

const SEVERITIES: ResumeIssueSeverity[] = ['high', 'medium', 'low']
const CATEGORIES: ResumeIssueCategory[] = [
  'quantification',
  'ownership',
  'techMatch',
  'format',
  'language',
  'completeness'
]

function asSeverity(v: any): ResumeIssueSeverity {
  return typeof v === 'string' && SEVERITIES.indexOf(v as ResumeIssueSeverity) >= 0
    ? (v as ResumeIssueSeverity)
    : 'medium'
}

function asCategory(v: any): ResumeIssueCategory {
  return typeof v === 'string' && CATEGORIES.indexOf(v as ResumeIssueCategory) >= 0
    ? (v as ResumeIssueCategory)
    : 'language'
}

// 校验并落地模型输出：quote 必须命中原文，否则丢弃
export function validateIssues(raw: any[], maskedUnits: ExtractedUnit[]): ResumeIssue[] {
  const out: ResumeIssue[] = []
  const seen: string[] = []
  for (let i = 0; i < raw.length && out.length < MAX_ISSUES; i++) {
    const r = raw[i]
    if (r == null || typeof r !== 'object') continue
    const quote = normalizeText(typeof r.quote === 'string' ? r.quote : '')
    if (quote.length < 4) continue
    const suggested = normalizeText(typeof r.suggested === 'string' ? r.suggested : '')
    const reason = normalizeText(typeof r.reason === 'string' ? r.reason : '')
    if (suggested.length === 0 || reason.length === 0) continue
    if (suggested.length > 300) continue
    if (seen.indexOf(quote) >= 0) continue

    // 优先匹配模型标注的 unit；不命中则全量查找（唯一命中才接受）
    let hit: ExtractedUnit | null = null
    const label = typeof r.unit === 'string' ? r.unit : ''
    for (const u of maskedUnits) {
      if (label.length > 0 && unitLabel(u) === label && normalizeText(u.text).indexOf(quote) >= 0) {
        hit = u
        break
      }
    }
    if (hit == null) {
      const hits = maskedUnits.filter((u) => normalizeText(u.text).indexOf(quote) >= 0)
      if (hits.length === 1) hit = hits[0]
    }
    if (hit == null) continue

    const original = normalizeText(typeof r.original === 'string' ? r.original : '')
    out.push({
      issueId: newId('ri'),
      severity: asSeverity(r.severity),
      category: asCategory(r.category),
      page: hit.page,
      paragraph: hit.paragraph,
      quote: quote,
      original:
        original.length >= quote.length && hit.text.indexOf(original) >= 0 ? original : quote,
      suggested: suggested,
      reason: reason,
      needsUserEvidence: r.needsUserEvidence === true,
      locked: false
    } as ResumeIssue)
    seen.push(quote)
  }
  // 严重度降序（high → low）
  out.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
  return out
}

// 调用 LLM 生成建议；未配置/失败返回 null（调用方不得扣额度、不得返回假数据）
async function callReviewLlm(
  env: Env,
  extracted: ExtractedResume,
  position: string,
  maxIssues: number,
  maxTokens: number,
  timeoutMs: number
): Promise<ResumeIssue[] | null> {
  if (!isResumeLlmReady(env)) return null
  const maskedUnits: ExtractedUnit[] = extracted.units.map(
    (u) => ({ page: u.page, paragraph: u.paragraph, text: maskPii(u.text) }) as ExtractedUnit
  )
  const messages = buildPrompt(position, maskedUnits, maxIssues)
  const r = await chatComplete(
    {
      baseUrl: env.llmBaseUrl,
      apiKey: env.llmApiKey,
      model: env.llmModel,
      timeoutMs: timeoutMs
    },
    messages,
    { maxTokens: maxTokens, temperature: 0.2 }
  )
  if (r == null) return null
  const parsed = extractJson(r.content)
  if (parsed == null || !Array.isArray(parsed.issues)) return null
  return validateIssues(parsed.issues, maskedUnits)
}

// 付费完整评审批注（最多 8 条）
export async function reviewResumeWithLlm(
  env: Env,
  extracted: ExtractedResume,
  position: string
): Promise<ResumeIssue[] | null> {
  return callReviewLlm(env, extracted, position, MAX_ISSUES, 2000, env.llmTimeoutMs)
}

// 裁剪为免费预览诊断：最多 3 条；[0] 完整改写，[1..] 锁定且不下发 suggested
export function toPreviewIssues(issues: ResumeIssue[]): ResumeIssue[] {
  const out: ResumeIssue[] = []
  for (let i = 0; i < issues.length && out.length < MAX_PREVIEW_ISSUES; i++) {
    const it = issues[i]
    const locked = out.length > 0
    out.push({
      issueId: it.issueId,
      severity: it.severity,
      category: it.category,
      page: it.page,
      paragraph: it.paragraph,
      quote: it.quote,
      original: it.original,
      suggested: locked ? '' : it.suggested,
      reason: it.reason,
      needsUserEvidence: it.needsUserEvidence,
      locked: locked
    } as ResumeIssue)
  }
  return out
}

// 免费预览 LLM：轻量（最多 3 条、maxTokens≈700、超时≤8s）
// 未配置 / 超时 / 失败 → 返回 []（调用方回退结构预览，不报错、不扣额度）
export async function reviewResumePreviewWithLlm(
  env: Env,
  extracted: ExtractedResume,
  position: string
): Promise<ResumeIssue[]> {
  const previewTimeout = Math.min(env.llmTimeoutMs, 8000)
  const issues = await callReviewLlm(
    env,
    extracted,
    position,
    MAX_PREVIEW_ISSUES,
    700,
    previewTimeout
  )
  if (issues == null) return []
  return toPreviewIssues(issues)
}
