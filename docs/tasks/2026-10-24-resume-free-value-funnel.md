# 任务卡：简历免费诊断价值化与付费续接

- 日期：2026-10-24
- 关联：P1.3 简历评审；来源 2026-10-24 用户反馈（免费分析无价值、不知道如何进入优化建议）；设计参考 Resume Worded / Grammarly / 超级简历的「先给证据、再锁改写」做法
- 契约冻结单：[2026-10-24-resume-preview-teaser.freeze.md](../contracts/2026-10-24-resume-preview-teaser.freeze.md)

## 1. 目标

把免费预览从「结构统计」升级为「3 条有证据的诊断 + 1 条完整改写」，并打通「解析 → 诊断 → 解锁 → 自动续跑深度评审」，让用户在付费前就看到真实价值，付费后不需要重新上传。

## 2. 范围

- 做：
  - 服务端免费预览调用一次轻量 LLM，产出最多 3 条锚定原文的问题；第 1 条给完整改写，第 2-3 条 `locked=true` 且不下发 `suggested`。
  - 新增 `ResumeIssue.locked` 与 `ResumeParseResult.previewIssues`；`issues` 仍只承载付费完整评审。
  - 预览结果缓存（同用户 + 同文件 hash + 同岗位）；命中不调 LLM、不扣每日预览次数。
  - LLM 未配置 / 超时 / 失败 → 回退结构预览（`previewIssues=[]`），不报错、不扣会员 / 单次包额度。
  - 客户端解析完成自动滚到「诊断摘要」；免费态展示 1 条完整 + 2 条锁定改写；底部固定解锁 CTA。
  - 付费成功返回简历页后自动用上次 cloud fileID 重跑完整评审；同 hash + 岗位的 preview 行更新为 full，避免历史出现两条同文件记录。
  - 历史详情页支持 locked 态（不显示未授权改写）。
  - Mock 对齐真实出参。
  - 成本卡补免费预览 LLM 成本行。
- 不做：
  - 不改定价 / SKU / 会员权益文案。
  - 不做简历诊断分数（避免与面试六维评分混淆）。
  - 不做 OCR / 图片简历 / 多文件批量。
  - 不改付费 8 条上限、付费 prompt 结构与完整评审缓存策略。
  - 不做锁定改写的客户端编辑 / 导出。
  - 不做分享 / 邀请解锁。

## 3. 依赖

- 前置：LLM 已配置（`LLM_ENABLED=true`、`LLM_BASE_URL`、`LLM_MODEL`）；`/resume/parse` 完整评审已上线；复用现有 `buildPrompt` 与 `validateIssues` 的 quote 命中校验。
- 外部环境：无新增密钥；真机需 MP + App 各走一次。
- 契约：**是**——`types/resume.uts` 与 `/resume/parse` / `/resume/detail` 出参新增字段，先签 [冻结单](../contracts/2026-10-24-resume-preview-teaser.freeze.md)。

## 4. 验收标准

- [ ] preview 出参：`issues=[]`；`previewIssues` 长度 1–3；首条 `locked=false` 且 `suggested` 非空；其余 `locked=true` 且 `suggested` 为空；每条 `quote` 均命中原文（沿用 `validateIssues`）。
- [ ] 免费预览 LLM 未配置 / 超时 / 失败 → 结构预览 `previewIssues=[]`，HTTP 200，不扣会员 / 单次包额度。
- [ ] 同用户 + 同文件 + 同岗位二次预览：`cached=true`，不调用 LLM，不新增 `resume_usages` preview 记录。
- [ ] 客户端解析完成后自动滚动到诊断摘要；首屏文案含「发现 N 条问题 · 免费可看 1 条完整改写」。
- [ ] 免费态：首条展示原文 / 建议稿 / 原因；锁定条展示原文 / 原因 + 锁态占位，网络响应中无 `suggested`。
- [ ] 免费态底部固定 CTA「解锁完整批注与改写」，点击进入 `paywall?from=resume`。
- [ ] 支付成功返回：无需重新上传，自动重跑 full；成功后展示完整 issues；失败有「重试」出口。
- [ ] 同文件 preview→full 只保留一条历史记录（resumeId 不变）。
- [ ] 历史详情页对 `locked=true` 的条目不显示 `suggested`，展示「解锁完整评审后查看改写」。
- [ ] Mock 环境与真实现象一致。
- [ ] 服务端新增单测覆盖 preview teaser / 缓存 / 回退 / 去重历史；G2 全绿。
- [ ] 成本卡补充「免费预览 LLM ≈ 0.004–0.006 元/次（3 条输出估算）」行，并按规则 §5 复核定价红线。

## 5. 风险与对策

| 风险                           | 等级 | 对策                                                                                             |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| 免费 LLM 被批量刷              | 中   | 沿用每日 3 次预览上限 + 同文件缓存 + 日志监控；超限回退结构预览                                  |
| 免费诊断质量差反而降低付费意愿 | 高   | 复用付费 prompt 与 quote 校验；只展示最严重 3 条；上线前用 5–10 份真实简历人工评测，不合格不上线 |
| locked 改写被客户端绕过        | 中   | 服务端不下发 locked 条目的 `suggested`，客户端只做占位                                           |
| 付费后自动重解析重复计费       | 中   | 同 hash + 岗位命中 full 缓存不扣费；preview→full 更新同一行                                      |
| 解析后自动滚动打断阅读         | 低   | 仅首次解析后滚动一次；用户手动滚动后不再强制                                                     |
| 契约冻结未签先编码             | 高   | 先冻结后实现；G2 双向核对字段                                                                    |
| 免费成本与既有口径冲突         | 中   | 成本卡补行并由 PO 确认；预览调用单独超时，失败静默回退                                           |
| 旧客户端渲染异常               | 低   | `previewIssues` 为增量字段，旧客户端忽略；`issues` 语义保持不变                                  |

## 6. 产物路径

- 新增：
  - `docs/contracts/2026-10-24-resume-preview-teaser.freeze.md`
  - `docs/tasks/2026-10-24-resume-free-value-funnel.gate.md`（门禁记录）
- 修改：
  - `server/src/types/domain.ts`
  - `server/src/services/resume.ts`
  - `server/src/services/resume-review.ts`
  - `server/src/routes/misc.ts`
  - `server/src/resume-route.spec.ts`、`server/src/resume-review.spec.ts`
  - `types/resume.uts`
  - `api/resume.uts`（仅类型透传，不改端点）
  - `api/mock/resume.mock.uts`
  - `pages/resume/resume.uvue`、`pages/resume/detail.uvue`
  - `docs/tasks/2026-10-22-cost-and-pricing-decision.md`（成本行）
- 不改：`server/src/services/resume-quota.ts`（额度口径不变）、支付 / 会员链路、`pages/membership/paywall.uvue`（沿用 `from=resume`）

## 7. 角色

- 主责：BE（预览 LLM、缓存、去重、回退）、FE（诊断摘要、锁态、自动续跑）
- 配合：AI（prompt 与质量评测）、UX（免费 / 锁定 / 付费三态）、PO（成本与转化裁决）、QA（G2 + 真机）

## 8. 负责人

BE + FE，执行 Agent（本会话）

## 9. 开工前质询（未决项清单）

| #   | 质询                             | 结论                                                                                                                                                                                                                                  |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 免费预览是否调 LLM？             | 已决策：调一次轻量 LLM（最多 3 条、`maxTokens≈700`、超时 8s）；成本卡补行，用户已选「3 条诊断 + 1 条改写」                                                                                                                            |
| 2   | 锁定改写是否可被客户端绕过？     | 已决策：服务端不下发 locked 条目的 `suggested`；客户端只做占位                                                                                                                                                                        |
| 3   | 如何防止刷免费额度？             | 已查证：`reservePreview` 有每日上限（`RESUME_FREE_PREVIEW_DAILY`）；本卡增加同文件缓存，命中不扣次数                                                                                                                                  |
| 4   | LLM 失败会不会让免费用户无结果？ | 已决策：回退结构预览，HTTP 200；错误只进日志                                                                                                                                                                                          |
| 5   | 付费后如何续跑？                 | 已查证：`onShow` 目前只刷新额度 / 历史（[resume.uvue](../../pages/resume/resume.uvue)）；本卡在 `loadQuota` 后判断 `canFull && parsed.mode==='preview'`，用本次 `fileUrl` 重跑 full。paywall 由 `navigateTo` 打开，返回时页面实例仍在 |
| 6   | 同文件会不会出现两条历史？       | 已决策：full 落库时若存在同 user + hash + position 的 preview 行，UPDATE 该行为 full（resumeId 不变）                                                                                                                                 |
| 7   | 旧客户端兼容？                   | 已决策：`previewIssues` 为增量字段，旧客户端忽略；`issues` 语义不变（付费完整评审）                                                                                                                                                   |
| 8   | 自动滚动是否支持？               | 已查证：`scroll-view` 的 `scroll-into-view` 已在 `pages/interview/room.uvue` 与 `pages/training/room.uvue` 使用                                                                                                                       |
| 9   | 免费诊断质量如何保证？           | 已决策：复用付费 prompt 与 `validateIssues`（quote 必须命中原文），只截取最严重 3 条；上线前用 5–10 份真实简历人工评测                                                                                                                |
| 10  | 成本红线？                       | 已查证：完整评审 LLM ≈ 0.008 元、含解析 ≈ 0.02 元（成本卡 §11）；预览只出 3 条，估算 ≈ 0.004–0.006 元/次，每日 3 次上限                                                                                                               |
| 11  | 是否需要新增错误码？             | 已决策：不需要；预览 AI 失败静默回退                                                                                                                                                                                                  |
| 12  | 是否影响付费缓存？               | 已决策：不改 `findCachedFull`；新增独立的 preview 缓存查询                                                                                                                                                                            |
| 13  | 草稿恢复后还能自动续跑吗？       | 已决策：P0 只覆盖同页面会话（支付返回页面未销毁）；跨重启的草稿续跑待定（2026-11-07 前评估是否给 `ResumeDraftRecord` 增加 `sourceUrl`）                                                                                               |

## 10. 交互草案（实施依据）

- 解析完成 → 自动滚到 `#resume-result`，只滚动一次。
- 诊断摘要卡：
  - 标题：「发现 N 条可优化的问题」
  - 副标题：「免费可看 1 条完整改写；其余解锁后查看」
  - 问题分布：高 / 中 / 低（只显示计数，不显示分数）
- 免费态：
  - 第 1 条：原文 / 建议稿 / 原因（完整可读）
  - 第 2-3 条：原文 / 原因 + 灰底锁态「解锁后查看改写」
  - 底部固定 CTA：「解锁完整批注与改写」→ `paywall?from=resume`
- 付费态：沿用现有「AI 逐条批注」列表 + 采用 / 忽略 + 保存改写 + 投递版本。
- 付费返回：顶部状态条「已解锁，正在生成逐条批注…」；成功替换为完整列表，失败显示「重试」。
