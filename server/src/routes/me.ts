// 我的数据路由：随账号同步的跨设备数据（报告历史）+ 账号自助删除
import { FastifyInstance } from 'fastify'
import { unlinkSync } from 'node:fs'
import { requireAuth } from './auth-guard.js'
import { getUserByUid, consumeSmsCode, bindPhoneToUser, PHONE_TAKEN } from '../services/auth.js'
import { deleteCloudFiles } from '../services/wx-storage.js'
import { okData, ok, fail } from '../util.js'

const MAX_REPORTS = 20

// 手机号绑定：验证码失败限流（10 次 / 15 分钟，按手机号），防爆破
const BIND_FAIL_LIMIT = 10
const BIND_FAIL_WINDOW_MS = 15 * 60_000
const bindFailLog = new Map<string, number[]>()

function pruneWindow(arr: number[], nowMs: number, windowMs: number): void {
  while (arr.length > 0 && arr[0] <= nowMs - windowMs) arr.shift()
}

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  // 我的报告历史（跨设备同步）：按生成时间倒序，与前端 ReportRecord 结构一致
  app.get('/me/reports', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const rows = (await db
      .prepare(
        `SELECT r.session_id, r.generated_at, r.payload
           FROM reports r
           JOIN users u ON u.id = r.user_id
           WHERE u.uid = ?
           ORDER BY r.generated_at DESC
           LIMIT ?`
      )
      .all(uid, MAX_REPORTS)) as unknown[]
    const list = rows.map((r: any) => ({
      sessionId: r.session_id,
      at: r.generated_at,
      report: JSON.parse(r.payload)
    }))
    return okData(list)
  })

  // 当前账号绑定的手机号（购买前绑定，契约：2026-10-23-phone-binding.freeze.md）
  // 未绑定返回 null；手机号仅本人可见，客户端展示前自行脱敏
  app.get('/me/phone', { preHandler: requireAuth }, async (request, reply) => {
    const user = await getUserByUid(db, (request.user as any).uid as string)
    if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
    const phone = user.phone != null && user.phone.length > 0 ? user.phone : null
    return okData({ phone: phone })
  })

  // 绑定手机号到当前账号：不新建账号、不切换 uid、不签发新 token。
  // 冲突（手机号已属他人）返回 409 + 业务码 40901，不覆盖原归属。
  app.post(
    '/me/phone',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['phone', 'code'],
          properties: { phone: { type: 'string' }, code: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const uid = (request.user as any).uid as string
      const { phone, code } = request.body as { phone: string; code: string }

      if (phone.length !== 11 || !/^[0-9]{11}$/.test(phone)) {
        return reply.code(400).send(fail(400, '手机号格式不正确'))
      }

      // 幂等：当前账号已绑定同一手机号 → 直接成功（不校验验证码、不改归属）
      const me = await getUserByUid(db, uid)
      if (me == null) return reply.code(401).send(fail(401, '用户不存在'))
      if (me.phone === phone) return okData({ phone: phone })

      const t = Date.now()
      const fails = bindFailLog.get(phone) ?? []
      pruneWindow(fails, t, BIND_FAIL_WINDOW_MS)
      if (fails.length >= BIND_FAIL_LIMIT) {
        return reply.code(400).send(fail(400, '尝试过于频繁，请稍后再试'))
      }

      const okCode = await consumeSmsCode(db, phone, code)
      if (!okCode) {
        fails.push(t)
        bindFailLog.set(phone, fails)
        return reply.code(400).send(fail(400, '验证码不正确或已过期'))
      }

      try {
        const user = await bindPhoneToUser(db, uid, phone)
        if (user == null) return reply.code(401).send(fail(401, '用户不存在'))
        bindFailLog.delete(phone)
        return okData({ phone: phone })
      } catch (e: any) {
        if (e instanceof Error && e.message === PHONE_TAKEN) {
          return reply.code(409).send(fail(40901, '该手机号已绑定其他账号'))
        }
        throw e
      }
    }
  )

  // 账号自助删除（合规红线）：级联清理该用户全部数据 + 磁盘简历文件；幂等（重复调用仍返回 ok）
  app.delete('/me/account', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const user = await getUserByUid(db, uid)
    if (user == null) return ok() // 已删除：幂等

    const env = (app as any).env as import('../config.js').Env
    const userId = user.id

    // 磁盘简历文件先收集（删表前），original_url 格式为 'resumes/<rel>'（/resume/parse 直存任意字符串，需容错）
    // 云存储对象（cloud://）单独收集，注销时同步清理（合规：云上副本不能残留）
    const resumeRows = (await db
      .prepare('SELECT original_url FROM resumes WHERE user_id = ?')
      .all(userId)) as unknown[]
    const files: string[] = []
    const cloudFileIDs: string[] = []
    for (const row of resumeRows) {
      const url = (row as any).original_url as string | null
      if (url == null) continue
      if (url.indexOf('cloud://') === 0) {
        cloudFileIDs.push(url)
        continue
      }
      if (url.startsWith('resumes/')) {
        files.push(env.uploadDir + '/' + url.substring('resumes/'.length))
      }
    }

    // 级联清理（PRAGMA foreign_keys = ON / InnoDB 外键，先子后父）
    await db.prepare('DELETE FROM tracking_events WHERE user_id = ?').run(userId)
    await db
      .prepare(
        'DELETE FROM answers WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)'
      )
      .run(userId)
    await db
      .prepare(
        'DELETE FROM session_asked WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)'
      )
      .run(userId)
    await db.prepare('DELETE FROM reports WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM resumes WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM resume_usages WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM practice_records WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM user_asked_history WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM sms_codes WHERE phone = ?').run(user.phone ?? '')
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    // 删除磁盘简历文件（文件不存在则忽略，不抛错）
    for (const f of files) {
      try {
        unlinkSync(f)
      } catch {
        // ignore
      }
    }
    // 删除云存储简历对象（best-effort：缺凭据/网络失败只告警，不阻断注销幂等语义）
    if (cloudFileIDs.length > 0) {
      try {
        await deleteCloudFiles({
          appId: env.wxAppId,
          secret: env.wxSecret,
          envId: env.wxCloudEnvId,
          fileIDs: cloudFileIDs,
          timeoutMs: 5000
        })
      } catch (e: any) {
        const msg = e != null && e.message != null ? String(e.message) : 'CLOUD_DELETE_ERROR'
        console.warn('[me] 云存储简历删除失败（不阻断注销）：', msg)
      }
    }
    return ok()
  })
}
