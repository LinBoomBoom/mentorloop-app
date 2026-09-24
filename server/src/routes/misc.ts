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
        return okData(await getReport(db, sessionId, env))
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
