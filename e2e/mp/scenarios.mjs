// 小程序自动化 E2E 场景集（任务卡 2026-10-16-mp-automator-e2e）
// 覆盖 IA-1 导航组：A1 / B1–B5 / C1–C2 / D2–D3。
// 断言原则：只断言「页面路径 + 关键元素存在性」，不读组件内部状态、不依赖 Tailwind 类名；
// 导航类断言一律走 c.waitPath() 轮询，不用固定 sleep。
// seed: true 的场景需要有报告历史——报告页在空态只渲染「暂无报告」，分段按钮不存在。

export const HOME = '/pages/index/index'
export const REPORT = '/pages/report/report'
export const TRAINING = '/pages/training/training'
export const MINE = '/pages/mine/mine'

// 成长面板的存在性锚点：用报告页里的包裹容器（组件根元素上的 id 会被 uni-app x 编译器丢弃）
const GROWTH_PANEL = '#growth-slot'
const SEG_REPORT = '#seg-report'
const SEG_GROWTH = '#seg-growth'

export const scenarios = [
  {
    id: 'IA1-A1',
    title: '四个 tab 可逐一切换（tabBar 静默失败回归）',
    async run(c) {
      for (const t of [HOME, TRAINING, REPORT, MINE]) {
        await c.gotoTab(t)
      }
    }
  },
  {
    id: 'IA1-B1',
    title: '首页简历入口 → 简历页',
    async run(c) {
      await c.home()
      await c.tap('#home-resume')
      c.assert(
        await c.waitPath('pages/resume/resume'),
        `期望 pages/resume/resume，实际 ${await c.path()}`
      )
    }
  },
  {
    id: 'IA1-B4',
    title: '数据条「待训练」→ 训练 tab',
    async run(c) {
      await c.home()
      await c.tap('#stat-todo')
      c.assert(await c.waitPath('pages/training/training'), `期望训练 tab，实际 ${await c.path()}`)
    }
  },
  {
    id: 'IA1-B2',
    title: '数据条「累计面试」→ 结果 tab 且落在成长趋势分段',
    seed: true,
    async run(c) {
      await c.home()
      await c.tap('#stat-total')
      c.assert(await c.waitPath(REPORT), `期望结果 tab，实际 ${await c.path()}`)
      c.assert(await c.present(GROWTH_PANEL), '未落在成长趋势分段：成长面板不存在')
    }
  },
  {
    id: 'IA1-B3',
    title: '数据条「平均等级」→ 结果 tab 且落在成长趋势分段',
    seed: true,
    async run(c) {
      await c.home()
      await c.tap('#stat-avg')
      c.assert(await c.waitPath(REPORT), `期望结果 tab，实际 ${await c.path()}`)
      c.assert(await c.present(GROWTH_PANEL), '未落在成长趋势分段：成长面板不存在')
    }
  },
  {
    id: 'IA1-B5',
    title: '最近报告卡 → 结果 tab 且默认「本场报告」分段（意图不串门）',
    seed: true,
    async run(c) {
      await c.home()
      await c.tap('#home-recent-report')
      c.assert(await c.waitPath(REPORT), `期望结果 tab，实际 ${await c.path()}`)
      c.assert(await c.absent(GROWTH_PANEL), '最近报告卡不应落到成长趋势分段')
    }
  },
  {
    id: 'IA1-C1',
    title: '报告页点「成长趋势」→ 页内切段',
    seed: true,
    async run(c) {
      await c.gotoTab(REPORT)
      await c.tap(SEG_GROWTH)
      c.assert(await c.present(GROWTH_PANEL), '切段后成长面板未出现')
    }
  },
  {
    id: 'IA1-C2',
    title: '报告页点「本场报告」→ 切回默认分段',
    seed: true,
    async run(c) {
      await c.gotoTab(REPORT)
      await c.tap(SEG_REPORT)
      c.assert(await c.absent(GROWTH_PANEL), '切回本场报告后成长面板仍存在')
    }
  },
  {
    id: 'IA1-D2',
    title: '冷启动态（结果 tab 未创建过）数据条深链仍生效',
    seed: true,
    async run(c) {
      await c.mp.reLaunch(HOME)
      await c.waitPath(HOME)
      await c.tap('#stat-total')
      c.assert(await c.present(GROWTH_PANEL), '冷启动深链未落到成长趋势')
    }
  },
  {
    id: 'IA1-D3',
    title: '分段意图一次性：切回本场报告并往返 tab 后不重放',
    seed: true,
    async run(c) {
      await c.home()
      await c.tap('#stat-total')
      c.assert(await c.present(GROWTH_PANEL), '前置不成立：首次点击应落在成长趋势')
      await c.tap(SEG_REPORT)
      await c.gotoTab(TRAINING)
      await c.gotoTab(REPORT)
      c.assert(await c.absent(GROWTH_PANEL), '意图被重放：往返后仍停在成长趋势')
    }
  }
]
