import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { uniAppX } from 'weapp-tailwindcss/presets'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'

// HBuilderX 启动构建时 process.cwd() 可能变化，必须从配置文件 URL 推导稳定的项目根
const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    uni(),
    WeappTailwindcss(
      uniAppX({
        base: projectRoot,
        cssEntries: [resolve(projectRoot, 'main.css')],
        rem2rpx: true,
        // 原生 App 端不支持 gap / space-x-* / space-y-* → 直接报错，避免静默失效
        uvueUnsupported: 'error'
      })
    )
  ]
})
