// 简历服务：解析 / 改写建议（P1.1 规则版，出参与前端 mock 结构逐字段一致）
import { basename } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Db } from '../db.js'
import { now } from '../util.js'
import { ResumeParseResult, ResumeSuggestion } from '../types/domain.js'

// 解析（规则版）：以文件名与固定字段生成结构化结果（Mock 后接真实文档解析）
export function parseResumeFile(
  db: Db,
  uid: string,
  originalUrl: string,
  fileName: string
): ResumeParseResult {
  const ext =
    fileName.toLowerCase().endsWith('.png') ||
    fileName.toLowerCase().endsWith('.jpg') ||
    fileName.toLowerCase().endsWith('.jpeg')
      ? 'image'
      : 'document'
  const result: ResumeParseResult = {
    contact: true,
    projects: 3,
    techStack: ['Java', 'Spring Boot', 'MySQL', 'Redis'],
    quantified: false,
    gaps: ['缺少量化成果', '空档期未说明'],
    formatRisks: ['一页超过 2 屏']
  }
  db.prepare(
    `INSERT INTO resumes (user_id, original_url, parse_payload, optimize_payload, created_at)
     VALUES ((SELECT id FROM users WHERE uid = ?), ?, ?, NULL, ?)`
  ).run(uid, originalUrl, JSON.stringify(result), now())
  void ext
  return result
}

// 改写建议（规则版）：给出结构与前端 mock 一致的建议稿
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
    }
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
