// 小程序页面截图（人工走查 / 改动核验用）
//
// 用法：
//   pnpm shot:mp onb                 # 截引导页
//   pnpm shot:mp prep 我的截图.png    # 截面试准备页到指定文件名
//   页面名：onb | prep | index | report | login
//
// 前置：DevTools「服务端口」已开；构建产物已就绪；再用自动化端口起一次实例：
//   pnpm build:mp-weixin
//   node_modules/.bin/... 或直接：
//   "<DevTools>\cli.bat" auto --project dist\build\mp-weixin --auto-port 9420 --trust-project
//
// 输出目录：MP_SHOT_DIR ?? <项目>/e2e/mp/shots（每次运行先清空该目录，只保留最近一次截图）
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import automator from 'miniprogram-automator'

const PAGES = {
  onb: '/pages/onboarding/onboarding',
  prep: '/pages/interview/prep',
  index: '/pages/index/index',
  report: '/pages/report/report',
  login: '/pages/login/login',
  prefs: '/pages/mine/prefs',
  mine: '/pages/mine/mine',
  paywall: '/pages/membership/paywall',
  resume: '/pages/resume/resume',
  training: '/pages/training/training'
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const wsEndpoint = process.env.MP_WS ?? 'ws://127.0.0.1:9420'
const outDir = process.env.MP_SHOT_DIR ?? resolve(import.meta.dirname, '..', 'e2e', 'mp', 'shots')

const pageKey = process.argv[2] ?? 'index'
const url = PAGES[pageKey]
if (url == null) {
  console.error(`未知页面「${pageKey}」，可选：${Object.keys(PAGES).join(' | ')}`)
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
const file = join(outDir, process.argv[3] ?? `${pageKey}.png`)

const mp = await automator.connect({ wsEndpoint })
try {
  await mp.reLaunch(url)
  await wait(2600)
  const page = await mp.currentPage()
  mkdirSync(outDir, { recursive: true })
  await mp.screenshot({ path: file })
  console.log(`[路径] ${page == null ? '' : page.path}`)
  console.log(`[截图] ${file}`)
} finally {
  await mp.disconnect()
}
