# 契约冻结：做题记录与 SRS 同步（Phase 2.1）

- 冻结日期：2026-10-23
- 影响面：新增服务端路由 `/practice/*`；客户端新增 `api/practice.uts` 与 `store/practice-progress.uts` 同步逻辑
- 兼容性：**新增端点，不改既有响应结构**；`/training/questions` 不变

## 1. 数据模型

`practice_records`（用户 × 题唯一）：

| 字段           | 类型   | 说明                               |
| -------------- | ------ | ---------------------------------- |
| user_id        | BIGINT | 数值用户 id（经 `users.uid` 解析） |
| question_id    | 文本   | 内容库题 id                        |
| subtrack       | 文本   | 细分领域（冗余，便于分组）         |
| difficulty     | 文本   | junior / mid / senior              |
| result         | 文本   | known / fuzzy / unknown            |
| attempts       | 整数   | 作答次数                           |
| correct_streak | 整数   | 连续「会」次数                     |
| interval_days  | 整数   | 当前复习间隔（天）                 |
| due_at         | 毫秒   | 下次到期时间                       |
| updated_at     | 毫秒   | 最近作答时间                       |

SRS 规则：

- `unknown`：间隔重置 1 天，streak = 0
- `fuzzy`：保留间隔，1 天后复习
- `known`：streak +1，间隔按 1 / 2 / 4 / 7 / 15 / 30 / 60 天递进

## 2. 端点

| 方法 | 路径                | 入参                                                                                  | 出参                                               |
| ---- | ------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| POST | `/practice/records` | `{ records: [{ questionId, subtrack, difficulty, result, answeredAt? }] }`（1–50 条） | `{ summary }`                                      |
| GET  | `/practice/records` | —                                                                                     | `{ records: PracticeRecordView[] }`（≤2000，倒序） |
| GET  | `/practice/summary` | —                                                                                     | `{ summary }`                                      |
| GET  | `/practice/wrong`   | `limit?`（1–100，默认 100）                                                           | `{ questions: QuestionItem[] }`                    |
| GET  | `/practice/due`     | `subtrack?`、`limit?`（1–20，默认 10）                                                | `{ dueCount, questions: QuestionItem[] }`          |

`summary`：

```ts
{
  total: number
  known: number
  fuzzy: number
  unknown: number
  wrongCount: number // result = unknown 的题数
  dueCount: number // due_at <= now 的题数
  subtracks: Array<{
    subtrack: string
    total: number
    known: number
    fuzzy: number
    unknown: number
    wrong: number
    due: number
  }>
}
```

## 3. 语义约定

1. **服务端权威**：登录态下 `summary` 与 `wrong` 以服务端为准；客户端本地仅作缓存与离线队列。
2. **补传幂等**：同一题重复提交不产生重复行；`answeredAt` 早于该题 `updated_at` 的补传被忽略（防止旧队列覆盖新结果）。
3. **鉴权**：全部端点 `requireAuth`；未登录返回业务 401。
4. **数据隔离**：按 `users.uid` 归属，跨账号不可见。
5. **错题本**：`result = unknown` 即进入错题本；再次标记 `known` 后移出（记录保留）。
6. **到期队列**：`due_at <= now` 才进入 `/practice/due`；`dueCount` 与 `/practice/summary` 一致。

## 4. 双签

- FE：2026-10-23 客户端同步队列、汇总、错题本、今日复习入口按本契约实现
- BE：2026-10-23 路由与 SRS 服务按本契约实现，单测覆盖写入 / 汇总 / 错题 / 到期 / 隔离 / 过期补传
