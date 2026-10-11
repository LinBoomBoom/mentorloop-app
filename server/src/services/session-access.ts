// 会话属主校验（IDOR 防护）：所有按 sessionId 的操作必须先确认属主。
// "不存在"与"非本人"统一抛 SESSION_NOT_FOUND（路由映射 404），避免会话 id 探测。
import { Db } from '../db.js'

export async function requireSessionOwner(db: Db, sessionId: string, uid: string): Promise<void> {
  const row = (await db
    .prepare(
      'SELECT u.uid AS owner_uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?'
    )
    .get(sessionId)) as { owner_uid: string } | undefined
  if (row == null || row.owner_uid !== uid) {
    throw new Error('SESSION_NOT_FOUND')
  }
}
