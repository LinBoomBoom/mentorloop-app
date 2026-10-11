// 报告 / 简历 / 埋点 路由（会员路由见 membership.ts）
import { FastifyInstance } from 'fastify'
import { basename } from 'node:path'
import { requireAuth } from './auth-guard.js'
import { getReport } from '../services/report.js'
import { parseResumeFile, optimizeResume } from '../services/resume.js'
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
          properties: { fileUrl: { type: 'string' } }
        }
      }
    },
    async (request) => {
      const { fileUrl } = request.body as { fileUrl: string }
      const uid = (request.user as any).uid as string
      const name = basename(fileUrl)
      return okData(await parseResumeFile(db, uid, fileUrl, name))
    }
  )

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
