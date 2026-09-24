// 面试路由：/interview/session /interview/next /interview/answer /interview/asr
import { FastifyInstance } from 'fastify'
import { createSession, nextQuestion as svcNext, submitAnswer } from '../services/interview.js'
import { ok, okData, fail } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  app.post(
    '/interview/session',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify()
        } catch {
          reply.code(401).send(fail(401, '未登录或登录已过期'))
        }
      },
      schema: {
        querystring: { type: 'object', properties: { mode: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['positionId', 'experienceLevel'],
          properties: {
            positionId: { type: 'string' },
            position: { type: 'string' },
            experienceLevel: { type: 'string' },
            experienceRange: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      if (uid == null) return reply.code(401).send(fail(401, '未登录'))
      const body = request.body as any
      const q = request.query as any
      const mode = typeof q?.mode === 'string' && q.mode.length > 0 ? q.mode : 'standard'
      const sessionId = createSession(db, uid, mode, {
        positionId: body.positionId,
        position: body.position ?? '',
        experienceLevel: body.experienceLevel,
        experienceRange: body.experienceRange ?? ''
      })
      return okData({ sessionId })
    }
  )

  app.get(
    '/interview/next',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify()
        } catch {
          reply.code(401).send(fail(401, '未登录或登录已过期'))
        }
      },
      schema: {
        querystring: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
            mode: { type: 'string' },
            positionId: { type: 'string' },
            experienceLevel: { type: 'string' },
            asked: { type: 'string' },
            remainSeconds: { type: 'number' },
            resumeRiskTopics: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const q = request.query as any
      try {
        const question = svcNext(db, {
          sessionId: q.sessionId,
          mode: q.mode ?? 'standard',
          askedComma: q.asked ?? '',
          remainSeconds: typeof q.remainSeconds === 'number' ? q.remainSeconds : 0,
          resumeRiskTopicsComma: q.resumeRiskTopics ?? ''
        })
        return okData(question)
      } catch (e: any) {
        if (e?.message === 'SESSION_NOT_FOUND') return reply.code(404).send(fail(404, '会话不存在'))
        if (e?.message === 'NO_MORE_QUESTIONS')
          return reply.code(200).send(fail(2001, '面试题目已收束'))
        return reply.code(500).send(fail(500, '出题失败'))
      }
    }
  )

  app.post(
    '/interview/answer',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify()
        } catch {
          reply.code(401).send(fail(401, '未登录或登录已过期'))
        }
      },
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'questionId', 'text'],
          properties: {
            sessionId: { type: 'string' },
            questionId: { type: 'string' },
            text: { type: 'string' },
            isFollowup: { type: 'boolean' }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as any
      submitAnswer(db, body.sessionId, body.questionId, body.text, body.isFollowup === true)
      return ok()
    }
  )

  // ASR 转写：P1.1 降级 stub（不伪造转写，前端自动降级文字作答）
  app.post('/interview/asr', async () => {
    return okData({ text: '', confidence: 0 })
  })
}
