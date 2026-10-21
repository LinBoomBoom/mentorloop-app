# 验收结论：简历 AI 深度解析与批注（批次 1）

- 日期：2026-10-21
- 任务卡：docs/tasks/2026-10-21-resume-ai-review.md
- 门禁记录：docs/tasks/2026-10-21-resume-ai-review.gate.md
- 契约冻结：docs/contracts/2026-10-21-resume-ai-review.freeze.md
- 结论：**批次 1 通过（代码与单测）**；真机/云端联调与批次 2（批注版 PDF）待执行

## 1. 审查结论

| 检查项   | 手段                                                       | 结论                                 |
| -------- | ---------------------------------------------------------- | ------------------------------------ |
| 代码审查 | 按 TRAE-code-review 口径自查（正确性/回归/可维护性）       | 无阻断                               |
| 安全审查 | 按 TRAE-security-review 口径自查（越权/注入/PII/资源滥用） | 无高危；属主与锚点校验为本次新增防线 |

重点核验：

- 模型输出 quote 必须命中抽取原文，未命中即丢弃（防幻觉/防注入式改写）。
- 历史/详情/删除均按 `uid + resumeId` 属主查询；非本人统一 404。
- 额度预扣失败可回滚；缓存命中不计费；免费预览有日上限。
- LLM 请求前手机号/邮箱脱敏；正文不写日志；隐私文案已改为「脱敏后调用模型，记录可删除」。

## 2. 验收标准核验（对照任务卡 §4）

- [x] 真实 PDF/DOCX 文本抽取；固定假数据（Java/Spring 等）已移除。
- [x] 扫描版 PDF（无文本层）返回「请上传可复制文本」，不扣额度。
- [x] 每条 issue 的 `quote` 命中原文才保留（单测覆盖未命中丢弃）。
- [x] LLM 未配置/失败返回 503，额度回滚（单测覆盖）。
- [x] 免费预览每日 3 次；会员每月 5 次；单次包 3 次，条件扣减不超发。
- [x] 同文件 + 同岗位完整评审命中缓存，不消耗额度与 token。
- [x] 历史列表/详情/删除仅本人可见；删除清理云对象；注销清理 `resumes` 与 `resume_usages`。
- [x] 客户端逐条对照（原文/建议/理由/严重度/需补证据）、历史回看、额度与付费引导；`build:mp-weixin` 通过。
- [x] G2 全绿（根 typecheck 为存量非阻断，见门禁记录）。

## 3. 产品红线复核

| 红线项                     | 结论                                                          |
| -------------------------- | ------------------------------------------------------------- |
| 面试房间不显示实时评分     | 不涉及                                                        |
| 评分必须引用证据           | 不涉及（简历评审不替代面试评分）                              |
| LLM 只做解释与示例         | 简历评审仅基于原文给建议，quote 未命中即丢弃；不改面试报告    |
| AI 改写标「建议稿」        | ✅ 页面标注「AI 逐条批注 · 采用后写入草稿」；需补证据单独标记 |
| AI 不伪装真人              | 不涉及（无真人化表达）                                        |
| 隐私红线                   | ✅ 原文件与记录可删除；注销级联清理；LLM 前脱敏；正文不进日志 |
| 无障碍（不只靠颜色表状态） | ✅ 严重度用文字标签「高/中/优先级」，非纯色                   |

## 4. 契约一致性

| 冻结项                                      | 实现位置                                          | 一致 |
| ------------------------------------------- | ------------------------------------------------- | ---- |
| `POST /resume/parse` 新增 fileName/position | `server/src/routes/misc.ts` / `api/resume.uts`    | ✅   |
| `GET /resume/history` / `detail` / `DELETE` | `server/src/routes/misc.ts`                       | ✅   |
| `GET /resume/quota`                         | `server/src/routes/misc.ts` / `resume-quota.ts`   | ✅   |
| 403 属主校验（cloud fileID）                | `routes/misc.ts` + `services/cloud-file.ts`       | ✅   |
| `resume_pack_3`（3 次 / 29 元）             | `server/src/data/skus.ts` / `services/payment.ts` | ✅   |
| users/resumes 新列 + resume_usages 表       | `schema.sql` / `baseline-mp-mysql.sql` / 迁移脚本 | ✅   |
| 两端类型字段一致                            | `types/resume.uts` ↔ `server/src/types/domain.ts` | ✅   |

## 5. 待办（人工 / 外部环境 / 批次 2）

1. ~~云端 MySQL 迁移~~ ✅ 已由服务启动自动迁移（版本 `mentorloop-mp-api-016`，`/resume/quota`、`/resume/history` 均 200）；SQL 文件保留作人工参照。
2. ~~LLM 配置~~ ✅ 已注入 `LLM_ENABLED=true` / `LLM_BASE_URL=https://api.deepseek.com/v1` / `LLM_MODEL=deepseek-chat` / `LLM_API_KEY`（不回显）；云端 22 键回读齐全，DeepSeek 完整评审实测通过。
3. ~~云存储凭据~~ ✅ 云端已有 `WX_APPID` / `WX_SECRET`，真实 PDF 下载抽取已通。
4. **真机走查**：PDF 上传 → 完整评审 → 历史回看 → 删除 → 付费包购买（Mock 支付）全链路。
5. **DOCX 真样本**：用真实 Word 简历验证段落锚点与建议质量（云端已用最小 DOCX 验证抽取，真实样本待测）。
6. **批次 2**：批注版 PDF 导出（PDF 原文件高亮 + 批注；DOCX 输出评审版 PDF，不做原版式还原），需另立冻结单。
7. **LLM 提示词质量**：用 10–20 份真实简历做人工评测，按「可执行性/无幻觉/岗位相关性」打分后再放量。
8. **发布前密钥轮换（P3-9）**：本次联调通过 `tcb cloudrun detail` 回读时终端打印过 EnvParams 明文，发布前轮换 `MYSQL_PASSWORD` / `JWT_SECRET` / `TENCENTCLOUD_SECRET_KEY` / `WX_SECRET` 并回写。

## 6. 云端联调执行记录（2026-10-21）

- 部署：`tcb cloudrun deploy` → 版本 `mentorloop-mp-api-015` / 访问策略误覆盖；已重新发布 `-016` 恢复访问策略；注入 LLM 后发布 `-017`；按用户要求轮换 LLM Key 后发布 `-018`（当前线上）。
- LLM Key 轮换：按用户提供的新 Key 更新云端 `LLM_API_KEY`，发布 `-018`；完整评审复测 **200 / 6.2s / 5 条建议（3 条 high）**，额度 3→2。
- 健康检查：`GET /healthz` → `{ ok: true, driver: "mysql" }`。
- 数据库：启动自动迁移生效，`GET /resume/quota`、`GET /resume/history` 均返回 200（列/表存在）。
- 付费发放：`POST /membership/order { skuId: "resume_pack_3" }` → `payParams=null`（Mock），`resume_single_total=3`，`canFull=true`。
- 真实 PDF 预览：上传 1 页 PDF 至 `resumes/<uid>/…` → `POST /resume/parse` 返回 `mode=preview`、`pages=1`、`techStack=[Java, Spring, Spring Boot, MySQL, Redis]`、`quantified=true`；预览额度 3→2。
- 真实 DOCX 预览：生成最小 DOCX 上传 → `fileType=docx`、文本抽取与技术栈识别正常；随后删除记录并注销测试账号。
- 历史与删除：`GET /resume/history` 返回该记录；`DELETE /resume/detail` 后列表清空，云存储对象同步删除（`tcb storage list` 已确认）。
- AI 完整评审（DeepSeek）：有额度用户 `POST /resume/parse` → 200，耗时 **6.6s**，返回 **7 条**锚定建议（2 条 high）；`singleLeft` 3→2。
- 缓存：同文件同岗位再次解析 → `cached=true`，耗时 **709ms**，额度不再扣减。
- 历史摘要：`issuesHigh=2`、`issuesTotal=7`、`mode=full`。
- TTS 回归：`POST /interview/tts` 返回 `tts/<uid>/tencent/…mp3`；`POST /interview/tts-ack` 后对象删除。
- 清理：全部测试账号已 `DELETE /me/account`；测试 PDF/DOCX/TTS 对象已删除。

## 7. 签字

| 角色             | 结论                 | 日期       |
| ---------------- | -------------------- | ---------- |
| 审查 Agent       | 通过                 | 2026-10-21 |
| UX（设计走查）   | 待真机               |            |
| QA（含安全准入） | 通过（代码）/ 待真机 | 2026-10-21 |
