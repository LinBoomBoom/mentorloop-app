// 桌面端账号互通服务（桌面→MP 单向权益；PO 裁决：跨库只读直查，不动桌面仓库）
// 绑定键：MP phone → 桌面 users.phone（主）；MP openid → 桌面 auth_identities(provider='wechat')（预留，
// 桌面端当前无微信登录写入，实际打通以手机号为主）
// 权益映射：桌面 effectiveVip 同义规则（level>0 且未过期；expireAt 空=长期有效）→ member_until，与本地取 max
// 任何失败不抛出：互通是增强项，不得阻塞登录/配额主流程
import { Db } from '../db.js'
import { Env } from '../config.js'
import type { UserRow } from './auth.js'

// 桌面端 expireAt 为空（长期会员）时写入 MP 的 member_until 哨兵：2100-01-01
export const LONG_TERM_VIP_UNTIL = 4102416000000

export type DesktopIdentity = { id: string; vip: unknown }

export type DesktopGateway = {
  findUsersByPhone(phone: string): Promise<DesktopIdentity[]>
  findUsersByWechatOpenid(openid: string): Promise<DesktopIdentity[]>
}

export function linkEnabled(env: Env): boolean {
  return env.desktopDbName.length > 0
}

// 创建跨库只读网关；未配置或库名非法返回 null（调用方按"互通关闭"处理）
export function createDesktopGateway(db: Db, env: Env): DesktopGateway | null {
  if (!linkEnabled(env)) return null
  const d = env.desktopDbName
  if (!/^[A-Za-z0-9_]+$/.test(d)) {
    console.warn('[desktop-link] DESKTOP_DB_NAME 非法标识符，互通关闭：', d)
    return null
  }
  return {
    // 桌面 users.phone 是普通 KEY 非唯一：可能多行，调用方仅唯一命中才绑定
    findUsersByPhone: async (phone: string) =>
      (await db
        .prepare(`SELECT id, vip FROM ${d}.users WHERE phone = ?`)
        .all(phone)) as unknown as DesktopIdentity[],
    findUsersByWechatOpenid: async (openid: string) =>
      (await db
        .prepare(
          `SELECT u.id AS id, u.vip AS vip FROM ${d}.auth_identities a JOIN ${d}.users u ON u.id = a.user_id
           WHERE a.provider = 'wechat' AND a.provider_uid = ?`
        )
        .all(openid)) as unknown as DesktopIdentity[]
  }
}

// 解析桌面 vip JSON（与桌面 effectiveVip 容错语义一致：解析失败/形态异常视为非会员）
// 桌面列为 MySQL JSON 类型（mysql2 可能返回对象或字符串），两种形态都接受
export function parseDesktopVip(vip: unknown): { level: number; expireAt: number | null } {
  if (vip == null) return { level: 0, expireAt: null }
  try {
    const v: unknown = typeof vip === 'string' ? JSON.parse(vip) : vip
    if (v == null || typeof v !== 'object') return { level: 0, expireAt: null }
    const o = v as Record<string, unknown>
    const level = Number(o.level ?? 0) || 0
    const expireAt = o.expireAt == null ? null : Number(o.expireAt)
    return { level, expireAt: expireAt != null && Number.isFinite(expireAt) ? expireAt : null }
  } catch {
    return { level: 0, expireAt: null }
  }
}

// 桌面 effectiveVip → MP member_until 值；0 = 桌面非会员（不映射权益）
export function desktopMemberUntil(vip: unknown): number {
  const v = parseDesktopVip(vip)
  if (v.level <= 0) return 0
  if (v.expireAt == null) return LONG_TERM_VIP_UNTIL
  if (v.expireAt <= Date.now()) return 0
  return v.expireAt
}

// 绑定桌面身份 + 单向权益同步（幂等：重复调用结果一致；权益取 max 不回退）。
// 原地更新传入 user 的 desktop_user_id / member_until，调用方无需重查即可拿到最新值。
export async function syncDesktopLink(
  db: Db,
  gateway: DesktopGateway | null,
  user: UserRow
): Promise<void> {
  if (gateway == null) return
  try {
    let hits: DesktopIdentity[] = []
    if (user.phone != null && user.phone.length > 0) {
      hits = await gateway.findUsersByPhone(user.phone)
    } else if (user.openid != null && user.openid.length > 0) {
      hits = await gateway.findUsersByWechatOpenid(user.openid)
    } else {
      return
    }
    if (hits.length > 1) {
      console.warn('[desktop-link] 桌面身份多命中，放弃绑定（phone=%s）', user.phone ?? '')
      return
    }
    if (hits.length === 0) return // 桌面无此用户：保持 MP 独立账号，不影响登录

    const hit = hits[0]
    if (user.desktop_user_id !== hit.id) {
      await db
        .prepare('UPDATE users SET desktop_user_id = ?, updated_at = ? WHERE id = ?')
        .run(hit.id, Date.now(), user.id)
      user.desktop_user_id = hit.id
    }
    const until = desktopMemberUntil(hit.vip)
    if (until > (user.member_until ?? 0)) {
      await db
        .prepare('UPDATE users SET member_until = ?, updated_at = ? WHERE id = ?')
        .run(until, Date.now(), user.id)
      user.member_until = until
    }
  } catch (e) {
    console.warn('[desktop-link] 同步失败（不阻塞主流程）', e)
  }
}
