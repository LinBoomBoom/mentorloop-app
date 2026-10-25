# G2 门禁记录：Phase 2.1 做题记录与 SRS 同步

- 日期：2026-10-23
- 任务卡：[2026-10-23-practice-sync-phase2.md](./2026-10-23-practice-sync-phase2.md)
- 契约：[2026-10-23-practice-sync.freeze.md](../contracts/2026-10-23-practice-sync.freeze.md)
- 结论：**代码门禁通过 + 云端 038 版本上线 + 跨设备同步实测通过**

## 1. 命令结果

| 命令                                    | 结果                                    |
| --------------------------------------- | --------------------------------------- |
| `pnpm lint`                             | 0 error / 0 warning                     |
| `pnpm typecheck`                        | 通过                                    |
| `pnpm test`                             | 8 文件 / 113 通过                       |
| `node scripts/check-uvue-css.mjs`       | OK（34 个 .uvue）                       |
| `node scripts/check-design-tokens.mjs`  | 全绿（A–H 八项）                        |
| `pnpm build:mp-weixin`                  | 构建成功                                |
| `pnpm --filter @mentorloop/server test` | 29 文件 / 217 通过（新增 4 条同步用例） |

## 2. 云端发布与 smoke

- 云托管版本：`mentorloop-mp-api-038`，流量 100%，访问策略 OA / PUBLIC / MINIAPP，EnvParams 25 键完整。
- 线上验证：
  - `POST /training/questions`（backend + be-db + senior）5 题全部 `be-db / senior`；非法难度返回业务码 400。
  - `POST /practice/records`（result=unknown，answeredAt 3 天前）→ `total=1 / wrong=1 / due=1`。
  - `GET /practice/wrong` 返回同一题；`GET /practice/due` 到期 1 题。

## 3. 客户端跨设备同步实测

1. 开发者工具内完成一组 5 题（全部「会」），等待补传落库。
2. 关闭并重开小程序（重置模块内存态），删除本地 `ml_practice_progress`，模拟换设备。
3. 重新进入做题页：**累计做题 5 / 会 5 / 错题 0**，细分领域行显示「5 题 · 会 5」——数据全部来自服务端恢复。

截图：`e2e/mp/shots/sync-01-summary.png`、`sync-02-restored.png`。此时无到期题，故「今日复习」入口按预期不显示。

## 4. 实现要点

- 表 `practice_records`：SQLite 自举 + 云端启动迁移幂等建表；用户 × 题唯一。
- SRS：不会 1 天、模糊 1 天不降间隔、会 1/2/4/7/15/30/60 天递进。
- 客户端 pending 队列（≤200）按 `answeredAt` 补传；服务端忽略早于 `updated_at` 的旧补传。
- 训练页 `onShow` 先展示本地缓存再拉服务端；「今日复习」入口按 `dueCount` 显隐；房间支持 `mode=due`。

### 4.1 今日复习入口走查（2026-10-23）

- 云账号造一条 3 天前「不会」记录后，做题页入口显示「今日复习 · 1 题」；点击进入 `mode=due` 房间，完成 1 题（查看解析 → 自评「会」）后出现小结「1 题 · 会 1」。
- 服务端复核 `dueCount=0 / wrongCount=0`；返回做题页滚到入口区域，今日复习与错题本入口均消失。
- 证据截图：`e2e/mp/shots/due-00-entry-visible.png`、`due-00b-entry-visible.png`、`due-02-room.png`、`due-03-answer.png`、`due-04-summary.png`、`due-05-entry-hidden.png`、`due-06-scrolled.png`。

## 5. 遗留

- 完整答案全文入库（Phase 2.2）与选择题形态（Phase 2.3）未开始。
- 复习提醒未做推送，依赖用户进入做题页。
