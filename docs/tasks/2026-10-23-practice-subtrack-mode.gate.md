# G2 门禁记录：训练改为「做题」+ 细分领域 × 难度

- 日期：2026-10-23
- 任务卡：[2026-10-23-practice-subtrack-mode.md](./2026-10-23-practice-subtrack-mode.md)
- 契约：[2026-10-23-practice-subtrack.freeze.md](../contracts/2026-10-23-practice-subtrack.freeze.md)
- 方案：[2026-10-23-practice-mode-proposal.md](../design/2026-10-23-practice-mode-proposal.md)
- 结论：**代码门禁通过 + 微信开发者工具做题全链路走查通过（390×844 与 320×568）**

## 1. 命令结果

| 命令                                             | 结果                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `pnpm lint`                                      | 0 error / 0 warning                                                |
| `pnpm typecheck`                                 | 通过                                                               |
| `pnpm test`                                      | 8 文件 / 113 通过                                                  |
| `node scripts/check-uvue-css.mjs`                | OK（34 个 .uvue）                                                  |
| `node scripts/check-design-tokens.mjs`           | 全绿（A–H 八项）                                                   |
| `pnpm build:mp-weixin`                           | 构建成功                                                           |
| `pnpm --filter @mentorloop/server test`          | 29 文件 / 213 通过（含新增 `practice.spec.ts` 4 条）               |
| `pnpm test:mp -- --no-build --ws=127.0.0.1:9420` | 11 场景：通过 3 / 跳过 8 / 失败 0（跳过原因见 §5，均非本任务引入） |

## 2. 已实施

- 服务端：`/training/questions` 新增可选 `subtrack` / `difficulty`；候选池 SQL 过滤；传 `difficulty` 时精确难度并把选择器经验档置 `senior`；旧调用行为不变。
- 客户端：`data/subtracks.uts` 20 个细分领域（4 方向 × 5）+ 三档难度；`store/practice-progress.uts` 本机掌握度与错题本（上限 100）。
- 做题选题页：方向 chip → 细分领域列表（含本机「已做 / 会」）→ 难度段 → 题量 5/10 → 固定底部「开始做题」；错题本入口。
- 做题房间：题目卡 → 「先在心里组织答案」提示 → 查看参考解析（标注「参考解析 · 节选」）→ 不会 / 模糊 / 会 → 下一题 → 本组小结；错题复习模式复用同一房间。
- 文案：首页闭环、成长分段、报告页、`pages.json` 标题统一为「做题」；入口 `navigateTo`。

## 3. 走查发现并修复

| #   | 位置     | 问题                                                           | 修复                                                                |
| --- | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 做题页   | 原生导航「做题」与页内大标题重复                               | 去掉页内大标题，保留原生导航；说明文案作为首行                      |
| 2   | 做题页   | 方向 / 题量 chip 选中态无底色（内联 `backgroundColor` 未生效） | 改 `bg-smart border-smart` / `bg-surface border-line` 动态 class    |
| 3   | 做题页   | 两列细分领域卡片名称被截断（「微服务与分…」）                  | 改单列列表：图标 + 名称 + 说明 + 本机进度，320 宽也不截断           |
| 4   | 做题页   | 「开始做题」在长列表底部，需滚动才能点到                       | 改固定底部操作栏并读安全区（与会员支付栏同构）                      |
| 5   | 做题房间 | 自定义导航未避让状态栏，标题压在状态栏下                       | `topPad` 读 `statusBarHeight` 并存 px 字符串                        |
| 6   | 做题房间 | 解析里的 Markdown 标记（`**`、围栏、`-`）直接外露              | 加 `plainText()` 去围栏 / 强调符 / 反引号，列表符转「·」            |
| 7   | 做题房间 | 「查看参考解析」为 `ml-button`，自动化无法触发                 | 改页面级可点 view（`id=practice-reveal`），与报告页 CTA 同一处理    |
| 8   | 做题房间 | 错题复习时自评会就地重排错题数组，题目顺序被打乱               | `wrongQuestions()` 返回副本                                         |
| 9   | E2E      | 首页简历卡（`ml-card`）自动化 tap 不可达                       | 记录为 README 已知限制 8；该场景改为存在性断言 + 截图走查，显式跳过 |

## 4. 开发者工具走查

主设备 iPhone 12/13（390×844）：做题页（默认方向 / 细分领域 / 难度 / 题量 / 错题本）→ 开始做题 → 做题房间 → 查看解析 → 连续自评 5 题 → 本组小结 → 错题本复习 2 题 → 复习小结，全链路通过。截图 `e2e/mp/shots/practice-0*.png`。

小屏 iPhone 5（320×568）：做题页方向 chip 自动换行、细分领域单列、固定底部 CTA 完整；做题房间题目卡、解析长文与三个自评按钮均无横向溢出。截图 `e2e/mp/shots-320/`（`training.png` / `room.png` / `room-answer.png`）。

## 5. E2E 跳过说明

- `IA1-B1`：首页简历入口由 `ml-card` 承载 `@tap`，自动化坐标 tap 被组件根 `@click.stop` 吞掉（README 已知限制 8）；入口存在性仍断言。
- `IA1-B2/B3/B5/C1/C2/D2/D3`：需报告数据；本机登录态下 `/me/reports` 拉取覆盖 E2E 种子（既有台账 U10），与本次改动无关。

## 6. 遗留

- 服务端上线 `subtrack` / `difficulty` 过滤前，云端仍会忽略这两个字段（向后兼容，返回通用题）；发布后做题页的精确过滤才完全生效。
- 解析为 `expectedEvidence` 节选，Phase 2 补完整答案列与服务端 SRS 排程。
