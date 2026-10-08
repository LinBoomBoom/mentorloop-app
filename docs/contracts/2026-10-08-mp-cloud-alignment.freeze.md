# 契约冻结：小程序端上云对齐（传输通道 + 微信登录鉴权源扩展 + DB 驱动语义）

- 日期：2026-10-08
- 任务卡：docs/tasks/2026-10-08-mp-cloud-alignment.md
- 状态：已冻结（PO 已确认「全套上云」方案；客户端/服务端双签由代理执行，见 §5）

## 1. 冻结范围总览

**核心原则：现有端点契约（信封形状 / 字段 / 状态码）零变更。** 本轮冻结的是三处「通道/语义级」变更，`api/*.uts` 各模块与 `server/src/routes` 的请求/出参字段全部不动。

## 2. 变更明细

### 2.1 传输通道（客户端 api/client.uts）

| 项        | 冻结前                                 | 冻结后                                                                                                                           |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MP-WEIXIN | uni.request + BASE_URL（实际全 mock）  | 非 mock 时走 `wx.cloud.callContainer({ config:{ env: CLOUD_ENV_ID }, path, method, data, header })`；BASE_URL 通道保留为公网兜底 |
| App / H5  | uni.request + BASE_URL                 | 不变（仍 mock，BASE_URL 空）                                                                                                     |
| mock 判定 | `API_ENV==='mock' \|\| BASE_URL===''`  | `API_ENV==='mock'`；API_ENV 按条件编译取值（MP-WEIXIN='prod'，其余='mock'）                                                      |
| 响应处理  | HTTP 2xx + `body.code===0\|\|200` 信封 | 不变（callContainer 的 `res.statusCode`/`res.data` 映射到同一处理函数）                                                          |

- 新增导出：`api/env.uts` → `CLOUD_ENV_ID: string = 'prod-d6gaa83ds8accb61b'`
- callContainer 路径 = `path + query`（服务端 Fastify 根路径无 /api 前缀）
- 401 / 业务 401 / 超时提示行为与现通道一致

### 2.2 微信登录鉴权源扩展（服务端 /auth/wechat，client 兼容）

| 项       | 冻结前                                         | 冻结后                                                                                                            |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 身份来源 | 仅 body.code → code2session（需 WX_APPSECRET） | **优先请求头 `X-WX-OPENID`**（callContainer 私有链路自动注入，免 secret）；头缺失再走 body.code code2session 兜底 |
| 请求体   | `{ code }` 必填                                | `{ code }` 降级为可选（头存在时可不传）；body schema 同步放宽                                                     |
| 出参     | `okData({ uid, nickname, token })`             | **不变**                                                                                                          |

- 安全约束（随冻结生效）：`X-WX-OPENID` 仅在 callContainer 私有链路可信；**未来绑定公网域名时必须在入口层剥离 X-WX-\* 请求头**（登记入发布检查单）；/auth/wechat 沿用现有限流。

### 2.3 DB 驱动语义（服务端 server/src）

| 项                    | 冻结前                                                                         | 冻结后                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 驱动                  | node:sqlite（DatabaseSync，同步）                                              | 双驱动：MYSQL_HOST 存在 → mysql2 池（异步）；否则 node:sqlite 直通（接口 Promise 化）                                         |
| Db 接口               | `prepare(sql)` → 同步 `{get,all,run}`；`exec(sql)` 同步                        | `prepare(sql)` → Promise 化 `{get,all,run}`；`exec(sql)` → Promise；调用点全部 await                                          |
| run() 返回            | `{ changes, lastInsertRowid }`                                                 | mysql2 结果归一为同形 `{ changes: affectedRows, lastInsertRowid: insertId }`                                                  |
| JSON 列               | TEXT 存 JSON 字符串                                                            | MySQL 侧仍用 TEXT/MEDIUMTEXT（**不用 JSON 类型**），读写均为字符串，语义零差                                                  |
| 事务                  | `db.exec('BEGIN')` 手工同步                                                    | async 事务助手（ALS 绑定连接；本地手工 BEGIN/COMMIT 包 await fn）                                                             |
| tracking 去重唯一索引 | `UNIQUE(event, IFNULL(user_id,0), IFNULL(session_id,''), IFNULL(client_ts,0))` | MySQL 生成列（`user_id_n`/`session_id_n`/`client_ts_n`）+ 唯一索引；写入语句不变                                              |
| 方言                  | SQLite（`INSERT OR REPLACE` 等如出现）                                         | db-driver 翻译：`INSERT OR REPLACE`→`REPLACE INTO`；保留字列名反引号化（M1 前科：desc/explain——本 schema 无，哨兵测试防新增） |

- 业务表结构与行语义（8 表：users/sms_codes/sessions/answers/session_asked/reports/resumes/orders/tracking_events）不变；云端建库走 `deploy/cloud/baseline-mp-mysql.sql`，本地仍由 schema.sql 自举。

## 3. 影响面

- 客户端 `api/*.uts` 业务模块：**零改动**（受益于信封兼容与通道下沉 client.uts）
- 服务端 routes/services：签名 async 化（内部重构），字段与流程不变
- 桌面端 MentorLoop 仓库：零改动
- 评分/选题规则：无涉及 → 固定评测集不触发重跑（若 CI 有评测集任务照常跑）

## 4. G2 对账清单

- [ ] client.uts 双通道响应映射与 uni.request 通道行为一致（成功信封/401/超时）
- [ ] /auth/wechat 两种鉴权源（X-WX-OPENID / code）各自有测试且出参同形
- [ ] db-driver：get/all/run/exec 返回形态在双驱动下一致（单测锁定）
- [ ] baseline-mp-mysql.sql 与 schema.sql 表结构对齐（列/索引/去重语义）

## 5. 双签

- 客户端签（FE）：代理执行 —— 基于 client.uts 现状与 frozen AuthResult 契约核对，通道下沉不影响字段
- 服务端签（BE）：代理执行 —— 基于 server/src routes/util 现状核对，async 化不改字段
- PO 签：用户已确认「全套上云」（2026-10-08 对话记录）
