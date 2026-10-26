// 批注版 PDF 导出（批次 2）单测：生成、定位高亮、错误口径与额度不变
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'
import { resetWxAccessTokenCache } from './services/wx-access-token.js'
import { buildAnnotatedPdf, locateQuoteOnPages } from './services/resume-annotate.js'
import type { ResumeIssue, ResumeParseResult } from './types/domain.js'

function mkRes(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    arrayBuffer: async () => body
  } as any
}

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([500, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Backend engineer with 4 years experience.', { x: 30, y: 240, size: 11, font })
  page.drawText('Built order service handling 5000 QPS and reduced latency', {
    x: 30,
    y: 220,
    size: 11,
    font
  })
  page.drawText('from 800ms to 220ms for core checkout APIs.', {
    x: 30,
    y: 200,
    size: 11,
    font
  })
  return new Uint8Array(await doc.save())
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const doc: any = await getDocument({ data: new Uint8Array(bytes) } as any).promise
  try {
    const parts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      for (const it of content.items as any[]) {
        if (typeof it.str === 'string') parts.push(it.str)
      }
    }
    return parts.join(' ')
  } finally {
    if (typeof doc.destroy === 'function') await doc.destroy()
  }
}

function issue(partial: Partial<ResumeIssue> = {}): ResumeIssue {
  return {
    issueId: 'ri_1',
    severity: 'high',
    category: 'quantification',
    page: 1,
    paragraph: -1,
    quote: 'reduced latency',
    original: 'reduced latency',
    suggested: '量化延迟与吞吐（请补充真实数据）',
    reason: '量化成果更能体现个人贡献',
    needsUserEvidence: true,
    locked: false,
    ...partial
  } as ResumeIssue
}

function fullResult(issues: ResumeIssue[], fileType: 'pdf' | 'docx' = 'pdf'): ResumeParseResult {
  return {
    resumeId: '1',
    fileName: 'my-resume.' + fileType,
    fileType: fileType,
    pages: 1,
    contact: true,
    projects: 1,
    techStack: ['Java'],
    quantified: true,
    gaps: [],
    formatRisks: [],
    issues: issues,
    previewIssues: [],
    mode: 'full',
    cached: false
  } as ResumeParseResult
}

function makeApp(overrides: (env: any) => void = () => {}) {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  env.uploadDir = './data/test-uploads-' + Math.random().toString(36).slice(2, 8)
  env.wxAppId = 'wxappid'
  env.wxSecret = 'wxsecret'
  env.wxCloudEnvId = 'prod-test'
  overrides(env)
  return buildApp({ env })
}

async function login(app: any, phone: string): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  return r.json().data.token
}

function auth(token: string) {
  return { authorization: 'Bearer ' + token }
}

async function uidOf(app: any, phone: string): Promise<string> {
  const row = (await (app as any).db
    .prepare('SELECT uid FROM users WHERE phone = ?')
    .get(phone)) as any
  return row.uid as string
}

let pdf: Uint8Array
let uploadedPaths: string[] = []

beforeEach(async () => {
  closeDb()
  resetWxAccessTokenCache()
  pdf = await makePdf()
  uploadedPaths = []
  vi.stubGlobal('fetch', async (url: any, init: any) => {
    const u = String(url)
    if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
    if (u.indexOf('/tcb/batchdownloadfile') >= 0) {
      return mkRes({
        errcode: 0,
        errmsg: 'ok',
        file_list: [{ download_url: 'https://cdn.example.com/r.pdf', status: 0 }]
      })
    }
    if (u.indexOf('cdn.example.com') >= 0) {
      return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(pdf) } as any
    }
    if (u.indexOf('/tcb/uploadfile') >= 0) {
      const body = JSON.parse(String(init != null ? init.body : '{}'))
      uploadedPaths.push(String(body.path))
      return mkRes({
        errcode: 0,
        errmsg: 'ok',
        url: 'https://cos.example.com/upload',
        token: 'tok',
        authorization: 'sig',
        file_id: 'cloud://prod-test.bucket/' + body.path,
        cos_file_id: 'cos-file-id'
      })
    }
    if (u.indexOf('cos.example.com') >= 0) return { ok: true, status: 204 } as any
    if (u.indexOf('/tcb/batchdeletefile') >= 0) return mkRes({ errcode: 0, errmsg: 'ok' })
    if (u.indexOf('llm.test') >= 0) {
      return {
        ok: true,
        status: 200,
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
                      quote: 'reduced latency',
                      original: 'reduced latency',
                      suggested: 'Add QPS and latency with real data',
                      reason: 'Quantified impact is more credible',
                      needsUserEvidence: true
                    }
                  ]
                })
              }
            }
          ]
        })
      } as any
    }
    throw new Error('unexpected ' + u)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetWxAccessTokenCache()
})

describe('buildAnnotatedPdf', () => {
  it('PDF 输入：原页 + 批注页，批注文本可回读', async () => {
    const env = loadEnv()
    env.wxAppId = 'wxappid'
    env.wxSecret = 'wxsecret'
    env.wxCloudEnvId = 'prod-test'
    const out = await buildAnnotatedPdf(env, {
      result: fullResult([issue()]),
      originalUrl: 'cloud://prod-test.bucket/resumes/u1/r.pdf',
      fileName: 'my-resume.pdf',
      position: '后端'
    })
    expect(out.pages).toBe(2)
    const text = await pdfText(out.bytes)
    expect(text).toContain('reduced latency')
    expect(text).toContain('简历批注')
    expect(text).toContain('量化成果')
  })

  it('DOCX 输入：输出评审版 PDF，不叠加原文件', async () => {
    const env = loadEnv()
    const out = await buildAnnotatedPdf(env, {
      result: fullResult([issue({ page: 0, paragraph: 2 })], 'docx'),
      originalUrl: null,
      fileName: 'my-resume.docx',
      position: ''
    })
    expect(out.pages).toBeGreaterThanOrEqual(1)
    const text = await pdfText(out.bytes)
    expect(text).toContain('评审批注')
    expect(text).toContain('未能叠加原文件')
    expect(text).toContain('reduced latency')
  })

  it('无批注：仍生成可读文件并说明未发现问题', async () => {
    const env = loadEnv()
    const out = await buildAnnotatedPdf(env, {
      result: fullResult([]),
      originalUrl: null,
      fileName: 'empty.pdf',
      position: ''
    })
    expect(await pdfText(out.bytes)).toContain('未发现需要修改的问题')
    expect(out.pages).toBe(1)
  })

  it('原文件不可读：降级为纯批注 PDF，不抛错', async () => {
    const env = loadEnv()
    env.wxAppId = 'wxappid'
    env.wxSecret = 'wxsecret'
    env.wxCloudEnvId = 'prod-test'
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down')
    })
    const out = await buildAnnotatedPdf(env, {
      result: fullResult([issue()]),
      originalUrl: 'cloud://prod-test.bucket/resumes/u1/r.pdf',
      fileName: 'my-resume.pdf',
      position: '后端'
    })
    const text = await pdfText(out.bytes)
    expect(text).toContain('未能叠加原文件')
    expect(text).toContain('reduced latency')
  })
})

describe('locateQuoteOnPages（原文定位）', () => {
  it('跨文本项的英文短语能定位到矩形，未命中的 quote 不产生矩形', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([500, 300])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText('Backend engineer with 4 years experience.', { x: 30, y: 240, size: 11, font })
    page.drawText('Order service handling 5000 QPS and reduced latency', {
      x: 30,
      y: 220,
      size: 11,
      font
    })
    const bytes = new Uint8Array(await doc.save())

    const hit = await locateQuoteOnPages(bytes, ['reduced latency', 'not in document'])
    expect(hit.length).toBe(2)
    expect(hit[0] != null && hit[0].rects.length > 0).toBe(true)
    expect(hit[0]?.page).toBe(1)
    // 未命中的 quote 保持 null
    expect(hit[1]).toBe(null)
  })

  it('中文短语（嵌入 CJK 子集）能定位到矩形', async () => {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const cjk = await doc.embedFont(readFileSync('assets/fonts/NotoSansSC-Regular.subset.ttf'), {
      subset: true
    } as any)
    const page = doc.addPage([500, 300])
    page.drawText('负责订单系统开发与维护，参与需求评审。', { x: 30, y: 240, size: 12, font: cjk })
    page.drawText('主导支付链路重构，QPS 从 2000 提升到 8600。', {
      x: 30,
      y: 216,
      size: 12,
      font: cjk
    })
    const bytes = new Uint8Array(await doc.save())

    const hit = await locateQuoteOnPages(bytes, ['负责订单系统开发与维护', '主导支付链路重构'])
    expect(hit.length).toBe(2)
    expect(hit[0] != null).toBe(true)
    expect(hit[1] != null).toBe(true)
    // 矩形必须落在页面内且宽高为正
    for (const h of hit) {
      for (const r of (h as any).rects as any[]) {
        expect(r.w).toBeGreaterThan(0)
        expect(r.h).toBeGreaterThan(0)
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.x).toBeLessThan(500)
      }
    }
  })

  it('命中不到时返回全 null 数组，不抛错', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([500, 300])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText('Hello world', { x: 30, y: 240, size: 11, font })
    const bytes = new Uint8Array(await doc.save())
    const hit = await locateQuoteOnPages(bytes, ['完全不存在的中文串'])
    expect(hit.length).toBe(1)
    expect(hit[0]).toBe(null)
  })
})

describe('POST /resume/annotate', () => {
  it('完整评审可导出、不扣额度、重复导出复用同一对象路径', async () => {
    const app = makeApp((env) => {
      env.llmEnabled = true
      env.llmBaseUrl = 'https://llm.test/v1'
      env.llmModel = 'm'
      env.llmApiKey = 'sk-test'
    })
    const phone = '13922220101'
    const token = await login(app, phone)
    await (app as any).db
      .prepare('UPDATE users SET resume_single_total = ? WHERE phone = ?')
      .run(2, phone)
    const uid = await uidOf(app, phone)

    const parsed = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: {
        fileUrl: 'cloud://prod-test.bucket/resumes/' + uid + '/r.pdf',
        fileName: 'my-resume.pdf',
        position: '后端'
      }
    })
    const resumeId = parsed.json().data.resumeId
    expect(parsed.json().data.mode).toBe('full')

    const quotaBefore = await app.inject({
      method: 'GET',
      url: '/resume/quota',
      headers: auth(token)
    })

    const a1 = await app.inject({
      method: 'POST',
      url: '/resume/annotate',
      headers: auth(token),
      payload: { resumeId }
    })
    expect(a1.statusCode).toBe(200)
    const d1 = a1.json().data
    expect(d1.fileID).toContain('cloud://')
    expect(d1.issueCount).toBe(1)
    expect(d1.pages).toBe(2)
    expect(typeof d1.expiresAt).toBe('number')

    const a2 = await app.inject({
      method: 'POST',
      url: '/resume/annotate',
      headers: auth(token),
      payload: { resumeId }
    })
    expect(a2.statusCode).toBe(200)
    // 同一记录固定路径，避免云存储堆积
    expect(uploadedPaths.length).toBe(2)
    expect(uploadedPaths[0]).toBe(uploadedPaths[1])

    const quotaAfter = await app.inject({
      method: 'GET',
      url: '/resume/quota',
      headers: auth(token)
    })
    expect(quotaAfter.json().data).toEqual(quotaBefore.json().data)
  })

  it('预览态拒绝导出且不产生文件', async () => {
    const app = makeApp((env) => {
      env.llmEnabled = false
    })
    const phone = '13922220102'
    const token = await login(app, phone)
    const uid = await uidOf(app, phone)
    const parsed = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: {
        fileUrl: 'cloud://prod-test.bucket/resumes/' + uid + '/r.pdf',
        fileName: 'my-resume.pdf',
        position: '后端'
      }
    })
    expect(parsed.json().data.mode).toBe('preview')
    const resumeId = parsed.json().data.resumeId

    const r = await app.inject({
      method: 'POST',
      url: '/resume/annotate',
      headers: auth(token),
      payload: { resumeId }
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().message).toContain('完整评审后才能导出批注 PDF')
    expect(uploadedPaths.length).toBe(0)
  })

  it('他人记录与非法入参分别返回 404 / 400', async () => {
    const app = makeApp()
    const tokenA = await login(app, '13922220103')
    const tokenB = await login(app, '13922220104')
    const uidA = await uidOf(app, '13922220103')

    // 直接写一条 full 记录（绕过 LLM）
    const r = await (app as any).db
      .prepare(
        `INSERT INTO resumes (user_id, original_url, file_name, file_type, content_hash, target_position, mode, parse_payload, created_at)
         VALUES ((SELECT id FROM users WHERE uid = ?), ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uidA,
        'cloud://prod-test.bucket/resumes/' + uidA + '/r.pdf',
        'a.pdf',
        'pdf',
        'h1',
        '后端',
        'full',
        JSON.stringify(fullResult([issue()])),
        Date.now()
      )
    const resumeId = String(r.lastInsertRowid)

    const other = await app.inject({
      method: 'POST',
      url: '/resume/annotate',
      headers: auth(tokenB),
      payload: { resumeId }
    })
    expect(other.statusCode).toBe(404)
    expect(other.json().message).toBe('简历不存在')

    const bad = await app.inject({
      method: 'POST',
      url: '/resume/annotate',
      headers: auth(tokenA),
      payload: { resumeId: 'abc' }
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().message).toBe('参数不合法')
  })
})
