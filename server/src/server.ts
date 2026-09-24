// 服务入口
import { buildApp } from './app.js'
import { loadEnv } from './config.js'

const env = loadEnv()
const app = buildApp({ env })

app
  .listen({ port: env.port, host: '0.0.0.0' })
  .then((addr) => {
    console.log('[mentorloop-server] listening on', addr)
  })
  .catch((err) => {
    console.error('[mentorloop-server] failed to start', err)
    process.exit(1)
  })
