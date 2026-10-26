// 认证路由：/auth/sms-code /auth/login /auth/wechat
import { FastifyInstance } from 'fastify'
import {
  sendSmsCode,
  loginByPhone,
  loginByWechat,
  code2SessionAttempt,
  getUserByUid,
  BIND_OPENID_MISMATCH
} from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { isPhoneLoginEnabled } from '../config.js'
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
      // 云端未接入短信通道时关闭手机号登录（个人主体无法办理短信签名）
      if (!isPhoneLoginEnabled(env)) {
        return reply.code(400).send(fail(400, '手机号登录暂不可用，请使用微信登录'))
      }
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
      if (!okSend) return reply.code(502).send(fail(502, '验证码发送失败，请稍后重试'))
      return ok()
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
      if (!isPhoneLoginEnabled(env)) {
        return reply.code(400).send(fail(400, '手机号登录暂不可用，请使用微信登录'))
      }
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

  // 微信静默登录（契约冻结 §2.2，2026-10-22 虚拟支付改造）：
  // 身份源优先级：
  // 1) body.code → jscode2session：拿到 code 且凭据齐全时始终真实换取，
  //    同时把 session_key 落服务端（虚拟支付用户态签名依赖）；若同时存在可信
  //    X-WX-OPENID，两者 openid 必须一致，否则拒绝（防身份错配）
  // 2) X-WX-OPENID 头：仅 TRUST_WX_HEADERS=true 时采信，作为无 code / 无凭据时兜底
  // 3) WX_MOCK_LOGIN=true（仅本地联调）→ 'wx_' + code 作 openid
  // 出参 { uid, nickname, token } 不变；session_key 永不下发
  // 若请求自带有效 token：把微信身份绑定到该账号（手机号登录用户首次支付的重登路径），
  // 不再按 openid 另建/切换账号。
  app.post(
    '/auth/wechat',
    {
      schema: {
        body: { type: 'object', properties: { code: { type: 'string' } } }
      }
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as { code?: string }
      // 可选绑定态：token 无效按匿名处理，不影响静默登录
      let bindUid = ''
      const authHeader = request.headers['authorization']
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        try {
          const payload = app.jwt.verify(authHeader.substring(7)) as any
          if (payload != null && typeof payload.uid === 'string') bindUid = payload.uid
        } catch {
          bindUid = ''
        }
      }
      const rawHeader = request.headers['x-wx-openid']
      const trustedHeaderOpenid =
        env.trustWxHeaders && typeof rawHeader === 'string' ? rawHeader : ''
      const code = typeof body.code === 'string' ? body.code : ''
      let openid = ''
      let sessionKey = ''

      // 1) code 优先：拿到 code 且有凭据时始终真实换取（含 session_key）
      if (code.length > 0 && env.wxAppId.length > 0 && env.wxSecret.length > 0) {
        const attempt = await code2SessionAttempt(env, code)
        if (attempt.session == null) {
          // 诊断口径：把微信侧 errcode 带回（不含任何密钥），便于真机区分
          // 40125（AppSecret 无效）/ 40029（code 无效或已用）/ -1（网络）
          return reply.code(400).send(fail(400, '微信登录失败（' + attempt.errcode + '），请重试'))
        }
        const wx = attempt.session
        if (trustedHeaderOpenid.length > 0 && trustedHeaderOpenid !== wx.openid) {
          console.warn('[auth] openid mismatch: header != code2session')
          return reply.code(400).send(fail(400, '微信身份校验失败'))
        }
        openid = wx.openid
        sessionKey = wx.sessionKey
      }
      // 2) 云托管头兜底（无 code 或凭据未配置时）
      if (openid.length === 0 && trustedHeaderOpenid.length > 0) {
        openid = trustedHeaderOpenid
      }
      // 3) 本地联调假 openid
      if (openid.length === 0 && code.length > 0 && env.wxMockLogin) {
        openid = 'wx_' + code
      }
      if (openid.length === 0) {
        if (code.length > 0 && !env.wxMockLogin) {
          return reply.code(400).send(fail(400, '微信登录未配置'))
        }
        return reply.code(400).send(fail(400, '缺少微信身份凭证'))
      }
      let auth
      try {
        auth = await loginByWechat(db, env, openid, sessionKey, bindUid)
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === BIND_OPENID_MISMATCH) {
          return reply.code(400).send(fail(400, '当前账号已绑定其他微信'))
        }
        throw e
      }
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
