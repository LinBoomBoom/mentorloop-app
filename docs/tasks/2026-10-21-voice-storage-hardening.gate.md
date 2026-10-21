# G2 门禁记录：系统问题清单批次 1+2（录音上限 · 云存储清理 · fileID 属主校验）

- 日期：2026-10-21
- 任务卡：docs/tasks/2026-10-21-voice-storage-hardening.md
- 结论：通过

| 检查项           | 命令                                         | 结果 | 备注                                               |
| ---------------- | -------------------------------------------- | ---- | -------------------------------------------------- |
| Lint             | `pnpm lint`                                  | ✅   | 0 error / 0 warning                                |
| 格式             | `pnpm format:check`                          | ✅   | 全仓通过（含本次格式化上游支付分析卡）             |
| 根单测           | `pnpm test`                                  | ✅   | 7 文件 / 102 用例全绿                              |
| uvue 守卫        | `node scripts/check-uvue-css.mjs`            | ✅   | 31 个 .uvue，无受限原子类                          |
| token 守卫       | `node scripts/check-design-tokens.mjs`       | ✅   | A–H 检查全绿                                       |
| 服务端 typecheck | `pnpm --filter @mentorloop/server typecheck` | ✅   | 通过                                               |
| 服务端单测       | `pnpm --filter @mentorloop/server test`      | ✅   | 19 文件 / 145 用例全绿                             |
| 服务端构建       | `pnpm --filter @mentorloop/server build`     | ✅   | tsc 产物成功                                       |
| 小程序构建       | `pnpm build:mp-weixin`                       | ✅   | uni-app x 5.26 编译通过（追加验证，非 G2 必跑项）  |
| 根 typecheck     | `pnpm typecheck`                             | ❌¹  | 非阻断；7 处报错均为改动前存量，见「失败项与处理」 |

> ¹ 依据 quality-gate-sop §2.1 脚注：根 `typecheck` 依赖 HBuilderX 环境，CI `continue-on-error`，不阻断。

## 覆盖要求核验（TDD 留痕，2026-10-15 起）

- 新增 / 修改**纯逻辑**的测试路径：
  - `server/src/asr-cloud.spec.ts`：`cloudFilePath` / `isOwnedCloudFileID` 路径解析与属主段校验。
  - `server/src/wx-storage.spec.ts`（新增）：批量删除凭据缺省跳过、官方参数与 50 条分批、错误码抛错。
  - `server/src/interview.spec.ts`：`asr-cloud` / `resume-parse` / `tts-ack` 三端点 403/400/401 与本人放行。
  - `server/src/me.spec.ts`：注销删除 `cloud://` 简历对象、云删除失败不阻断注销。
  - `server/src/tts.spec.ts`：合成写入路径含 `tts/<uid>/` 段。
- **修 Bug** 的复现测试（先红后绿证据）：不适用——本批为安全加固与功能新增，历史缺口无既有自动化复现；新增用例作为回归护栏。其中属主校验用例在改动前实现上会返回 200（缺口），改动后为 403。

## 失败项与处理

- 根 `pnpm typecheck` 失败（7 处，均为存量、且不在本次改动文件内）：
  - `tests/evals/eval-set.ts`：`resumeTechStacks` 不在 `EvalCase`（5 处）。
  - `tests/evals/eval.spec.ts`：同字段访问（1 处）。
  - `tests/report-segment.spec.ts`：`reportSegmentIntent` 未导出（1 处）。
- 处理：按 G2 脚注记为非阻断；本批不修改评测集与报告分段代码，避免范围蔓延。建议另立微链修复。
