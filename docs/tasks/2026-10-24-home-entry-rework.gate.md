# G2 门禁记录：首页入口重排

- 日期：2026-10-24
- 任务卡：[2026-10-24-home-entry-rework.md](./2026-10-24-home-entry-rework.md)
- 设计稿：[2026-10-24-home-redesign-mockup.html](../design/2026-10-24-home-redesign-mockup.html)（A · 训练驾驶舱，2026-10-24 评审通过）
- 结论：**G2 通过**；A 方向设计稿已按稿落地；360×640 Android / 375×667 iPhone SE 真机默认字号走查待复验

## 1. 客户端门禁

| 命令                                   | 结果                            |
| -------------------------------------- | ------------------------------- |
| `pnpm lint`                            | 0 error / 0 warning             |
| `pnpm typecheck`                       | 通过                            |
| `pnpm test`                            | 8 文件 / 117 通过               |
| `pnpm build:mp-weixin`                 | 构建成功                        |
| `node scripts/check-uvue-css.mjs`      | OK（34 个 .uvue，无受限原子类） |
| `node scripts/check-design-tokens.mjs` | 全绿（A–H 八项）                |

## 2. E2E

`pnpm test:mp --no-build --ws=ws://127.0.0.1:9420 --only=IA1`

- 场景 10 个：通过 2，跳过 8，失败 0
- 通过：`IA1-A1`（三 tab 切换）、`IA1-B4`（`#stat-todo` → `/pages/training/training`）
- 跳过（既有）：`IA1-B1` 简历卡为 `ml-card` 自定义组件，自动化 tap 不可达（README 已知限制 8）
- 跳过（环境）：`IA1-B2/B3/B5/C1/C2/D2/D3`，服务端报告拉取覆盖 E2E 种子，环境无报告数据（台账 U10）
- 手工补验：`#stat-total` → `/pages/report/report`；7 个锚点在运行时与 WXML 产物中均存在

## 3. 视觉走查

- 390×844（iPhone 12/13 模拟器，默认字号）：按设计稿 A 落地「深色任务舱 + 浅色训练纸」；页高 762，主任务区 125–424、今日任务 485–551、两列入口 563–667、成长轨 732–752，全部首屏可见且无纵向滚动。
- 同机型强制紧凑分支（设计稿阶段）：主卡描述 / 脚注与两列副标题隐藏，五层仍完整可见，无裁切。
- 真机待复验：360×640 Android、375×667 iPhone SE 默认字号首屏不滚动（用户走查）。

## 4. 已知偏差与决策

- `uni.getWindowInfo()` 在 DevTools 冷启动的 `onShow` 阶段可能返回未就绪高度（实测首帧误判 compact）；已增加 `onReady` 二次校准。真机影响面小，但保留该加固。
- 未新增 Tab、未改 tabBar；训练入口为首页常驻卡 + 今日任务，成长页原有「做题」分段保留。
- 登录提示改为任务舱右上角「登录」药丸（匿名态），不再占用整行；已登录时 App 显示「本周 N 次」，MP 因右上角微信胶囊空间不足仅保留头像。
- 设计稿中的「本周 2 次」是 App 侧展示；MP 端该数据仍可在成长页查看，避免与胶囊冲突。
- 模块卡落地为纯色 tint（设计稿渐变仅作氛围），符合 uvue 侧不引入渐变工具类的约束。

## 5. 产物核对

- 修改：`pages/index/index.uvue`
- 新增：`docs/design/2026-10-24-home-redesign-mockup.html`、`docs/tasks/2026-10-24-daily-work-report.md`
- 未改：`pages.json`、`e2e/mp/scenarios.mjs`、`api/`、`types/`、服务端
- 无契约变更，无需冻结单
