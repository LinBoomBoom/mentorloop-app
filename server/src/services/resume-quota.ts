// 简历评审额度：会员每自然月 N 次 + 单次包次数；免费用户每日预览次数
// 规则：
//   - 完整评审（full）：会员月度额度优先，其次单次包；两者都无 → 拒绝
//   - 预览（preview）：免费用户每日上限；不消耗会员/单次包
//   - 先预扣、失败回滚（LLM 失败不扣费）；月度/每日按中国时区（UTC+8）自然周期
import { Db } from '../db.js'
import type { Env } from '../config.js'
import type { UserRow } from './auth.js'
import type { ResumeQuota } from '../types/domain.js'

const CN_OFFSET_MS = 8 * 3600 * 1000

export type QuotaToken = { kind: 'member' | 'single' | 'preview'; usageId: number }

function startOfMonthCn(ts: number = Date.now()): number {
  const d = new Date(ts + CN_OFFSET_MS)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - CN_OFFSET_MS
}

function startOfDayCn(ts: number = Date.now()): number {
  const d = new Date(ts + CN_OFFSET_MS)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - CN_OFFSET_MS
}

async function getUser(db: Db, uid: string): Promise<UserRow | null> {
  const row = await db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
  return row != null ? (row as UserRow) : null
}

async function countUsage(
  db: Db,
  userId: number,
  mode: 'member' | 'preview',
  since: number
): Promise<number> {
  const row = (await db
    .prepare(
      'SELECT COUNT(*) AS c FROM resume_usages WHERE user_id = ? AND mode = ? AND created_at >= ?'
    )
    .get(userId, mode, since)) as any
  return Number(row != null ? (row.c ?? 0) : 0)
}

export async function getResumeQuota(db: Db, env: Env, uid: string): Promise<ResumeQuota> {
  const user = await getUser(db, uid)
  if (user == null) {
    return {
      memberMonthlyTotal: env.resumeMemberMonthlyQuota,
      memberMonthlyLeft: 0,
      singleLeft: 0,
      freePreviewLeftToday: 0,
      canFull: false
    } as ResumeQuota
  }
  const now = Date.now()
  const member = user.member_until != null && user.member_until > now
  const monthUsed = member ? await countUsage(db, user.id, 'member', startOfMonthCn(now)) : 0
  const previewUsed = await countUsage(db, user.id, 'preview', startOfDayCn(now))
  const memberLeft = member ? Math.max(0, env.resumeMemberMonthlyQuota - monthUsed) : 0
  const singleLeft = Math.max(0, user.resume_single_total - user.resume_single_used)
  return {
    memberMonthlyTotal: env.resumeMemberMonthlyQuota,
    memberMonthlyLeft: memberLeft,
    singleLeft: singleLeft,
    freePreviewLeftToday: Math.max(0, env.resumeFreePreviewDaily - previewUsed),
    canFull: memberLeft > 0 || singleLeft > 0
  } as ResumeQuota
}

// 预扣完整评审额度：会员月度 → 单次包；无可用额度返回 null
export async function reserveFullReview(db: Db, env: Env, uid: string): Promise<QuotaToken | null> {
  const user = await getUser(db, uid)
  if (user == null) return null
  const now = Date.now()
  const member = user.member_until != null && user.member_until > now

  if (member) {
    // 月度额度：计数+插入放在同一事务，避免并发超发（单实例/云端事务均可用）
    const token = await db.transaction(async (): Promise<QuotaToken | null> => {
      const used = await countUsage(db, user.id, 'member', startOfMonthCn(now))
      if (used >= env.resumeMemberMonthlyQuota) return null
      const r = await db
        .prepare('INSERT INTO resume_usages (user_id, mode, created_at) VALUES (?, ?, ?)')
        .run(user.id, 'member', now)
      return r.changes > 0 ? ({ kind: 'member', usageId: r.lastInsertRowid } as QuotaToken) : null
    })()
    if (token != null) return token
  }

  // 单次包：条件更新保证不超扣
  const r = await db
    .prepare(
      `UPDATE users SET resume_single_used = resume_single_used + 1, updated_at = ?
       WHERE uid = ? AND resume_single_used < resume_single_total`
    )
    .run(now, uid)
  if (r.changes > 0) return { kind: 'single', usageId: 0 } as QuotaToken
  return null
}

// 免费预览额度：每日上限
export async function reservePreview(db: Db, env: Env, uid: string): Promise<QuotaToken | null> {
  const user = await getUser(db, uid)
  if (user == null) return null
  const now = Date.now()
  const token = await db.transaction(async (): Promise<QuotaToken | null> => {
    const used = await countUsage(db, user.id, 'preview', startOfDayCn(now))
    if (used >= env.resumeFreePreviewDaily) return null
    const r = await db
      .prepare('INSERT INTO resume_usages (user_id, mode, created_at) VALUES (?, ?, ?)')
      .run(user.id, 'preview', now)
    return r.changes > 0 ? ({ kind: 'preview', usageId: r.lastInsertRowid } as QuotaToken) : null
  })()
  return token
}

// 失败回滚：完整评审不扣费；预览不占当日次数
export async function refundResumeQuota(db: Db, uid: string, token: QuotaToken): Promise<void> {
  if (token.kind === 'single') {
    await db
      .prepare(
        `UPDATE users SET resume_single_used =
           CASE WHEN resume_single_used > 0 THEN resume_single_used - 1 ELSE 0 END,
         updated_at = ? WHERE uid = ?`
      )
      .run(Date.now(), uid)
    return
  }
  if (token.usageId > 0) {
    await db
      .prepare(
        'DELETE FROM resume_usages WHERE id = ? AND user_id = (SELECT id FROM users WHERE uid = ?)'
      )
      .run(token.usageId, uid)
  }
}
