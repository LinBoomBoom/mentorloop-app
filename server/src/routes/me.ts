// 我的数据路由：随账号同步的跨设备数据（报告历史）+ 账号自助删除
import { FastifyInstance } from 'fastify'
import { unlinkSync } from 'node:fs'
import { requireAuth } from './auth-guard.js'
import { getUserByUid } from '../services/auth.js'
import { okData, ok } from '../util.js'

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

  // 账号自助删除（合规红线）：级联清理该用户全部数据 + 磁盘简历文件；幂等（重复调用仍返回 ok）
  app.delete('/me/account', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const user = getUserByUid(db, uid)
    if (user == null) return ok() // 已删除：幂等

    const env = (app as any).env as import('../config.js').Env
    const userId = user.id

    // 磁盘简历文件先收集（删表前），original_url 格式为 'resumes/<rel>'（/resume/parse 直存任意字符串，需容错）
    const resumeRows = db
      .prepare('SELECT original_url FROM resumes WHERE user_id = ?')
      .all(userId) as unknown[]
    const files: string[] = []
    for (const row of resumeRows) {
      const url = (row as any).original_url as string | null
      if (url != null && url.startsWith('resumes/')) {
        files.push(env.uploadDir + '/' + url.substring('resumes/'.length))
      }
    }

    // 级联清理（PRAGMA foreign_keys = ON，先子后父）
    db.prepare('DELETE FROM tracking_events WHERE user_id = ?').run(userId)
    db.prepare(
      'DELETE FROM answers WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)'
    ).run(userId)
    db.prepare(
      'DELETE FROM session_asked WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)'
    ).run(userId)
    db.prepare('DELETE FROM reports WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM resumes WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sms_codes WHERE phone = ?').run(user.phone ?? '')
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    // 删除磁盘简历文件（文件不存在则忽略，不抛错）
    for (const f of files) {
      try {
        unlinkSync(f)
      } catch {
        // ignore
      }
    }
    return ok()
  })
}
