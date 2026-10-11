// 埋点服务：批量接收前端补传队列，逐条解析落库（幂等去重，失败不阻塞）
// 2026-10-12 修复：tracking_events.user_id 为 BIGINT，此前直插字符串 uid
// 在 MySQL 严格模式（TDSQL-C）报 1265 被 catch 吞掉 → 云端埋点 100% 静默丢失。
// 现由路由层鉴权取得 uid 后，在此解析为 users.id 数值入库；未注册用户 user_id 落 NULL。
import { Db } from '../db.js'
import { now } from '../util.js'

export async function ingestEvents(db: Db, uid: string, events: string[]): Promise<number> {
  let ok = 0
  // uid → users.id（一次性解析，整批复用）
  let numericUserId: number | null = null
  if (uid.length > 0) {
    try {
      const row = (await db.prepare('SELECT id FROM users WHERE uid = ?').get(uid)) as
        { id: number } | undefined
      if (row != null) numericUserId = row.id
    } catch {
      // 解析失败不影响事件落库（user_id 为 NULL）
    }
  }
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO tracking_events (user_id, session_id, event, payload, platform, client_ts, server_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  for (const raw of events) {
    try {
      const body = JSON.parse(raw) as any
      if (body == null || typeof body.event !== 'string') continue
      const props = { ...body }
      delete props.event
      delete props.userId // 身份以鉴权 uid 为准，客户端上报值不入 payload
      delete props.sessionId
      delete props.platform
      delete props.timestamp
      try {
        await stmt.run(
          numericUserId,
          typeof body.sessionId === 'string' ? body.sessionId : '',
          body.event,
          JSON.stringify(props),
          typeof body.platform === 'string' ? body.platform : '',
          typeof body.timestamp === 'number' ? body.timestamp : 0,
          now()
        )
        ok++
      } catch {
        // 单条失败不阻塞批次
      }
    } catch {
      // 跳过无法解析的事件
    }
  }
  return ok
}
