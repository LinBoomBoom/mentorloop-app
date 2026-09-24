// 报告 / 简历 / 会员 / 埋点 路由
import { FastifyInstance } from 'fastify'
import { basename } from 'node:path'
import { requireAuth } from './auth-guard.js'
import { getReport } from '../services/report.js'
import { parseResumeFile, optimizeResume } from '../services/resume.js'
import { getUserByUid } from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { ingestEvents } from '../services/track.js'
import { ok, okData, fail } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

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
      try {
        return okData(getReport(db, sessionId))
      } catch {
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
      return okData(parseResumeFile(db, uid, fileUrl, name))
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

  // ---- 会员 / 配额 ----
  app.get('/membership/quota', { preHandler: requireAuth }, async (request, reply) => {
    const user = getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    return okData(getQuota(user))
  })

  // 占位：P1.3 兑现微信支付（payParams null → 前端按 Mock 语义本地发放，避免阻塞流程）
  app.post(
    '/membership/order',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['skuId'],
          properties: { skuId: { type: 'string' } }
        }
      }
    },
    () => okData({ orderId: 'stub-' + Date.now(), payParams: null })
  )

  // 服务端回调：客户端不直接调用；P1.3 实现签名校验
  app.post('/membership/order/notify', () => ok())

  // ---- 埋点 ----
  app.post(
    '/track/batch',
    {
      schema: {
        body: {
          type: 'object',
          required: ['events'],
          properties: { events: { type: 'array', items: { type: 'string' } } }
        }
      }
    },
    async (request) => {
      const { events } = request.body as { events: string[] }
      ingestEvents(db, events ?? [])
      return ok()
    }
  )
}
