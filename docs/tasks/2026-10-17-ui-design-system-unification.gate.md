# G2 门禁记录：全站 UI 设计系统统一（按钮 / chip / 卡片结构层收敛）

- 日期：2026-10-17
- 任务卡：docs/tasks/2026-10-17-ui-design-system-unification.md
- 结论：**通过**（typecheck 为环境类非阻塞项，见「失败项与处理」）

## 检查项（纯客户端范围，服务端三项按门禁裁剪规则跳过）

| 检查项          | 命令                                   | 结果                                                                                                                                              |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint            | `pnpm lint`                            | ✅ 0 error / 0 warning（修复 4 处：ml-chip selectTextBase 静态类误写、paywall/report 孤儿常量）                                                   |
| 格式            | `pnpm format:check`                    | ✅（9 个本次新增/修改文件 prettier --write 后复检通过）                                                                                           |
| 单测            | `pnpm test`                            | ✅ 7 files / 92 tests                                                                                                                             |
| uvue CSS 守卫   | `node scripts/check-uvue-css.mjs`      | ✅ 31 个 .uvue，零违规                                                                                                                            |
| 设计 token 守卫 | `node scripts/check-design-tokens.mjs` | ✅ **A–H 八项全绿**（47 token 双向 / 142 hex / 101 图标 / 新增检查 G 手搓卡片禁令 5580 行零违规 / 新增检查 H 手搓 chip 禁令零违规·例外 2 处登记） |
| SOP 登记守卫    | `node scripts/check-sop-registry.mjs`  | ✅ 17 skill / 13 SOP 零发现                                                                                                                       |
| typecheck       | `pnpm typecheck`                       | ⚠️ 环境类非阻塞，见下                                                                                                                             |
| MP 生产构建     | `pnpm build:mp-weixin`                 | ✅ DONE（exit 0）                                                                                                                                 |

## 产物验证（字面量 / 色值纪律，规避 wtu- 哈希与标识符混淆）

| 验证点                  | 位置                                                | 结果    |
| ----------------------- | --------------------------------------------------- | ------- |
| ml-segmented 文案序列化 | `pages/report/report.js`「本场报告」                | ✅ ×1   |
| E2E 契约 id 存活        | report.js「seg-report/seg-growth」                  | ✅ ×2   |
| ml-chip hint 文案       | prep.js / onboarding.js / prefs.js「敬请期待」      | ✅ ×2×3 |
| ml-button link 文案     | onboarding.js「先跳过」                             | ✅ ×1   |
| ml-chip action 文案     | resume.js「忽略」×1 /「采用」×6 /「导出」×2         | ✅      |
| 品牌色存活              | wxss「5b6cff」×21 /「eef1ff」×5 /「ui-monospace」×7 | ✅      |

## 覆盖要求核验（TDD 留痕）

- 新增 / 修改**纯逻辑**：本卡为组件样式与模板结构收敛，无引擎/ store/ types 纯逻辑变更 → 不适用。
- **修 Bug** 复现测试：不适用（结构收敛非缺陷修复）；结构回归由机检检查 G/H 承担（退出码门禁）。

## 失败项与处理

**`pnpm typecheck` 退出码 2：`tests/report-segment.spec.ts(4,10) TS2305 Module '*.uts' has no exported member 'reportSegmentIntent'`。定性：环境类非阻塞（vue-tsc 对 .uts 模块解析限制），非本次改动引入。**

证据链：

1. `store/report-segment.uts:21` 确有 `export const reportSegmentIntent`（grep 复核）；
2. 同一导入在 vitest 下正常（92/92 通过，含该 spec）；
3. 本卡改动清单（任务卡 §6）不含 store/、tests/、report-segment 相关文件；
4. 门禁 SOP 明示 typecheck 非 CI 阻塞项（vue-tsc 依赖 HBuilderX 环境）。

处置：不修改测试、不放宽门禁；记录在案，待 HBuilderX 环境本地复核。

**`pnpm format:check` 首跑 9 文件告警**：均为本卡新增/修改文件（新文件缩进与旧文件 CRLF 幽灵），`prettier --write` 后复检 exit 0，非规则放宽。
