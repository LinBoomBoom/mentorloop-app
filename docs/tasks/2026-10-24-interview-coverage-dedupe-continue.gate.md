# G2 门禁记录：面试覆盖度/续接与跨场次去重 + 训练续组

- 日期：2026-10-24
- 任务卡：[2026-10-24-interview-coverage-dedupe-continue.md](./2026-10-24-interview-coverage-dedupe-continue.md)
- 契约：[2026-10-24-interview-max-questions.freeze.md](../contracts/2026-10-24-interview-max-questions.freeze.md)
- 结论：**通过**（G2 代码门禁 + 云端 039 上线 + smoke + 开发者工具运行态走查）

## 1. 命令结果

| 命令                                         | 结果                            |
| -------------------------------------------- | ------------------------------- |
| `pnpm lint`                                  | 0 error / 0 warning             |
| `pnpm typecheck`                             | 通过                            |
| `pnpm test`                                  | 8 文件 / 117 通过（新增 4 例）  |
| `node scripts/check-uvue-css.mjs`            | OK（34 个 .uvue）               |
| `node scripts/check-design-tokens.mjs`       | 全绿（A–H 八项）                |
| `pnpm build:mp-weixin`                       | 构建成功                        |
| `pnpm --filter @mentorloop/server typecheck` | 通过                            |
| `pnpm --filter @mentorloop/server test`      | 29 文件 / 219 通过（新增 2 例） |
| `pnpm --filter @mentorloop/server build`     | 通过                            |

## 2. 已实施范围

- **跨场次去重**：新增 `user_asked_history`（SQLite 自举 + MySQL 启动迁移）；按最近 90 天 / 300 题排除；池不足时回退并打印告警；收束题不入历史。
- **续题契约**：`GET /interview/next` 新增可选 `maxQuestions`（0–12）；`maxQuestions>0` 时 `timeShort` 不触发收束；默认行为不变。
- **面试房间**：顶部显示「已覆盖 X/6 维度 · N/M 题」；第 7 道主问题完成后展示「生成报告 / 再来一题」，选择期间隐藏作答入口；续题复用同一 session，上限 12。
- **训练续组**：小结页新增「再来 5 题」，沿用方向/细分/难度直接 `redirectTo` 新一组。
- **账号注销**：级联清理新增 `practice_records` 与 `user_asked_history`。

## 3. 新增测试

- 客户端 `tests/interview-engine.spec.ts`：`maxQuestions=12 + remainSeconds=0` 可续到 12；`recentAsked` 排除与池不足回退。
- 客户端 `tests/rules-consistency.spec.ts`：双端 `maxQuestions` 时间规则一致；`recentAsked` 排除/回退一致。
- 服务端 `server/src/interview.spec.ts`：`maxQuestions=12` 续题 + 非法值 400；同一用户连续两场交集为 0。

## 4. 云端发布与运行态验证

### 4.1 云端发布（039）

- 版本 `mentorloop-mp-api-039`，流量 100%（038 → 0）。
- EnvParams 25 键保留；访问策略 OA / PUBLIC / MINIAPP 未被覆盖。
- `/healthz` → HTTP 200 / 业务码 0。

### 4.2 云端 smoke

| 项                                               | 结果                                                         |
| ------------------------------------------------ | ------------------------------------------------------------ |
| 同一用户连续两场各 7 题                          | 交集 `[]`                                                    |
| `maxQuestions=12` + `remainSeconds=0`            | 7 题后继续出 5 题到 12，随后返回 `q-wrapup`，再取业务码 2001 |
| `maxQuestions=13`                                | HTTP 200 + 业务码 400                                        |
| 旧调用：不传 `maxQuestions` 且 `remainSeconds=0` | 按 7 题收束，返回 `q-wrapup`，兼容                           |

### 4.3 开发者工具走查

- 房间：7 次跳过后显示「已覆盖 5/6 维度 · 7/7 题」，出现「生成报告 / 再来一题」；点「再来一题」→「8/12」，入口消失。
- 训练：小结页「再来 5 题」可见；点击后进入新组（进度 1/5）。
- 截图：`e2e/mp/shots/room-01-offer.png`、`room-02-continued.png`、`training-01-summary.png`、`training-02-again.png`。

### 4.4 走查中发现并修复

- `skipQuestion` 原先从 `LISTENING` 直接迁移 `NEXT_QUESTION`（状态机不允许），跳过后不会出新题；已改为 `LISTENING → TRANSCRIBING → FOLLOW_UP_DECISION`，并加 `skipping` 防重入。修复后 7 次跳过正确推进到 7/7。

## 5. 备注

- 本次未改 `types/`；`api/interview.uts` 与 `/interview/next` 的变更已按冻结单双签。
- 旧服务端忽略 `maxQuestions` 时，续题仍按 7 题收束；客户端不会死路。
- `practice_records` 注销清理为本次顺带补齐的隐私闭环，不影响既有接口。
