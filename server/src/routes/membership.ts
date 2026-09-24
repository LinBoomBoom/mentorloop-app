// 会员与支付路由（P1.3）：quota / order（双模式）/ 微信回调 notify
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { getUserByUid } from '../services/auth.js'
import { getQuota } from '../services/quota.js'
import { createOrder, payOrderMock, settleOrder } from '../services/payment.js'
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

  // 服务端权威配额
  app.get('/membership/quota', { preHandler: requireAuth }, async (request, reply) => {
    const user = getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    return okData(getQuota(user))
  })

  // 下单：mock 模式直接发放并返回 payParams:null；wx 模式返回拉起支付参数
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
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const user = getUserByUid(db, uid)
      if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
      const { skuId } = request.body as { skuId: string }

      if (env.payMode === 'wx') {
        try {
          const order = createOrder(db, user.id, skuId)
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
      try {
        const r = payOrderMock(db, user.id, skuId)
        return okData({ orderId: r.orderId, payParams: null })
      } catch (e: any) {
        if (e?.message === 'SKU_NOT_FOUND') return reply.code(400).send(fail(400, '商品不存在'))
        return reply.code(500).send(fail(500, '下单失败'))
      }
    }
  )

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

    const order = requireOrder(db, orderId)
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

    settleOrder(db, orderId, txId) // 幂等：重复回调不重复发放
    return { code: 'SUCCESS', message: '成功' }
  })
}

function requireOrder(db: import('../db.js').Db, orderId: string) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  return row != null ? (row as any) : null
}
