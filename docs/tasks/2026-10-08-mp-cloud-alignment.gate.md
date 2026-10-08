# 门禁记录：小程序端数据对齐云托管（配套后端上云 + callContainer 双通道）

- 日期：2026-10-08
- 任务卡：[2026-10-08-mp-cloud-alignment.md](./2026-10-08-mp-cloud-alignment.md)
- 契约冻结：[2026-10-08-mp-cloud-alignment.freeze.md](../contracts/2026-10-08-mp-cloud-alignment.freeze.md)
- 仓库：E:\LsqCoding\Mentorloop-app（桌面端 MentorLoop 仓库零改动）

## 变更物

服务端（server/）：

- 新增 `src/db-driver.ts`：双驱动原语层（本地 node:sqlite Promise 化直通 ↔ 云端 mysql2 连接池 + ALS 事务路由）；方言翻译含新增项 `ON CONFLICT(col) DO UPDATE SET … excluded.* → ON DUPLICATE KEY UPDATE … VALUES(*)`（auth.ts upsert 专用，M1 无此前科）；run() 归一 `{changes,lastInsertRowid}` 数字
- 重构 `src/db.ts`：Db 双驱动化；云端跳过 schema 自举（baseline SQL 外部建库）；本地保留 WAL/foreign_keys/schema.sql/migrate
- 修改 `src/config.ts`（MYSQL_* 注入）、`src/app.ts`（MYSQL_HOST→getDb 接线）、`src/server.ts`（0.0.0.0 监听，既有）
- 全部 `.prepare(` 调用点 await 化：services 7 文件（auth/interview/payment/quota/report/resume/track）+ routes 5 文件（auth/interview/misc/membership/me）；payment.ts 手工 BEGIN/COMMIT ×2 → `db.transaction(async fn)()` 助手
- `/auth/wechat` 鉴权源扩展（冻结 §2.2）：优先头 `X-WX-OPENID`，body.code 兜底（'wx_'+code mock 语义不变）；出参 `{uid,nickname,token}` 不变
- 新增 `GET /healthz`（信封 + driver 字段，探活/发布验证）
- 部署物：`Dockerfile`（多阶段 node:22-slim；**含 `cp src/schema.sql dist/schema.sql`**——tsc 不搬运 .sql，否则启动即崩）；`src/db-driver.spec.ts`（13 用例）；`.env.example` 补 MYSQL_* 与鉴权源说明
- 依赖：`mysql2@^3.11.0`（已同步根 pnpm-lock）

客户端（根目录）：

- `api/env.uts`：API_ENV 条件编译拨值（MP-WEIXIN='prod'，其余='mock'）；新增 `CLOUD_ENV_ID='prod-d6gaa83ds8accb61b'`；useMock() 去掉 BASE_URL==='' 条件（冻结 §2.1）
- `api/client.uts`：双通道——MP-WEIXIN 非 mock 走 `wx.cloud.callContainer`（globalThis 取 wx，speech.uts 先例），其余 uni.request 不变；响应/失败处理抽为共享 handleResponse/handleFail，两通道映射一致
- `App.uvue`：onLaunch 首位 `initCloud()`（MP 块，wx.cloud.init）
- `manifest.json`：mp-weixin 加 `"cloud": true`（见遗留：被 uni-app x CLI 忽略，无害）
- `api/*.uts` 业务模块零改动（信封兼容 + 通道下沉）

## G2 执行记录

| 项         | 命令                                                                    | 结果                                                                                                               |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 服务端单测 | `cd server && npm test`                                                 | ✅ 9 文件 47 用例全绿（含 db-driver.spec 13 例 + 既有回归）                                                        |
| 服务端类型 | `cd server && npm run typecheck`                                        | ✅ 0 错误（strict）                                                                                                |
| 服务端构建 | `cd server && npm run build`                                            | ✅ dist 产物完整                                                                                                   |
| 小程序构建 | `pnpm build:mp-weixin`（**需 `UNI_INPUT_DIR=项目根`**，HBuilderX 布局） | ✅ Build complete；产物 `dist/build/mp-weixin/api/client.js` 含 callContainer 与 initCloud，env.js 常量折叠为 prod |
| 客户端单测 | `pnpm test`（根）                                                       | ✅ 4 文件全绿                                                                                                      |

## 冻结 §4 对账

- [x] client.uts 双通道响应映射一致：共享 handleResponse/handleFail（HTTP 401 / 非 2xx / 空 body / 信封 0\|200 / 业务 401 / message 透传逐分支一致），编译产物核验云链路生效
- [x] /auth/wechat 两种鉴权源各自有测试且出参同形：`db-driver.spec.ts` 覆盖头直登 / code 兜底 / 双缺失 400 / 同 openid uid 幂等
- [x] db-driver 形态一致单测锁定：get/all/run/exec + run 归一 + 事务提交/回滚/嵌套（sqlite 侧实跑；mysql 侧与 M1 同源逻辑，事务 ALS 路由已在 M1 云端验证）
- [x] baseline-mp-mysql.sql 与 schema.sql 对齐：9 表逐列核对（**任务卡"8 表"为笔误，schema.sql 实为 9 表，以 schema 为准**）；tracking 去重 IFNULL 表达式索引 → 生成列（user_id_n/session_id_n/client_ts_n）+ 唯一索引，写入语句不变；JSON 列 TEXT/MEDIUMTEXT 直存；DDL 兼容云实例 TDSQL-C **MySQL 5.7**（无 JSON 类型、无函数索引、生成列 5.7.6+ 支持，M1 经验一致）

## G3 云端部署 runbook（用户侧动作，M1 同模式）

1. **建库**：云 MySQL（实例 cynosdbmysql-gjsimu6g，建议外网开关保持关闭、用内网/临时开外网执行）新建库 `mentorloop_mp`，执行 `deploy/cloud/baseline-mp-mysql.sql`（幂等可重跑）
2. **建服务**：云托管控制台 prod-d6gaa83ds8accb61b 新建服务 `mentorloop-mp-api`
3. **版本配置环境变量**（控制台填，CLI EnvParams 空且不继承——M1 前科）：`MYSQL_HOST/PORT/USER/PASSWORD/DATABASE=mentorloop_mp`（HOST 用**内网地址**）、`JWT_SECRET`（新随机值，勿复用桌面端）、`MOCK_SMS_CODE=123456`、`PORT=8787`；监听端口与 PORT 一致
4. **部署**：`docker build` 上下文 = `server/` 目录（`docker build -t <registry>/mentorloop-mp-api:<tag> server/`），推镜像或控制台上传；发布
5. **smoke**（全部走 callContainer/云链路）：
   - [ ] `GET /healthz` → code 0 且 `driver==='mysql'`
   - [ ] `POST /auth/wechat`（带 X-WX-OPENID 头或 body.code）→ token 可用
   - [ ] 建会话 → 出题 → 答题 → 报告 全链路
   - [ ] `POST /track/batch` 埋点落库（同参数重复 → 去重不重复计数）
   - [ ] `mentorloop_mp` 库各表数据可查
   - [ ] 微信开发者工具：静默登录 → 答题 → 成长页报告历史
   - [ ] App/H5 行为不变（仍 mock）；本地 `cd server && npm run dev` SQLite 路径不回归（单测已覆盖）

## 遗留与备注

- `manifest.cloud:true` 被 uni-app x CLI 忽略（构建通过）：callContainer 可用性实际依赖 appid 与云环境同主体绑定 + 开发者工具云能力开关，非 manifest 字段；发布前在开发者工具确认
- **安全登记**：`X-WX-OPENID` 仅 callContainer 私有链路可信；未来绑定公网域名必须在入口层剥离 `X-WX-*` 请求头（入发布检查单）；`JWT_SECRET/WX_APPSECRET/MYSQL_PASSWORD` 只进控制台版本配置，不进仓库
- CLI 构建本项目必须 `UNI_INPUT_DIR` 指向项目根（源码在根目录的 HBuilderX 布局），已验证可用
- wxpay 真实通道 / ASR aliyun 通道 / 题库三域页面：按任务卡范围不做，另立卡
