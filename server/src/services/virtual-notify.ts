// 虚拟支付发货推送 / 退款推送处理 + 查单兜底（W4）
// 契约：docs/contracts/2026-10-21-virtual-pay.freeze.md §3 / §11.6
//
// 安全口径（重要）：
//   道具直购推送（xpay_goods_deliver_notify）的签名规则官方文档未公开细节，
//   因此**不采信 XML 内容本身**：收到推送后一律调用 query_order 以平台查单结果为权威，
//   只有查单返回已支付且金额一致才发放。伪造推送最多触发一次查单，不会产生权益。
//
// 幂等：以本地订单号（outTradeNo）+ settleOrder 的 CREATED→PAID 原子迁移保证；
//       重复推送 / 推送与查单同时到达均只发放一次。
import type { Db } from '../db.js'
import type { Env } from '../config.js'
import { getOrder, settleOrder, revokeOrderBenefit, type OrderRow } from './payment.js'
import { getSku } from '../data/skus.js'
import { isVirtualPayReady, queryVirtualOrder } from './virtual-pay.js'
import { now } from '../util.js'

export const EVENT_GOODS_DELIVER = 'xpay_goods_deliver_notify'
// 小程序虚拟支付的退款推送事件名（官方「2.4 消息推送」）。
// 注意：minigame_pay_refund_succ_notify 是**小游戏**的事件名，小程序不会推送。
export const EVENT_REFUND = 'xpay_refund_notify'

// 查单状态（官方枚举）：2 已支付待发货 / 3 发货中 / 4 已发货 / 5 已退款 / 8 用户退款完成
function isPaidStatus(status: number): boolean {
  return status === 2 || status === 3 || status === 4
}
function isRefundedStatus(status: number): boolean {
  return status === 5 || status === 8
}

export type XmlMap = { [key: string]: any }

function escapeXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function unescapeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// 极简 XML 解析：推送格式固定、无重复同名标签，够用且零依赖
export function parseXml(xml: string): XmlMap {
  const cleaned = xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m: string, c: string) => escapeXmlText(c))
  const root: XmlMap = {}
  const stack: XmlMap[] = [root]
  const re = /<(\/?)([A-Za-z_][\w.\-:]*)([^>]*?)(\/?)>/g
  let last = 0
  let m: RegExpExecArray | null = null
  while ((m = re.exec(cleaned)) != null) {
    const text = cleaned.slice(last, m.index)
    if (text.trim().length > 0) {
      const cur = stack[stack.length - 1]
      const prev = typeof cur['#text'] === 'string' ? cur['#text'] : ''
      cur['#text'] = prev + unescapeXmlText(text.trim())
    }
    last = re.lastIndex
    if (m[1] === '/') {
      if (stack.length > 1) stack.pop()
      continue
    }
    const name = m[2]
    const node: XmlMap = {}
    const parent = stack[stack.length - 1]
    if (parent[name] == null) parent[name] = node
    if (m[4] !== '/') stack.push(node)
  }
  return root
}

// 深度优先取文本（兼容 <GoodsInfo><ProductId> 与扁平 <ProductId> 两种写法）
export function findText(node: any, key: string): string {
  if (node == null || typeof node !== 'object') return ''
  const direct = node[key]
  if (typeof direct === 'string') return direct.trim()
  if (direct != null && typeof direct === 'object') {
    const t = direct['#text']
    if (typeof t === 'string' && t.trim().length > 0) return t.trim()
  }
  const keys = Object.keys(node)
  for (let i = 0; i < keys.length; i++) {
    const child = node[keys[i]]
    if (child != null && typeof child === 'object') {
      const r = findText(child, key)
      if (r.length > 0) return r
    }
  }
  return ''
}

export function buildXmlReply(errCode: number, errMsg: string): string {
  return (
    '<xml><ErrCode>' +
    String(errCode) +
    '</ErrCode><ErrMsg><![CDATA[' +
    errMsg +
    ']]></ErrMsg></xml>'
  )
}

async function resolveOpenid(db: Db, order: OrderRow, pushed: string): Promise<string> {
  if (pushed.length > 0) return pushed
  const row = (await db.prepare('SELECT openid FROM users WHERE id = ?').get(order.user_id)) as
    { openid?: string | null } | undefined
  return row != null && typeof row.openid === 'string' ? row.openid : ''
}

// 退款落账：状态迁移 + 按「剩余额度」回收权益（已使用部分不追缴）
// 政策：已消费的权益不退；未使用部分在平台强制退款（尤其 iOS）后回收
async function markRefunded(db: Db, order: OrderRow): Promise<void> {
  if (order.status === 'REFUNDED') return
  const wasPaid = order.status === 'PAID'
  await db
    .prepare("UPDATE orders SET status='REFUNDED' WHERE id = ? AND status IN ('PAID','CREATED')")
    .run(order.id)
  if (wasPaid) await revokeOrderBenefit(db, order)
  console.warn('[virtual-notify] 订单已退款并回收剩余权益 order=' + order.id)
}

// 推送处理入口：返回 XML 回包（ErrCode 0 = 成功，平台不再重试）
export async function handleVirtualNotify(db: Db, env: Env, xml: string): Promise<string> {
  if (env.mpPayMode !== 'virtual') return buildXmlReply(1, 'virtual pay disabled')
  if (xml.trim().length === 0) return buildXmlReply(1, 'empty body')

  const root = parseXml(xml)
  const event = findText(root, 'Event')
  if (event !== EVENT_GOODS_DELIVER && event !== EVENT_REFUND) {
    return buildXmlReply(0, 'ignored')
  }
  // 模拟推送：只校验格式，不执行任何业务（官方要求）
  if (findText(root, 'IsMock') === 'true') return buildXmlReply(0, 'mock ok')

  const outTradeNo = findText(root, 'OutTradeNo')
  if (outTradeNo.length === 0) return buildXmlReply(1, 'missing OutTradeNo')

  const order = await getOrder(db, outTradeNo)
  if (order == null) {
    console.warn('[virtual-notify] 未知订单 outTradeNo=' + outTradeNo)
    return buildXmlReply(0, 'order not found')
  }
  // 幂等短路：已处理过的订单不再查单（重试场景下省 API 调用）
  if (event === EVENT_GOODS_DELIVER && order.status === 'PAID') {
    return buildXmlReply(0, 'already paid')
  }
  if (event === EVENT_REFUND && order.status === 'REFUNDED') {
    return buildXmlReply(0, 'already refunded')
  }

  const openid = await resolveOpenid(db, order, findText(root, 'OpenId'))
  if (openid.length === 0) return buildXmlReply(1, 'no openid')

  // 以平台查单为权威（见文件头安全口径）
  const q = await queryVirtualOrder(env, openid, outTradeNo)
  if (q == null) return buildXmlReply(1, 'query failed')

  if (event === EVENT_REFUND) {
    if (!isRefundedStatus(q.status)) return buildXmlReply(0, 'not refunded yet')
    await markRefunded(db, order)
    return buildXmlReply(0, 'refund recorded')
  }

  if (isRefundedStatus(q.status)) {
    await markRefunded(db, order)
    return buildXmlReply(0, 'refunded')
  }
  if (!isPaidStatus(q.status)) return buildXmlReply(0, 'not paid')

  const sku = getSku(order.sku_id)
  const pushedProduct = findText(root, 'ProductId')
  if (sku == null) return buildXmlReply(0, 'sku missing')
  if (pushedProduct.length > 0 && pushedProduct !== sku.wxProductId) {
    console.warn('[virtual-notify] productId 不一致 order=' + order.id + ' pushed=' + pushedProduct)
    return buildXmlReply(0, 'product mismatch')
  }
  if (q.orderFee !== order.amount) {
    console.warn(
      '[virtual-notify] 金额不一致 order=' +
        order.id +
        ' expect=' +
        String(order.amount) +
        ' got=' +
        String(q.orderFee)
    )
    return buildXmlReply(0, 'amount mismatch')
  }

  const settled = await settleOrder(db, order.id, q.wxOrderId)
  return buildXmlReply(0, settled ? 'delivered' : 'idempotent')
}

// 查单兜底：CREATED 且 24h 内的订单，命中已支付即补发货
// 返回本次补发数量（0 表示无变化）
export async function reconcileVirtualOrders(
  db: Db,
  env: Env,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
  limit: number = 50
): Promise<number> {
  if (env.mpPayMode !== 'virtual' || !isVirtualPayReady(env)) return 0
  const rows = (await db
    .prepare(
      "SELECT id FROM orders WHERE status = 'CREATED' AND created_at > ? ORDER BY created_at ASC LIMIT ?"
    )
    .all(now() - maxAgeMs, limit)) as unknown[]

  let settled = 0
  for (const r of rows) {
    const id = String((r as any).id)
    const order = await getOrder(db, id)
    if (order == null) continue
    const openid = await resolveOpenid(db, order, '')
    if (openid.length === 0) continue
    const q = await queryVirtualOrder(env, openid, id)
    if (q == null) continue
    if (isRefundedStatus(q.status)) {
      await markRefunded(db, order)
      continue
    }
    if (!isPaidStatus(q.status)) continue
    if (q.orderFee !== order.amount) {
      console.warn('[virtual-notify] 对账金额不一致 order=' + id)
      continue
    }
    if (await settleOrder(db, id, q.wxOrderId)) settled++
  }
  return settled
}

// 定时器入口（仅在 server.ts 主流程启动；测试不启动，避免挂住进程）
export function startVirtualOrderReconciler(
  db: Db,
  env: Env,
  intervalMs: number = 5 * 60 * 1000
): NodeJS.Timeout | null {
  if (env.mpPayMode !== 'virtual' || !isVirtualPayReady(env)) return null
  console.log('[virtual-notify] 查单兜底已启动，间隔(ms)=' + String(intervalMs))
  const timer = setInterval(() => {
    void reconcileVirtualOrders(db, env)
      .then((n) => {
        if (n > 0) console.log('[virtual-notify] 兜底补发 ' + String(n) + ' 单')
      })
      .catch((e) => console.warn('[virtual-notify] 对账失败', e))
  }, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
  return timer
}
