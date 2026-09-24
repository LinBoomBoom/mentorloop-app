# 服务端领域 SOP

生成日期：2026-09-24
归属：SOP 系统 L2 领域层 · 领域：服务端（`server/`）
上游：[README.md](./README.md) §4；相关：`contract-freeze-sop.md`、`quality-gate-sop.md`

---

## 1. 技术栈与运行

- Node ≥22 + TypeScript + **Fastify 5** + 内置 `node:sqlite`（零原生依赖）。
- 与前端同一 pnpm workspace（`server/` 子包），共享根 lint 基线与质量门禁。
- 启动：`pnpm --filter @mentorloop/server dev`（默认 `http://127.0.0.1:8787`）。
- 冒烟：`node server/e2e/smoke.mjs [baseUrl]`（需服务已启动）。

---

## 2. 分层与依赖方向

```
routes/ → services/ → rules/ · data/ → db
```

| 目录                   | 职责                                        | 约束                          |
| ---------------------- | ------------------------------------------- | ----------------------------- |
| `routes/`              | 端点、鉴权、入参校验                        | 不写业务逻辑，只编排          |
| `services/`            | 业务编排（会话/报告/支付/ASR/配额）         | 不直接拼 SQL 之外的 HTTP 细节 |
| `rules/`               | 选题/评分/追问（**前端 `engine/` 镜像**）   | 必须与前端逻辑一致            |
| `data/`                | 题库/图谱/岗位/SKU（**前端 `data/` 镜像**） | 变更需同步前端                |
| `db.ts` / `schema.sql` | 存储                                        | 隐私最小化                    |

---

## 3. 硬性约定

### 3.1 统一响应

一律用 `util.ts` 的构造器，禁止手拼响应体：

- 成功：`okData(data)` → `{code:0, data, message:''}`
- 空成功：`ok()` → `{code:0, data:null, message:''}`
- 失败：`fail(code, message)`

### 3.2 鉴权

- 除 `auth` 与 `track` 外，所有端点挂 `requireAuth` 预处理器。
- 鉴权失败返回**业务 401**（`fail(401, ...)`），前端 `client.uts` 识别后自动登出。

### 3.3 错误处理

- 统一由 `app.ts` 的 `setErrorHandler` 兜底：4xx → `fail(400, message)`；5xx → `fail(500, ...)` 并打日志。
- 不要把内部异常原文透给客户端。

### 3.4 幂等

- 写操作必须幂等。参考 `answers` 表 `UNIQUE(session_id, question_id, user_answer_index)`：重放返回既有记录。
- 支付回调用状态机幂等：`UPDATE ... WHERE id=? AND status='CREATED'`，`changes===0` 即已处理。
- 埋点用唯一索引去重（`idx_tracking_dedupe`）。

### 3.5 配置

- 配置集中在 `config.ts` 的 `Env` + `loadEnv()`；新配置项必须同时更新 `config.ts` 与 `.env.example`。
- **默认值必须安全降级**：`llmEnabled=false`、`payMode='mock'`、`asrProvider='stub'`——零配置可跑，且不伪造结果。

### 3.6 存储与隐私

- 不落库录音原文/音频文件；简历文件暂存磁盘 `UPLOAD_DIR`。
- `schema.sql` 变更：新增列/表用 `IF NOT EXISTS` 或加列语句，保持幂等可重复执行。

---

## 4. 领域检查清单

- [ ] 出参走 `okData/ok/fail`，无手拼响应体。
- [ ] 非 auth/track 端点挂了 `requireAuth`。
- [ ] 写操作幂等（唯一索引或状态机）。
- [ ] 新配置项同步 `config.ts` + `.env.example`，默认安全降级。
- [ ] 触及 `rules/`、`data/` 时已同步前端 `engine/`、`data/`。
- [ ] 契约变更已走 `contract-freeze-sop.md`。
- [ ] 新增逻辑有 `*.spec.ts` 单测。

---

## 5. 承载 skill

`mentorloop-server-conventions`；排障用 `TRAE-debugger`。
