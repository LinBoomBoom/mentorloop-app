# G2 门禁记录：训练小结页重设计

- 日期：2026-10-24
- 任务卡：[2026-10-24-training-summary-redesign.md](./2026-10-24-training-summary-redesign.md)
- 设计稿：[2026-10-24-training-summary-redesign.html](../design/2026-10-24-training-summary-redesign.html)
- 结论：**通过**（G2 + 开发者工具走查）

## 1. 命令结果

| 命令                                   | 结果                |
| -------------------------------------- | ------------------- |
| `pnpm lint`                            | 0 error / 0 warning |
| `pnpm typecheck`                       | 通过                |
| `pnpm test`                            | 8 文件 / 117 通过   |
| `node scripts/check-uvue-css.mjs`      | OK（34 个 .uvue）   |
| `node scripts/check-design-tokens.mjs` | 全绿（A–H 八项）    |
| `pnpm build:mp-weixin`                 | 构建成功            |

## 2. 已实施

- 小结首屏改为结果卡：结论句 + 会/模糊/不会三段进度条 + 计数；
- 「下一步建议」卡按结果动态切换主/次行动；
- 待巩固列表包含模糊 + 不会，附「明天复习」标签；
- 全对空态：主按钮「再来 5 题」，次按钮「换一组」；
- 移除「本机已记录掌握度」等技术文案。

## 3. 走查

- 混合结果（会 1 / 模糊 1 / 不会 1）：结果卡、建议卡、待巩固列表与主次按钮正常。
- 全对（会 2）：全部答对、满绿分段条、空态与「再来 5 题」主按钮正常。
- 截图：`e2e/mp/shots/training-summary-v2-mixed.png`、`training-summary-v2-allknown.png`。

## 4. 备注

- 320×568 以设计稿小屏稿为准；uvue 页面使用 scroll-view，长列表可滚动。
- 守卫曾命中进度条使用 `rounded-chip`（手搓 chip），已改为 `rounded-full` 后全绿。
- 未改 `types/` / `api/`，无契约冻结。
