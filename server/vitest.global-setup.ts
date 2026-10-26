// vitest 全局钩子：清理本地运行数据目录里的单测临时产物
// 背景：多个 spec 把 dbPath 指到 ./data/test-*.db，且会建 test-uploads-* 目录；
// 长期累积曾达 GB 级，拖慢云托管部署的构建上下文上传。此处每次跑测前后各清一次。
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function clean(): void {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (name.startsWith('test-')) rmSync(join(dir, name), { recursive: true, force: true })
  }
}

export default function setup(): () => void {
  clean()
  return clean
}
