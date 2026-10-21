# 任务卡：简历 AI 深度解析与批注（P1-2 重构）

- 日期：2026-10-21
- 关联：系统问题清单 P1-2（简历解析为占位实现）；决策：会员月度额度 + 单次包、仅 PDF/DOCX、应用内对照 + 批注版 PDF
- 状态：批次 1 已实现并通过云端联调（线上 `mentorloop-mp-api-018`，DeepSeek 完整评审实测通过）；真机走查与批次 2（批注版 PDF）待执行。详见 [验收结论](./2026-10-21-resume-ai-review.accept.md)

## 1. 目标

把当前固定返回值的简历解析替换为真实 PDF/DOCX 抽取 + 证据锚定的 AI 评审，并补齐历史记录、会员/单次包额度与防刷闭环；把「解析结果」从 6 个字段升级为可执行的逐条修改建议。

## 2. 范围

- 做（批次 1）：
  - PDF/DOCX 真实文本抽取（含页码/段落定位），扫描版无文本层 PDF 明确拒绝。
  - LLM 结构化评审：每条建议含原文锚点、原文、建议稿、理由、严重度、是否需补证据；服务端校验锚点必须能在原文中命中。
  - LLM 未配置/失败时明确返回「AI 服务不可用」，**不再返回固定假数据**，且不扣额度。
  - 服务端历史记录：列表 / 详情 / 删除；按文件内容 SHA-256 缓存，重复解析零 token 消耗。
  - 付费门控：会员每月 5 次、单次包 3 次（`resume_pack_3`）；免费用户仅确定性结构预览（不调用 LLM）。
  - 客户端：逐条对照视图、历史记录入口、额度与付费引导。
- 做（批次 2）：
  - 批注版 PDF 导出：PDF 输入在原文件上高亮 + 批注；DOCX 输入输出评审版 PDF（保持原文摘录与批注，不做原版式还原）。
- 不做：
  - 图片/OCR 输入（相册入口保留但提示仅支持 PDF/DOCX；OCR 另立卡）。
  - DOCX 原格式修订/Word 批注回写（保真成本高，暂不做）。
  - App/H5 真后端文件上传（当前 App/H5 为 mock 模式，另立卡）。
  - 简历模板生成器、投递版本重构。

## 3. 依赖

- 前置：P1-2 现状确认（[resume.ts](../server/src/services/resume.ts) 为占位实现）；本批前已修复 fileID 属主校验与云存储回收。
- 外部环境：
  - LLM：复用现有 OpenAI 兼容配置 `LLM_ENABLED` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`；云端未配置时批次 1 只能做预览，完整评审不可用。
  - 云存储：PDF/DOCX 通过 `cloud://` 下载（复用 `getCloudFileTempUrl`），依赖 `WX_APPID` / `WX_SECRET`。
  - 依赖包：`pdfjs-dist`（PDF 文本 + 坐标）、`mammoth`（DOCX 文本）、`pdf-lib`（批次 2 批注）。
- 契约：**是** → [冻结单](../contracts/2026-10-21-resume-ai-review.freeze.md)。涉及 `types/`、`api/`、服务端出参、DB 列与新端点。

## 4. 验收标准

- [ ] 上传一份可复制文本的 PDF/DOCX，解析结果来自真实正文；与文件内容明显不符的固定值（Java/Spring 等）不再出现。
- [ ] 扫描版 PDF（无文本层）返回可理解错误「请上传可复制文本的 PDF」，不扣额度。
- [ ] 每条 issue 的 `anchor.quote` 能在抽取文本中精确命中；未命中的模型输出被丢弃。
- [ ] LLM 未配置/超时：返回业务错误且额度不变；客户端显示「AI 暂不可用」。
- [ ] 免费用户只得到确定性预览；会员每月最多 5 次完整评审；单次包按次扣减；并发/失败不重复扣。
- [ ] 同一文件（SHA-256 相同 + 目标岗位相同）重复解析命中缓存，不消耗额度与 token。
- [ ] 历史列表/详情仅本人可见；删除记录同时删除云上原文件与结果；注销账号清理全部简历数据。
- [ ] 客户端可逐条查看原文/建议/理由并标记采用；历史记录可回看。
- [ ] G2 全绿（两端）。

## 5. 风险与对策

| 风险                                       | 等级 | 对策                                                                  |
| ------------------------------------------ | ---- | --------------------------------------------------------------------- |
| LLM 幻觉导致建议与原文无关                 | 高   | 强制 anchor 原文精确匹配；未命中即丢弃；提示词要求只基于给定文本      |
| 简历 PII 进入第三方模型                    | 高   | 发送前脱敏手机号/邮箱；不写日志；隐私文案改为明确告知并取得同意       |
| 免费用户刷预览造成存储/算力消耗            | 中   | 预览每天 3 次；文件大小/页数上限；同一 hash 缓存                      |
| 解析超时/大文件阻塞请求                    | 中   | 10MB、PDF ≤20 页、抽取超时 15s、LLM 超时 30s、失败不扣额度            |
| PDF 文本层缺失（扫描件）                   | 中   | 明确拒绝并提示，不静默返回空结果                                      |
| 单次包定价未最终确认                       | 中   | 先按 3 次 / 29 元配置（与现有单次包同价），PO 可在 `skus.ts` 一处调整 |
| 云端 MySQL 需手工加列                      | 中   | 同步 `deploy/cloud/baseline-mp-mysql.sql`，发布前执行迁移并回读       |
| DOCX 批注 PDF 无法完全保留原版式（批次 2） | 中   | 明确为「评审版 PDF」，原文摘录 + 批注，不承诺版式还原                 |

## 6. 产物路径

- 新增：
  - `server/src/services/resume-extract.ts`、`server/src/services/resume-review.ts`、`server/src/services/resume-quota.ts`
  - `server/src/resume-extract.spec.ts`、`server/src/resume-review.spec.ts`、`server/src/resume-quota.spec.ts`
  - `docs/contracts/2026-10-21-resume-ai-review.freeze.md`
  - `docs/tasks/2026-10-21-resume-ai-review.gate.md`、`docs/tasks/2026-10-21-resume-ai-review.accept.md`
- 修改：
  - 服务端：`services/resume.ts`、`routes/misc.ts`、`types/domain.ts`、`schema.sql`、`deploy/cloud/baseline-mp-mysql.sql`、`data/skus.ts`、`services/payment.ts`、`config.ts`（额度常量）
  - 客户端：`types/resume.uts`、`api/resume.uts`、`pages/resume/resume.uvue`、`data/membership.uts`（单次包展示）
  - 测试：`server/src/interview.spec.ts`（属主）、`server/src/payment.spec.ts`（新 SKU）

## 7. 角色

- 主责：AI（评审规则与提示词）+ BE（抽取/额度/端点）
- 配合：FE / UX / QA / LC

## 8. 负责人

AI + BE + 执行 Agent（Trae）

## 9. 开工前质询（未决项清单）

| #   | 质询                   | 结论                                                                                       |
| --- | ---------------------- | ------------------------------------------------------------------------------------------ |
| 1   | 输入格式范围？         | 已决策（2026-10-21）：仅 PDF/DOCX；图片/扫描件不解析，提示改用可复制文本文件               |
| 2   | 输出形态？             | 已决策：批次 1 应用内对照；批次 2 批注版 PDF；DOCX 不承诺原版式                            |
| 3   | 付费模型？             | 已决策：会员每月 5 次 + 单次包 3 次；免费仅确定性预览                                      |
| 4   | 单次包价格？           | 已决策（暂定）：29 元 / 3 次，与现有 `single_pack_3` 同价；PO 可单点调整 `skus.ts`         |
| 5   | LLM 未配置时如何表现？ | 已决策：返回业务错误「AI 暂不可用」，不返回假数据、不扣额度                                |
| 6   | 历史记录保留策略？     | 已决策：保留至用户删除或注销；提供删除入口；隐私文案同步更新                               |
| 7   | 如何定位建议与原文？   | 已决策：PDF 用页码 + 文本项坐标；DOCX 用段落序号 + 原文引用；服务端精确匹配校验            |
| 8   | 缓存键？               | 已决策：`SHA-256(file) + position + promptVersion`；命中不计费                             |
| 9   | 免费预览的防刷？       | 已决策：每天 3 次 + 文件上限；缓存命中不计次                                               |
| 10  | 现有 MySQL 如何加列？  | 已决策：`schema.sql` + `deploy/cloud/baseline-mp-mysql.sql` 同步，发布前执行迁移脚本并回读 |
| 11  | 服务端文件读取通道？   | 已决策：MP 走 `cloud://` → `/tcb/batchdownloadfile`；App/H5 真后端上传另立卡               |
