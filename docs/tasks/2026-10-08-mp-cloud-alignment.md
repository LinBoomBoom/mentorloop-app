# 任务卡：小程序端数据对齐云托管平台（配套后端上云 + callContainer 双通道）

- 日期：2026-10-08
- 关联：M1 云托管收官（桌面端 Nitro 已上云，smoke 11/11）/ 设计稿 `MentorLoop/docs/miniapp-cloud-backend-design.md` §2 §7 / 决策 D1（小程序静默登录）

> 修正记录（2026-10-08）：初稿误判对齐目标为 MentorLoop/server（桌面端内容后端）。经核查，本仓库 `server/src`（Fastify + node:sqlite）才是小程序端配套后端——已实现客户端冻结的 `/auth/sms-code` `/auth/login` `/auth/wechat` 契约，响应 `{code,data,message}` 信封 + JWT Bearer 与 `api/client.uts` 完全匹配。小程序页面（面试/训练/成长/简历/会员）全部依赖这套端点。PO 已确认修正后方案：**全套上云**。

## 1. 目标

把小程序配套后端（本仓库 `server/src`）部署到桌面端同一微信云托管环境（prod-d6gaa83ds8accb61b，新服务），DB 按 M1 模式做双驱动（node:sqlite ↔ mysql2 → 云 MySQL 新库），客户端 MP-WEIXIN 通道改走 `wx.cloud.callContainer`，小程序端到端读到云端真数据。

## 2. 范围

- 做：
  - 服务端：`server/src/db-driver.ts`（mysql2 池 + ALS 事务路由 + TEXT 列直存字符串 + 方言翻译 + 参数归一；本地 node:sqlite 直通，get/all/run 统一 Promise 化）；全部调用点 await 化（~45 处 / 10 文件）；payment.ts 手工 BEGIN/COMMIT 改 async 事务助手
  - 部署物：`server/Dockerfile`（tsc 构建、0.0.0.0 监听、PORT）；`deploy/cloud/baseline-mp-mysql.sql`（8 表 MySQL DDL，JSON 列用 TEXT 直存规避 jsonStrings 语义差）；tracking 去重唯一索引改生成列方案；健康检查端点（缺则补 /healthz）
  - `/auth/wechat` 鉴权源扩展：优先 callContainer 注入 `X-WX-OPENID`（免 code2session），body.code code2session 兜底；出参不变
  - 客户端：`api/env.uts` 按平台拨 env（MP-WEIXIN='prod'，App/H5 维持 'mock'）；`api/client.uts` 双通道（MP-WEIXIN 非 mock 走 callContainer，其余 uni.request 维持现状）；`App.uvue` MP 块加 `wx.cloud.init`（globalThis 模式）；`manifest.json` mp-weixin 云能力声明
  - 测试：db-driver 单测 + 现有 vitest 套件全绿 + 云端 smoke
- 不做：
  - MentorLoop/server（桌面端）任何改动；小程序不直连桌面端内容后端
  - 题库/考卷/学习中心三域页面（M3 另开卡）
  - wxpay 真实通道（保持 mock 支付）、ASR aliyun 真实通道（保持 stub）
  - 公网域名绑定；App/H5 端真后端切换

## 3. 依赖

- 前置：云托管环境 prod-d6gaa83ds8accb61b 已开通（M1）；小程序 appid wx83b5d63ecd739421 与云环境同主体
- 外部环境（用户侧动作）：云 MySQL（TDSQL-C）新建库（建议 `mentorloop_mp`）并执行 baseline-mp-mysql.sql；云托管控制台新服务（建议 `mentorloop-mp-api`）版本配置填环境变量：MYSQL_HOST/PORT/USER/PASSWORD/DATABASE、JWT_SECRET、WX_APPID/WX_APPSECRET、MOCK_SMS_CODE（或接真实短信则后续另办）、PORT=8787；微信开发者工具关联云环境
- 契约：传输通道新增 + `/auth/wechat` 鉴权源扩展 + DB 驱动语义 → 触发契约冻结（已落盘，见下）

## 4. 验收标准

- [ ] 契约冻结文档落盘且与本卡一致
- [ ] `server/` 内 `npm test` 全绿（现有套件回归 + db-driver 用例：方言翻译/参数归一/事务路由）
- [ ] `pnpm build:mp-weixin` 通过，产物含 callContainer 调用路径
- [ ] 云端部署后 smoke：healthz / 注册或微信登录 / 建会话 / 答题 / 报告 / 埋点 全链路真数据落 `mentorloop_mp` 库
- [ ] 微信开发者工具：启动静默登录（callContainer → /auth/wechat）→ 建会话答题出报告，数据云端可查
- [ ] App/H5 行为不变（仍 mock）
- [ ] 本地 SQLite 开发路径不回归（`npm run dev` 可用）

## 5. 风险与对策

| 风险                                                             | 等级 | 对策                                                                                                                               |
| ---------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fastify 默认监听 localhost，容器内不可达                         | 中   | Dockerfile ENV PORT + 启动 host 0.0.0.0，部署后 smoke 验证                                                                         |
| SQLite 方言残留（INSERT OR REPLACE / IFNULL 索引等）在 mysql2 炸 | 高   | M1 前科清单逐项排查：`INSERT OR REPLACE`→`REPLACE INTO`；tracking 去重索引改生成列；db-driver 单测锁定；reserved word 全表反引号化 |
| await 化漏点（同步习惯残留）                                     | 高   | tsc strict + 运行时 smoke 覆盖每个端点；参照 M1「helper 全量名单机械扫描」做法                                                     |
| node:sqlite run() 返回 {changes,lastInsertRowid} 语义            | 中   | db-driver 统一归一 mysql2 结果为同形对象                                                                                           |
| callContainer 环境未关联/基础库过旧                              | 中   | 验收前置条件写明；失败显式 toast 不静默                                                                                            |
| manifest `cloud` 字段 uni-app x 不支持                           | 低   | 构建验证；不支持则退化用说明文档                                                                                                   |
| JWT_SECRET / WX_APPSECRET 泄露                                   | 中   | 只进控制台版本配置，不进仓库；.env.example 更新占位                                                                                |

## 6. 产物路径

- 新增：`server/src/db-driver.ts` + `server/tests/db-driver.test.ts`（或 spec）；`server/Dockerfile`；`deploy/cloud/baseline-mp-mysql.sql`；`docs/contracts/2026-10-08-mp-cloud-alignment.freeze.md`；`docs/tasks/2026-10-08-mp-cloud-alignment.gate.md`
- 修改：`server/src/db.ts`、`server/src/server.ts`、`server/src/config.ts`（MYSQL_* 注入）、`server/src/services/*.ts`（~7）、`server/src/routes/*.ts`（~5）、`server/.env.example`；`api/client.uts`、`api/env.uts`、`App.uvue`、`manifest.json`
- 任务记录：本卡 + gate 记录（小程序仓库 docs/tasks/）

## 7. 角色

- 主责：BE（db 双驱动 + 部署物）与 FE（客户端双通道）跨栈，由代理一体执行
- 配合：QA（G2）、MP-PM（callContainer 平台约束）、FA（wx.cloud 在 uni-app x 的可用性——已按 speech.uts globalThis 先例确认可行）、PO（方案修正裁决，已确认）

## 8. 负责人

- PO 终审（用户）；执行：代理执行（FE/BE/QA 一体）
