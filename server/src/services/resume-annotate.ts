// 简历批注版 PDF 导出（批次 2）
// 契约：docs/contracts/2026-10-26-resume-annotated-pdf.freeze.md
// 口径：
//   - 仅完整评审（mode='full'）可导出；预览态直接拒绝，不生成文件、不扣额度
//   - PDF 输入：原文件高亮问题原文 + 追加批注页；原文件不可读时降级为纯批注 PDF 并在封面标注
//   - DOCX 输入：输出「评审版 PDF」（原文摘录 + 批注），不还原原版式
//   - 生成过程零 LLM 调用；中文全靠随镜像分发的 CJK 字体子集
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { Db } from '../db.js'
import type { Env } from '../config.js'
import type { ResumeAnnotateResult, ResumeIssue, ResumeParseResult } from '../types/domain.js'
import { findOwnedRow, rowToResult } from './resume.js'
import { loadCloudResumeBytes, safeFileName } from './resume-extract.js'
import { uploadToWxCloud } from './wx-storage.js'

// 字体：随 assets 分发，保证中文在任何环境一致渲染（Noto Sans SC · SIL OFL 1.1）
const FONT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../assets/fonts/NotoSansSC-Regular.subset.ttf'
)
export const ANNOTATE_TIMEOUT_MS = 20000

// 启动自检：字体随镜像分发，缺失时批注 PDF 会在运行时才失败。
// 暴露给 server.ts 打一行日志，便于发布后回读运行日志确认（不阻断启动）。
export function annotateFontStatus(): { path: string; ready: boolean } {
  return { path: FONT_PATH, ready: existsSync(FONT_PATH) }
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 56
const BODY_SIZE = 10.5
const LINE_GAP = 6
const SEVERITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

export type AnnotateOutput = ResumeAnnotateResult

// ---- 文本排版工具（pdf-lib 无自动换行） ----

// 按字符宽度换行：中文按字、英文按词，超宽强制断行
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  const paragraphs = text.split(/\r?\n/)
  for (const para of paragraphs) {
    const chars = Array.from(para)
    let line = ''
    let i = 0
    while (i < chars.length) {
      const ch = chars[i]
      // 英文单词整体进入，避免把单词拆开
      if (/[A-Za-z0-9._%+-]/.test(ch)) {
        let word = ''
        while (i < chars.length && /[A-Za-z0-9._%+-]/.test(chars[i])) {
          word += chars[i]
          i += 1
        }
        const candidate = line + word
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line.length > 0) {
          out.push(line)
          line = word
        } else if (font.widthOfTextAtSize(word, size) > maxWidth) {
          // 超长单词：硬切
          for (const c of Array.from(word)) {
            if (font.widthOfTextAtSize(line + c, size) > maxWidth && line.length > 0) {
              out.push(line)
              line = ''
            }
            line += c
          }
        } else {
          line = candidate
        }
        continue
      }
      const candidate = line + ch
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line.length > 0) {
        out.push(line)
        line = ch
      } else {
        line = candidate
      }
      i += 1
    }
    out.push(line)
  }
  return out
}

type Cursor = { page: PDFPage; y: number }

// 写一段文字；空间不足自动翻页
function drawParagraph(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  font: PDFFont,
  opts: { size?: number; color?: ReturnType<typeof rgb>; indent?: number; gapAfter?: number } = {}
): void {
  const size = opts.size != null ? opts.size : BODY_SIZE
  const indent = opts.indent != null ? opts.indent : 0
  const color = opts.color != null ? opts.color : rgb(0.15, 0.15, 0.18)
  const maxWidth = PAGE_W - MARGIN * 2 - indent
  for (const line of wrapText(text, font, size, maxWidth)) {
    if (cursor.y < MARGIN + size) {
      cursor.page = doc.addPage([PAGE_W, PAGE_H])
      cursor.y = PAGE_H - MARGIN
    }
    cursor.page.drawText(line, { x: MARGIN + indent, y: cursor.y, size: size, font: font, color })
    cursor.y -= size + LINE_GAP
  }
  cursor.y -= opts.gapAfter != null ? opts.gapAfter : 0
}

function drawRule(cursor: Cursor): void {
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y + 6 },
    end: { x: PAGE_W - MARGIN, y: cursor.y + 6 },
    thickness: 0.6,
    color: rgb(0.86, 0.86, 0.89)
  })
  cursor.y -= 6
}

// ---- PDF 原文定位：quote → 高亮矩形 ----

export type HighlightRect = { x: number; y: number; w: number; h: number }

// 单个 quote 的定位结果：页码 + 该页上的若干矩形
export type QuoteHit = { page: number; rects: HighlightRect[] }

// 逐页取文本项并建立「字符偏移 → 文本项」映射；偏移口径与 extractPdf 一致（项间以空格连接后归一化）
// 返回与入参 quotes 等长的数组，未命中的位置为 null（保证调用方能把结果映射回 issue 序号）
export async function locateQuoteOnPages(
  bytes: Uint8Array,
  quotes: string[]
): Promise<Array<QuoteHit | null>> {
  const result: Array<QuoteHit | null> = []
  for (let i = 0; i < quotes.length; i++) result.push(null)
  if (quotes.length === 0) return result
  const pdf: any = await getDocument({ data: new Uint8Array(bytes) } as any).promise
  try {
    // 未命中的 quote 索引（重复 quote 各自独立，避免后一条覆盖前一条）
    const pending: number[] = []
    for (let i = 0; i < quotes.length; i++) pending.push(i)
    for (let p = 1; p <= pdf.numPages; p++) {
      if (pending.length === 0) break
      const page = await pdf.getPage(p)
      try {
        const content = await page.getTextContent()
        const items = (content.items ?? []) as any[]
        // 建字符表：归一化后的每个字符 → 所属文本项与项内序号。
        // 归一化与 normalizeText 口径一致（空白折叠为单个空格、首尾去空白），
        // 这样 text 的下标与 owners 严格一一对应，避免二次归一化造成偏移错位。
        let text = ''
        const owners: Array<{ item: any; idx: number } | null> = []
        let pendingSpace = false
        for (const it of items) {
          const s = it != null && typeof it.str === 'string' ? it.str : ''
          if (s.length === 0) continue
          for (let k = 0; k < s.length; k++) {
            const ch = s[k]
            if (/\s/.test(ch)) {
              pendingSpace = true
              continue
            }
            if (pendingSpace && text.length > 0) {
              text += ' '
              owners.push(null)
            }
            pendingSpace = false
            text += ch
            owners.push({ item: it, idx: k })
          }
          // 文本项之间视为一个分隔（pdfjs 常把视觉空格拆成独立项）
          pendingSpace = true
        }
        if (text.length === 0) continue
        for (let n = pending.length - 1; n >= 0; n--) {
          const idx = pending[n]
          const at = text.indexOf(quotes[idx])
          if (at < 0) continue
          const rects = quoteToRects(owners, quotes[idx], at)
          if (rects.length === 0) continue
          result[idx] = { page: p, rects: rects } as QuoteHit
          pending.splice(n, 1)
        }
      } finally {
        page.cleanup()
      }
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy()
  }
  return result
}

// 把 quote 覆盖的字符按所属文本项拆成若干矩形（跨项时分段）
function quoteToRects(
  owners: Array<{ item: any; idx: number } | null>,
  quote: string,
  at: number
): HighlightRect[] {
  const byItem = new Map<any, number[]>()
  const order: any[] = []
  for (let i = at; i < at + quote.length && i < owners.length; i++) {
    const o = owners[i]
    if (o == null) continue
    let arr = byItem.get(o.item)
    if (arr == null) {
      arr = []
      byItem.set(o.item, arr)
      order.push(o.item)
    }
    arr.push(o.idx)
  }
  const rects: HighlightRect[] = []
  for (const it of order) {
    const idxs = byItem.get(it) as number[]
    const s = typeof it.str === 'string' ? it.str : ''
    if (s.length === 0) continue
    const width = typeof it.width === 'number' ? it.width : 0
    if (width <= 0) continue
    const minIdx = Math.min(...idxs)
    const maxIdx = Math.max(...idxs)
    const x0 = it.transform[4] + (minIdx / s.length) * width
    const x1 = it.transform[4] + ((maxIdx + 1) / s.length) * width
    const fontSize =
      it.transform != null && it.transform.length >= 4
        ? Math.hypot(it.transform[2], it.transform[3]) || 10
        : 10
    rects.push({ x: x0, y: it.transform[5], w: x1 - x0, h: fontSize } as HighlightRect)
  }
  return rects
}

// ---- 批注渲染 ----

function issueTitle(n: number, it: ResumeIssue): string {
  const sev = SEVERITY_LABEL[it.severity] != null ? SEVERITY_LABEL[it.severity] : '中'
  const pageText = it.page > 0 ? ' · P' + it.page : ''
  return n + '. [' + sev + '] ' + it.category + pageText
}

// 批注页：逐条列出原文 / 建议 / 原因
function renderIssuePages(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  issues: ResumeIssue[],
  header: { title: string; meta: string[]; note?: string }
): void {
  const page = doc.addPage([PAGE_W, PAGE_H])
  const cursor: Cursor = { page: page, y: PAGE_H - MARGIN }
  drawParagraph(doc, cursor, header.title, bold, { size: 17, gapAfter: 6 })
  for (const m of header.meta) {
    drawParagraph(doc, cursor, m, font, { size: 9.5, color: rgb(0.42, 0.42, 0.46) })
  }
  if (header.note != null && header.note.length > 0) {
    drawParagraph(doc, cursor, header.note, font, {
      size: 9.5,
      color: rgb(0.72, 0.42, 0.04)
    })
  }
  drawRule(cursor)

  if (issues.length === 0) {
    drawParagraph(doc, cursor, '本次评审未发现需要修改的问题。', font)
    return
  }

  for (let i = 0; i < issues.length; i++) {
    const it = issues[i]
    drawParagraph(doc, cursor, issueTitle(i + 1, it), bold, { size: 11.5, gapAfter: 2 })
    drawParagraph(doc, cursor, '原文：' + it.quote, font, {
      size: 10,
      color: rgb(0.42, 0.42, 0.46)
    })
    if (it.suggested.length > 0) {
      drawParagraph(doc, cursor, '建议：' + it.suggested, font, { size: 10 })
    } else {
      drawParagraph(doc, cursor, '建议：解锁完整评审后查看改写', font, {
        size: 10,
        color: rgb(0.68, 0.68, 0.71)
      })
    }
    drawParagraph(doc, cursor, '原因：' + it.reason, font, {
      size: 10,
      color: rgb(0.42, 0.42, 0.46)
    })
    if (it.needsUserEvidence) {
      drawParagraph(doc, cursor, '需补充真实数据后再使用该改写。', font, {
        size: 9.5,
        color: rgb(0.72, 0.42, 0.04)
      })
    }
    cursor.y -= 8
  }
  drawParagraph(
    doc,
    cursor,
    '本批注由 MentorLoop 依据简历原文生成，改写内容标注「请补充真实数据」处需你本人核实。',
    font,
    { size: 9, color: rgb(0.68, 0.68, 0.71) }
  )
}

async function embedChineseFont(doc: PDFDocument): Promise<PDFFont> {
  if (!existsSync(FONT_PATH)) throw new Error('RESUME_ANNOTATE_FONT_MISSING')
  doc.registerFontkit(fontkit)
  return await doc.embedFont(readFileSync(FONT_PATH), { subset: true })
}

export type AnnotateInput = {
  result: ResumeParseResult
  originalUrl: string | null
  fileName: string
  position: string
}

// 生成批注 PDF 字节；原文件可读且为 PDF 时叠加高亮
export async function buildAnnotatedPdf(
  env: Env,
  input: AnnotateInput
): Promise<{ bytes: Uint8Array; pages: number }> {
  const issues = input.result.issues
  const baseName = safeFileName(input.fileName.replace(/\.(pdf|docx)$/i, ''))
  const meta = [
    '文件：' + baseName + '.' + input.result.fileType,
    '目标岗位：' + (input.position.length > 0 ? input.position : '未指定（按通用技术岗评审）'),
    '评审条数：' +
      issues.length +
      '（高 ' +
      countSeverity(issues, 'high') +
      ' / 中 ' +
      countSeverity(issues, 'medium') +
      ' / 低 ' +
      countSeverity(issues, 'low') +
      '）'
  ]

  // 1) 尝试加载原 PDF 并叠加高亮
  let doc: PDFDocument | null = null
  let overlaid = false
  let overlayNote = ''
  if (
    input.result.fileType === 'pdf' &&
    input.originalUrl != null &&
    input.originalUrl.indexOf('cloud://') === 0
  ) {
    try {
      const original = await loadCloudResumeBytes(env, input.originalUrl)
      const hits = await locateQuoteOnPages(
        original,
        issues.map((it) => it.quote)
      )
      doc = await PDFDocument.load(original)
      const marker = await doc.embedFont(StandardFonts.HelveticaBold)
      let located = 0
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]
        if (h == null) continue
        located += 1
        const page = doc.getPage(h.page - 1)
        for (const r of h.rects) {
          page.drawRectangle({
            x: r.x,
            y: r.y - r.h * 0.24,
            width: r.w,
            height: r.h * 1.34,
            color: rgb(1, 0.92, 0.55),
            opacity: 0.42,
            borderWidth: 0
          })
        }
        // 序号与批注页条目号一一对应：同一条跨项时只在首个矩形左侧标一次
        const first = h.rects[0]
        page.drawText(String(i + 1), {
          x: Math.max(2, first.x - 13),
          y: first.y + first.h * 0.28,
          size: 7,
          font: marker,
          color: rgb(0.78, 0.16, 0.12)
        })
      }
      overlaid = true
      if (located < issues.length) {
        overlayNote =
          '共 ' + issues.length + ' 条批注，已在原文定位 ' + located + ' 处，其余见批注页。'
      }
    } catch {
      // 原文件不可读（加密/损坏/云存储不可用）→ 降级纯批注 PDF
      doc = null
      overlayNote = '未能叠加原文件，本文件仅包含批注内容。'
    }
  }

  if (doc == null) {
    doc = await PDFDocument.create()
    overlayNote = '未能叠加原文件，本文件仅包含批注内容。'
  }

  const font = await embedChineseFont(doc)
  const bold = font
  renderIssuePages(doc, font, bold, issues, {
    title: overlaid ? '简历批注（原文见前页）' : '简历评审批注',
    meta: meta,
    note: overlayNote
  })

  const bytes = await doc.save()
  return { bytes: new Uint8Array(bytes), pages: doc.getPageCount() }
}

function countSeverity(issues: ResumeIssue[], sev: string): number {
  let n = 0
  for (const it of issues) if (it.severity === sev) n += 1
  return n
}

// 批注文件固定路径：同一记录重复导出覆盖同一对象，避免云存储堆积；
// 记录删除时可凭此路径确定性清理（无需 list 接口）
export function annotatedCloudPath(uid: string, resumeId: number): string {
  return 'resumes/' + uid + '/annotated-' + resumeId + '.pdf'
}

// 导出入口：校验属主与模式 → 生成 → 写云存储
export async function annotateResumePdf(
  db: Db,
  env: Env,
  uid: string,
  resumeId: string
): Promise<AnnotateOutput> {
  const row = await findOwnedRow(db, uid, resumeId)
  if (row == null) throw new Error('RESUME_NOT_FOUND')
  const result = rowToResult(row)
  if (result == null) throw new Error('RESUME_ANNOTATE_NO_ISSUES')
  if (result.mode !== 'full') throw new Error('RESUME_ANNOTATE_PREVIEW')
  if (result.issues.length === 0) throw new Error('RESUME_ANNOTATE_NO_ISSUES')

  if (env.wxAppId.length === 0 || env.wxSecret.length === 0 || env.wxCloudEnvId.length === 0) {
    throw new Error('RESUME_STORAGE_UNAVAILABLE')
  }

  const fileName =
    safeFileName((row.file_name != null ? row.file_name : 'resume').replace(/\.\w+$/, '')) +
    '-批注.pdf'

  const built = await withTimeout(
    buildAnnotatedPdf(env, {
      result: result,
      originalUrl: row.original_url,
      fileName: fileName,
      position: row.target_position != null ? row.target_position : ''
    }),
    ANNOTATE_TIMEOUT_MS
  )

  const cloudPath = annotatedCloudPath(uid, row.id)
  const fileID = await uploadToWxCloud({
    appId: env.wxAppId,
    secret: env.wxSecret,
    envId: env.wxCloudEnvId,
    cloudPath: cloudPath,
    data: built.bytes,
    contentType: 'application/pdf',
    timeoutMs: 15000
  })
  return {
    fileID: fileID,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    issueCount: result.issues.length,
    pages: built.pages
  } as ResumeAnnotateResult
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: any = null
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('RESUME_ANNOTATE_TIMEOUT')), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}
