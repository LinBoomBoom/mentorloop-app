// 认证路由：/auth/sms-code /auth/login /auth/wechat
import { FastifyInstance } from 'fastify'
import {
  sendSmsCode,
  loginByPhone,
  loginByWechat,
  code2Session,
  getUserByUid
} from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { ok, okData, fail } from '../util.js'

// ---- 轻量内存限流（单实例足够；窗口外自动滑出，防止 Map 无界增长）----
const SMS_SEND_MIN_INTERVAL_MS = 60_000 // 同一手机号两次发码最小间隔
const SMS_SEND_HOURLY_LIMIT = 5 // 同一手机号 1 小时内最多发码次数
const LOGIN_FAIL_LIMIT = 10 // 同一手机号 15 分钟内最大登录失败次数
const LOGIN_FAIL_WINDOW_MS = 15 * 60_000

const smsSendLog = new Map<string, number[]>()
const loginFailLog = new Map<string, number[]>()

function pruneWindow(arr: number[], nowMs: number, windowMs: number): void {
  while (arr.length > 0 && arr[0] <= nowMs - windowMs) arr.shift()
}

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
    async (request, reply) => {
      const { phone } = request.body as { phone: string }
      const t = Date.now()
      const log = smsSendLog.get(phone) ?? []
      pruneWindow(log, t, 3_600_000)
      const last = log.length > 0 ? log[log.length - 1] : 0
      if (t - last < SMS_SEND_MIN_INTERVAL_MS) {
        return reply.code(400).send(fail(400, '发送过于频繁，请稍后再试'))
      }
      if (log.length >= SMS_SEND_HOURLY_LIMIT) {
        return reply.code(400).send(fail(400, '今日发送次数已达上限'))
      }
      log.push(t)
      smsSendLog.set(phone, log)
      const okSend = await sendSmsCode(db, env, phone)
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
      // 验证码爆破防护：失败次数超限直接拒绝（成功不记录）
      const t = Date.now()
      const fails = loginFailLog.get(phone) ?? []
      pruneWindow(fails, t, LOGIN_FAIL_WINDOW_MS)
      if (fails.length >= LOGIN_FAIL_LIMIT) {
        return reply.code(400).send(fail(400, '尝试过于频繁，请稍后再试'))
      }
      const auth = await loginByPhone(db, env, phone, code)
      if (auth == null) {
        fails.push(t)
        loginFailLog.set(phone, fails)
        return reply.code(400).send(fail(400, '验证码不正确或已过期'))
      }
      loginFailLog.delete(phone)
      const token = app.jwt.sign({ uid: auth.uid })
      return okData({ uid: auth.uid, nickname: auth.nickname, token })
    }
  )

  // 微信静默登录（契约冻结 §2.2，2026-10-11 安全收紧）：
  // 身份源优先级（逐级降级，互不兜底）：
  // 1) X-WX-OPENID 头：仅 TRUST_WX_HEADERS=true（云托管私有链路）时采信，
  //    否则 app 层 onRequest 已剥离该头，路由层再校验开关双保险
  // 2) body.code → jscode2session 真实换取（需 WX_APPID + WX_SECRET）
  // 3) WX_MOCK_LOGIN=true（仅本地联调）→ 'wx_' + code 作 openid
  // 出参 { uid, nickname, token } 不变
  app.post(
    '/auth/wechat',
    {
      schema: {
        body: { type: 'object', properties: { code: { type: 'string' } } }
      }
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as { code?: string }
      const headerOpenid = request.headers['x-wx-openid']
      let openid = ''
      if (env.trustWxHeaders && typeof headerOpenid === 'string' && headerOpenid.length > 0) {
        openid = headerOpenid
      }
      if (openid.length === 0 && body.code != null && body.code.length > 0) {
        if (env.wxAppId.length > 0 && env.wxSecret.length > 0) {
          const wxOpenid = await code2Session(env, body.code)
          if (wxOpenid == null) {
            return reply.code(400).send(fail(400, '微信登录失败，请重试'))
          }
          openid = wxOpenid
        } else if (env.wxMockLogin) {
          openid = 'wx_' + body.code
        } else {
          return reply.code(400).send(fail(400, '微信登录未配置'))
        }
      }
      if (openid.length === 0) {
        return reply.code(400).send(fail(400, '缺少微信身份凭证'))
      }
      const auth = await loginByWechat(db, env, openid)
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
    const user = await getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    const q = getQuota(user)
    return okData({ uid: user.uid, nickname: user.nickname, quota: q })
  })
}
