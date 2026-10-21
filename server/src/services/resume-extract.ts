// 简历文件抽取：cloud:// 下载 → 类型/大小/页数校验 → PDF/DOCX 文本 + 定位信息
// 约束：
//   - 仅 PDF / DOCX；图片与旧版 .doc 明确拒绝（OCR 另立卡）
//   - 扫描版 PDF（无文本层）明确拒绝，不静默返回空结果
//   - 解析文本不写日志；调用方负责 PII 脱敏后再送 LLM
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mammoth from 'mammoth'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Env } from '../config.js'
import { getCloudFileTempUrl } from './wx-storage.js'

export type ResumeFileType = 'pdf' | 'docx'

// 抽取定位单元：PDF 按页（paragraph=-1）；DOCX 按段落（page=0）
export type ExtractedUnit = {
  page: number
  paragraph: number
  text: string
}

export type ExtractedResume = {
  fileType: ResumeFileType
  pages: number
  text: string
  units: ExtractedUnit[]
}

export const MAX_RESUME_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 20
export const MAX_TEXT_CHARS = 20000
const DOWNLOAD_TIMEOUT_MS = 15000
// pdfjs 标准字体目录（仅用于消除文本抽取时的字体加载告警；不影响文本结果）
// pdfjs 要求 URL 形态：正斜杠 + 结尾斜杠（Windows 路径需转换）
const PDFJS_FONT_DIR =
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../node_modules/pdfjs-dist/standard_fonts'
  ).replace(/\\/g, '/') + '/'

export function detectResumeType(bytes: Uint8Array): ResumeFileType | '' {
  if (bytes.length >= 5) {
    // %PDF-
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      return 'pdf'
    }
  }
  // PK\x03\x04：DOCX（ZIP）容器
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) {
    return 'docx'
  }
  return ''
}

export function safeFileName(name: string): string {
  const base = basename(name.length > 0 ? name : 'resume')
  const cleaned = base.replace(/[\\/:*?"<>|\r\n]/g, '_').trim()
  return (cleaned.length > 0 ? cleaned : 'resume').substring(0, 120)
}

// 从 cloud:// 下载原始字节；缺云凭据/超限时抛明确错误码
export async function loadCloudResumeBytes(
  env: Env,
  fileID: string,
  opts: { timeoutMs?: number } = {}
): Promise<Uint8Array> {
  if (env.wxAppId.length === 0 || env.wxSecret.length === 0 || env.wxCloudEnvId.length === 0) {
    throw new Error('RESUME_STORAGE_UNAVAILABLE')
  }
  const timeoutMs =
    opts.timeoutMs != null && opts.timeoutMs > 0 ? opts.timeoutMs : DOWNLOAD_TIMEOUT_MS
  const url = await getCloudFileTempUrl({
    appId: env.wxAppId,
    secret: env.wxSecret,
    envId: env.wxCloudEnvId,
    fileID: fileID,
    maxAgeSeconds: 300,
    timeoutMs: Math.min(timeoutMs, 10000)
  })
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error('RESUME_DOWNLOAD_HTTP_' + res.status)
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('RESUME_EMPTY_FILE')
  if (buf.length > MAX_RESUME_BYTES) throw new Error('RESUME_TOO_LARGE')
  return buf
}

// PDF：逐页取文本项（保留页号；文本项顺序即阅读顺序）
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedResume> {
  // pdfjs 自带类型定义滞后于运行时（v6）：init 参数与 destroy 以 any 兜底
  const pdf: any = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: PDFJS_FONT_DIR
  } as any).promise
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('RESUME_TOO_MANY_PAGES')
    const units: ExtractedUnit[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      try {
        const content = await page.getTextContent()
        const items = (content.items ?? []) as any[]
        const parts: string[] = []
        for (const it of items) {
          const s = it != null && typeof it.str === 'string' ? it.str : ''
          if (s.length > 0) parts.push(s)
        }
        const text = normalizeText(parts.join(' '))
        units.push({ page: i, paragraph: -1, text: text } as ExtractedUnit)
      } finally {
        page.cleanup()
      }
    }
    const full = units
      .map((u) => u.text)
      .filter((t) => t.length > 0)
      .join('\n\n')
    if (full.replace(/\s/g, '').length < 50) throw new Error('RESUME_NO_TEXT_LAYER')
    return {
      fileType: 'pdf',
      pages: pdf.numPages,
      text: full.substring(0, MAX_TEXT_CHARS),
      units: units.filter((u) => u.text.length > 0)
    } as ExtractedResume
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy()
  }
}

// DOCX：mammoth 抽取纯文本，按空行/换行切段
export async function extractDocx(bytes: Uint8Array): Promise<ExtractedResume> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
  const raw = result != null && typeof result.value === 'string' ? result.value : ''
  const paras = raw
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter((s) => s.length > 0)
  const full = paras.join('\n')
  if (full.replace(/\s/g, '').length < 50) throw new Error('RESUME_NO_TEXT_LAYER')
  const units: ExtractedUnit[] = []
  for (let i = 0; i < paras.length; i++) {
    units.push({ page: 0, paragraph: i, text: paras[i] } as ExtractedUnit)
  }
  return {
    fileType: 'docx',
    pages: 0,
    text: full.substring(0, MAX_TEXT_CHARS),
    units: units
  } as ExtractedResume
}

// 依据魔数抽取；类型不支持时给出明确错误
export async function extractResume(bytes: Uint8Array): Promise<ExtractedResume> {
  const t = detectResumeType(bytes)
  if (t === 'pdf') return await extractPdf(bytes)
  if (t === 'docx') return await extractDocx(bytes)
  throw new Error('RESUME_UNSUPPORTED_TYPE')
}

export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
