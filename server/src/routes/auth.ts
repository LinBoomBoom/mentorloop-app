// 认证路由：/auth/sms-code /auth/login /auth/wechat
import { FastifyInstance } from 'fastify'
import { sendSmsCode, loginByPhone, loginByWechat, getUserByUid } from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { ok, okData, fail } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db
  const env = (app as any).env as import('../config.js').Env

  app.post(
    '/auth/sms-code',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string', minLength: 11, maxLength: 11 } }
        }
      }
    },
    async (request) => {
      const { phone } = request.body as { phone: string }
      const okSend = sendSmsCode(db, env, phone)
      return okSend ? ok() : fail(400, '手机号格式不正确')
    }
  )

  app.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone', 'code'],
          properties: { phone: { type: 'string' }, code: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const { phone, code } = request.body as { phone: string; code: string }
      const auth = loginByPhone(db, env, phone, code)
      if (auth == null) {
        return reply.code(400).send(fail(400, '验证码不正确或已过期'))
      }
      const token = app.jwt.sign({ uid: auth.uid })
      return okData({ uid: auth.uid, nickname: auth.nickname, token })
    }
  )

  app.post(
    '/auth/wechat',
    {
      schema: {
        body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } }
      }
    },
    async (request) => {
      const { code } = request.body as { code: string }
      const auth = loginByWechat(db, env, code)
      const token = app.jwt.sign({ uid: auth.uid })
      return okData({ uid: auth.uid, nickname: auth.nickname, token })
    }
  )

  // 内部辅助：验证 token 并返回用户（供 E2E/调试）
  app.get('/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send(fail(401, '未登录或登录已过期'))
    }
    const user = getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    const q = getQuota(user)
    return okData({ uid: user.uid, nickname: user.nickname, quota: q })
  })
}
