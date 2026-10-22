# 契约冻结：专项训练线上题库

- 日期：2026-10-22
- 触发：专项训练由本地静态题库切换为服务端 `questions` 内容库；新增训练取题端点。任务卡：[2026-10-22-training-online-question-bank.md](../tasks/2026-10-22-training-online-question-bank.md)
- 状态：已冻结
- 双签：服务端 ✓ 客户端 ✓（AI 侧仅确认选题口径，无出参变更）

## 变更内容

| 项       | 变更前                                         | 变更后                                                           |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| 训练取题 | 客户端 `selectNext` + `data/question-bank.uts` | 服务端 `POST /training/questions`，候选池来自 `questions` 内容库 |
| 训练题量 | 客户端按时长估算 3/4/5 题                      | 请求 `count`（1–10），服务端返回实际可用题量（可能少于请求值）   |
| 训练维度 | `domain` 由客户端拼任务 id 解析                | 同名字段透传，服务端按 `abilityDomain` 定向；出完自动放宽全量    |
| Mock     | 本地静态题库伪造题目                           | 不再伪造：训练/面试出题明确报错，提示切换 `dev`/`prod`           |
| 评分建议 | 从静态题库按维度反查知识点                     | 从本场实际题目取知识点，无命中时回退「维度典型题」               |
| 报告回查 | 静态题库 `getQuestionById`                     | 内容库 `findQuestionById`；收束题按 id 查独立常量                |

## 端点契约（逐字）

```
POST /training/questions        （requireAuth；JSON）
请求体：
{
  "positionId": "frontend" | "backend" | "devops" | "ai",
  "experienceLevel": "fresh" | "junior" | "mid" | "senior",
  "domain": string,   // '' = 不限维度；否则 abilityDomain，如 'knowledge'
  "count": number     // 1–10，服务端截断到该区间
}
成功：{ code: 0, data: { questions: QuestionItem[] } }
  - questions 可能少于 count（内容库该岗位可用题不足）；可能为空数组
  - 每项为现有 QuestionItem 形状（与正式面试出参逐字段一致）
错误：
  未登录                        → 401 { code: 401, message: '未登录或登录已过期' }
  参数不合法（schema）           → { code: 400, message: <校验信息> }
  内容库读取异常                → { code: 500, message: '题库加载失败' }
```

说明：

- 只读端点，不创建面试会话、不写 `session_asked` / `answers`、不扣面试额度。
- 排序与去重由服务端 `selectNext` 统一负责；客户端不得二次筛选。
- 训练完成后仍由客户端写本地 `trainingHistory`，不新增训练结果上报端点。

## 客户端改动

- 新增 `api/training.uts::fetchTrainingQuestions(positionId, experienceLevel, domain, count)`。
- `pages/training/room.uvue` 进入房间时一次拉取本场题目；成功后按序出题。
- 拉题失败 / 空数组：弹窗「重试 / 退出」，**不扣当日训练额度**；额度扣减延后到拉题成功。

## 服务端改动

- 新增 `routes/training.ts` + `services/training.ts`。
- 复用 `services/content-bank.ts::loadCandidates` 与 `rules/question-selector.ts::selectNext`。
- 不做跨场次去重（与正式面试现状一致，跨场去重属批次 B）。

## 影响面

- 新增端点，不改动既有 `/interview/*`、`/membership/*`、`/report/*` 出参。
- 静态题库文件（`data/question-bank.uts`、`server/src/data/question-bank.ts`）降级为测试夹具，禁止业务引用。
- App/H5 的 `mock` 模式不再提供面试/训练题目；联调需 `API_ENV=dev` 或 `prod`。
