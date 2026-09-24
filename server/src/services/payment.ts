// 支付与权益服务（P1.3）：下单 / 权益发放 / 订单状态机与幂等
// 金额以服务端 data/skus.ts 为准，仅认 skuId；发放与状态迁移在同一事务内，
// 通过「原子迁移 CREATED→PAID」保证回调幂等（重复回调只发放一次）。
import { Db } from '../db.js'
import { newId, now } from '../util.js'
import { getSku } from '../data/skus.js'
import { UserRow } from './auth.js'
import { isMember } from './quota.js'

export type OrderRow = {
  id: string
  user_id: number
  sku_id: string
  sku_kind: string
  amount: number
  status: string
  transaction_id: string | null
  paid_at: number | null
  created_at: number
}

const DAY_MS = 86400000

export function createOrder(db: Db, userId: number, skuId: string): OrderRow {
  const sku = getSku(skuId)
  if (sku == null) throw new Error('SKU_NOT_FOUND')
  const orderId = newId('o')
  db.prepare(
    `INSERT INTO orders (id, user_id, sku_id, sku_kind, amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'CREATED', ?)`
  ).run(orderId, userId, sku.id, sku.kind, sku.priceCent, now())
  return getOrder(db, orderId) as OrderRow
}

export function getOrder(db: Db, orderId: string): OrderRow | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  return row != null ? (row as OrderRow) : null
}

// 用户可见订单状态（含归属校验）
export function getOrderForUser(db: Db, userId: number, orderId: string): OrderRow | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId)
  return row != null ? (row as OrderRow) : null
}

// 发放权益（member 叠加 member_until；single 累加剩余场次）
function grantBenefit(db: Db, order: OrderRow): void {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id) as
    UserRow | undefined
  if (user == null) return
  const sku = getSku(order.sku_id)
  if (sku == null) return
  const t = now()
  if (sku.kind === 'member') {
    const base = isMember(user) && user.member_until != null ? user.member_until : t
    db.prepare('UPDATE users SET member_until = ?, updated_at = ? WHERE id = ?').run(
      base + sku.memberDays * DAY_MS,
      t,
      order.user_id
    )
  } else {
    db.prepare(
      'UPDATE users SET single_quota_total = single_quota_total + ?, updated_at = ? WHERE id = ?'
    ).run(sku.singleCount, t, order.user_id)
  }
}

// mock 支付：下单即支付成功并发放（本地零配置可跑）
export function payOrderMock(
  db: Db,
  userId: number,
  skuId: string
): { orderId: string; amount: number } {
  const order = createOrder(db, userId, skuId)
  db.exec('BEGIN')
  try {
    const r = db
      .prepare("UPDATE orders SET status='PAID', paid_at = ? WHERE id = ? AND status = 'CREATED'")
      .run(now(), order.id)
    if (r.changes > 0) grantBenefit(db, order)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { orderId: order.id, amount: order.amount }
}

// 微信回调结算：原子迁移 CREATED→PAID，成功后发放；重复回调返回 false（不重复发放）
// 返回 true 表示本次完成发放；false 表示订单已处理（幂等）。
export function settleOrder(db: Db, orderId: string, transactionId: string): boolean {
  db.exec('BEGIN')
  try {
    const r = db
      .prepare(
        "UPDATE orders SET status='PAID', paid_at = ?, transaction_id = ? WHERE id = ? AND status = 'CREATED'"
      )
      .run(now(), transactionId, orderId)
    if (r.changes === 0) {
      db.exec('COMMIT')
      return false
    }
    const order = getOrder(db, orderId)
    if (order != null) grantBenefit(db, order)
    db.exec('COMMIT')
    return true
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
