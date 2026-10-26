import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // 跑测前后清理 ./data 下的单测临时产物，避免长期累积（曾达 GB 级）
    globalSetup: ['./vitest.global-setup.ts'],
    // DB 集成用例在并行负载下可能超过 5s 默认阈值
    testTimeout: 15000,
    hookTimeout: 15000
  }
})
