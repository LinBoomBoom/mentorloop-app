// 认证服务：短信发码 / 手机号登录 / 微信静默登录 + 新用户配额创建
import { Db } from '../db.js'
import { Env } from '../config.js'
import { newId, now } from '../util.js'
import { AuthResult } from '../types/domain.js'

export type UserRow = {
  id: number
  uid: string
  phone: string | null
  openid: string | null
  nickname: string
  channel: string
  free_quota_total: number
  free_quota_used: number
  single_quota_total: number
  single_quota_used: number
  member_until: number | null
  created_at: number
  updated_at: number
}

function rowToUser(row: unknown): UserRow {
  return row as UserRow
}

export function sendSmsCode(db: Db, env: Env, phone: string): boolean {
  if (phone.length !== 11) return false
  const expiresAt = now() + env.smsTtlMs
  db.prepare(
    `INSERT INTO sms_codes (phone, code, expires_at, consumed) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, consumed = 0`
  ).run(phone, env.mockSmsCode, expiresAt)
  return true
}

function findOrCreateUser(
  db: Db,
  channel: string,
  key: 'phone' | 'openid',
  value: string
): UserRow {
  const col = key === 'phone' ? 'phone' : 'openid'
  let row = db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(value) as unknown
  if (row == null) {
    const t = now()
    const nickname = key === 'phone' ? '用户' + value.slice(-4) : '微信用户'
    db.prepare(
      `INSERT INTO users (uid, phone, openid, nickname, channel, free_quota_total, free_quota_used, single_quota_total, single_quota_used, member_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 3, 0, 0, 0, NULL, ?, ?)`
    ).run(
      newId('u'),
      key === 'phone' ? value : null,
      key === 'openid' ? value : null,
      nickname,
      channel,
      t,
      t
    )
    row = db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(value) as unknown
  }
  return rowToUser(row)
}

export function loginByPhone(db: Db, env: Env, phone: string, code: string): AuthResult | null {
  // 记录校验：存在且未过期未消费，且 code 匹配；无记录时用配置的 mock 码兜底
  const rec = db.prepare('SELECT * FROM sms_codes WHERE phone = ?').get(phone) as
    { code: string; expires_at: number; consumed: number } | undefined
  const validRecord =
    rec != null && rec.code === code && rec.expires_at > now() && rec.consumed === 0
  const mockFallback = rec == null && code === env.mockSmsCode
  if (!validRecord && !mockFallback) return null

  if (validRecord) {
    db.prepare('UPDATE sms_codes SET consumed = 1 WHERE phone = ?').run(phone)
  }
  const user = findOrCreateUser(db, 'phone', 'phone', phone)
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

export function loginByWechat(db: Db, _env: Env, code: string): AuthResult {
  const openid = 'wx_' + code
  const user = findOrCreateUser(db, 'wechat', 'openid', openid)
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

export function getUserByUid(db: Db, uid: string): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
  return row != null ? rowToUser(row) : null
}
