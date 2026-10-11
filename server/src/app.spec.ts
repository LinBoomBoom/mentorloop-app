// JSON 解析器健壮性回归：损坏请求体必须返回统一失败响应，不得击穿进程
// 2026-10-11 崩溃现场：双重转义体 {\"events\":[...]} 令自定义解析器同步 throw，
// SyntaxError 穿透 Fastify 解析管线以 uncaughtException 杀死整个服务
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'

function makeApp() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return buildApp({ env })
}

describe('JSON 解析器健壮性', () => {
  beforeEach(() => closeDb())

  it('双重转义的损坏 JSON 返回统一 400 且进程存活', async () => {
    const app = makeApp()
    // 与崩溃日志同款的载荷形态（字面反斜杠引号，非法 JSON）
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { 'content-type': 'application/json' },
      payload: '{\\"events\\":[\\"2026-10-11T13:50:49.7944858+08:00|app_launch|{}\\"]}'
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().code).toBe(400)

    // 进程存活：后续合法请求仍正常响应
    const ok = await app.inject({ method: 'GET', url: '/healthz' })
    expect(ok.statusCode).toBe(200)
  })

  it('空请求体按空对象处理，走路由校验返回统一 400', async () => {
    const app = makeApp()
    const r = await app.inject({
      method: 'POST',
      url: '/track/batch',
      headers: { 'content-type': 'application/json' }
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().code).toBe(400)
  })
})
