// 面试路由：/interview/session /interview/next /interview/answer /interview/asr
import { FastifyInstance } from 'fastify'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createSession, nextQuestion as svcNext, submitAnswer } from '../services/interview.js'
import { getAsrDriver } from '../services/asr.js'
import { ok, okData, fail } from '../util.js'
import { newId } from '../util.js'

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

  // ASR 转写（P2-13）：multipart 上传音频 → 落盘 → 驱动识别 → 清理临时文件
  // 驱动按配置选择：默认 stub 明确降级（不伪造转写）；aliyun 需密钥（见 services/asr.ts）
  app.post(
    '/interview/asr',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify()
        } catch {
          reply.code(401).send(fail(401, '未登录或登录已过期'))
        }
      }
    },
    async (request) => {
      const env = (app as any).env as import('../config.js').Env
      const driver = getAsrDriver(env)
      let file = null
      try {
        file = (await request.file({ limits: { files: 1, fileSize: 10 * 1024 * 1024 } })) as any
      } catch {
        return ok()
      }
      if (file == null) {
        // 无音频：明确降级（不伪造转写，客户端走文字作答）
        return okData({ text: '', confidence: 0 })
      }
      const ext =
        file.filename != null && String(file.filename).indexOf('.') >= 0
          ? String(file.filename).split('.').pop()
          : 'bin'
      const tmpPath = join(env.uploadDir, 'asr_' + newId('asr') + '.' + ext)
      let buf: Buffer
      try {
        buf = (await file.toBuffer()) as Buffer
      } catch {
        return okData({ text: '', confidence: 0 })
      }
      if (buf == null || buf.length === 0) {
        return okData({ text: '', confidence: 0 })
      }
      await writeFile(tmpPath, buf)
      try {
        const r = await driver.transcribe(tmpPath, { timeoutMs: env.asrTimeoutMs })
        return okData(r)
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'ASR_ERROR'
        console.warn('[interview] asr failed', msg)
        // 转写失败同样明确降级（不卡流程、不伪造文本）
        return okData({ text: '', confidence: 0 })
      } finally {
        try {
          await unlink(tmpPath)
        } catch {
          // 忽略清理异常
        }
      }
    }
  )
}
