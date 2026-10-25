# 任务卡：Phase 2.1 做题记录与 SRS 同步

- 日期：2026-10-23
- 关联：Phase 2 方案（[2026-10-23-practice-mode-proposal.md](../design/2026-10-23-practice-mode-proposal.md) §Phase 2）；契约 [2026-10-23-practice-sync.freeze.md](../contracts/2026-10-23-practice-sync.freeze.md)
- 前序：做题模式 Phase 1（本地掌握度与错题本）已上线

## 1. 目标

把做题记录、错题本从「本机存储」升级为「账号同步 + 记忆曲线复习」，让用户换设备不丢进度，并在合适的时间被提醒复习。

## 2. 范围

- 做：
  - 服务端 `practice_records` 表（SQLite 自举 + 云端 MySQL 迁移）
  - `/practice/records`（写/读）、`/practice/summary`、`/practice/wrong`、`/practice/due`
  - SRS：不会 1 天、模糊 1 天不降间隔、会按 1/2/4/7/15/30/60 天递进
  - 客户端离线队列补传（`pending`）+ 登录后拉取汇总/错题
  - 做题页新增「今日复习」入口，做题房间支持 `mode=due`
- 不做：
  - 不做完整答案全文入库（Phase 2.2）
  - 不做选择题形态（Phase 2.3）
  - 不做跨端实时推送（复习提醒仍靠页面入口）

## 3. 依赖

- 前置：Phase 1 做题模式、账号体系（JWT + uid）、内容库 questions 表
- 外部环境：无新增凭据
- 契约：是，已冻结

## 4. 验收标准

- [x] 未登录调用 `/practice/*` 返回业务 401
- [x] 「不会」写入后进入错题本与到期队列；再标记「会」移出错题本，attempts 累加
- [x] 汇总按细分领域分组，`wrongCount` 与 `dueCount` 正确
- [x] 跨账号隔离：另一账号看不到记录与错题
- [x] 过期补传（answeredAt 更早）不覆盖较新记录
- [x] 客户端离线作答进入队列，联网后自动补传；换设备登录后进度一致
- [x] 做题页「今日复习」只在有到期题时出现，进入后可完成复习（2026-10-23 云账号走查：dueCount=1 时入口显示「今日复习 · 1 题」，进入完成复习后小结「1 题 · 会 1」，服务端 dueCount 回落 0、入口消失；截图 `e2e/mp/shots/due-00..06`）
- [x] 服务端/客户端门禁全绿

## 5. 风险与对策

| 风险                   | 等级 | 对策                                                |
| ---------------------- | ---- | --------------------------------------------------- |
| 旧本地数据与服务端冲突 | 中   | 首次登录后以服务端为准；本地队列补传保留 answeredAt |
| 离线队列无限增长       | 低   | 上限 200 条，超出丢弃最旧                           |
| 云端表未建导致 500     | 中   | 启动迁移幂等建表；部署后 smoke 覆盖写读             |
| SRS 间隔让用户久不复习 | 低   | 页面展示到期数；后续可加推送（Phase 2.4）           |

## 6. 产物路径

- 新增：`server/src/services/practice.ts`、`server/src/routes/practice.ts`、`api/practice.uts`、契约与任务卡
- 修改：`server/src/schema.sql`、`server/src/db.ts`、`server/src/routes/index.ts`、`server/src/practice.spec.ts`、`store/practice-progress.uts`、`pages/training/training.uvue`、`pages/training/room.uvue`

## 7. 角色

- 主责：BE（记录与 SRS）、FE（同步与复习入口）
- 配合：AI（排程参数）、UX（今日复习入口）、QA（G2）

## 8. 负责人

BE + FE，执行 Agent（本会话）

## 9. 开工前质询

| #   | 质询                         | 结论                                                   |
| --- | ---------------------------- | ------------------------------------------------------ |
| 1   | 是否必须新表？               | 是：记录需按用户 × 题唯一并带 SRS 字段，现有表无处承载 |
| 2   | 能否复用报告数据推断掌握度？ | 否：面试报告是场次级，无法表达逐题复习节奏             |
| 3   | 离线如何不丢作答？           | 客户端 pending 队列 + answeredAt 去旧；重连自动补传    |
| 4   | 是否要做推送提醒？           | 本期不做；先以做题页「今日复习」入口验证复习意愿       |
| 5   | 旧客户端是否受影响？         | 否：新增端点；旧版本只读本地，不调用新接口             |
