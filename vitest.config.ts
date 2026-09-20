import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

// .uts 是 uni-app x 的强类型脚本，Node/Vitest 原生不认识。
// 这里用一个前置插件把 .uts 交给 esbuild 按 TypeScript 转译，
// 从而让纯逻辑（状态机 / 评分）可以脱离 HBuilderX 直接单测。
function utsAsTypeScript() {
  return {
    name: 'uts-as-typescript',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      if (!id.endsWith('.uts')) return null
      const esbuild = await import('esbuild')
      const result = await esbuild.transform(code, {
        loader: 'ts',
        target: 'esnext',
        format: 'esm'
      })
      return { code: result.code, map: null }
    }
  }
}

export default defineConfig({
  plugins: [utsAsTypeScript()],
  resolve: {
    alias: { '@': root },
    extensions: ['.mjs', '.js', '.ts', '.uts', '.json']
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts']
  }
})
