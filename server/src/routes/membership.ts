// 会员与支付路由（P1.3）：quota / order（双模式）/ 微信回调 notify
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { getUserByUid, getFreshSessionKey } from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { createDesktopGateway, syncDesktopLink } from '../services/desktop-link.js'
import { createOrder, payOrderMock, settleOrder } from '../services/payment.js'
import { getSku } from '../data/skus.js'
import { isVirtualPayReady, createVirtualPayParams } from '../services/virtual-pay.js'
import { handleVirtualNotify } from '../services/virtual-notify.js'
import {
  createJsapiOrder,
  verifyNotifySignature,
  decryptResource,
  WxNotifyDetail
} from '../services/wechat-pay.js'
import { okData, fail } from '../util.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db
  const env = (app as any).env as import('../config.js').Env

  // 服务端权威配额（含桌面权益单向同步：已绑定/可绑定用户每次读取都刷新，未配置互通时零开销）
  app.get('/membership/quota', { preHandler: requireAuth }, async (request, reply) => {
    const user = await getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    await syncDesktopLink(db, createDesktopGateway(db, env), user)
    return okData(getQuota(user))
  })

  // 下单：按 platform 分流（契约 §5.1）
  // - app：PAY_MODE=mock 直接发放 / wx 返回 v3 JSAPI payParams
  // - mp-weixin：MP_PAY_MODE=mock 直接发放 / virtual 返回虚拟支付 payData
  app.post(
    '/membership/order',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['skuId'],
          properties: { skuId: { type: 'string' }, platform: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const user = await getUserByUid(db, uid)
      if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
      const { skuId, platform } = request.body as { skuId: string; platform?: string }
      if (platform !== 'app' && platform !== 'mp-weixin') {
        return reply.code(400).send(fail(400, '平台参数不合法'))
      }

      if (platform === 'mp-weixin' && env.mpPayMode === 'virtual') {
        // 虚拟支付：session_key 是用户态签名密钥，缺失/过期直接 409 让客户端重登
        if (!isVirtualPayReady(env)) {
          console.warn('[payment] MP_PAY_MODE=virtual 但 OfferID/AppKey 未配置')
          return reply.code(500).send(fail(500, '下单失败'))
        }
        const sessionKey = await getFreshSessionKey(db, uid)
        if (sessionKey == null) {
          return reply.code(409).send(fail(409, '微信会话已过期，请重新进入小程序'))
        }
        const sku = getSku(skuId)
        if (sku == null) return reply.code(400).send(fail(400, '商品不存在'))
        try {
          const order = await createOrder(db, user.id, skuId)
          const payParams = createVirtualPayParams(env, sku, order.id, sessionKey)
          return okData({ orderId: order.id, payParams })
        } catch {
          return reply.code(500).send(fail(500, '下单失败'))
        }
      }

      if (platform === 'app' && env.payMode === 'wx') {
        try {
          const order = await createOrder(db, user.id, skuId)
          const payParams = await createJsapiOrder(
            env,
            order.id,
            'MentorLoop 会员/单次包',
            order.amount,
            user.openid ?? ''
          )
          return okData({ orderId: order.id, payParams })
        } catch (e: any) {
          if (e?.message === 'SKU_NOT_FOUND') return reply.code(400).send(fail(400, '商品不存在'))
          if (e?.message === 'WX_PRECREATE_FAILED')
            return reply.code(502).send(fail(502, '微信下单失败'))
          return reply.code(500).send(fail(500, '下单失败'))
        }
      }

      // 两端 mock：下单即发放，payParams=null
      try {
        const r = await payOrderMock(db, user.id, skuId)
        return okData({ orderId: r.orderId, payParams: null })
      } catch (e: any) {
        if (e?.message === 'SKU_NOT_FOUND') return reply.code(400).send(fail(400, '商品不存在'))
        return reply.code(500).send(fail(500, '下单失败'))
      }
    }
  )

  // 虚拟支付推送（无鉴权，靠平台查单校验）：发货推送 + 退款通知
  // 回包必须是 XML（ErrCode 0 = 成功，平台不再重试）
  // GET：微信消息推送配置时的 URL 校验，明文模式下原样回显 echostr
  // （不做签名校验：该端点只回显字符串、无业务副作用；发货权威仍是 query_order）
  app.get('/membership/virtual/notify', async (request, reply) => {
    const q = (request.query ?? {}) as { echostr?: string }
    const echo = typeof q.echostr === 'string' ? q.echostr : ''
    return reply.code(200).type('text/plain').send(echo)
  })

  app.post('/membership/virtual/notify', async (request, reply) => {
    const raw =
      typeof request.body === 'string' ? request.body : String((request as any).rawBody ?? '')
    const out = await handleVirtualNotify(db, env, raw)
    return reply.code(200).type('application/xml').send(out)
  })

  // 微信支付回调（无鉴权）：验签 → 解密 → 金额校验 → 幂等发放
  app.post('/membership/order/notify', async (request: FastifyRequest, reply: FastifyReply) => {
    const headers = request.headers
    const signature = (headers['wechatpay-signature'] as string) ?? ''
    const timestamp = (headers['wechatpay-timestamp'] as string) ?? ''
    const nonce = (headers['wechatpay-nonce'] as string) ?? ''
    const rawBody = (request as any).rawBody ?? ''

    if (env.payMode !== 'wx' || signature.length === 0) {
      // mock 模式或缺少签名：拒绝，避免伪造回调
      return reply.code(401).send({ code: 'FAIL', message: 'invalid signature' })
    }
    if (!verifyNotifySignature(env, timestamp, nonce, rawBody, signature)) {
      console.warn('[payment] notify signature verify failed')
      return reply.code(401).send({ code: 'FAIL', message: 'invalid signature' })
    }

    let detail: WxNotifyDetail
    try {
      detail = decryptResource(env.wxApiV3Key, (request.body as any).resource)
    } catch {
      return reply.code(400).send({ code: 'FAIL', message: 'decrypt failed' })
    }

    const orderId = detail.out_trade_no ?? ''
    const tradeState = detail.trade_state ?? ''
    const txId = detail.transaction_id ?? ''
    const total = detail.amount?.total ?? -1
    if (orderId.length === 0 || tradeState !== 'SUCCESS') {
      return reply.code(400).send({ code: 'FAIL', message: 'invalid detail' })
    }

    const order = await requireOrder(db, orderId)
    if (order == null) return reply.code(404).send({ code: 'FAIL', message: 'order not found' })
    if (order.amount !== total) {
      console.warn(
        '[payment] amount mismatch order=%s expect=%s got=%s',
        orderId,
        order.amount,
        total
      )
      return reply.code(400).send({ code: 'FAIL', message: 'amount mismatch' })
    }

    await settleOrder(db, orderId, txId) // 幂等：重复回调不重复发放
    return { code: 'SUCCESS', message: '成功' }
  })
}

async function requireOrder(db: import('../db.js').Db, orderId: string) {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  return row != null ? (row as any) : null
}
