// 简历额度单测：会员月度上限 / 单次包条件扣减 / 免费预览日上限 / 失败回滚
import { beforeEach, describe, expect, it } from 'vitest'
import { Db } from './db.js'
import type { Env } from './config.js'
import {
  getResumeQuota,
  refundResumeQuota,
  reserveFullReview,
  reservePreview
} from './services/resume-quota.js'

const env = { resumeMemberMonthlyQuota: 2, resumeFreePreviewDaily: 2 } as Env
let db: Db

async function makeUser(uid: string, extra: { memberUntil?: number; singleTotal?: number } = {}) {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO users (uid, channel, resume_single_total, member_until, created_at, updated_at)
       VALUES (?, 'phone', ?, ?, ?, ?)`
    )
    .run(uid, extra.singleTotal ?? 0, extra.memberUntil ?? null, now, now)
}

beforeEach(async () => {
  db = new Db(':memory:', null)
  await makeUser('u_free')
  await makeUser('u_member', { memberUntil: Date.now() + 86400000 })
  await makeUser('u_single', { singleTotal: 1 })
})

describe('resume quota', () => {
  it('免费用户无完整评审额度，但可预览；预览达日上限后拒绝', async () => {
    const q = await getResumeQuota(db, env, 'u_free')
    expect(q.canFull).toBe(false)
    expect(q.freePreviewLeftToday).toBe(2)

    expect(await reserveFullReview(db, env, 'u_free')).toBeNull()
    const p1 = await reservePreview(db, env, 'u_free')
    const p2 = await reservePreview(db, env, 'u_free')
    expect(p1).not.toBeNull()
    expect(p2).not.toBeNull()
    expect(await reservePreview(db, env, 'u_free')).toBeNull()
    expect((await getResumeQuota(db, env, 'u_free')).freePreviewLeftToday).toBe(0)
  })

  it('会员月度额度：2 次后拒绝；回滚后恢复 1 次', async () => {
    const t1 = await reserveFullReview(db, env, 'u_member')
    const t2 = await reserveFullReview(db, env, 'u_member')
    expect(t1 != null && t1.kind).toBe('member')
    expect(t2 != null && t2.kind).toBe('member')
    expect(await reserveFullReview(db, env, 'u_member')).toBeNull()
    expect((await getResumeQuota(db, env, 'u_member')).memberMonthlyLeft).toBe(0)

    await refundResumeQuota(db, 'u_member', t2!)
    expect((await getResumeQuota(db, env, 'u_member')).memberMonthlyLeft).toBe(1)
  })

  it('单次包：条件扣减防超扣；失败回滚', async () => {
    const t = await reserveFullReview(db, env, 'u_single')
    expect(t != null && t.kind).toBe('single')
    expect((await getResumeQuota(db, env, 'u_single')).singleLeft).toBe(0)
    expect(await reserveFullReview(db, env, 'u_single')).toBeNull()

    await refundResumeQuota(db, 'u_single', t!)
    expect((await getResumeQuota(db, env, 'u_single')).singleLeft).toBe(1)
  })

  it('并发扣减单次包不会超发', async () => {
    const results = await Promise.all([
      reserveFullReview(db, env, 'u_single'),
      reserveFullReview(db, env, 'u_single'),
      reserveFullReview(db, env, 'u_single')
    ])
    expect(results.filter((x) => x != null).length).toBe(1)
  })
})
