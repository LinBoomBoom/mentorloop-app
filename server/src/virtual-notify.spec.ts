// 虚拟支付推送与查单兜底单测（W4）：XML 解析 / 以查单为权威 / 幂等 / 三元校验 / 退款
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import type { Env } from './config.js'
import { closeDb, getDb } from './db.js'
import { setVirtualPayTransportForTest } from './services/virtual-pay.js'
import {
  parseXml,
  findText,
  buildXmlReply,
  reconcileVirtualOrders,
  startVirtualOrderReconciler
} from './services/virtual-notify.js'

function makeApp(env: Env) {
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

function virtualEnv(): Env {
  const env = loadEnv()
  env.mpPayMode = 'virtual'
  env.mpOfferId = '1450672438'
  env.mpAppKey = 'test-app-key'
  return env
}

async function loginWithSession(
  app: any,
  env: Env
): Promise<{ token: string; uid: string; sessionKey: string }> {
  const phone = '136' + String(Date.now()).slice(-8)
  await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone, code: '123456' }
  })
  const d = r.json().data
  const db = getDb(env.dbPath)
  // 模拟微信登录用户：同时具备 session_key 与 openid（查单兜底依赖 openid）
  await db
    .prepare(
      'UPDATE users SET session_key = ?, session_key_updated_at = ?, openid = ? WHERE uid = ?'
    )
    .run('SK_TEST', Date.now(), 'o_test_openid', d.uid)
  return { token: d.token, uid: d.uid, sessionKey: 'SK_TEST' }
}

// 创建一笔 CREATED 虚拟支付订单（返回 orderId）
async function createOrder(app: any, token: string, skuId: string = 'single_pack_3') {
  const r = await app.inject({
    method: 'POST',
    url: '/membership/order',
    headers: { authorization: 'Bearer ' + token },
    payload: { skuId, platform: 'mp-weixin' }
  })
  expect(r.statusCode).toBe(200)
  return r.json().data.orderId as string
}

async function quota(app: any, token: string): Promise<any> {
  const r = await app.inject({
    method: 'GET',
    url: '/membership/quota',
    headers: { authorization: 'Bearer ' + token }
  })
  return r.json().data
}

function deliverXml(orderId: string, productId: string = 'single_pack_3'): string {
  return (
    '<xml><CreateTime>1790000000</CreateTime><MsgType><![CDATA[event]]></MsgType>' +
    '<Event><![CDATA[xpay_goods_deliver_notify]]></Event>' +
    '<OpenId><![CDATA[o_test_openid]]></OpenId>' +
    '<OutTradeNo><![CDATA[' +
    orderId +
    ']]></OutTradeNo>' +
    '<WeChatPayInfo><MchOrderNo><![CDATA[wx_' +
    orderId +
    ']]></MchOrderNo></WeChatPayInfo>' +
    '<GoodsInfo><ProductId><![CDATA[' +
    productId +
    ']]></ProductId><Quantity>1</Quantity></GoodsInfo></xml>'
  )
}

function refundXml(orderId: string): string {
  return (
    '<xml><MsgType><![CDATA[event]]></MsgType>' +
    '<Event><![CDATA[xpay_refund_notify]]></Event>' +
    '<OpenId><![CDATA[o_test_openid]]></OpenId>' +
    '<OutTradeNo><![CDATA[' +
    orderId +
    ']]></OutTradeNo></xml>'
  )
}

async function notify(app: any, xml: string) {
  const r = await app.inject({
    method: 'POST',
    url: '/membership/virtual/notify',
    headers: { 'content-type': 'application/xml' },
    payload: xml
  })
  return r.body
}

// 注入查单响应（status 见官方枚举）
function injectQuery(status: number, orderFee: number = 2900) {
  setVirtualPayTransportForTest(
    async () => ({
      status: 200,
      body: JSON.stringify({
        errcode: 0,
        errmsg: '',
        order: {
          order_id: 'x',
          status: status,
          order_fee: orderFee,
          paid_fee: orderFee,
          wx_order_id: 'wx_order_1'
        }
      })
    }),
    'TOKEN_TEST'
  )
}

describe('XML 解析（W4）', () => {
  it('支持 CDATA 与嵌套标签', () => {
    const root = parseXml(deliverXml('o_abc'))
    expect(findText(root, 'Event')).toBe('xpay_goods_deliver_notify')
    expect(findText(root, 'OutTradeNo')).toBe('o_abc')
    expect(findText(root, 'ProductId')).toBe('single_pack_3')
    expect(findText(root, 'MchOrderNo')).toBe('wx_o_abc')
  })

  it('缺字段返回空串，不抛错', () => {
    const root = parseXml('<xml><A>1</A></xml>')
    expect(findText(root, 'Nope')).toBe('')
    expect(buildXmlReply(0, 'ok')).toContain('<ErrCode>0</ErrCode>')
  })
})

describe('虚拟支付推送（W4）', () => {
  beforeEach(() => closeDb())
  afterEach(() => {
    setVirtualPayTransportForTest(null, '')
    closeDb()
  })

  it('查单已支付 → 发货一次；重复推送幂等', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    injectQuery(2)

    const b1 = await notify(app, deliverXml(orderId))
    expect(b1).toContain('delivered')
    expect((await quota(app, token)).singleCreditsLeft).toBe(3)

    // 重复推送：短路为 already paid，不再扣发
    const b2 = await notify(app, deliverXml(orderId))
    expect(b2).toContain('already paid')
    expect((await quota(app, token)).singleCreditsLeft).toBe(3)
  })

  it('查单未支付 → 不发货，回 ErrCode 0 停止重试', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    injectQuery(1)

    const b = await notify(app, deliverXml(orderId))
    expect(b).toContain('not paid')
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('模拟推送 → 只回成功，不查单、不发货', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    let called = 0
    setVirtualPayTransportForTest(async () => {
      called++
      return { status: 200, body: JSON.stringify({ errcode: 0, order: { status: 2 } }) }
    }, 'TOKEN_TEST')

    const xml = deliverXml(orderId).replace('</OpenId>', '</OpenId><IsMock>true</IsMock>')
    const b = await notify(app, xml)
    expect(b).toContain('mock ok')
    expect(called).toBe(0)
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('productId 不一致 → 拒发（防串单）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    injectQuery(2)

    const b = await notify(app, deliverXml(orderId, 'single_pack_10'))
    expect(b).toContain('product mismatch')
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('金额不一致 → 拒发（防改价）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    injectQuery(2, 1)

    const b = await notify(app, deliverXml(orderId))
    expect(b).toContain('amount mismatch')
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('未知订单 → 回成功但不出货（避免平台 13 次重试）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    injectQuery(2)
    const b = await notify(app, deliverXml('o_not_exist'))
    expect(b).toContain('order not found')
    expect(b).toContain('<ErrCode>0</ErrCode>')
  })

  it('退款通知（查单已退款）→ 订单 REFUNDED 且回收未使用额度', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)
    injectQuery(2)
    await notify(app, deliverXml(orderId))
    expect((await quota(app, token)).singleCreditsLeft).toBe(3)

    injectQuery(5, 2900)
    const b = await notify(app, refundXml(orderId))
    expect(b).toContain('refund recorded')

    const db = getDb(env.dbPath)
    const row = (await db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId)) as any
    expect(row.status).toBe('REFUNDED')
    // 未使用的 3 场被回收（已使用部分不追缴）
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('非 virtual 模式直接拒绝（防止误开推送）', async () => {
    const env = loadEnv() // mpPayMode=mock
    const app = makeApp(env)
    const b = await notify(app, deliverXml('o_x'))
    expect(b).toContain('virtual pay disabled')
  })

  it('GET 消息推送 URL 校验：原样回显 echostr', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const r = await app.inject({
      method: 'GET',
      url: '/membership/virtual/notify?signature=abc&timestamp=1&nonce=2&echostr=hello123'
    })
    expect(r.statusCode).toBe(200)
    expect(r.body).toBe('hello123')
  })
})

describe('查单兜底（W4）', () => {
  beforeEach(() => closeDb())
  afterEach(() => {
    setVirtualPayTransportForTest(null, '')
    closeDb()
  })

  it('只补发已支付的 CREATED 单；未支付不动', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const paidOrder = await createOrder(app, token)
    await createOrder(app, token)

    // 按订单号区分：paidOrder 返回已支付，其余返回未支付
    setVirtualPayTransportForTest(async (_url, body) => {
      const oid = JSON.parse(body).order_id
      const paid = oid === paidOrder
      return {
        status: 200,
        body: JSON.stringify({
          errcode: 0,
          order: {
            status: paid ? 2 : 1,
            order_fee: 2900,
            paid_fee: paid ? 2900 : 0,
            wx_order_id: 'wx_' + oid
          }
        })
      }
    }, 'TOKEN_TEST')

    const db = getDb(env.dbPath)
    const n = await reconcileVirtualOrders(db, env)
    expect(n).toBe(1)
    const q = await quota(app, token)
    expect(q.singleCreditsLeft).toBe(3)

    // 再跑一轮：已支付单已 PAID，不再命中；未支付单仍不发货
    const n2 = await reconcileVirtualOrders(db, env)
    expect(n2).toBe(0)
  })

  it('超过 24h 的 CREATED 单不再扫描（终止条件）', async () => {
    const env = virtualEnv()
    const app = makeApp(env)
    const { token } = await loginWithSession(app, env)
    const orderId = await createOrder(app, token)

    const db = getDb(env.dbPath)
    await db
      .prepare('UPDATE orders SET created_at = ? WHERE id = ?')
      .run(Date.now() - 25 * 60 * 60 * 1000, orderId)

    let called = 0
    setVirtualPayTransportForTest(async () => {
      called++
      return {
        status: 200,
        body: JSON.stringify({ errcode: 0, order: { status: 2, order_fee: 2900 } })
      }
    }, 'TOKEN_TEST')

    expect(await reconcileVirtualOrders(db, env)).toBe(0)
    expect(called).toBe(0)
    expect((await quota(app, token)).singleCreditsLeft).toBe(0)
  })

  it('间隔 <=0 时关闭查单兜底（不创建定时器）', () => {
    const env = virtualEnv()
    makeApp(env)
    const db = getDb(env.dbPath)
    expect(startVirtualOrderReconciler(db, env, 0)).toBeNull()
    expect(startVirtualOrderReconciler(db, env, -1)).toBeNull()
  })
})
