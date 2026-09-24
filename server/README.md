# @mentorloop/server · MentorLoop 后端（P1.1）

Node ≥22 + TypeScript + Fastify + 内置 `node:sqlite`（零原生依赖）。与前端同一 pnpm workspace（`server/` 子包），共享质量门禁与根 lint 基线。

## 快速开始

```bash
# 安装（根目录）
pnpm install

# 启动开发服务（默认 http://127.0.0.1:8787）
pnpm --filter @mentorloop/server dev

# 复制环境变量样例（可选）
cp server/.env.example server/.env
```

## 脚本

| 命令                                         | 说明                       |
| -------------------------------------------- | -------------------------- |
| `pnpm --filter @mentorloop/server dev`       | tsx watch 开发             |
| `pnpm --filter @mentorloop/server test`      | Vitest 单测                |
| `pnpm --filter @mentorloop/server typecheck` | tsc --noEmit               |
| `pnpm --filter @mentorloop/server build`     | tsc 编译到 `dist/`         |
| `node server/e2e/smoke.mjs [baseUrl]`        | 端到端冒烟（需服务已启动） |

## 端点（与前端 `api/*.uts` 契约对齐，统一响应 `{code, data, message}`）

- 认证：`POST /auth/sms-code`、`POST /auth/login`、`POST /auth/wechat`（App 短信 mock 码 `123456`；微信 mock 静默）
- 面试：`POST /interview/session`、`GET /interview/next`、`POST /interview/answer`（出题权威在服务端；答题幂等）
- 报告：`GET /report?sessionId=`（幂等重算，首次生成扣一次免费额度）
- 简历：`POST /resume/parse`、`POST /resume/optimize`（P1.1 规则版，出参与前端 mock 一致）
- 会员：`GET /membership/quota`（服务端账本）；`POST /membership/order`、`POST /membership/order/notify` 为 P1.3 占位
- ASR：`POST /interview/asr`（P1.1 降级 stub，不伪造转写）
- 埋点：`POST /track/batch`（批量落库，幂等去重）

除 auth 与 track 外均需 `Authorization: Bearer <token>`。

## 存储与隐私

- 关系库：SQLite（`DB_PATH` 指向 `server/data/mentorloop.db`；测试用独立临时库）
- 技能迁移：选题/评分逻辑移植自前端 `engine/`、`data/`，保持两端契约一致（`server/src/rules/`、`server/src/data/`）
- 隐私最小化：不落库录音原文/音频文件，仅存文本回答与简历文件（磁盘 `UPLOAD_DIR`）

## 前端切换

前端 `api/env.uts` 是 Mock ↔ 真后端单一切换点：`API_ENV='dev'` 且填 `API_BASE_URL`（如 `http://127.0.0.1:8787`）走真后端；拨回 `'mock'` 全链路回退本地 Mock。
