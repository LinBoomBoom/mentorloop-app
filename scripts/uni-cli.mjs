// uni CLI 包装（跨平台、零新增依赖）
// 本仓为 HBuilderX 根目录布局（manifest.json 等项目文件在仓库根），而 uni CLI 默认以 src/ 为输入目录，
// 故这里显式把 UNI_INPUT_DIR 指向当前工作目录（项目根），再原样转发参数给 uni CLI 的 bin 入口。
// 用法：node scripts/uni-cli.mjs build -p mp-weixin
// 若外部已设置 UNI_INPUT_DIR（如 HBuilderX 注入），优先沿用外部值。
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const uniBin = require.resolve('@dcloudio/vite-plugin-uni/bin/uni.js')

const result = spawnSync(process.execPath, [uniBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, UNI_INPUT_DIR: process.env.UNI_INPUT_DIR ?? process.cwd() }
})

process.exit(result.status ?? 1)
