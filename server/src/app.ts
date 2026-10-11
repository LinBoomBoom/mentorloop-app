// 应用组装：buildApp 与 listen 分离，便于测试注入
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { loadEnv, ensureDataDirs, assertCloudSafety, Env } from './config.js'
import { getDb } from './db.js'
import registerRoutes from './routes/index.js'
import { fail } from './util.js'

export type BuildOptions = {
  env?: Env
  dbPath?: string
}

export function buildApp(opts: BuildOptions = {}): FastifyInstance {
  const env = opts.env ?? loadEnv()
  assertCloudSafety(env)
  ensureDataDirs(env)
  // 双驱动：云端注入 MYSQL_HOST → mysql2 池（schema 由 baseline SQL 外部建库）；否则本地 node:sqlite
  const mysql =
    env.mysqlHost.length > 0
      ? {
          host: env.mysqlHost,
          port: env.mysqlPort,
          user: env.mysqlUser,
          password: env.mysqlPassword,
          database: env.mysqlDatabase,
          poolSize: env.mysqlPoolSize
        }
      : null
  const db = getDb(opts.dbPath ?? env.dbPath, mysql)

  const app = Fastify({ logger: false })

  // 暴露 db 与 env（routes/services 通过 (app as any).db 读取）
  ;(app as any).env = env
  ;(app as any).db = db

  // 覆盖默认 application/json 解析器：额外保留字节原文（微信支付回调验签需要）。
  // JSON.parse 抛出的 SyntaxError 必须就地捕获转 done(err)：同步 throw 会穿透
  // Fastify 解析管线（uncaughtException）直接杀死进程（2026-10-11 本地崩溃实证）
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: any, body: any, done: any) => {
      req.rawBody = body
      const text = String(body)
      if (text.length === 0) {
        done(null, {})
        return
      }
      try {
        done(null, JSON.parse(text))
      } catch {
        const err: any = new Error('请求体不是合法 JSON')
        err.statusCode = 400
        done(err, undefined)
      }
    }
  )

  void app.register(cors, { origin: true })
  void app.register(jwt, { secret: env.jwtSecret })
  void app.register(multipart)

  // 微信身份头门禁：仅当部署方显式声明 TRUST_WX_HEADERS=true（云托管私有链路）时采信
  // X-WX-* 头；否则一律剥离，防止公网调用方伪造 X-WX-OPENID 登录他人账号（契约冻结 §2.2）
  if (!env.trustWxHeaders) {
    app.addHook('onRequest', async (req) => {
      for (const key of Object.keys(req.headers)) {
        if (key.startsWith('x-wx-')) delete req.headers[key]
      }
    })
  }

  // 统一错误映射（schema 校验失败 → 400；业务错误透明透传 message）
  app.setErrorHandler((err, _request, reply) => {
    const status = (err as any).statusCode ?? 500
    if (status >= 400 && status < 500) {
      return reply.code(200).send(fail(400, (err as Error).message || '请求参数不正确'))
    }
    console.error('[server] unhandled error', err)
    return reply.code(500).send(fail(500, '服务异常，请稍后重试'))
  })

  void registerRoutes(app)
  return app
}
