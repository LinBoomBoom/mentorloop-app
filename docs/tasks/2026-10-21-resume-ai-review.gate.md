# G2 门禁记录：简历 AI 深度解析（批次 1）

- 日期：2026-10-21
- 任务卡：docs/tasks/2026-10-21-resume-ai-review.md
- 结论：通过

| 检查项           | 命令                                         | 结果 | 备注                                               |
| ---------------- | -------------------------------------------- | ---- | -------------------------------------------------- |
| Lint             | `pnpm lint`                                  | ✅   | 0 error / 0 warning                                |
| 格式             | `pnpm format:check`                          | ✅   | 全仓通过                                           |
| 根单测           | `pnpm test`                                  | ✅   | 7 文件 / 102 用例全绿                              |
| uvue 守卫        | `node scripts/check-uvue-css.mjs`            | ✅   | 31 个 .uvue                                        |
| token 守卫       | `node scripts/check-design-tokens.mjs`       | ✅   | A–H 全绿                                           |
| 服务端 typecheck | `pnpm --filter @mentorloop/server typecheck` | ✅   | 通过                                               |
| 服务端单测       | `pnpm --filter @mentorloop/server test`      | ✅   | 23 文件 / 165 用例全绿                             |
| 服务端构建       | `pnpm --filter @mentorloop/server build`     | ✅   | tsc 产物成功                                       |
| 小程序构建       | `pnpm build:mp-weixin`                       | ✅   | uni-app x 5.26 编译通过（追加验证）                |
| 根 typecheck     | `pnpm typecheck`                             | ❌¹  | 非阻断；7 处存量报错，与本次文件无关（同批次 1+2） |

> ¹ 依据 quality-gate-sop §2.1 脚注：根 `typecheck` 依赖 HBuilderX，CI `continue-on-error`，不阻断。

## 覆盖要求核验（TDD 留痕，2026-10-15 起）

- 新增 / 修改**纯逻辑**的测试路径：
  - `server/src/resume-extract.spec.ts`：PDF/DOCX 魔数、文本抽取、段落/页定位、扫描件拒绝。
  - `server/src/resume-review.spec.ts`：结构统计、PII 脱敏、quote 锚点校验、严重度排序、LLM 失败降级。
  - `server/src/resume-quota.spec.ts`：会员月度上限、单次包条件扣减、预览日上限、失败回滚、并发不超发。
  - `server/src/resume-route.spec.ts`：云下载 → 抽取 → LLM → 额度 → 缓存 → 历史/详情/删除全链路；免费预览；AI 不可用不扣费。
  - `server/src/services/payment.spec.ts`：`resume_pack_3` 发放 `resume_single_total=3`。
  - `server/src/me.spec.ts`：注销清理 `resume_usages`。
- **修 Bug** 的复现测试（先红后绿证据）：不适用——本批为占位实现替换（功能新增）+ 安全加固；新用例覆盖旧实现会返回固定假数据的缺口。
