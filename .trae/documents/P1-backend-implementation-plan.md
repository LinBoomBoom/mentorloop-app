# MentorLoop P1 后端首迭代实施计划（P1.1）

生成日期：2026-09-24
范围：P1 阶段第 1 个可交付迭代——**后端服务骨架 + 端到端真后端**（认证 / 会话编排 / 评分报告 / 简历 / 配额 / 埋点），前端从 Mock 切换真后端。LLM 评分（P1.2）与微信支付（P1.3）后置，仅做占位接口。

## 1. Context（为什么要做）

前端业务已在 Mock 下完整闭环（P0 全部交付并推送）。P1 的目标是让业务线真正可用：数据跨设备、评审服务端权威、为支付/运营铺路。当前 `api/client.uts` 的 `BASE_URL` 为空 → 全部走 Mock，无法承载真实用户。本迭代交付一个可本地运行、与前端契约一致、通过单测+端到端脚本的真后端，并把前端切到真后端（保留按需回退 Mock）。

## 2. 技术决策（待确认项，默认采用推荐）

| #   | 决策      | 推荐                                                                       | 说明                                                                                                                |
| --- | --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | 语言/框架 | **Node ≥22 + TypeScript + Fastify**                                        | 文档未指定后端栈；与前端同栈降切换成本；Fastify 内置 JSON Schema 校验（契约即可执行）+ 官方 JWT/multipart/CORS 插件 |
| D2  | 关系库    | **better-sqlite3**（本地零部署）                                           | 需在 `pnpm-workspace.yaml` `allowBuilds` 增加 `better-sqlite3: true`；不碰 vite override。后续可换 Postgres         |
| D3  | 仓库布局  | **同仓 `server/` 子包**，`pnpm-workspace.yaml` 增加 `packages: ['server']` | 复用单仓门禁；server 自带 vitest/tsconfig 与独立 lint，CI 加独立 job                                                |
| D4  | 代码复用  | **移植前端纯逻辑**（engine/* + data/*）为服务端 TS 模块                    | scorer/question-selector 等已是纯逻辑；移植后服务端选题/评分与前端 Mock 天然一致                                    |

## 3. server/ 目录结构（新建）

```
server/
├─ package.json          # @mentorloop/server；scripts: dev/build/start/test/lint/typecheck
├─ tsconfig.json         # NodeNext，独立于根
├─ vitest.config.ts      # include src/**/*.spec.ts
├─ .env.example          # PORT / DB_PATH / JWT_SECRET / UPLOAD_DIR / MOCK_SMS_CODE
├─ README.md             # pnpm --filter @mentorloop/server dev
└─ src/
   ├─ app.ts             # buildApp()（供测试复用，与 listen 分离）
   ├─ server.ts          # 入口：env → buildApp().listen()
   ├─ env.ts / config.ts
   ├─ plugins/           # jwt（requireAuth→401 body）、db（better-sqlite3）、errors（统一 {code,data,message}）
   ├─ routes/            # auth / interview / report / resume / membership / asr / track
   ├─ services/          # auth / session / answer / report / resume / quota / asr
   ├─ repos/             # user / session / answer / report / resume / track
   ├─ rules/             # 从前端移植：question-selector.ts、scorer.ts、rubric.ts、answer-signal.ts
   ├─ data/              # 从前端移植：question-bank.ts、*-map.ts、position-options.ts
   ├─ schema.sql
   └─ seed.ts            # 启动一致性校验（selectNext/scoreInterview 与前端 mock 已知输出一致）
```

## 4. 端点清单（与前端 api/*.uts 契约逐一对齐）

统一响应 `{code, data, message}`；`0/200` 成功；401 业务码（HTTP 或 body）→ 前端自动登出；除 auth 与 track 外均需 `Authorization: Bearer`。

1. `POST /auth/sms-code` `{phone}` — 发码（mock 验证码 MOCK_SMS_CODE，入库过期）
2. `POST /auth/login` `{phone, code}` — 登录，签发 JWT，返回 `AuthResult{uid,nickname,token}`
3. `POST /auth/wechat` `{code}` — 静默登录（mock 以 code 当 openid）
4. `POST /interview/session` `{positionId,position,experienceLevel,experienceRange}` → `{sessionId}`
5. `GET /interview/next` query `sessionId,mode,positionId,experienceLevel,asked,remainSeconds,resumeRiskTopics` → **完整 `QuestionItem`**（含 misconceptions/followupPrompts/resumeRisk）
6. `POST /interview/answer` `{sessionId,questionId,text,isFollowup}` → `{ok}`（幂等：重放返回既有记录）
7. `GET /report?sessionId=` → `InterviewReport`（服务端按需幂等重算 + 缓存 reports.payload）
8. `POST /resume/parse` `{fileUrl}` → `ResumeParseResult`（结构与前端 mock 逐字段一致；文件暂存 UPLOAD_DIR）
9. `POST /resume/optimize` `{text,position}` → `ResumeSuggestion[]`（mock 规则，结构一致）
10. `GET /membership/quota` → `{freeInterviewsLeft,singleCreditsLeft,memberUntil}`（服务端账本）
11. `POST /membership/order` — **占位 stub**（P1.3 兑现支付；`payParams:null`）
12. `POST /membership/order/notify` — **占位 stub**（服务端回调）
13. `POST /interview/asr`（multipart audio）— **降级 stub** `{text:'',confidence:0}`（不伪造转写，与前端 asr.uts 语义一致）
14. `POST /track/batch` `{events: string[]}` — 逐条 JSON.parse 落库，失败不阻塞

关键对齐点：`/interview/next` 的 asked 以服务端 answers 为准（权威收束）；`submitAnswer` 幂等键 `(session_id, question_id, user_answer_index)` UNIQUE。

## 5. 数据表（SQLite，schema.sql）

- `users`：uid(unique)/phone/openid/nickname/channel/配额字段(free_quota_total|used、single_quota_total|used)/member_until
- `sms_codes`：phone/code/expires_at/consumed
- `sessions`：id(user_id,position/experience,mode,status,current_question_id,question_seq,created_at)
- `answers`：id(session_id,question_id,user_answer_index,is_followup,speaker,text,idempotency_key,created_at) + **UNIQUE(session_id,question_id,user_answer_index)**
- `reports`：session_id UNIQUE + payload(JSON)
- `resumes`：user_id + original_url + parse/optimize payload(JSON)
- `orders`：占位（id/sku_id/sku_kind/amount/status）
- `tracking_events`：event + payload + 平台 + 时间戳 + 幂等唯一索引

隐私最小化：**不落库录音原文/音频文件**，仅文本回答与简历文件（本地磁盘）。

## 6. 前端切换与降级（改动集中在 api/）

1. 新增 `api/env.uts`：`API_ENV: 'mock' | 'dev' | 'prod'`（默认 'mock'）、`BASE_URL`；`client.uts` 的 `BASE_URL`/`useMock` 改读此处。只改一处即可全链路切换。
2. 修 bug：`api/asr.uts` `uni.uploadFile` 的 `url` 缺 `BASE_URL` 前缀 → 拼上，否则真后端模式该通道必失败。
3. 降级策略：`API_ENV` 拨回 'mock' 即全链路回退；前端既有"网络失败本地保存/补传"机制在真后端 fail 时自动接管，不丢答案。
4. 真后端模式下前端不再本地 Mock 评分（report 走 `GET /report`）。

## 7. 实施步骤（子任务卡，按序）

1. **契约对齐卡**：四元组幂等 + 全部端点入出参与前端 `api/*.uts` 逐字段核对（产出对齐清单）
2. **脚手架卡**：pnpm-workspace 加 packages/allowBuilds；server/ package/tsconfig/vitest/env/schema.sql；`pnpm --filter server dev` 可起
3. **认证+鉴权卡**：sms-code/login/wechat + JWT + 默认配额创建
4. **会话/选题/答题卡**：移植 question-selector + 题库/图谱/档位；session→next→answer 幂等
5. **报告卡**：移植 scorer/rubric/answer-signal；`GET /report` 幂等重算
6. **简历+配额+埋点卡**：parse/optimize（mock 规则）、quota、track/batch
7. **asr/membership 占位卡**：asr 降级 stub；order/notify stub
8. **测试+E2E 卡**：server vitest（auth/session/next/report 幂等/配额）+ `tests/e2e` 全链路脚本（登录→session→答题×N→report→quota）
9. **前端切换+CI+文档卡**：`api/env.uts` + 修 asr 路径 bug；CI 新增 server job（lint/typecheck/test/build）；更新 `docs/closure-development-plan.md` 状态

## 8. 验证方式

- `pnpm --filter @mentorloop/server test`：auth 登录、next 按岗位出题/收束、answer 幂等、report 结构与字段、quota 扣减
- `node tests/e2e/*.mjs`：注册→建会话→连续答题→取报告→查配额 全链路，断言与前端契约字段一致
- 前端：`API_ENV='dev'` + 本地起 server → 小程序/H5 跑通"登录→面试→报告→训练"；`pnpm check` 保持全绿；`API_ENV` 拨回 mock 验证回退
- CI：新增 server job 全绿

## 9. 明确后置（不做进 P1.1）

真实 ASR 转写、微信支付 order/notify 签名与回调、LLM 评分/报告解释（P1.2）、Postgres/Redis/对象存储迁移、followup-engine 移植（前端靠问题卡自派发即可）。
