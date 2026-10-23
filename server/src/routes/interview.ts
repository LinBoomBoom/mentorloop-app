// 面试路由：/interview/session /interview/next /interview/answer /interview/asr
import { FastifyInstance } from 'fastify'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createSession, nextQuestion as svcNext, submitAnswer } from '../services/interview.js'
import { getAsrDriver } from '../services/asr.js'
import { transcribeByCloudFileID } from '../services/asr-cloud.js'
import { isCloudFileID, isOwnedCloudFileID } from '../services/cloud-file.js'
import { deleteCloudFiles } from '../services/wx-storage.js'
import { getTtsDriver, TTS_TIMEOUT_MS } from '../services/tts.js'
import { requireAuth } from './auth-guard.js'
import { ok, okData, fail } from '../util.js'
import { newId } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  app.post(
    '/interview/session',
    {
      preHandler: requireAuth,
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
      const sessionId = await createSession(db, uid, mode, {
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
      preHandler: requireAuth,
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
            resumeRiskTopics: { type: 'string' },
            resumeTechStacks: { type: 'string' },
            maxQuestions: { type: 'integer', minimum: 0, maximum: 12 }
          }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const q = request.query as any
      try {
        const question = await svcNext(db, uid, {
          sessionId: q.sessionId,
          mode: q.mode ?? 'standard',
          askedComma: q.asked ?? '',
          remainSeconds: typeof q.remainSeconds === 'number' ? q.remainSeconds : 0,
          resumeRiskTopicsComma: q.resumeRiskTopics ?? '',
          resumeTechStacksComma: q.resumeTechStacks ?? '',
          maxQuestions: typeof q.maxQuestions === 'number' ? q.maxQuestions : 0
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
      preHandler: requireAuth,
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
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const body = request.body as any
      try {
        await submitAnswer(
          db,
          uid,
          body.sessionId,
          body.questionId,
          body.text,
          body.isFollowup === true
        )
      } catch (e: any) {
        if (e?.message === 'SESSION_NOT_FOUND') return reply.code(404).send(fail(404, '会话不存在'))
        return reply.code(500).send(fail(500, '答案保存失败'))
      }
      return ok()
    }
  )

  // ASR 转写（P2-13）：multipart 上传音频 → 落盘 → 驱动识别 → 清理临时文件
  // 驱动按配置选择：默认 stub 明确降级（不伪造转写）；aliyun 需密钥（见 services/asr.ts）
  app.post(
    '/interview/asr',
    {
      preHandler: requireAuth
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

  // 录音作答上行（契约：docs/contracts/2026-10-21-asr-cloud-upload.freeze.md）
  // 小程序端 wx.cloud.uploadFile → fileID → 服务端取音频 → 微信 ASR → 文本
  // 诚实降级：任一环节失败 → text=''，客户端提示重录或改文字作答
  app.post(
    '/interview/asr-cloud',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['fileID'],
          properties: { fileID: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const env = (app as any).env as import('../config.js').Env
      const uid = (request.user as any).uid as string
      const body = request.body as any
      if (body == null || typeof body.fileID !== 'string') {
        return fail(400, '缺少文件ID')
      }
      if (!isCloudFileID(body.fileID)) {
        return fail(400, '文件ID格式不正确')
      }
      // 属主校验：只允许本人 asr/<uid>/ 路径，防止借 fileID 读取他人录音
      if (!isOwnedCloudFileID(body.fileID, uid, 'asr')) {
        return reply.code(403).send(fail(403, '无权访问该文件'))
      }
      try {
        const r = await transcribeByCloudFileID(env, body.fileID)
        return okData(r)
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'ASR_CLOUD_ERROR'
        console.warn('[interview] asr-cloud failed', msg)
        return okData({ text: '', confidence: 0 })
      }
    }
  )

  // TTS 下行（契约：docs/contracts/2026-10-19-tts-outbound.freeze.md）
  // 文本 → 合成音频 → 写微信云存储 → 返回 cloud:// fileID（客户端 InnerAudioContext 直接播）
  // 诚实降级：任一环节不可用 → fileID='' 且 format=''，客户端回退字幕模式，不阻塞流程
  app.post(
    '/interview/tts',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: { text: { type: 'string' } }
        }
      }
    },
    async (request) => {
      const env = (app as any).env as import('../config.js').Env
      const uid = (request.user as any).uid as string
      const body = request.body as any
      if (body == null || typeof body.text !== 'string') {
        return fail(400, '缺少文本')
      }
      const driver = getTtsDriver(env)
      try {
        const r = await driver.synthesize(body.text, { timeoutMs: TTS_TIMEOUT_MS, uid: uid })
        return okData(r)
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'TTS_ERROR'
        console.warn('[interview] tts failed', msg)
        // 合成失败同样降级（不伪造音频、不卡面试流程）
        return okData({ fileID: '', provider: driver.name, format: '', chars: 0 })
      }
    }
  )

  // TTS 回收回执（契约：docs/contracts/2026-10-21-tts-ack-and-file-ownership.freeze.md）
  // 客户端播放结束/失败/主动停止后回调；服务端只删本人 tts/<uid>/ 下的合成对象。
  // best-effort：删除不可用（缺凭据/网络失败）只告警，仍返回成功，不打扰用户。
  app.post(
    '/interview/tts-ack',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['fileID'],
          properties: { fileID: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const env = (app as any).env as import('../config.js').Env
      const uid = (request.user as any).uid as string
      const body = request.body as any
      if (body == null || typeof body.fileID !== 'string') {
        return fail(400, '缺少文件ID')
      }
      if (!isCloudFileID(body.fileID)) {
        return fail(400, '文件ID格式不正确')
      }
      if (!isOwnedCloudFileID(body.fileID, uid, 'tts')) {
        return reply.code(403).send(fail(403, '无权访问该文件'))
      }
      try {
        await deleteCloudFiles({
          appId: env.wxAppId,
          secret: env.wxSecret,
          envId: env.wxCloudEnvId,
          fileIDs: [body.fileID],
          timeoutMs: 5000
        })
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'TTS_ACK_DELETE_ERROR'
        console.warn('[interview] tts-ack delete failed（best-effort）', msg)
      }
      return ok()
    }
  )
}
