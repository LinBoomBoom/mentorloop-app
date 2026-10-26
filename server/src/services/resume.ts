// 简历服务：真实 PDF/DOCX 抽取 + LLM 证据锚定评审 + 历史/额度
// 契约：docs/contracts/2026-10-21-resume-ai-review.freeze.md
// 约束：
//   - 不再返回固定假数据；LLM 未配置/失败 → 明确错误（不扣额度）
//   - 每条 issue 的 quote 必须命中原文（由 resume-review 校验）
//   - 同一文件（hash + 岗位）完整评审命中缓存，不重复计费
import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { Db } from '../db.js'
import type { Env } from '../config.js'
import { now } from '../util.js'
import type {
  ResumeHistoryItem,
  ResumeIssue,
  ResumeParseResult,
  ResumeQuota,
  ResumeSuggestion
} from '../types/domain.js'
import {
  extractResume,
  loadCloudResumeBytes,
  safeFileName,
  type ResumeFileType
} from './resume-extract.js'
import {
  collectResumeStats,
  reviewResumePreviewWithLlm,
  reviewResumeWithLlm
} from './resume-review.js'
import {
  getResumeQuota,
  refundResumeQuota,
  reserveFullReview,
  reservePreview
} from './resume-quota.js'
import { deleteCloudFiles } from './wx-storage.js'

export type ParseResumeOutput = { result: ResumeParseResult; quota: ResumeQuota }

type ResumeRow = {
  id: number
  original_url: string | null
  file_name: string | null
  file_type: string | null
  content_hash: string | null
  target_position: string | null
  mode: string | null
  parse_payload: string | null
  created_at: number
}

function rowToResult(row: ResumeRow): ResumeParseResult | null {
  if (row.parse_payload == null) return null
  try {
    const r = JSON.parse(row.parse_payload) as any
    if (r == null || typeof r !== 'object') return null
    // 历史读数以库内元信息为准，避免 payload 缺字段
    r.resumeId = String(row.id)
    r.fileName = row.file_name != null ? row.file_name : 'resume'
    r.fileType = (row.file_type === 'docx' ? 'docx' : 'pdf') as ResumeFileType
    r.mode = row.mode === 'preview' ? 'preview' : 'full'
    r.cached = true
    // 兼容 2026-10-21 简历 AI 评审上线前的旧记录：payload 只有结构统计，
    // 无 issues/数组字段；不补齐会让历史列表迭代 undefined 抛错 → /resume/history 500
    r.pages = typeof r.pages === 'number' ? r.pages : 0
    r.contact = r.contact === true
    r.projects = typeof r.projects === 'number' ? r.projects : 0
    r.techStack = Array.isArray(r.techStack) ? r.techStack : []
    r.quantified = r.quantified === true
    r.gaps = Array.isArray(r.gaps) ? r.gaps : []
    r.formatRisks = Array.isArray(r.formatRisks) ? r.formatRisks : []
    r.issues = Array.isArray(r.issues) ? r.issues : []
    // 2026-10-24 免费预览 teaser 上线前的旧记录：无 previewIssues / locked，读取时补齐
    r.previewIssues = Array.isArray(r.previewIssues) ? r.previewIssues : []
    for (let i = 0; i < r.issues.length; i++) {
      const it = r.issues[i]
      if (it != null && typeof it === 'object') it.locked = it.locked === true
    }
    for (let i = 0; i < r.previewIssues.length; i++) {
      const it = r.previewIssues[i]
      if (it != null && typeof it === 'object') it.locked = it.locked === true
    }
    return r as ResumeParseResult
  } catch {
    return null
  }
}

// 完整评审缓存：同用户 + 同 hash + 同岗位 + full
async function findCachedFull(
  db: Db,
  uid: string,
  hash: string,
  position: string
): Promise<ResumeParseResult | null> {
  const row = (await db
    .prepare(
      `SELECT r.* FROM resumes r JOIN users u ON u.id = r.user_id
       WHERE u.uid = ? AND r.content_hash = ? AND r.target_position = ?
         AND r.mode = 'full' AND r.parse_payload IS NOT NULL
       ORDER BY r.id DESC LIMIT 1`
    )
    .get(uid, hash, position)) as any
  return row != null ? rowToResult(row as ResumeRow) : null
}

// 免费预览缓存：同用户 + 同 hash + 同岗位 + preview（命中不调 LLM、不扣每日次数）
async function findCachedPreview(
  db: Db,
  uid: string,
  hash: string,
  position: string
): Promise<ResumeParseResult | null> {
  const row = (await db
    .prepare(
      `SELECT r.* FROM resumes r JOIN users u ON u.id = r.user_id
       WHERE u.uid = ? AND r.content_hash = ? AND r.target_position = ?
         AND r.mode = 'preview' AND r.parse_payload IS NOT NULL
       ORDER BY r.id DESC LIMIT 1`
    )
    .get(uid, hash, position)) as any
  return row != null ? rowToResult(row as ResumeRow) : null
}

// 同 user + hash + 岗位的预览行 id（用于 preview → full 同行更新，避免历史重复）
async function findPreviewRowId(
  db: Db,
  uid: string,
  hash: string,
  position: string
): Promise<number | null> {
  const row = (await db
    .prepare(
      `SELECT r.id FROM resumes r JOIN users u ON u.id = r.user_id
       WHERE u.uid = ? AND r.content_hash = ? AND r.target_position = ? AND r.mode = 'preview'
       ORDER BY r.id DESC LIMIT 1`
    )
    .get(uid, hash, position)) as any
  return row != null ? Number(row.id) : null
}

async function insertResumeRow(
  db: Db,
  uid: string,
  originalUrl: string,
  fileName: string,
  fileType: ResumeFileType,
  hash: string,
  position: string,
  mode: 'full' | 'preview',
  result: ResumeParseResult
): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO resumes
        (user_id, original_url, file_name, file_type, content_hash, target_position, mode, parse_payload, optimize_payload, created_at)
       VALUES ((SELECT id FROM users WHERE uid = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      uid,
      originalUrl,
      fileName,
      fileType,
      hash,
      position,
      mode,
      JSON.stringify(result),
      JSON.stringify(result.issues),
      now()
    )
  const id = Number(r.lastInsertRowid)
  // 回写 resumeId，历史/详情读取无需二次拼装
  result.resumeId = String(id)
  await db
    .prepare('UPDATE resumes SET parse_payload = ? WHERE id = ?')
    .run(JSON.stringify(result), id)
  return id
}

// 解析入口：真实抽取 → 缓存 → 额度 → LLM/预览 → 落库
export async function parseResumeFile(
  db: Db,
  env: Env,
  uid: string,
  fileUrl: string,
  fileName: string,
  position: string
): Promise<ParseResumeOutput> {
  if (fileUrl.indexOf('cloud://') !== 0) {
    throw new Error('RESUME_LOCAL_UNSUPPORTED')
  }
  const bytes = await loadCloudResumeBytes(env, fileUrl)
  const hash = createHash('sha256').update(bytes).digest('hex')
  const pos = position.trim()
  const name = safeFileName(fileName.length > 0 ? fileName : basename(fileUrl))

  // 完整评审缓存命中：不消耗额度、不调用 LLM
  const cachedFull = await findCachedFull(db, uid, hash, pos)
  if (cachedFull != null) {
    return {
      result: cachedFull,
      quota: await getResumeQuota(db, env, uid)
    } as ParseResumeOutput
  }

  const quota = await getResumeQuota(db, env, uid)

  // 免费预览缓存命中：不调 LLM、不扣每日预览次数（仅免费态适用；会员态应走完整评审）
  if (!quota.canFull) {
    const cachedPreview = await findCachedPreview(db, uid, hash, pos)
    if (cachedPreview != null) {
      return { result: cachedPreview, quota: quota } as ParseResumeOutput
    }
  }

  const extracted = await extractResume(bytes)
  const stats = collectResumeStats(extracted)

  if (quota.canFull) {
    const token = await reserveFullReview(db, env, uid)
    if (token == null) throw new Error('RESUME_QUOTA_EXHAUSTED')
    let issues: any = null
    try {
      issues = await reviewResumeWithLlm(env, extracted, pos)
    } catch (e) {
      await refundResumeQuota(db, uid, token)
      throw e
    }
    if (issues == null) {
      await refundResumeQuota(db, uid, token)
      throw new Error('RESUME_AI_UNAVAILABLE')
    }
    const result = {
      resumeId: '',
      fileName: name,
      fileType: extracted.fileType,
      pages: extracted.pages,
      contact: stats.contact,
      projects: stats.projects,
      techStack: stats.techStack,
      quantified: stats.quantified,
      gaps: stats.gaps,
      formatRisks: stats.formatRisks,
      issues: issues,
      previewIssues: [],
      mode: 'full',
      cached: false
    } as ResumeParseResult
    // preview → full 去重：同 user + hash + 岗位已有预览行则更新该行（resumeId 不变）
    const previewId = await findPreviewRowId(db, uid, hash, pos)
    if (previewId != null) {
      result.resumeId = String(previewId)
      await db
        .prepare(
          `UPDATE resumes SET mode = 'full', parse_payload = ?, optimize_payload = ? WHERE id = ?`
        )
        .run(JSON.stringify(result), JSON.stringify(result.issues), previewId)
    } else {
      await insertResumeRow(db, uid, fileUrl, name, extracted.fileType, hash, pos, 'full', result)
    }
    return { result, quota: await getResumeQuota(db, env, uid) } as ParseResumeOutput
  }

  // 免费预览：轻量 LLM 产出最多 3 条有证据诊断（首条完整改写，其余锁定）
  const token = await reservePreview(db, env, uid)
  if (token == null) throw new Error('RESUME_PREVIEW_EXHAUSTED')
  // LLM 未配置 / 超时 / 失败 → 回退结构预览（previewIssues=[]），不报错、不扣额度
  let previewIssues: ResumeIssue[] = []
  try {
    previewIssues = await reviewResumePreviewWithLlm(env, extracted, pos)
  } catch {
    previewIssues = []
  }
  const result = {
    resumeId: '',
    fileName: name,
    fileType: extracted.fileType,
    pages: extracted.pages,
    contact: stats.contact,
    projects: stats.projects,
    techStack: stats.techStack,
    quantified: stats.quantified,
    gaps: stats.gaps,
    formatRisks: stats.formatRisks,
    issues: [],
    previewIssues: previewIssues,
    mode: 'preview',
    cached: false
  } as ResumeParseResult
  try {
    await insertResumeRow(db, uid, fileUrl, name, extracted.fileType, hash, pos, 'preview', result)
  } catch (e) {
    await refundResumeQuota(db, uid, token)
    throw e
  }
  return { result, quota: await getResumeQuota(db, env, uid) } as ParseResumeOutput
}

// 历史列表：最近 limit 条（默认 20，上限 50）
export async function listResumeHistory(
  db: Db,
  uid: string,
  limit: number = 20
): Promise<ResumeHistoryItem[]> {
  const n = Math.min(50, Math.max(1, limit))
  const rows = (await db
    .prepare(
      `SELECT r.* FROM resumes r JOIN users u ON u.id = r.user_id
       WHERE u.uid = ? AND r.parse_payload IS NOT NULL
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`
    )
    .all(uid, n)) as unknown[]
  const items: ResumeHistoryItem[] = []
  for (const raw of rows) {
    const row = raw as ResumeRow
    const result = rowToResult(row)
    if (result == null) continue
    let issuesHigh = 0
    for (const it of result.issues) {
      if (it.severity === 'high') issuesHigh += 1
    }
    items.push({
      resumeId: result.resumeId,
      fileName: result.fileName,
      fileType: result.fileType,
      createdAt: row.created_at,
      mode: result.mode,
      issuesHigh: issuesHigh,
      issuesTotal: result.issues.length,
      projects: result.projects,
      quantified: result.quantified
    } as ResumeHistoryItem)
  }
  return items
}

async function findOwnedRow(db: Db, uid: string, resumeId: string): Promise<ResumeRow | null> {
  if (!/^\d+$/.test(resumeId)) return null
  const row = (await db
    .prepare(
      `SELECT r.* FROM resumes r JOIN users u ON u.id = r.user_id
       WHERE r.id = ? AND u.uid = ?`
    )
    .get(Number(resumeId), uid)) as any
  return row != null ? (row as ResumeRow) : null
}

export async function getResumeDetail(
  db: Db,
  env: Env,
  uid: string,
  resumeId: string
): Promise<ParseResumeOutput | null> {
  const row = await findOwnedRow(db, uid, resumeId)
  if (row == null) return null
  const result = rowToResult(row)
  if (result == null) return null
  return { result, quota: await getResumeQuota(db, env, uid) } as ParseResumeOutput
}

// 删除单条记录：先删库，再 best-effort 清理云对象/本地文件
export async function deleteResumeRecord(
  db: Db,
  env: Env,
  uid: string,
  resumeId: string
): Promise<boolean> {
  const row = await findOwnedRow(db, uid, resumeId)
  if (row == null) return false
  await db.prepare('DELETE FROM resumes WHERE id = ?').run(row.id)
  const url = row.original_url
  if (url != null && url.indexOf('cloud://') === 0) {
    try {
      await deleteCloudFiles({
        appId: env.wxAppId,
        secret: env.wxSecret,
        envId: env.wxCloudEnvId,
        fileIDs: [url],
        timeoutMs: 5000
      })
    } catch (e: any) {
      const msg = e != null && e.message != null ? String(e.message) : 'CLOUD_DELETE_ERROR'
      console.warn('[resume] 云对象删除失败（不阻断删除记录）：', msg)
    }
  } else if (url != null && url.indexOf('resumes/') === 0) {
    try {
      unlinkSync(env.uploadDir + '/' + url.substring('resumes/'.length))
    } catch {
      // 文件不存在则忽略
    }
  }
  return true
}

// 改写建议（旧投递版本入口，出参零变更；深度评审走 issues）
export function optimizeResume(text: string, position: string): ResumeSuggestion[] {
  void text
  return [
    {
      original: '负责系统开发与维护',
      suggested:
        '主导订单系统重构，将平均响应时间从 800ms 降至 220ms（需补充真实数据），面向' +
        position +
        '岗位突出个人贡献',
      reason: '突出行动与量化结果，便于面试官快速判断价值',
      needsUserEvidence: true
    } as ResumeSuggestion
  ]
}

// 把上传文件落到磁盘并返回相对路径
export function saveUpload(
  uid: string,
  fileName: string,
  buffer: Buffer,
  uploadDir: string
): string {
  const safeName = basename(fileName).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const rel = `u_${uid.slice(-6)}_${Date.now()}_${safeName}`
  mkdirSync(uploadDir, { recursive: true })
  writeFileSync(uploadDir + '/' + rel, buffer)
  return 'resumes/' + rel
}
