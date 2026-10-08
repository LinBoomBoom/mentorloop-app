// 应用组装：buildApp 与 listen 分离，便于测试注入
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { loadEnv, ensureDataDirs, Env } from './config.js'
import { getDb } from './db.js'
import registerRoutes from './routes/index.js'
import { fail } from './util.js'

export type BuildOptions = {
  env?: Env
  dbPath?: string
}

export function buildApp(opts: BuildOptions = {}): FastifyInstance {
  const env = opts.env ?? loadEnv()
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

  // 覆盖默认 application/json 解析器：额外保留字节原文（微信支付回调验签需要）
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: any, body: any, done: any) => {
      req.rawBody = body
      const text = String(body)
      done(null, text.length > 0 ? JSON.parse(text) : {})
    }
  )

  void app.register(cors, { origin: true })
  void app.register(jwt, { secret: env.jwtSecret })
  void app.register(multipart)

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
