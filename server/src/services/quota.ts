// 配额与权益服务（服务端权威账本；字段与前端 fetchQuota 对齐）
// 扣减规则与前端 store/quota.uts 一致：会员不扣 → 先扣单次包 → 再扣免费额度。
import { Db } from '../db.js'
import { UserRow } from './auth.js'

export type QuotaView = {
  freeInterviewsLeft: number
  singleCreditsLeft: number
  memberUntil: number
}

export function isMember(u: UserRow): boolean {
  if (u.member_until != null && u.member_until > Date.now()) return true
  return false
}

export function getQuota(u: UserRow): QuotaView {
  return {
    freeInterviewsLeft: Math.max(0, u.free_quota_total - u.free_quota_used),
    singleCreditsLeft: Math.max(0, u.single_quota_total - u.single_quota_used),
    memberUntil: u.member_until ?? 0
  }
}

// 完成一场面试后扣减（报告生成时由 report 服务调用）
export function consumeInterview(db: Db, uid: string): void {
  const u = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as UserRow | undefined
  if (u == null) return
  if (isMember(u)) return
  const singleLeft = Math.max(0, u.single_quota_total - u.single_quota_used)
  if (singleLeft > 0) {
    db.prepare(
      'UPDATE users SET single_quota_used = single_quota_used + 1, updated_at = ? WHERE uid = ?'
    ).run(Date.now(), uid)
    return
  }
  const freeLeft = Math.max(0, u.free_quota_total - u.free_quota_used)
  if (freeLeft > 0) {
    db.prepare(
      'UPDATE users SET free_quota_used = free_quota_used + 1, updated_at = ? WHERE uid = ?'
    ).run(Date.now(), uid)
  }
}
