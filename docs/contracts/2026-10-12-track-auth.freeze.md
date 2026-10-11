# 契约冻结：/track/batch 鉴权与身份语义收紧

- 日期：2026-10-12
- 触发：P0 安全修复（埋点云端静默丢失 + 匿名通道可刷爆）
- 状态：已实施（服务端 + 测试落库，客户端无需改动）
- 双签：服务端 ✓（本次变更与客户端 tracking.uts 出参无冲突，向后兼容）

## 变更内容

| 项   | 变更前                                                         | 变更后                                                                 |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 鉴权 | 免鉴权（SOP 豁免 track）                                       | `requireAuth` 必需，401 无 token                                       |
| 身份 | 信任 `body.userId` 字符串直插 `tracking_events.user_id BIGINT` | 忽略 `body.userId`；以鉴权 uid 解析 `users.id` 数值入库，未注册落 NULL |
| 限量 | 无                                                             | 每批 `maxItems: 100`，单条 `maxLength: 4096`                           |

## 兼容性说明

- 客户端 `api/tracking.uts` 出参不变（events 字符串数组，payload 内 userId 字段保留但服务端忽略）。
- 未登录期间的埋点将 401 暂存本地队列（上限 200），登录后随 `flushTrackingQueue` 补传成功。
- `tracking_events.user_id` 语义变更：`0`/NULL = 匿名或未注册；正整数 = `users.id`。此前遗留的字符串脏数据仅存在于本地 SQLite 测试库，云端 MySQL 因 1265 从未写入过（即此前埋点本就全丢），无需数据迁移。

## 核验命令

```bash
curl -s -X POST $BASE_URL/track/batch -H 'content-type: application/json' -d '{"events":["{\"event\":\"t\"}"]}'
# 预期：HTTP 401 {"code":401,"message":"未登录..."}
grep -n "maxItems" server/src/routes/misc.ts   # 预期：100
grep -n "numericUserId" server/src/services/track.ts
```
