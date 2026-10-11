# 契约冻结记录：PositionId 方向体系对齐桌面端

- 日期：2026-10-11
- 任务卡：docs/tasks/2026-10-11-mp-position-taxonomy-c1.md
- PO 裁决：方向体系按「前端 / 后端 / 运维 / AI 工程」（数据库同一套数据源，以桌面端为准）

## 触发文件

- `types/interview.uts` L9（PositionId 联合类型）

## 字段 diff

| 项     | 冻结前                                                     | 冻结后                                        |
| ------ | ---------------------------------------------------------- | --------------------------------------------- |
| 类型名 | `PositionId`                                               | `PositionId`（不变）                          |
| 取值域 | `'java-backend' \| 'frontend' \| 'golang-backend' \| 'pm'` | `'frontend' \| 'backend' \| 'devops' \| 'ai'` |
| 语义   | MP 自造岗位粒度（Java/Go 独立方向 + 产品经理）             | 桌面端方向粒度（Java/Go 为 backend 内技术栈） |

## 出入参影响

- 接口形状零变更：`/interview/session` 请求体 `positionId: string`（schema 无枚举约束），`/interview/next` query `positionId: string`，报告/统计出参同字段——仅字符串取值域变更
- 展示名映射（客户端 positionDisplay / 服务端 position 字段透传）：前端 / 后端 / 运维 / AI 工程

## 兼容策略

- 客户端：`userStore.restore()` 对持久化旧值归一化（java-backend / golang-backend / pm → backend），归一化发生在类型断言前
- 客户端快照恢复：interview room `validPos` 白名单更新为新四值，未知旧值 fallback `'backend'`（既有兜底逻辑，仅换数组）
- 服务端：不添加归一化代码——产品未上线、云端无生产会话数据；positionId 由客户端归一化后传入
- 双端 position-options / question-bank 逐字同步迁移（人工同步模式维持，接口下发归 C5）

## 双签

- 客户端签署：AI 工程师 + 客户端工程师视角复核 —— 通过（选题过滤为相等匹配，值域迁移后命中原 Java 题库；收束题按方向取用逻辑不变）
- 服务端签署：服务端工程师视角复核 —— 通过（schema 仅 string 校验；题库副本同步迁移；无存储过程/枚举依赖）
- PO 裁决签署：用户 2026-10-11 指令原文为准 —— 已确认

## G2 验证点

- 双端 position-options 值域一致；全仓旧值清零；evals 评估集重跑通过
