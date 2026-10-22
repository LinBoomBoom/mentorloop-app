// 简历解析路由集成：云下载 → 真实抽取 → LLM 锚定 → 额度/缓存/历史/删除
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'
import { resetWxAccessTokenCache } from './services/wx-access-token.js'

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

async function grantResumeCredits(app: any, phone: string, n: number) {
  await (app as any).db
    .prepare('UPDATE users SET resume_single_total = ? WHERE phone = ?')
    .run(n, phone)
}

let pdf: Uint8Array
let deletedFileIDs: string[] = []

beforeEach(async () => {
  closeDb()
  resetWxAccessTokenCache()
  pdf = await makePdf()
  deletedFileIDs = []
  vi.stubGlobal('fetch', async (url: any, init: any) => {
    const u = String(url)
    if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
    if (u.indexOf('/tcb/batchdownloadfile') >= 0) {
      return mkRes({
        errcode: 0,
        errmsg: 'ok',
        file_list: [
          {
            fileid: 'cloud://prod-test.bucket/resumes/r.pdf',
            download_url: 'https://cdn.example.com/r.pdf',
            status: 0
          }
        ]
      })
    }
    if (u.indexOf('cdn.example.com') >= 0) {
      return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(pdf) } as any
    }
    if (u.indexOf('/tcb/batchdeletefile') >= 0) {
      const body = JSON.parse(String(init != null ? init.body : '{}'))
      if (body != null && Array.isArray(body.fileid_list))
        deletedFileIDs = deletedFileIDs.concat(body.fileid_list)
      return mkRes({ errcode: 0, errmsg: 'ok' })
    }
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
                      suggested: 'Add QPS, latency and user impact with real data',
                      reason: 'Quantified impact makes contribution credible',
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

describe('POST /resume/parse（完整评审）', () => {
  it('真实抽取 + LLM 锚定 + 单次包扣减 + 缓存 + 历史/详情/删除', async () => {
    const app = makeApp((env) => {
      env.llmEnabled = true
      env.llmBaseUrl = 'https://llm.test/v1'
      env.llmModel = 'm'
      env.llmApiKey = 'sk-test'
    })
    const phone = '13922220001'
    const token = await login(app, phone)
    await grantResumeCredits(app, phone, 2)
    const uid = await uidOf(app, phone)
    const fileUrl = 'cloud://prod-test.bucket/resumes/' + uid + '/r.pdf'

    const r1 = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: { fileUrl, fileName: 'my-resume.pdf', position: '后端' }
    })
    const b1 = r1.json()
    expect(b1.code).toBe(0)
    expect(b1.data.mode).toBe('full')
    expect(b1.data.fileType).toBe('pdf')
    expect(b1.data.issues.length).toBe(1)
    expect(b1.data.issues[0].quote).toContain('reduced latency')
    expect(b1.data.quota.singleLeft).toBe(1)
    const resumeId = b1.data.resumeId

    // 同文件 + 同岗位重复解析：命中缓存，不再扣额度
    const r2 = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: { fileUrl, fileName: 'my-resume.pdf', position: '后端' }
    })
    expect(r2.json().data.cached).toBe(true)
    expect(r2.json().data.quota.singleLeft).toBe(1)

    const h = await app.inject({ method: 'GET', url: '/resume/history', headers: auth(token) })
    expect(h.json().data.items.length).toBe(1)
    expect(h.json().data.items[0].issuesHigh).toBe(1)

    const d = await app.inject({
      method: 'GET',
      url: '/resume/detail?resumeId=' + resumeId,
      headers: auth(token)
    })
    expect(d.json().data.issues.length).toBe(1)

    const del = await app.inject({
      method: 'DELETE',
      url: '/resume/detail?resumeId=' + resumeId,
      headers: auth(token)
    })
    expect(del.json().code).toBe(0)
    expect(deletedFileIDs).toContain(fileUrl)

    const h2 = await app.inject({ method: 'GET', url: '/resume/history', headers: auth(token) })
    expect(h2.json().data.items.length).toBe(0)
    closeDb()
  })
})

describe('POST /resume/parse（免费预览 / AI 不可用）', () => {
  it('免费用户只返回确定性预览，每日 3 次后拒绝', async () => {
    const app = makeApp()
    const phone = '13922220002'
    const token = await login(app, phone)
    const uid = await uidOf(app, phone)
    const fileUrl = 'cloud://prod-test.bucket/resumes/' + uid + '/r.pdf'

    for (let i = 0; i < 3; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/resume/parse',
        headers: auth(token),
        payload: { fileUrl, fileName: 'r.pdf', position: '后端' }
      })
      expect(r.json().code).toBe(0)
      expect(r.json().data.mode).toBe('preview')
      expect(r.json().data.issues.length).toBe(0)
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: { fileUrl, fileName: 'r.pdf', position: '后端' }
    })
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().message).toContain('预览')
    closeDb()
  })

  it('有额度但 LLM 未配置 → 503，额度不扣', async () => {
    const app = makeApp() // llmEnabled 默认 false
    const phone = '13922220003'
    const token = await login(app, phone)
    await grantResumeCredits(app, phone, 1)
    const uid = await uidOf(app, phone)

    const r = await app.inject({
      method: 'POST',
      url: '/resume/parse',
      headers: auth(token),
      payload: {
        fileUrl: 'cloud://prod-test.bucket/resumes/' + uid + '/r.pdf',
        fileName: 'r.pdf',
        position: '后端'
      }
    })
    expect(r.statusCode).toBe(503)
    const q = await app.inject({ method: 'GET', url: '/resume/quota', headers: auth(token) })
    expect(q.json().data.singleLeft).toBe(1)
    closeDb()
  })
})

describe('GET /resume/history（旧记录兼容）', () => {
  it('简历 AI 评审上线前的旧 payload（无 issues）不再导致 500', async () => {
    const app = makeApp()
    const phone = '13922220004'
    const token = await login(app, phone)
    const uid = await uidOf(app, phone)
    // 2026-10-21 前的规则版记录：parse_payload 无 issues/resumeId/mode 等字段
    const legacy = {
      contact: true,
      projects: 3,
      techStack: ['Java'],
      quantified: false,
      gaps: ['缺少量化成果'],
      formatRisks: ['一页超过 2 屏']
    }
    await (app as any).db
      .prepare(
        'INSERT INTO resumes (user_id, original_url, parse_payload, optimize_payload, created_at) VALUES ((SELECT id FROM users WHERE uid = ?), ?, ?, NULL, ?)'
      )
      .run(uid, 'resumes/legacy.pdf', JSON.stringify(legacy), Date.now())

    const h = await app.inject({
      method: 'GET',
      url: '/resume/history',
      headers: auth(token)
    })
    expect(h.statusCode).toBe(200)
    const items = h.json().data.items
    expect(items.length).toBe(1)
    expect(items[0].issuesTotal).toBe(0)
    expect(items[0].issuesHigh).toBe(0)

    // 历史详情同样补齐缺省字段，避免页面渲染 undefined
    const d = await app.inject({
      method: 'GET',
      url: '/resume/detail?resumeId=' + items[0].resumeId,
      headers: auth(token)
    })
    expect(d.statusCode).toBe(200)
    expect(d.json().data.issues.length).toBe(0)
    expect(d.json().data.gaps.length).toBe(1)
    closeDb()
  })
})
