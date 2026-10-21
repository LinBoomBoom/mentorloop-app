// 简历文件抽取单测：魔数识别 / PDF 文本与页码 / DOCX 段落 / 扫描件拒绝
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import { detectResumeType, extractResume } from './services/resume-extract.js'

async function makePdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([500, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x: 30, y: 260 - i * 20, size: 10, font: font })
  }
  return new Uint8Array(await doc.save())
}

async function makeDocx(text: string): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  )
  zip
    .folder('_rels')!
    .file(
      '.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    )
  const paras = text
    .split('\n')
    .map((s) => '<w:p><w:r><w:t>' + s + '</w:t></w:r></w:p>')
    .join('')
  zip
    .folder('word')!
    .file(
      'document.xml',
      '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        paras +
        '</w:body></w:document>'
    )
  const data = await zip.generateAsync({ type: 'uint8array' })
  return data
}

describe('detectResumeType', () => {
  it('按魔数识别 PDF / DOCX，其他一律拒绝', async () => {
    expect(detectResumeType(await makePdf('hello'))).toBe('pdf')
    expect(detectResumeType(await makeDocx('hello'))).toBe('docx')
    expect(detectResumeType(new Uint8Array([1, 2, 3, 4]))).toBe('')
  })
})

describe('extractResume', () => {
  it('PDF：抽取正文并按页建立定位单元', async () => {
    const bytes = await makePdf(
      'Backend engineer with 4 years experience.\nBuilt order service handling 5000 QPS.\nReduced latency from 800ms to 220ms.'
    )
    const r = await extractResume(bytes)
    expect(r.fileType).toBe('pdf')
    expect(r.pages).toBe(1)
    expect(r.text).toContain('5000 QPS')
    expect(r.units.length).toBe(1)
    expect(r.units[0].page).toBe(1)
    expect(r.units[0].paragraph).toBe(-1)
  })

  it('DOCX：抽取段落并建立段落定位单元', async () => {
    const bytes = await makeDocx(
      'Backend engineer with 4 years experience.\nBuilt order service handling 5000 QPS.'
    )
    const r = await extractResume(bytes)
    expect(r.fileType).toBe('docx')
    expect(r.text).toContain('5000 QPS')
    expect(r.units.length).toBeGreaterThanOrEqual(2)
    expect(r.units[0].paragraph).toBe(0)
    expect(r.units[0].page).toBe(0)
  })

  it('无文本层的 PDF → RESUME_NO_TEXT_LAYER（扫描件拒绝）', async () => {
    const bytes = await makePdf('')
    await expect(extractResume(bytes)).rejects.toThrow(/RESUME_NO_TEXT_LAYER/)
  })

  it('不支持的类型 → RESUME_UNSUPPORTED_TYPE', async () => {
    await expect(extractResume(new Uint8Array([0x25, 0x21, 0x50, 0x44]))).rejects.toThrow(
      /RESUME_UNSUPPORTED_TYPE/
    )
  })
})
