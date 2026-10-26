# G2 门禁记录：简历免费诊断价值化与付费续接（previewIssues）

- 日期：2026-10-26
- 任务卡：[2026-10-24-resume-free-value-funnel.md](./2026-10-24-resume-free-value-funnel.md)
- 契约：[2026-10-24-resume-preview-teaser.freeze.md](../contracts/2026-10-24-resume-preview-teaser.freeze.md)（FE / BE 双签，2026-10-26）
- 结论：**G2 通过**（代码门禁全绿；真机走查与云端 smoke 待 QA 补录）

## 1. 命令结果

| 命令                                         | 结果                            |
| -------------------------------------------- | ------------------------------- |
| `pnpm lint`                                  | 0 error / 0 warning             |
| `pnpm format:check`                          | 全绿                            |
| `pnpm typecheck`                             | 通过                            |
| `pnpm test`                                  | 8 文件 / 117 通过               |
| `node scripts/check-uvue-css.mjs`            | OK（33 个 .uvue）               |
| `node scripts/check-design-tokens.mjs`       | 全绿（A–H 八项）                |
| `pnpm --filter @mentorloop/server typecheck` | 通过                            |
| `pnpm --filter @mentorloop/server test`      | 30 文件 / 237 通过（新增 4 例） |
| `pnpm --filter @mentorloop/server build`     | 通过                            |
| `pnpm build:mp-weixin`                       | 构建成功                        |

## 2. 已实施范围

- **契约**：`ResumeIssue.locked`、`ResumeParseResult.previewIssues` 新增；`/resume/parse`、`/resume/detail` 出参透传；旧记录读取时回填（`previewIssues=[]`、`issues[].locked=false`）。无新增端点、无新增业务码。
- **服务端预览编排**（`services/resume.ts`）：免费态调一次轻量 LLM（最多 3 条），首条完整改写、其余 `locked=true` 且 `suggested=''`；LLM 未配置 / 超时 / 失败 → 回退结构预览（`previewIssues=[]`），HTTP 200，不扣额度。
- **预览缓存**：同 user + 文件 hash + 岗位命中 → 不调 LLM、不新增 `resume_usages` preview 记录、`cached=true`。
- **历史去重**：preview → full 更新同一行，`resumeId` 不变，历史不出现两条。
- **预览裁剪**（`services/resume-review.ts`）：`reviewResumePreviewWithLlm`（`maxTokens≈700`、超时 ≤8s）+ `toPreviewIssues`（复用 `validateIssues` 的 quote 命中校验）。
- **客户端**（`pages/resume/resume.uvue`）：解析完成自动滚到诊断摘要；免费态展示 1 条完整 + 2 条锁定占位（网络响应中无 `suggested`）；底部固定 CTA「解锁完整批注与改写」→ `paywall?from=resume`；付费返回后 `onShow` 检测 `canFull` 自动用上次 cloud fileID 重跑 full，失败给「重试」出口。
- **历史回放**（`pages/resume/detail.uvue`）：免费记录展示诊断列表，`locked=true` 条目不渲染 `suggested`，展示「解锁完整评审后查看改写」。
- **Mock 对齐**（`api/mock/resume.mock.uts`）：会员 / 单次包 → full；免费用户 → preview（1 完整 + 2 锁定）。
- **成本卡**：§11 补「免费预览 LLM ≈ 0.004–0.006 元/次」行，并同步 §4 验收口径与 §8 质询 #8。

## 3. 新增测试

- 服务端 `server/src/resume-route.spec.ts`：免费预览 teaser（LLM 可用 → 3 条、首条完整、其余锁定且无 `suggested`；二次预览 `cached=true` 不扣次数）；preview → full 同行更新（`resumeId` 不变、历史仅一条）；免费每日上限用例改为逐次换岗位以避开缓存。
- 服务端 `server/src/resume-review.spec.ts`：`toPreviewIssues`（最多 3 条、锁定条去 `suggested`、空输入回退）；`validateIssues` 补 `locked=false` 断言。

## 4. 待补（未在本次执行）

- 真机走查（MP + App 各一次）：免费态锁态、自动滚动、支付返回自动续跑。
- 云端 smoke：`/resume/parse` 免费态出参逐字核对（`previewIssues` 1–3 条、`issues=[]`）。
- 免费诊断质量人工评测（5–10 份真实简历，任务卡 §4 / §5 风险项）。

## 5. 备注

- 预览缓存使「同文件 + 同岗位」二次预览不再消耗每日次数，属契约 §0 决策；既有「每日 3 次上限」用例已按新语义调整（换岗位以命中不同缓存键）。
- 本次未改表结构（`resumes.parse_payload` 为 JSON 文本），无需迁移脚本。
