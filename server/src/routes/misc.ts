// 报告 / 简历 / 埋点 路由（会员路由见 membership.ts）
import { FastifyInstance } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { getReport } from '../services/report.js'
import {
  parseResumeFile,
  optimizeResume,
  listResumeHistory,
  getResumeDetail,
  deleteResumeRecord
} from '../services/resume.js'
import { getResumeQuota } from '../services/resume-quota.js'
import { isCloudFileID, isOwnedCloudFileID } from '../services/cloud-file.js'
import { ingestEvents } from '../services/track.js'
import { ok, okData, fail } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db
  const env = (app as any).env as import('../config.js').Env

  // 健康检查（云托管探活/发布验证）
  app.get('/healthz', async () =>
    okData({
      ok: true,
      driver: db.driver,
      ts: Date.now()
    })
  )

  // ---- 报告 ----
  app.get(
    '/report',
    {
      preHandler: requireAuth,
      schema: {
        querystring: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const { sessionId } = request.query as { sessionId: string }
      const uid = (request.user as any).uid as string
      try {
        return okData(await getReport(db, uid, sessionId, env))
      } catch (e: any) {
        // 属主校验失败与会话不存在统一 404，防会话 id 探测
        if (e?.message === 'SESSION_NOT_FOUND') return reply.code(404).send(fail(404, '会话不存在'))
        return reply.code(500).send(fail(500, '报告生成失败'))
      }
    }
  )

  // ---- 简历 ----
  app.post(
    '/resume/parse',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['fileUrl'],
          properties: {
            fileUrl: { type: 'string' },
            fileName: { type: 'string' },
            position: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as { fileUrl: string; fileName?: string; position?: string }
      const uid = (request.user as any).uid as string
      // 属主校验：只允许本人 resumes/<uid>/ 路径
      if (isCloudFileID(body.fileUrl) && !isOwnedCloudFileID(body.fileUrl, uid, 'resumes')) {
        return reply.code(403).send(fail(403, '无权访问该文件'))
      }
      try {
        const out = await parseResumeFile(
          db,
          env,
          uid,
          body.fileUrl,
          body.fileName != null ? body.fileName : '',
          body.position != null ? body.position : ''
        )
        return okData({ ...out.result, quota: out.quota })
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'RESUME_ERROR'
        if (msg === 'RESUME_LOCAL_UNSUPPORTED') {
          return reply.code(400).send(fail(400, '请在小程序内上传简历文件'))
        }
        if (msg === 'RESUME_UNSUPPORTED_TYPE') {
          return reply.code(400).send(fail(400, '仅支持 PDF / DOCX 文件'))
        }
        if (msg === 'RESUME_TOO_LARGE' || msg === 'RESUME_EMPTY_FILE') {
          return reply.code(400).send(fail(400, '文件为空或超过 10MB'))
        }
        if (msg === 'RESUME_TOO_MANY_PAGES') {
          return reply.code(400).send(fail(400, 'PDF 页数不能超过 20 页'))
        }
        if (msg === 'RESUME_NO_TEXT_LAYER') {
          return reply.code(400).send(fail(400, '未检测到可复制文本，请上传可复制文本的 PDF/DOCX'))
        }
        if (msg === 'RESUME_STORAGE_UNAVAILABLE' || msg.indexOf('RESUME_DOWNLOAD_') === 0) {
          return reply.code(503).send(fail(503, '文件存储暂不可用，请稍后重试'))
        }
        if (msg === 'RESUME_AI_UNAVAILABLE') {
          return reply.code(503).send(fail(503, 'AI 服务暂不可用，请稍后重试'))
        }
        if (msg === 'RESUME_QUOTA_EXHAUSTED') {
          return reply.code(403).send(fail(403, '需要会员或单次包'))
        }
        if (msg === 'RESUME_PREVIEW_EXHAUSTED') {
          return reply.code(403).send(fail(403, '今日预览次数已用完，请开通会员或单次包'))
        }
        console.warn('[resume] parse failed', msg)
        return reply.code(500).send(fail(500, '解析失败，请重试'))
      }
    }
  )

  // 历史列表 / 详情 / 删除 / 额度
  app.get(
    '/resume/history',
    {
      preHandler: requireAuth,
      schema: {
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }
        }
      }
    },
    async (request) => {
      const uid = (request.user as any).uid as string
      const q = request.query as any
      const limit = q != null && q.limit != null ? Number(q.limit) : 20
      return okData({ items: await listResumeHistory(db, uid, limit) })
    }
  )

  app.get(
    '/resume/detail',
    {
      preHandler: requireAuth,
      schema: {
        querystring: {
          type: 'object',
          required: ['resumeId'],
          properties: { resumeId: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const { resumeId } = request.query as { resumeId: string }
      const out = await getResumeDetail(db, env, uid, resumeId)
      if (out == null) return reply.code(404).send(fail(404, '简历不存在'))
      return okData({ ...out.result, quota: out.quota })
    }
  )

  app.delete(
    '/resume/detail',
    {
      preHandler: requireAuth,
      schema: {
        querystring: {
          type: 'object',
          required: ['resumeId'],
          properties: { resumeId: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const { resumeId } = request.query as { resumeId: string }
      const deleted = await deleteResumeRecord(db, env, uid, resumeId)
      if (!deleted) return reply.code(404).send(fail(404, '简历不存在'))
      return ok()
    }
  )

  app.get('/resume/quota', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    return okData(await getResumeQuota(db, env, uid))
  })

  app.post(
    '/resume/optimize',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['text', 'position'],
          properties: { text: { type: 'string' }, position: { type: 'string' } }
        }
      }
    },
    async (request) => {
      const { text, position } = request.body as { text: string; position: string }
      return okData(optimizeResume(text, position))
    }
  )

  // ---- 埋点 ----
  // 2026-10-12 收紧：加 requireAuth（SOP 此前豁免 track，但匿名通道可被公网刷爆；
  // 客户端 requestSilent 统一附带 token，登录前事件在队列中等待登录后补传）
  // 并加批量上限（100 条/批、单条 4KB），uid 以鉴权身份为准（不再信任 body.userId）
  app.post(
    '/track/batch',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              maxItems: 100,
              items: { type: 'string', maxLength: 4096 }
            }
          }
        }
      }
    },
    async (request) => {
      const { events } = request.body as { events: string[] }
      const uid = (request.user as any).uid as string
      await ingestEvents(db, uid, events ?? [])
      return ok()
    }
  )
}
