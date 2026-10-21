# 任务卡：W2 服务端会话与 session_key 落库

- 日期：2026-10-22
- 关联：里程碑 M2「支付与会员」/ 父卡 [2026-10-21-mp-virtual-payment-feasibility.md](./2026-10-21-mp-virtual-payment-feasibility.md) §12 W2

## 1. 目标

让服务端在登录时拿到并保存 `session_key`，为虚拟支付用户态签名提供密钥，同时保证不下发、不落日志。

## 2. 范围

- 做：
  - `code2Session` 返回 `{ openid, session_key }`；
  - `users` 增列 `session_key` 与 `session_key_updated_at`；
  - 登录路由在请求含 code 时始终调用 `code2session` 刷新；
  - header openid 与 code2session openid 不一致 → 400 拒绝并告警；
  - 登录响应保持 `{ uid, nickname, token }`；
  - 提供仅服务端可用的 session_key 读取函数，供 W3 使用。
- 不做：
  - 不做虚拟支付签名（W3）；
  - 不下发 session_key、不写日志、不进埋点；
  - 不改客户端登录协议。

## 3. 依赖

- 前置：W1a（契约结构）
- 外部环境：云端 `WX_APPID` / `WX_SECRET`（W0）
- 契约：是（登录响应不变，但下单链路依赖 session_key）

## 4. 验收标准

- [x] `code2Session` 单测覆盖成功、微信错误码、网络失败
- [x] 登录响应契约测试断言无 `session_key`
- [x] 云托管场景（header + code）下会刷新 session_key
- [x] openid 不一致返回 400 并产生告警日志
- [x] DB 可回读，日志检索无 session_key 明文
- [x] `schema.sql` 与 `deploy/cloud/baseline-mp-mysql.sql` 同步

## 5. 风险与对策

| 风险                                      | 等级 | 对策                                               |
| ----------------------------------------- | ---- | -------------------------------------------------- |
| 云托管 header 优先导致不调用 code2session | 高   | 改为 code 存在即调用，header 仅作一致性基准        |
| session_key 过期                          | 高   | 提供 `updated_at`，W5 支付前校验并在 -15007 时重登 |
| 密钥落库泄露                              | 高   | 仅服务端读取；日志脱敏；不进入埋点                 |
| 建表变更未同步云端                        | 中   | 双 SQL 同步 + 部署后回读列                         |

## 6. 产物路径

- 修改：`server/src/services/auth.ts`、`server/src/routes/auth.ts`、`server/src/schema.sql`、`deploy/cloud/baseline-mp-mysql.sql`
- 新增/修改：`server/src/auth.spec.ts`

## 7. 角色

- 主责：BE
- 配合：QA（越权与脱敏用例）、FE（登录时序确认）

## 8. 负责人

后端工程师 + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询                        | 结论                                                                                   |
| --- | --------------------------- | -------------------------------------------------------------------------------------- |
| 1   | 云托管现在怎么取 openid？   | **已查证**：改造前 `routes/auth.ts:108-125` 头优先；改造后 code 优先，整段为 `100-147` |
| 2   | session_key 存哪？          | **已决策**：`users` 增列（openid 唯一，一对一），不建独立表                            |
| 3   | 登录出参要加字段吗？        | **已决策**：不加；`types/auth.uts:8-12` 保持不变                                       |
| 4   | 不一致时能否降级用 header？ | **已决策**：不能静默降级；400 拒绝并告警                                               |

## 10. 实施记录（2026-10-22）

- 服务端：`code2Session` 返回 `{ openid, sessionKey }`；`loginByWechat` 落库 `session_key` / `session_key_updated_at`；新增 `getSessionKey` / `getFreshSessionKey`（24h 兜底窗口）。
- 登录路由：code 优先真实换取，header 仅兜底；header 与 code 的 openid 不一致 → 400 + 告警，日志不含 session_key。
- Schema：`schema.sql` 与 `baseline-mp-mysql.sql` 同步新增两列；`db.ts` 的 MySQL 迁移与本地 SQLite `migrate` 均已补齐。
- 验证：`npx vitest run src/auth.spec.ts`（9 passed）、`npx tsc --noEmit`、`eslint` 均通过。
