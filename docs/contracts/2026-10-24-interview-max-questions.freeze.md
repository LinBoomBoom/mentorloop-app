# 契约冻结单：面试续题上限（/interview/next 新增 maxQuestions）

- 日期：2026-10-24
- 关联任务卡：[2026-10-24-interview-coverage-dedupe-continue.md](../tasks/2026-10-24-interview-coverage-dedupe-continue.md)
- 类型：请求字段扩展（复用既有端点，不新增端点、不改响应结构）
- 状态：**已冻结（FE / BE 双签，2026-10-24）**

## 0. 背景与决策

| 项       | 结论                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| 默认题量 | `standard` 7 题、`quick` 3 题、`deep` 12 题，保持不变                                             |
| 续题     | 用户在第 7 题后主动点「再来一题」，同一 session 最多续到 12 题                                    |
| 控制方式 | 不做固定时长档位；用户随时可结束，续题是显式动作                                                  |
| 成本     | 单场约 0.02 元；多 5 题仍可忽略（[成本卡 §11](../tasks/2026-10-22-cost-and-pricing-decision.md)） |

## 1. 端点变更

| 端点              | 方法 | 变更                                              |
| ----------------- | ---- | ------------------------------------------------- |
| `/interview/next` | GET  | querystring 新增可选 `maxQuestions`；响应结构不变 |

## 2. 端点契约（逐字）

```
GET /interview/next        （requireAuth）
querystring：
  sessionId: string                // 必填，既有
  mode: 'quick' | 'standard' | 'deep'  // 可选，缺省 standard
  positionId: string               // 可选，既有
  experienceLevel: string          // 可选，既有
  asked: string                    // 可选，逗号串；服务端仅作参考
  remainSeconds: number            // 可选，既有
  resumeRiskTopics: string         // 可选，既有
  resumeTechStacks: string         // 可选，既有
  maxQuestions: integer            // 新增，可选，0–12，缺省 0

成功：{ "code": 0, "data": QuestionItem, "message": "" }

maxQuestions 语义：
  0（缺省）→ 使用 mode 预算：quick 3 / standard 7 / deep 12；时间预算可触发收束
  1–12     → 覆盖 mode 预算；服务端以 asked.length >= maxQuestions 收束
             此时时间预算不再触发收束（timeShort 仅对 maxQuestions=0 生效）
  达到上限 → HTTP 200 + { "code": 2001, "message": "面试题目已收束" }

错误：
  未登录 / token 失效                  → 401
  非 0–12 整数                         → HTTP 200 + 业务码 400（schema 统一映射）
  会话不存在 / 非本人会话              → 404 "会话不存在"
  候选池耗尽                           → HTTP 200 + 业务码 2001
```

## 3. 字段 diff

| 字段           | 变更前           | 变更后                          | 端              |
| -------------- | ---------------- | ------------------------------- | --------------- |
| `maxQuestions` | 不存在           | 可选 `integer`，0–12，缺省 0    | client → server |
| 响应字段       | `QuestionItem`   | 不变                            | server → client |
| 错误码         | 401 / 404 / 2001 | 不变；新增非法参数 → 业务码 400 | server → client |

## 4. 行为矩阵

| 入参                  | 行为                                                  | 兼容性                        |
| --------------------- | ----------------------------------------------------- | ----------------------------- |
| 不传 / 0              | quick 3、standard 7、deep 12，与现状完全一致          | 旧客户端不受影响              |
| 12                    | 标准场可续到 12 题后收束；quick/deep 同样以 12 为上限 | 新客户端「再来一题」使用      |
| 12 + 已超模式时间预算 | 继续出题到 12（`timeShort` 不触发）；时间仅用于展示   | 新客户端续题                  |
| 1–11                  | 覆盖模式预算，按指定题量收束                          | 仅测试/其他客户端使用，不推荐 |
| <0、>12、非整数       | HTTP 200 + 业务码 400                                 | 参数校验                      |

## 5. 影响面

- 客户端：
  - `api/interview.uts`：`nextQuestion()` 末尾新增 `maxQuestions: number = 0`，仅当 >0 时拼入 query。
  - `pages/interview/room.uvue`：默认不传；用户点「再来一题」后传 `12`，并把本地 `modeMax` 显示更新为 12。
  - mock：`mockNextQuestion` 不消费该参数，行为不变。
- 服务端：
  - `routes/interview.ts`：querystring schema 新增 `maxQuestions`（integer, minimum 0, maximum 12）。
  - `services/interview.ts`：`NextQuestionParams` 新增 `maxQuestions`；`SelectorInput.maxQuestions` 由硬编码 0 改为入参。
  - `rules/question-selector.ts`：`timeShort` 改为仅在 `maxQuestions === 0` 时生效；`engine/question-selector.uts` 同步镜像。
- 数据：无表结构变更；跨场次历史表属于任务卡另一工作流，不在本冻结单内。
- 类型：`types/interview.uts` 不变。

## 6. 兼容与发布顺序

1. **先部署服务端**（支持 `maxQuestions`），再发客户端。
2. 新客户端在旧服务端上：Fastify 默认忽略未声明 query 参数 → 续题仍按 7 题收束；客户端收到 2001 直接进报告，不留死路。
3. 旧客户端在新服务端上：不传 `maxQuestions` → 0 → 行为不变。
4. 回滚：服务端回滚后，客户端「再来一题」退化为 7 题收束，不影响主链路。

## 7. 双向核对矩阵

| 项       | 客户端             | 服务端                 | 一致 |
| -------- | ------------------ | ---------------------- | ---- |
| 参数名   | `maxQuestions`     | `maxQuestions`         | ✅   |
| 类型     | number             | integer                | ✅   |
| 范围     | 仅发 0 或 12       | 0–12                   | ✅   |
| 缺省     | 0                  | 0                      | ✅   |
| 响应结构 | `QuestionItem`     | `okData(QuestionItem)` | ✅   |
| 收束     | 业务码 2001 → 报告 | HTTP 200 + 2001        | ✅   |
| 非法参数 | 不发送             | 业务码 400             | ✅   |

## 8. 验证

- [x] 服务端单测：不传 → 标准 7 题收束；传 12 → 第 12 题后收束；传 13 → 业务码 400。
- [x] 服务端单测：quick 3 / deep 12 在不传参数时不变。
- [x] 规则镜像一致性：`maxQuestions=12` 且 `remainSeconds=0` 时不提前收束；`maxQuestions=0` 时 `timeShort` 行为不变。
- [x] 客户端单测/规则一致性：`maxQuestions` 覆盖模式预算的既有用例保持通过。
- [x] G2：`lint` / `typecheck` / `test` / `build:mp-weixin` 全绿。
- [x] 云端 smoke（039，2026-10-24）：旧调用不传参数行为不变；新调用传 12 可续到 12 后收束；非法 13 → 业务码 400。

## 9. 双签

| 角色 | 签署       | 结论 |
| ---- | ---------- | ---- |
| FE   | 2026-10-24 | 同意 |
| BE   | 2026-10-24 | 同意 |
