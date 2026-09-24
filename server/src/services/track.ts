// 埋点服务：批量接收前端补传队列，逐条解析落库（幂等去重，失败不阻塞）
import { Db } from '../db.js'
import { now } from '../util.js'

export function ingestEvents(db: Db, events: string[]): number {
  let ok = 0
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
      delete props.userId
      delete props.sessionId
      delete props.platform
      delete props.timestamp
      try {
        stmt.run(
          typeof body.userId === 'string' && body.userId.length > 0 ? body.userId : null,
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
