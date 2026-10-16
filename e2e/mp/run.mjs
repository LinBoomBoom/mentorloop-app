// 小程序自动化 E2E 运行器（任务卡 2026-10-16-mp-automator-e2e）
// 用法：pnpm test:mp            先构建再跑
//       pnpm test:mp --no-build 跳过构建，用现有 dist
//       pnpm test:mp --only=IA1-B2  只跑匹配的场景
// 前置：微信开发者工具 → 设置 → 安全设置 → 服务端口「开启」
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import automator from 'miniprogram-automator'
import { scenarios } from './scenarios.mjs'

const HERE = import.meta.dirname
const ROOT = path.resolve(HERE, '..', '..')
const PROJECT = path.join(ROOT, 'dist', 'build', 'mp-weixin')
const CLI = process.env.WX_DEVTOOLS_CLI ?? 'D:\\Tencent\\微信web开发者工具\\cli.bat'
const SHOTS = path.join(HERE, '__screenshots__')
const NO_BUILD = process.argv.includes('--no-build')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length)

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// 报告页空态只渲染「暂无报告」，故需要报告的场景先注入一条种子历史（键与 store/report-history.uts 一致）
function seedRecords() {
  return [
    {
      sessionId: 'e2e-seed-1',
      at: Date.now(),
      report: {
        overall: 'E2E 种子报告',
        strongest: '岗位知识与正确性',
        topPriority: '补充量化指标',
        dimensions: [
          {
            dimension: 'knowledge',
            level: 'B',
            confidence: 0.82,
            evidence: 'E2E 种子证据',
            missingEvidence: '缺少量化指标',
            suggestQuestions: [],
            exampleAnswer: ''
          }
        ],
        riskQuestions: [],
        trainingPlan: [{ id: 'train-knowledge-1', title: '定向训练', durationMin: 3, priority: 1 }]
      }
    }
  ]
}

function build() {
  if (NO_BUILD) {
    console.log('[test:mp] 跳过构建（--no-build）')
    return
  }
  console.log('[test:mp] 构建 dist/build/mp-weixin …')
  const r = spawnSync('pnpm', ['build:mp-weixin'], { cwd: ROOT, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error('[test:mp] 构建失败，终止。')
    process.exit(1)
  }
}

async function launch() {
  // 连接既有自动化会话（绕开 automator.launch 的 Windows 限制，见 README「已知限制」）
  const ws =
    process.env.WX_AUTO_WS ??
    (process.argv.find((a) => a.startsWith('--ws=')) ?? '').slice('--ws='.length)
  if (ws.length > 0) {
    console.log(`[test:mp] 连接既有自动化会话 ${ws}`)
    return { mp: await automator.connect({ wsEndpoint: ws }), owned: false }
  }
  if (!existsSync(CLI)) throw new Error(`未找到 DevTools CLI：${CLI}（可用 WX_DEVTOOLS_CLI 覆盖）`)
  if (!existsSync(PROJECT))
    throw new Error(`未找到构建产物：${PROJECT}（先跑 pnpm build:mp-weixin）`)
  return {
    mp: await automator.launch({ cliPath: CLI, projectPath: PROJECT, timeout: 90000 }),
    owned: true
  }
}

// 连上后小程序可能仍在首次编译，此时取页面元信息会失败
// （表现为 getPageMetaByWebviewId 返回 null），必须先等到就绪再跑场景
async function waitReady(mp, timeout = 90000) {
  const until = Date.now() + timeout
  let last = ''
  for (;;) {
    try {
      const p = await mp.currentPage()
      if (p != null) return p
      last = 'currentPage 为空'
    } catch (e) {
      last = e && e.message ? e.message : String(e)
    }
    if (Date.now() > until) throw new Error(`等待小程序就绪超时：${last}`)
    await delay(1000)
  }
}

function makeCtx(mp) {
  async function find(sel) {
    const p = await mp.currentPage()
    if (p == null) return null
    try {
      return await p.$(sel)
    } catch {
      return null
    }
  }
  async function poll(fn, timeout) {
    const until = Date.now() + timeout
    for (;;) {
      if (await fn()) return true
      if (Date.now() > until) return false
      await delay(150)
    }
  }
  async function pathOf() {
    const p = await mp.currentPage()
    return p == null ? '' : (p.path ?? '')
  }
  function normalize(url) {
    return url.startsWith('/') ? url.slice(1) : url
  }
  async function waitPathOf(expected, timeout) {
    const want = normalize(expected)
    return poll(async () => (await pathOf()) === want, timeout)
  }
  return {
    mp,
    path: pathOf,
    // 导航类断言一律用轮询等路径，不用固定 sleep：点击 → 渲染 → 跳转的耗时不稳定
    async waitPath(expected, timeout = 8000) {
      return waitPathOf(expected, timeout)
    },
    async gotoTab(url, timeout = 8000) {
      await mp.switchTab(url)
      if (!(await waitPathOf(url, timeout))) {
        throw new Error(`switchTab ${url} 后路径仍为 ${await pathOf()}`)
      }
    },
    async present(sel, timeout = 4000) {
      return poll(async () => (await find(sel)) != null, timeout)
    },
    async absent(sel, timeout = 4000) {
      return poll(async () => (await find(sel)) == null, timeout)
    },
    async tap(sel, timeout = 5000) {
      await poll(async () => (await find(sel)) != null, timeout)
      const el = await find(sel)
      if (el == null) throw new Error(`找不到可点击元素 ${sel}`)
      await el.tap()
      await delay(300)
    },
    // 回首页：先过一次「结果」tab，让可能残留的分段意图被 onShow 消费掉，避免场景间串态
    async home() {
      await this.gotoTab('/pages/report/report')
      await this.gotoTab('/pages/index/index')
    },
    async seed() {
      await mp.callWxMethod('setStorageSync', 'ml_report_history', JSON.stringify(seedRecords()))
    },
    async shot(name) {
      try {
        mkdirSync(SHOTS, { recursive: true })
        await mp.screenshot({ path: path.join(SHOTS, `${name}.png`) })
      } catch {
        /* 截图失败不影响结论 */
      }
    },
    assert(cond, msg) {
      if (!cond) throw new Error(msg)
    }
  }
}

const picked = ONLY.length > 0 ? scenarios.filter((s) => s.id.includes(ONLY)) : scenarios
if (picked.length === 0) {
  console.error(`[test:mp] --only=${ONLY} 未匹配任何场景`)
  process.exit(1)
}

build()

let mp = null
let ownedSession = false
const results = []
try {
  console.log('[test:mp] 启动自动化实例 …')
  const session = await launch()
  mp = session.mp
  ownedSession = session.owned
  console.log('[test:mp] 等待小程序就绪 …')
  await waitReady(mp)
  const c = makeCtx(mp)
  await c.seed()
  // 首启画像未完成时会自动弹引导页，先完成一次，避免干扰后续场景
  if ((await c.path()) === 'pages/onboarding/onboarding') {
    console.log('[test:mp] 检测到首启引导页，先完成一次前置')
    await c.tap('#ob-save')
    await c.waitPath('/pages/index/index')
  }
  for (const s of picked) {
    try {
      await mp.reLaunch('/pages/index/index')
      await delay(300)
      await s.run(c)
      results.push({ id: s.id, ok: true })
      console.log(`  ✓ ${s.id} ${s.title}`)
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      results.push({ id: s.id, ok: false, msg })
      console.error(`  ✗ ${s.id} ${s.title}\n      ${msg}`)
      await c.shot(s.id)
    }
  }
} catch (e) {
  const msg = e && e.message ? e.message : String(e)
  console.error(`\n[test:mp] 无法建立自动化会话：${msg}`)
  console.error(
    '请确认：微信开发者工具 → 设置 → 安全设置 → 服务端口「开启」；且工具未处于其它自动化会话中。'
  )
  console.error(
    '若报 cliPath 相关错误：Node ≥18.20 起非 shell spawn .bat 会 EINVAL（automator 自带 launch 的已知限制），'
  )
  console.error(
    '改用：先在终端跑 `"<DevTools>\\cli.bat" auto --project dist\\build\\mp-weixin --auto-port 9420`，'
  )
  console.error('再跑 `pnpm test:mp -- --ws=ws://127.0.0.1:9420`。')
  process.exitCode = 2
} finally {
  // 自己拉起的会话：close() 收干净；外部会话（--ws）：只 disconnect，让会话留着方便复跑，
  // 同时释放连接，否则 WS 会吊住事件循环导致进程不退出
  if (mp != null) {
    try {
      if (ownedSession) {
        await mp.close()
      } else {
        await mp.disconnect()
      }
    } catch {
      /* ignore */
    }
  }
}

if (results.length > 0) {
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n[test:mp] 场景 ${results.length} 个：通过 ${results.length - failed}，失败 ${failed}`
  )
  if (failed > 0) console.log(`[test:mp] 失败场景截图见 ${SHOTS}`)
  process.exitCode = failed > 0 ? 1 : 0
}
