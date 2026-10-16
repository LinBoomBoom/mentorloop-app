# 小程序自动化 E2E（mp-e2e）

任务卡：`docs/tasks/2026-10-16-mp-automator-e2e.md`

## 为什么存在

微信开发者工具是 Electron 壳，小程序的模拟器是 Chromium 渲染面 —— UI Automation 读不到内部控件树，Computer Use 合成的点击也进不去（2026-10-16 实测）。所以「真机走查」中可判定的导航类场景改用微信官方自动化 SDK 断言。

## 前置（一次性）

1. 微信开发者工具 → **设置 → 安全设置 → 服务端口「开启」**（不开则无法建立自动化会话）。
2. 一次 `pnpm build:mp-weixin`（运行器默认会自己构建，`--no-build` 可跳过）。

CLI 路径默认 `D:\Tencent\微信web开发者工具\cli.bat`，可用环境变量 `WX_DEVTOOLS_CLI` 覆盖。

## 用法

```bash
pnpm test:mp                 # 构建 + 跑全部场景
pnpm test:mp --no-build      # 用现有 dist
pnpm test:mp -- --only=IA1-B2  # 只跑匹配场景
```

- 退出码：`0` 全通过 / `1` 有失败场景 / `2` 无法建立会话（服务端口等环境问题）。
- 失败场景会截图到 `e2e/mp/__screenshots__/`（已 gitignore）。

## 覆盖范围

IA-1 导航组：`A1`（4 tab 可切换）、`B1`/`B2`/`B3`/`B4`/`B5`（首页各入口去向）、`C1`/`C2`（报告页页内分段）、`D2`/`D3`（跨 tab 深链与一次性语义）。

需要报告数据的场景由运行器注入一条种子历史（键 `ml_report_history`，与 `store/report-history.uts` 一致）——报告页在**空态**只渲染「暂无报告」，分段按钮不存在。

## 不覆盖（后续批次）

- 视觉类断言（字体/对比度/圆角）：API 无法断言，仍靠截图走查。
- 需登录态或真实后端的场景：E1 死链全量遍历、E2 退出登录落首页、报告页多场历史。
- ui-1 的其余场景。
- CI 集成：需带 DevTools 的专用 runner，另立卡。
