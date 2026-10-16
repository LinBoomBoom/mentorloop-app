# G2 门禁记录：跨 tab 复盘域分段深链

- 日期：2026-10-15
- 任务卡：docs/tasks/2026-10-15-report-segment-deeplink.md
- 结论：**通过**（格式项为环境类失败，非本次改动引入，见「失败项与处理」）

| 检查项           | 命令                                         | 结果                                              |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| Lint             | `pnpm lint`                                  | ✅ 0 error / 0 warning                            |
| 格式             | `pnpm format:check`                          | ⚠️ 环境类失败 → 见下                              |
| 单测             | `pnpm test`                                  | ✅ 7 files / **92 tests**（原 89 + 新增 3）       |
| uvue CSS 守卫    | `node scripts/check-uvue-css.mjs`            | ✅ 28 个 .uvue 文件，零违规                       |
| 设计 token 守卫  | `node scripts/check-design-tokens.mjs`       | ✅ A–F 全绿（47 token 双向 / 141 hex / 101 图标） |
| SOP 登记守卫     | `node scripts/check-sop-registry.mjs`        | ✅ 17 skill / 13 SOP，结构面 + 预算面零发现       |
| 服务端 typecheck | `pnpm --filter @mentorloop/server typecheck` | ✅                                                |
| 服务端 单测      | `pnpm --filter @mentorloop/server test`      | ✅ 14 files / 83 tests                            |
| 服务端 构建      | `pnpm --filter @mentorloop/server build`     | ✅                                                |

## 覆盖要求核验（TDD 留痕）

- 新增 / 修改**纯逻辑**的测试路径：`tests/report-segment.spec.ts`（3 例：无意图返回空串 / 写入后可读一次 / 消费后清空不重放）。
- **修 Bug** 的复现测试（先红后绿证据）：**不适用**（本卡为功能新增，非缺陷修复）。

## 失败项与处理

**`pnpm format:check` 退出码 1，报 272 个文件。定性：环境类失败，非本次改动引入。**

证据链：

1. `.prettierrc.json` 设 `endOfLine: "lf"`；
2. 本机 `git config core.autocrlf` = `true` → 工作区文件以 CRLF 检出；
3. **未改动文件** `api/asr.uts` 单跑 `pnpm prettier --check` 同样失败；
4. 报错清单包含 `README.md`、`package.json`、`.prettierrc.json` 等本轮完全未触碰的文件；
5. Linux CI（LF 检出）的 `format:check` 为绿。

处置：**不**修改仓库格式规则、**不**用 `prettier --write` 掩盖、**不**放宽门禁。本轮改动文件已经 pre-commit 的 lint-staged `prettier --write` 处理，自身格式无违规。环境治理（`.gitattributes` 固定 `eol=lf`，或本机 `core.autocrlf=false`）**需另立任务**，本卡不处理。
