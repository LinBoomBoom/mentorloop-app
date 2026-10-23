// 认证服务：短信发码 / 手机号登录 / 微信静默登录 + 新用户配额创建
import { Db } from '../db.js'
import { Env, DEFAULT_FREE_QUOTA } from '../config.js'
import { newId, now } from '../util.js'
import { AuthResult } from '../types/domain.js'
import { createDesktopGateway, syncDesktopLink } from './desktop-link.js'
import { wxApiFetch } from './wx-http.js'

export type UserRow = {
  id: number
  uid: string
  phone: string | null
  openid: string | null
  session_key: string | null
  session_key_updated_at: number | null
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
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?, ?)`
      )
      .run(
        newId('u'),
        key === 'phone' ? value : null,
        key === 'openid' ? value : null,
        nickname,
        channel,
        DEFAULT_FREE_QUOTA,
        t,
        t
      )
    row = (await db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(value)) as unknown
  }
  return rowToUser(row)
}

// 校验并消费短信验证码（登录与手机号绑定共用）。
// 必须存在已发送的记录且未过期未消费（不做"无记录也放行"的 mock 兜底，
// 万能码漏洞已于 2026-10-11 收紧；本地联调先调 /auth/sms-code 即可）
export async function consumeSmsCode(db: Db, phone: string, code: string): Promise<boolean> {
  const rec = (await db.prepare('SELECT * FROM sms_codes WHERE phone = ?').get(phone)) as
    { code: string; expires_at: number; consumed: number } | undefined
  const validRecord =
    rec != null && rec.code === code && rec.expires_at > now() && rec.consumed === 0
  if (!validRecord) return false
  await db.prepare('UPDATE sms_codes SET consumed = 1 WHERE phone = ?').run(phone)
  return true
}

export async function loginByPhone(
  db: Db,
  env: Env,
  phone: string,
  code: string
): Promise<AuthResult | null> {
  const okCode = await consumeSmsCode(db, phone, code)
  if (!okCode) return null

  const user = await findOrCreateUser(db, 'phone', 'phone', phone)
  await syncDesktopLink(db, createDesktopGateway(db, env), user) // 桌面账号互通（关闭时零开销）
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

// 微信身份绑定冲突（路由层转成 400，不静默换号）
export const BIND_OPENID_MISMATCH = 'OPENID_MISMATCH'

async function findUserByOpenid(db: Db, openid: string): Promise<UserRow | null> {
  const row = (await db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)) as unknown
  return row != null ? rowToUser(row) : null
}

async function writeSessionKey(db: Db, userId: number, sessionKey: string): Promise<void> {
  // 每次真实 code 登录覆盖刷新；仅服务端可见，绝不下发
  const t = now()
  await db
    .prepare(
      'UPDATE users SET session_key = ?, session_key_updated_at = ?, updated_at = ? WHERE id = ?'
    )
    .run(sessionKey, t, t, userId)
}

// 同一 openid 只允许一个账号持有。手机号账号首次绑定微信时，若 openid 已被另一个
// 账号占用（通常是启动静默登录自动创建的空壳，或历史遗留的微信账号），把对方的数据
// 与额度并入当前账号，再释放其微信身份 —— 一个微信账号最终只对应一个 uid。
// 说明：同一 openid 必然属于同一个微信用户，合并不会把两个人的数据混在一起。
async function mergeAccountInto(db: Db, owner: UserRow, target: UserRow): Promise<void> {
  const t = now()
  // 订单/面试/报告/简历/额度流水全部改挂到当前账号（埋点不迁移，避免唯一索引冲突）
  const tables: string[] = ['sessions', 'reports', 'resumes', 'resume_usages', 'orders']
  const memberUntil = Math.max(owner.member_until ?? 0, target.member_until ?? 0)
  const desktopUserId =
    target.desktop_user_id != null && target.desktop_user_id.length > 0
      ? target.desktop_user_id
      : owner.desktop_user_id
  await db.transaction(async () => {
    for (let i = 0; i < tables.length; i++) {
      await db
        .prepare('UPDATE ' + tables[i] + ' SET user_id = ? WHERE user_id = ?')
        .run(target.id, owner.id)
    }
    await db
      .prepare(
        `UPDATE users SET
           free_quota_used = ?,
           single_quota_total = ?,
           single_quota_used = ?,
           resume_single_total = ?,
           resume_single_used = ?,
           member_until = ?,
           desktop_user_id = ?,
           updated_at = ?
         WHERE id = ?`
      )
      .run(
        target.free_quota_used + owner.free_quota_used,
        target.single_quota_total + owner.single_quota_total,
        target.single_quota_used + owner.single_quota_used,
        target.resume_single_total + owner.resume_single_total,
        target.resume_single_used + owner.resume_single_used,
        memberUntil > 0 ? memberUntil : null,
        desktopUserId,
        t,
        target.id
      )
    // 释放被合并账号的身份键（保留行，避免历史引用悬空）
    await db
      .prepare(
        `UPDATE users SET
           phone = NULL,
           openid = NULL,
           session_key = NULL,
           session_key_updated_at = NULL,
           desktop_user_id = NULL,
           updated_at = ?
         WHERE id = ?`
      )
      .run(t, owner.id)
  })()
  console.warn(
    '[auth] 合并重复账号：owner=' +
      owner.uid +
      ' → target=' +
      target.uid +
      '（openid 归一到当前账号）'
  )
}

// 微信登录：openid 由路由层归一后入库；sessionKey 仅在拿到 code 真实换取时传入。
// openid 来源（路由层保证，见 routes/auth.ts §2.2）：
// 1) body.code → jscode2session 真实换取（需 WX_APPID + WX_SECRET；同时拿 session_key）
// 2) 云托管私有链路注入的 X-WX-OPENID（TRUST_WX_HEADERS=true 时采信，否则已被 app 层剥离）
// 3) 本地联调 WX_MOCK_LOGIN=true 时才允许 'wx_'+code 假 openid
//
// bindUid：请求携带有效 token 时由路由层传入。手机号登录账号本身没有 openid/session_key，
// 首次拉起虚拟支付会被 409 拦下并走「重登重试」；旧实现按 openid 另建/切换账号，
// 导致订单与权益落到另一个 uid。这里改为把微信身份绑定到当前账号，保持 uid 不变。
export async function loginByWechat(
  db: Db,
  env: Env,
  openid: string,
  sessionKey: string = '',
  bindUid: string = ''
): Promise<AuthResult> {
  if (bindUid.length > 0) {
    let me = await getUserByUid(db, bindUid)
    if (me != null) {
      if (me.openid != null && me.openid.length > 0) {
        // 已绑定：openid 必须一致；token 有效时顺手刷新 session_key
        if (me.openid !== openid) throw new Error(BIND_OPENID_MISMATCH)
        if (sessionKey.length > 0) await writeSessionKey(db, me.id, sessionKey)
        return { uid: me.uid, nickname: me.nickname, token: '' }
      }
      // 未绑定：openid 被另一个账号占用时，合并对方数据到当前账号并释放其微信身份，
      // 保证「一个微信账号只有一个 openid、一个 uid」。
      const owner = await findUserByOpenid(db, openid)
      if (owner != null && owner.uid !== bindUid) {
        await mergeAccountInto(db, owner, me)
        me = (await getUserByUid(db, bindUid)) ?? me
      }
      const t = now()
      if (sessionKey.length > 0) {
        await db
          .prepare(
            'UPDATE users SET openid = ?, session_key = ?, session_key_updated_at = ?, updated_at = ? WHERE id = ?'
          )
          .run(openid, sessionKey, t, t, me.id)
      } else {
        await db
          .prepare('UPDATE users SET openid = ?, updated_at = ? WHERE id = ?')
          .run(openid, t, me.id)
      }
      me.openid = openid // 桌面互通读内存对象，需与落库一致
      await syncDesktopLink(db, createDesktopGateway(db, env), me)
      return { uid: me.uid, nickname: me.nickname, token: '' }
    }
  }

  const user = await findOrCreateUser(db, 'wechat', 'openid', openid)
  if (sessionKey.length > 0) await writeSessionKey(db, user.id, sessionKey)
  await syncDesktopLink(db, createDesktopGateway(db, env), user) // openid → 桌面 auth_identities 预留
  return { uid: user.uid, nickname: user.nickname, token: '' }
}

export type WxSession = {
  openid: string
  sessionKey: string // 虚拟支付用户态签名用；仅服务端持有
}

// jscode2session 结果：errcode=0 成功；>0 微信侧错误码；-1 网络/非 2xx；-2 凭据未配置
export type WxSessionAttempt = {
  session: WxSession | null
  errcode: number
}
export const WX_ERR_NETWORK = -1
export const WX_ERR_NOT_CONFIGURED = -2

// jscode2session：临时 code 换 openid + session_key（真实微信身份）。
// 必须走 wxApiFetch：云托管容器内到 api.weixin.qq.com 的流量被「云调用」网关接管，
// 网关自签证书会让裸 fetch 直接 TLS 失败（此前真机/工具都报「微信登录失败」即此因）。
// 失败（网络/微信侧错误）返回 session=null + errcode，由路由层决定拒绝；
// 不打日志泄漏 code / session_key。
export async function code2SessionAttempt(env: Env, code: string): Promise<WxSessionAttempt> {
  if (env.wxAppId.length === 0 || env.wxSecret.length === 0) {
    return { session: null, errcode: WX_ERR_NOT_CONFIGURED } as WxSessionAttempt
  }
  try {
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(env.wxAppId)}` +
      `&secret=${encodeURIComponent(env.wxSecret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code'
    const res = await wxApiFetch({ url: url, method: 'GET', timeoutMs: 10000 })
    if (res.status < 200 || res.status >= 300) {
      return { session: null, errcode: WX_ERR_NETWORK } as WxSessionAttempt
    }
    let data: any = null
    try {
      data = JSON.parse(res.body)
    } catch {
      console.warn('[auth] jscode2session invalid json')
      return { session: null, errcode: WX_ERR_NETWORK } as WxSessionAttempt
    }
    if (data == null || typeof data.openid !== 'string' || data.openid.length === 0) {
      const ec = data != null && typeof data.errcode === 'number' ? data.errcode : WX_ERR_NETWORK
      console.warn('[auth] jscode2session failed, errcode =', ec)
      return { session: null, errcode: ec } as WxSessionAttempt
    }
    const sessionKey = typeof data.session_key === 'string' ? data.session_key : ''
    if (sessionKey.length === 0) {
      console.warn('[auth] jscode2session returned empty session_key')
    }
    return {
      session: { openid: data.openid, sessionKey } as WxSession,
      errcode: 0
    } as WxSessionAttempt
  } catch (e: any) {
    // 网络层失败（DNS/出网/TLS）：把底层 code 打进日志，便于云端定位（不含密钥）
    const cause = e != null && e.cause != null ? e.cause : null
    const detail =
      cause != null
        ? String(cause.code ?? cause.message ?? cause)
        : e != null
          ? String(e.message ?? e)
          : 'unknown'
    console.warn('[auth] jscode2session request failed', detail)
    return { session: null, errcode: WX_ERR_NETWORK } as WxSessionAttempt
  }
}

export async function code2Session(env: Env, code: string): Promise<WxSession | null> {
  return (await code2SessionAttempt(env, code)).session
}

// 虚拟支付会话密钥读取：仅服务端调用，禁止经路由下发。
export type SessionKeyInfo = { sessionKey: string; updatedAt: number }

export async function getSessionKey(db: Db, uid: string): Promise<SessionKeyInfo | null> {
  const row = (await db
    .prepare('SELECT session_key, session_key_updated_at FROM users WHERE uid = ?')
    .get(uid)) as
    { session_key?: string | null; session_key_updated_at?: number | null } | undefined
  if (row == null || typeof row.session_key !== 'string' || row.session_key.length === 0) {
    return null
  }
  return { sessionKey: row.session_key, updatedAt: Number(row.session_key_updated_at ?? 0) }
}

// 保守新鲜度窗口：客户端下单前会用 wx.login 刷新，这里只做兜底；
// WeChat 侧无公开固定 TTL，24h 仅用于避免使用明显陈旧的密钥。
export const SESSION_KEY_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function getFreshSessionKey(
  db: Db,
  uid: string,
  maxAgeMs: number = SESSION_KEY_MAX_AGE_MS
): Promise<string | null> {
  const info = await getSessionKey(db, uid)
  if (info == null) return null
  if (info.updatedAt > 0 && now() - info.updatedAt > maxAgeMs) return null
  return info.sessionKey
}

export async function getUserByUid(db: Db, uid: string): Promise<UserRow | null> {
  const row = await db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
  return row != null ? rowToUser(row) : null
}

// 手机号已被其他账号占用（路由层转成 409，不覆盖原归属）
export const PHONE_TAKEN = 'PHONE_TAKEN'

// 把手机号绑定到当前登录账号（不新建账号、不切换 uid、不签发新 token）。
// 契约：docs/contracts/2026-10-23-phone-binding.freeze.md
export async function bindPhoneToUser(db: Db, uid: string, phone: string): Promise<UserRow | null> {
  const me = await getUserByUid(db, uid)
  if (me == null) return null
  // 幂等：已绑定同一手机号直接返回（不重复校验验证码、不改归属）
  if (me.phone === phone) return me

  let conflict = false
  await db.transaction(async () => {
    const owner = (await db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) as
      { id: number } | undefined
    if (owner != null && owner.id !== me.id) {
      conflict = true
      return
    }
    await db
      .prepare('UPDATE users SET phone = ?, updated_at = ? WHERE id = ?')
      .run(phone, now(), me.id)
  })()

  if (conflict) throw new Error(PHONE_TAKEN)
  return getUserByUid(db, uid)
}
