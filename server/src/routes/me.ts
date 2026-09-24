// 我的数据路由：随账号同步的跨设备数据（报告历史）
import { FastifyInstance } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { okData } from '../util.js'

const MAX_REPORTS = 20

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  // 我的报告历史（跨设备同步）：按生成时间倒序，与前端 ReportRecord 结构一致
  app.get('/me/reports', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const rows = db
      .prepare(
        `SELECT r.session_id, r.generated_at, r.payload
           FROM reports r
           JOIN users u ON u.id = r.user_id
           WHERE u.uid = ?
           ORDER BY r.generated_at DESC
           LIMIT ?`
      )
      .all(uid, MAX_REPORTS) as unknown[]
    const list = rows.map((r: any) => ({
      sessionId: r.session_id,
      at: r.generated_at,
      report: JSON.parse(r.payload)
    }))
    return okData(list)
  })
}
