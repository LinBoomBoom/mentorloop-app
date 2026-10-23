# 契约冻结单：做题模式（细分领域 + 精确难度过滤）

- 日期：2026-10-23
- 关联任务卡：[2026-10-23-practice-subtrack-mode.md](../tasks/2026-10-23-practice-subtrack-mode.md)
- 类型：请求字段扩展（复用既有端点，不新增端点、不改响应结构）
- 状态：**已冻结（FE / BE 双签，2026-10-23）**

## 1. 端点变更

| 端点                  | 方法 | 变更                                                  |
| --------------------- | ---- | ----------------------------------------------------- |
| `/training/questions` | POST | 请求体新增可选 `subtrack`、`difficulty`；响应结构不变 |

## 2. 端点契约（逐字）

```
POST /training/questions        （requireAuth；JSON）
请求体：
{
  "positionId": "frontend" | "backend" | "devops" | "ai",   // 必填
  "experienceLevel": "fresh" | "junior" | "mid" | "senior", // 必填（兼容旧调用）
  "domain": string,     // 可选，六维能力域；'' = 不限
  "subtrack": string,   // 可选，细分领域 id（见 §3）；'' = 不限
  "difficulty": "junior" | "mid" | "senior", // 可选；缺省/'' = 按 experienceLevel 白名单
  "count": number       // 1–10
}

成功：{ "code": 0, "data": { "questions": QuestionItem[] }, "message": "" }
```

## 3. 细分领域 id（20 个，按方向）

| 方向     | subtrack                                                    |
| -------- | ----------------------------------------------------------- |
| frontend | `fe-web` `fe-app` `fe-miniprogram` `fe-desktop` `fe-arch`   |
| backend  | `be-micro` `be-data` `be-db` `be-web` `be-game`             |
| devops   | `op-k8s` `op-sre` `op-devops` `op-cloud` `op-sec` `op-trad` |
| ai       | `ai-algo` `ai-app` `ai-infra` `ai-mlops`                    |

未知 `subtrack` → 返回空数组（200），不报 500。

## 4. 难度语义（新增，做题模式专用）

- 传 `difficulty` 时：**精确匹配**该难度，不再按 `experienceLevel` 的难度白名单扩展；
  服务端内部把选择器的经验档位置为 `senior`（允许全部难度），但候选池已按 `difficulty` 精确过滤。
- 不传 `difficulty` 时：沿用旧行为（按 `experienceLevel` 白名单抽题），现有面试/训练调用不受影响。
- 难度与内容库映射固定：`junior`=初级 / `mid`=中级 / `senior`=高级。

## 5. 字段 diff

| 字段         | 变更前 | 变更后                                                                         | 端              |
| ------------ | ------ | ------------------------------------------------------------------------------ | --------------- |
| `subtrack`   | 不存在 | 可选 `string`，20 个 id 之一或 `''`                                            | client → server |
| `difficulty` | 不存在 | 可选 `'junior' \| 'mid' \| 'senior'`                                           | client → server |
| 响应字段     | —      | 不变（`QuestionItem`，含 `expectedEvidence` / `knowledgePoint` / `techStack`） | server → client |

## 6. 影响面

- 服务端：`routes/training.ts` 请求 schema、`services/training.ts` 输入、`services/content-bank.ts` 候选查询。
- 客户端：`api/training.uts` 参数扩展；`pages/training/*` 重做为「做题」；报告/首页文案「训练 → 做题」。
- 兼容：旧调用不传新字段，行为完全不变；面试出题链路不经过本端点。

## 7. 双签

| 角色 | 签署       | 结论 |
| ---- | ---------- | ---- |
| FE   | 2026-10-23 | 同意 |
| BE   | 2026-10-23 | 同意 |
