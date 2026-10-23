# 任务卡：面试覆盖度/续接与跨场次去重 + 训练续组

- 日期：2026-10-24
- 关联：P1 体验优化；来源 2026-10-23 题量/定价讨论；云端题库 [2026-10-18-cloud-bank-integration.md](./2026-10-18-cloud-bank-integration.md) §批次 B；成本口径 [2026-10-22-cost-and-pricing-decision.md](./2026-10-22-cost-and-pricing-decision.md)

## 1. 目标

在不改定价的前提下，把单场 7 题的价值做实：跨场不重复、六维覆盖可见、用户可随时结束或续一题，训练可原地续组。

## 2. 范围

- 做：
  1. **跨场次去重**：新增 `user_asked_history`（uid × question_id），`/interview/next` 选题目排除最近 90 天 / 最近 300 题；池不足时回退最近最少使用；同场 `session_asked` 去重不变。
  2. **面试覆盖度与续接**：房间展示「已覆盖 X/6 维度 · 第 N 题」；满 7 题或覆盖不足时提供「生成报告 / 再来一题」；续题复用同一 session，安全上限 12 题；续题期间以题量为准、时间预算不触发收束；用户随时结束。
  3. **训练续组**：小结页新增「再来 5 题」，沿用当前方向/细分领域/难度直接开新组；保留「再来一组」回配置页。
  4. **契约**：`/interview/next` 新增可选 `maxQuestions`（默认 0 = 模式预算），先出冻结单再实现。
  5. **验证**：服务端/客户端单测 + 规则镜像一致性 + G2；云端连续两场 smoke 验证交集。
- 不做：
  - 不改定价、SKU、权益文案；
  - 不做 20 题挑战组、deep 模式 UI、每日计划（P2）；
  - 不做训练跨场去重；
  - 不重做报告、评分、追问策略；
  - 不做实时 LLM 反馈；
  - 不做固定时长档位（沿用用户裁决：用户自由控制面试时长）。

## 3. 依赖

- 前置：云端题库 16,453 题（[cloud-bank L18](./2026-10-18-cloud-bank-integration.md)）；`session_asked` 单场去重已存在；`QuestionItem.abilityDomain` 已可用；`interviewSession.getQuestions()` 已保存本场题目。
- 外部环境：云托管需要部署 `user_asked_history` 迁移；体验版/开发者工具用于走查。
- 契约：**是**——`api/interview.uts` 与 `/interview/next` 请求新增可选 `maxQuestions`；冻结单 [2026-10-24-interview-max-questions.freeze.md](../contracts/2026-10-24-interview-max-questions.freeze.md) 双签后再实现；`types/` 预计不改。

## 4. 验收标准

- [x] `user_asked_history` 幂等建表（SQLite 自举 + 云端启动迁移）；每次成功出题写入 uid×question，重复出题更新 `asked_at`（本地集成测试通过；039 已部署）。
- [x] 同一用户连续两场（同方向/难度池充足）题目交集 = 0；池不足时回退最近最少使用且不崩溃，日志可查（本地集成测试 + 039 云端 smoke 通过）。
- [x] 房间展示「已覆盖 X/6 维度 · 第 N 题」；第 7 题后出现「生成报告 / 再来一题」，续题复用同一 session，最多 12 题；随时可结束（2026-10-24 开发者工具走查：7/7 后入口出现，再来一题 → 8/12；截图 `room-01/02`）。
- [x] `/interview/next` 不传 `maxQuestions` 行为不变（standard 7 / quick 3 / deep 12）；传 12 时可续到 12 后才收束。
- [x] `maxQuestions > 0` 时时间预算不触发收束（含 `remainSeconds=0` / 超时）；`maxQuestions=0` 时 `timeShort` 行为不变。
- [x] 训练小结「再来 5 题」直接以原方向/细分/难度开新组，无需回配置页；「再来一组」仍可用（2026-10-24 开发者工具走查：按钮可见，点击后新组 1/5；截图 `training-01/02`）。
- [x] 规则镜像一致性、服务端单测、G2（`lint` / `typecheck` / `test` / `build:mp-weixin`）全绿。
- [x] 云端 smoke（039）：连续两场题目交集 `[]`；`maxQuestions=12` 可续到 12；非法 13 → 业务码 400；旧调用不传参数行为不变。

> 门禁与测试明细：[G2 记录](./2026-10-24-interview-coverage-dedupe-continue.gate.md)。

## 5. 风险与对策

| 风险                          | 等级 | 对策                                                                  |
| ----------------------------- | ---- | --------------------------------------------------------------------- |
| 池不足 / 同方向同难度导致无题 | 中   | 先放宽跨场历史过滤，保留同场去重；仍不足则收束，不重复当前场          |
| 历史表无限增长                | 低   | 索引 `(user_id, asked_at)`；只查最近 90 天 / 300 条，清理任务后续补   |
| 续题导致单场过长、疲劳        | 中   | 默认 7 题；续题必须用户主动点；硬上限 12；覆盖度展示不用分数/颜色施压 |
| 时间预算在续题时提前收束      | 高   | `maxQuestions>0` 时 `timeShort` 不生效；两镜像同步改并加单测          |
| 改默认预算导致既有断言回归    | 中   | 默认预算保持 7；仅显式 `maxQuestions=12` 生效；新增用例，不改旧断言   |
| 契约冻结未签就动 API          | 高   | 先冻结、后编码；冻结单落 `docs/contracts/`                            |
| 云端未部署时续题失败          | 中   | 续题收到 2001/收束题时直接进入报告，不留死路                          |
| 覆盖度被理解为「实时评分」    | 中   | 只显示「已覆盖」和维度名，不显示分数；遵守房间无实时分数红线          |

## 6. 产物路径

- 新增：
  - `docs/contracts/2026-10-24-interview-max-questions.freeze.md`
  - `server/src/services/asked-history.ts`（如需要独立服务）
- 修改：
  - `server/src/schema.sql`、`server/src/db.ts`（`user_asked_history` 本地自举）
  - `server/src/routes/interview.ts`、`server/src/services/interview.ts`
  - `server/src/rules/question-selector.ts`、`engine/question-selector.uts`
  - `api/interview.uts`
  - `pages/interview/room.uvue`、`store/interview-session.uts`（如需缓存覆盖集合）
  - `pages/training/room.uvue`
  - `tests/interview-engine.spec.ts`、`tests/rules-consistency.spec.ts`、服务端对应 spec
- 不改：`types/interview.uts`；若实现中必须新增出参字段，停止并重新冻结。

## 7. 角色

- 主责：FE（房间/训练）、BE（历史表/端点）
- 配合：AI（选题与去重规则）、UX（覆盖度展示）、QA（G2/E2E）、PO（范围）

## 8. 负责人

FE + BE，执行 Agent（本会话）

## 9. 开工前质询（未决项清单）

| #   | 质询                         | 结论                                                                                                                                                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 当前题量到底是多少？         | 已查证：面试 standard 7、quick 3 / deep 12 仅引擎存在；训练 5/10；仓库无 20。见 [question-selector.uts L52-54](../../engine/question-selector.uts)、[training.uvue L233](../../pages/training/training.uvue) |
| 2   | 20 题适合做默认单场吗？      | 已决策：不适合。20 题只作为 P2「挑战组/测评组」，中间设小结与休息点                                                                                                                                          |
| 3   | 跨场次去重现在有吗？         | 已查证：没有。仅 `session_asked` 单场去重；批次 B 未动（[cloud-bank L160](./2026-10-18-cloud-bank-integration.md)）                                                                                          |
| 4   | 历史表怎么存？               | 已决策：`user_asked_history(user_id, question_id, asked_at, position_id)`，唯一 `(user_id, question_id)`，重复出题 upsert `asked_at`                                                                         |
| 5   | 排除多少历史？               | 已决策：最近 90 天或最近 300 条；池不足时放宽跨场过滤                                                                                                                                                        |
| 6   | 覆盖度要不要新接口？         | 已查证：不需要。`QuestionItem.abilityDomain` + `DIMENSION_LABEL` + `interviewSession.getQuestions()` 可客户端计算                                                                                            |
| 7   | 怎么续到 12 又不改默认？     | 已决策：`/interview/next` 新增可选 `maxQuestions`；默认 0 走模式预算；显式传 12 才续；需契约冻结                                                                                                             |
| 8   | 训练续组能否纯客户端？       | 已查证：可以。房间 `onLoad` 已读 `count/subtrack/difficulty`，`redirectTo` 同页即可                                                                                                                          |
| 9   | 多几题成本会超吗？           | 已查证：单场约 0.02 元；12 题仍可忽略（[cost card L107-112](./2026-10-22-cost-and-pricing-decision.md)）                                                                                                     |
| 10  | 会不会回归固定时长档位？     | 已决策：不会。只展示覆盖度/题数，用户随时结束                                                                                                                                                                |
| 11  | 默认预算改 7→12 吗？         | 已决策：不改默认；仅显式 `maxQuestions=12` 生效，旧断言不变                                                                                                                                                  |
| 12  | 池不足时怎么办？             | 已决策：先放宽跨场历史，保留同场去重；仍不足则收束，不重复当前场                                                                                                                                             |
| 13  | 续题会被时间预算提前收束吗？ | 已查证：standard 第 7 题后 `remainSeconds` 只剩 150/0，现有 `timeShort` 会直接收束。已决策：`maxQuestions>0` 时以题量为准，`timeShort` 仅对 0 生效；两镜像同步改                                             |
