// 内容库适配层（批次 A）：桌面库 interview_questions 行 → MP questions 表行 + QuestionItem
// 同步脚本（scripts/sync-content-questions.mjs）与本地 fixture 灌入共用此模块，保证同一映射逻辑。
// 映射依据：docs/drafts/2026-10-18-content-adapter-design.md §5。

import { QuestionItem, Difficulty, PositionId, QuestionType } from '../types/interview.js'
import { classifyDimension } from '../rules/dimension-classifier.js'
import { phraseQuestion } from '../rules/question-phrasing.js'
import { DOMAIN_LABEL } from '../data/dimension-rules.js'
import { techIdFor } from '../data/tech-vocabulary.js'

// 源行（interview_questions 的适配所需列）
export type RawQuestion = {
  id: string
  track: string | null
  type: string | null
  q: string | null
  a: string | null
  keywords: string | null
  weight: number | null
  difficulty: string | null
  tech: string | null
  subtrack: string | null
  skill: string | null
  license: string | null
}

// 目标行（MP questions 表）
export type QuestionRow = {
  id: string
  position_id: string
  track: string
  subtrack: string
  difficulty: Difficulty
  ability_domain: string
  content: string
  content_raw: string
  evidence: string
  knowledge_point: string
  keywords: string
  tech_token: string
  weight: number
  q_type: string
  license: string
  synced_at: number
}

// 期望证据摘要上限（避免 MEDIUMTEXT 参考答案全文进报告/响应；阈值即纪律）
export const EVIDENCE_MAX = 400

const TRACKS: string[] = ['frontend', 'backend', 'devops', 'ai']
const DIFF_MAP: Record<string, Difficulty> = { easy: 'junior', medium: 'mid', hard: 'senior' }
const TYPE_MAP: Record<string, QuestionType> = { hot: 'scenario', special: 'design' }

// resumeRisk 实证修正（2026-10-18）：云库 weight 仅 {3,5} 且 5 ≡ special/hard，
// 按设计稿「weight>=4」会把全部 1615 道 special 误标为简历验证题、劫持每场出题；
// 云题均为知识/场景题（非简历验证题），故统一 false，简历追问仍由引擎侧动态生成。
function parseKeywords(raw: string | null): string[] {
  if (raw == null || raw.length === 0) return []
  const t = raw.trim()
  if (t.charAt(0) === '[') {
    try {
      const arr = JSON.parse(t) as unknown[]
      const out: string[] = []
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i]
        if (typeof v === 'string' && v.length > 0) out.push(v)
      }
      return out
    } catch {
      // 解析失败：按逗号切分兜底
    }
  }
  return t.split(',').filter((s) => s.length > 0)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

// 源行 → 目标行；不可用行（方向/难度不在值域、题面为空）返回 null（跳过并计数）
export function mapRawQuestion(raw: RawQuestion, syncedAt: number): QuestionRow | null {
  const track = (raw.track ?? '').trim()
  if (TRACKS.indexOf(track) === -1) return null
  const difficulty = DIFF_MAP[(raw.difficulty ?? '').trim()]
  if (difficulty == null) return null
  const rawTitle = (raw.q ?? '').trim()
  if (rawTitle.length === 0) return null

  const keywords = parseKeywords(raw.keywords)
  const subtrack = (raw.subtrack ?? '').trim()
  const tech = (raw.tech ?? '').trim()
  const qType = (raw.type ?? '').trim()
  const knowledgePoint = (raw.skill ?? '').trim() || (keywords.length > 0 ? keywords[0] : '')

  const row: QuestionRow = {
    id: raw.id,
    position_id: track,
    track: track,
    subtrack: subtrack,
    difficulty: difficulty,
    ability_domain: classifyDimension({
      keywords: keywords,
      subtrack: subtrack,
      tech: tech,
      qType: qType
    }),
    content: phraseQuestion(rawTitle, qType),
    content_raw: rawTitle,
    evidence: truncate((raw.a ?? '').trim(), EVIDENCE_MAX),
    knowledge_point: knowledgePoint,
    keywords: keywords.join(','),
    tech_token: techIdFor(track, tech),
    weight: raw.weight != null ? raw.weight : 3,
    q_type: qType,
    license: (raw.license ?? '').trim(),
    synced_at: syncedAt
  }
  return row
}

// QuestionItem 派生字段：purpose 由六维 + 知识点确定性生成（不入库，见设计稿 §12 列清单）
export function purposeOf(row: QuestionRow): string {
  const label = DOMAIN_LABEL[row.ability_domain]
  const d = label != null ? label : row.ability_domain
  return row.knowledge_point.length > 0 ? '考察' + d + '：' + row.knowledge_point : '考察' + d
}

// 目标行 → 选题器消费的 QuestionItem
export function toQuestionItem(row: QuestionRow): QuestionItem {
  const type = TYPE_MAP[row.q_type]
  return {
    id: row.id,
    positionId: row.position_id as PositionId,
    abilityDomain: row.ability_domain,
    subAbility: row.subtrack,
    knowledgePoint: row.knowledge_point,
    content: row.content,
    purpose: purposeOf(row),
    difficulty: row.difficulty,
    type: type != null ? type : 'concept',
    misconceptions: [],
    expectedEvidence: row.evidence,
    followupPrompts: [],
    resumeRisk: false,
    techStack: row.tech_token
  } as QuestionItem
}

// 目标行 → questions 表 upsert 参数（列序与 schema.sql 一致）
export const QUESTION_COLUMNS: string =
  'id, position_id, track, subtrack, difficulty, ability_domain, content, content_raw, evidence, knowledge_point, keywords, tech_token, weight, q_type, license, synced_at'

export function questionParams(row: QuestionRow): (string | number)[] {
  return [
    row.id,
    row.position_id,
    row.track,
    row.subtrack,
    row.difficulty,
    row.ability_domain,
    row.content,
    row.content_raw,
    row.evidence,
    row.knowledge_point,
    row.keywords,
    row.tech_token,
    row.weight,
    row.q_type,
    row.license,
    row.synced_at
  ]
}

// upsert SQL（SQLite 写法；云端由 db-driver 方言翻译为 ON DUPLICATE KEY UPDATE）
export const QUESTION_UPSERT_SQL =
  'INSERT INTO questions (' +
  QUESTION_COLUMNS +
  ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ' +
  'position_id=excluded.position_id, track=excluded.track, subtrack=excluded.subtrack, ' +
  'difficulty=excluded.difficulty, ability_domain=excluded.ability_domain, content=excluded.content, ' +
  'content_raw=excluded.content_raw, evidence=excluded.evidence, knowledge_point=excluded.knowledge_point, ' +
  'keywords=excluded.keywords, tech_token=excluded.tech_token, weight=excluded.weight, ' +
  'q_type=excluded.q_type, license=excluded.license, synced_at=excluded.synced_at'
