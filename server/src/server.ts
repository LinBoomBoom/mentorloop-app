// 服务入口
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { runContentSync } from './scripts/sync-content-questions.js'

const env = loadEnv()
const app = buildApp({ env })

app
  .listen({ port: env.port, host: '0.0.0.0' })
  .then((addr) => {
    console.log('[mentorloop-server] listening on', addr)
    // 内容库一次性同步（批次 A · G3 云端联调）：仅云端 + 显式开启时执行，且仅在
    // 目标表为空时真正写入（幂等）。异步后台执行，失败只记日志，绝不阻塞/影响服务启动。
    if (env.mysqlHost.length > 0 && process.env.SYNC_CONTENT_ON_BOOT === 'true') {
      console.log('[content-sync] SYNC_CONTENT_ON_BOOT=true，启动后同步内容库（ifEmpty）')
      void runContentSync({ ifEmpty: true }).catch((e) => {
        console.error('[content-sync] 同步失败（不影响服务运行）：', e)
      })
    }
  })
  .catch((err) => {
    console.error('[mentorloop-server] failed to start', err)
    process.exit(1)
  })
