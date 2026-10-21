// 认证服务：短信发码 / 手机号登录 / 微信静默登录 + 新用户配额创建
import { Db } from '../db.js'
import { Env } from '../config.js'
import { newId, now } from '../util.js'
import { AuthResult } from '../types/domain.js'
import { createDesktopGateway, syncDesktopLink } from './desktop-link.js'

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
  resume_single_total: number
  resume_single_used: number
  member_until: number | null
  desktop_user_id: string | null
  created_at: number
  updated_at: number
}

function rowToUser(row: unknown): UserRow {
  return row as UserRow
}

export async function sendSmsCode(db: Db, env: Env, phone: string): Promise<boolean> {
  if (phone.length !== 11) return false
  const expiresAt = now() + env.smsTtlMs
  await db
    .prepare(
      `INSERT INTO sms_codes (phone, code, expires_at, consumed) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, consumed = 0`
    )
    .run(phone, env.mockSmsCode, expiresAt)
  return true
}

async function findOrCreateUser(
  db: Db,
  channel: string,
  key: 'phone' | 'openid',
  value: string
): Promise<UserRow> {
  const col = key === 'phone' ? 'phone' : 'openid'
  let row = (await db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(value)) as unknown
  if (row == null) {
    const t = now()
    const nickname = key === 'phone' ? '用户' + value.slice(-4) : '微信用户'
    await db
      .prepare(
        `INSERT INTO users (uid, phone, openid, nickname, channel, free_quota_total, free_quota_used, single_quota_total, single_quota_used, member_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 3, 0, 0, 0, NULL, ?, ?)`
      )
      .run(
        newId('u'),
        key === 'phone' ? value : null,
        key === 'openid' ? value : null,
        nickname,
        channel,
        t,
        t
      )
    row = (await db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(value)) as unknown
  }
  return rowToUser(row)
}

export async function loginByPhone(
  db: Db,
  env: Env,
  phone: string,
  code: string
): Promise<AuthResult | null> {
  // 验证码校验：必须存在已发送的记录且未过期未消费（不做"无记录也放行"的 mock 兜底，
  // 万能码漏洞已于 2026-10-11 收紧；本地联调先调 /auth/sms-code 即可）
  const rec = (await db.prepare('SELECT * FROM sms_codes WHERE phone = ?').get(phone)) as
    { code: string; expires_at: number; consumed: number } | undefined
  const validRecord =
    rec != null && rec.code === code && rec.expires_at > now() && rec.consumed === 0
  if (!validRecord) return null

  await db.prepare('UPDATE sms_codes SET consumed = 1 WHERE phone = ?').run(phone)
  const user = await findOrCreateUser(db, 'phone', 'phone', phone)
  await syncDesktopLink(db, createDesktopGateway(db, env), user) // 桌面账号互通（关闭时零开销）
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

// 微信登录：openid 由路由层归一后入库。
// openid 来源（路由层保证，见 routes/auth.ts §2.2）：
// 1) 云托管私有链路注入的 X-WX-OPENID（TRUST_WX_HEADERS=true 时采信，否则已被 app 层剥离）
// 2) body.code → jscode2session 真实换取（需 WX_APPID + WX_SECRET）
// 3) 本地联调 WX_MOCK_LOGIN=true 时才允许 'wx_'+code 假 openid
export async function loginByWechat(db: Db, env: Env, openid: string): Promise<AuthResult> {
  const user = await findOrCreateUser(db, 'wechat', 'openid', openid)
  await syncDesktopLink(db, createDesktopGateway(db, env), user) // openid → 桌面 auth_identities 预留
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

// jscode2session：临时 code 换 openid（真实微信身份）。
// 失败（网络/微信侧错误）返回 null，由路由层决定拒绝；不打日志泄漏 code。
export async function code2Session(env: Env, code: string): Promise<string | null> {
  if (env.wxAppId.length === 0 || env.wxSecret.length === 0) return null
  try {
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(env.wxAppId)}` +
      `&secret=${encodeURIComponent(env.wxSecret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code'
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return null
    const data = (await res.json()) as { openid?: string; errcode?: number }
    if (data == null || typeof data.openid !== 'string' || data.openid.length === 0) {
      console.warn('[auth] jscode2session failed, errcode =', data?.errcode ?? 'unknown')
      return null
    }
    return data.openid
  } catch (e) {
    console.warn('[auth] jscode2session request failed', e instanceof Error ? e.message : e)
    return null
  }
}

export async function getUserByUid(db: Db, uid: string): Promise<UserRow | null> {
  const row = await db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
  return row != null ? rowToUser(row) : null
}
