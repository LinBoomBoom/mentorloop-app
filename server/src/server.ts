// 服务入口
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { runContentSync } from './scripts/sync-content-questions.js'
import { startVirtualOrderReconciler } from './services/virtual-notify.js'
import { annotateFontStatus } from './services/resume-annotate.js'
import type { Db } from './db.js'

async function main(): Promise<void> {
  const env = loadEnv()
  const app = buildApp({ env })
  const db = (app as any).db as Db

  // 云端 MySQL 增量迁移（SQLite 自动 no-op）：必须在 listen 前完成
  await db.ensureSchema()

  const addr = await app.listen({ port: env.port, host: '0.0.0.0' })
  console.log('[mentorloop-server] listening on', addr)

  // 批注 PDF 的 CJK 字体自检（发布后回读运行日志可确认镜像内资产是否齐全）
  const font = annotateFontStatus()
  console.log('[resume-annotate] font ready=' + font.ready + ' path=' + font.path)

  // 虚拟支付查单兜底（仅 MP_PAY_MODE=virtual 且密钥齐全时启动；
  // 间隔由 VIRTUAL_RECONCILE_INTERVAL_MS 控制，默认 60 分钟，<=0 关闭）
  startVirtualOrderReconciler(db, env, env.virtualReconcileIntervalMs)

  // 内容库自举（批次 A · G3）：云端（MYSQL_HOST 非空）且内容源库已配置（DESKTOP_DB_NAME）
  // 时，后台检查内容库——目标表为空、或适配层版本（ADAPTER_VERSION）与落库版本不一致时
  // 全量重建（题面/分类逻辑变更后自动生效）；一致则跳过，重启零开销。
  // 与本地 SQLite 的 fixture 自举同语义；失败只记日志，绝不阻塞/影响服务启动。
  if (env.mysqlHost.length > 0 && env.desktopDbName.length > 0) {
    console.log('[content-sync] 云端 + 内容源已配置，检查内容库（版本一致即跳过）')
    void runContentSync().catch((e) => {
      console.error('[content-sync] 同步失败（不影响服务运行）：', e)
    })
  }
}

main().catch((err) => {
  console.error('[mentorloop-server] failed to start', err)
  process.exit(1)
})
