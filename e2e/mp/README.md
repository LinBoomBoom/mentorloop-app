# 小程序自动化 E2E（mp-e2e）

任务卡：`docs/tasks/2026-10-16-mp-automator-e2e.md`

## 为什么存在

微信开发者工具是 Electron 壳，小程序的模拟器是 Chromium 渲染面 —— UI Automation 读不到内部控件树，Computer Use 合成的点击也进不去（2026-10-16 实测：指针到位、`页面路径` 不变）。所以「真机走查」中可判定的导航类场景改用微信官方自动化 SDK 断言。

## 前置（一次性）

1. 微信开发者工具 → **设置 → 安全设置 → 服务端口「开启」**（不开则无法建立自动化会话）。
2. 建议同页开启「**自动化接口打开工具时默认信任项目**」，避免打开项目时弹信任框。
3. 一次 `pnpm build:mp-weixin`（`--no-build` 可跳过）。

CLI 路径默认 `D:\Tencent\微信web开发者工具\cli.bat`，可用环境变量 `WX_DEVTOOLS_CLI` 覆盖。

## 用法（Windows 标准两步法）

```powershell
# 1) 起自动化会话（会打印 ✔ auto；之后约 5–10s 端口才开始监听）
& "$env:WX_DEVTOOLS_CLI或默认路径\cli.bat" auto --project "d:\LsqCoding\mentorloop-app\dist\build\mp-weixin" --auto-port 9420 --trust-project

# 2) 连上并跑场景（退出码：0 全通过 / 1 有失败 / 2 无法建立会话）
pnpm test:mp -- --no-build --ws=ws://127.0.0.1:9420
```

其他参数：

- `--only=IA1-B2` 只跑匹配场景；不加 `--ws` 则走 `automator.launch()`（见下「已知限制」，本机不可用）。
- 失败场景会截图到 `e2e/mp/__screenshots__/`（已 gitignore）。

## 已知限制（踩过的坑，务必先读）

1. **`automator.launch()` 在 Node ≥ 18.20 上必然失败**：该库内部用非 shell 方式 `spawn('cli.bat', …)`，而 Node 出于安全修复会对此抛 `EINVAL`（报错文案是误导性的 `please make sure cliPath is correctly specified`）。→ 走上面的两步法。
2. **`cli auto` 成功后端口有延迟**：命令返回≠可连接，需等几秒确认 9420 在监听。
3. **会话可能在运行中掉线**：表现为后续场景全部 `Connection closed`。重跑前先确认 9420 仍在监听，不在则重跑第 1 步。
4. **组件根元素上的 `id` 会被 uni-app x 编译器丢弃**（实测 `ml-growth-panel` 根节点 `id` 编译后消失）。选择器锚点要放在**页面级**容器上，例如报告页的 `#growth-slot`。
5. **报告页空态没有分段按钮**：无历史报告时只渲染「暂无报告」。故运行器为需要数据的场景注入一条种子历史（键 `ml_report_history`，与 `store/report-history.uts` 一致）。
6. **导航断言必须轮询**：点击 → 渲染 → 跳转的耗时不稳定，固定 `sleep` 会假失败。统一用 `c.waitPath()` / `c.gotoTab()`。
7. **热重载不会重跑页面 `<script setup>`**：改脚本逻辑后 DevTools 热重载只更新模板，旧页面实例仍挂旧逻辑，会出现「改了没生效」的假象（本项目实测：首启引导漏跳、点击无反应都由此误判）。**凡涉及脚本逻辑的验证，必须先 `cli close --project …` 再 `cli auto` 重开项目**。

## 覆盖范围

IA-1 导航组 10 条：`A1`（4 tab 可切换）、`B1`/`B2`/`B3`/`B4`/`B5`（首页各入口去向）、`C1`/`C2`（报告页页内分段）、`D2`/`D3`（跨 tab 深链与一次性语义）。2026-10-16 实测 **10/10 通过**。

## 不覆盖（后续批次）

- 视觉类断言（字体/对比度/圆角）：API 无法断言，仍靠截图走查。
- 需登录态或真实后端的场景：E1 死链全量遍历、E2 退出登录落首页、报告页多场历史。
- ui-1 的其余场景。
- CI 集成：需带 DevTools 的专用 runner，另立卡。
