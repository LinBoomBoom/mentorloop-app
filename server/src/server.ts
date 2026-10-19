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
    // 内容库自举（批次 A · G3）：云端（MYSQL_HOST 非空）且内容源库已配置（DESKTOP_DB_NAME）
    // 时，后台检查内容库——目标表为空、或适配层版本（ADAPTER_VERSION）与落库版本不一致时
    // 全量重建（题面/分类逻辑变更后自动生效）；一致则跳过，重启零开销。
    // 与本地 SQLite 的 fixture 自举同语义；失败只记日志，绝不阻塞/影响服务启动。
    // 不依赖新增环境变量：云托管控制台的环境变量区只支持改已有值、不支持新增键。
    if (env.mysqlHost.length > 0 && env.desktopDbName.length > 0) {
      console.log('[content-sync] 云端 + 内容源已配置，检查内容库（版本一致即跳过）')
      void runContentSync().catch((e) => {
        console.error('[content-sync] 同步失败（不影响服务运行）：', e)
      })
    }
  })
  .catch((err) => {
    console.error('[mentorloop-server] failed to start', err)
    process.exit(1)
  })
