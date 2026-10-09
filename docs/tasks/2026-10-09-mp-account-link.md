# 任务卡：小程序端与桌面端账号互通（桌面→MP 单向权益）

- 日期：2026-10-09
- 关联：[2026-10-08-mp-cloud-alignment](./2026-10-08-mp-cloud-alignment.md) 的后续需求；本会话 PO 双裁决：①权益方向=桌面→MP 单向；②实现路径=跨库只读直查（不动桌面仓库）

## 1. 目标

桌面端已购 VIP 的用户登录小程序后获得同等权益：按手机号（微信 openid 预留）打通桌面端 `mentorloop` 库身份，把桌面 `effectiveVip` 单向映射为 MP `member_until`，两端库表与账号体系各自保持独立。

## 2. 范围

- 做：
  - MP `users` 表加 `desktop_user_id VARCHAR(64) NULL`（本地 schema.sql + 迁移 + 云端 baseline DDL 三处同步）
  - 新服务 `desktop-link.ts`：跨库只读查桌面身份（`mentorloop.users` by phone；`mentorloop.auth_identities` provider='wechat' by openid 预留），按桌面 `effectiveVip` 同义规则映射权益，绑定后 `member_until = max(本地, 桌面映射值)`
  - 登录路径（loginByPhone / loginByWechat）尝试绑定；`GET /membership/quota` 对已绑定用户刷新
  - 配置开关 `DESKTOP_DB_NAME`（默认空 = 关闭全部跨库查询；本地 SQLite 无桌面库，天然关闭）
- 不做：
  - 不改桌面端 MentorLoop 仓库任何代码/数据（PO 裁决跨库只读）
  - 不做双向权益：MP 购买不反写桌面（PO 裁决单向；MP 自购权益记本地，与桌面取 max）
  - 不改客户端 `types/` 与 `api/`（出参结构零变更，见 §3 契约）
  - 不做 MP 内部 openid/phone 双账号合并（既存缺口：同一人两种登录方式在 MP 侧是两行 users，另立任务卡）
  - 不做专用 MySQL 账号改造（沿用现有凭据，风险表登记 + runbook 建议）

## 3. 依赖

- 前置：[2026-10-08-mp-cloud-alignment.gate.md](./2026-10-08-mp-cloud-alignment.gate.md) 的云端部署尚未执行——本卡 DDL 变更直接并入 `baseline-mp-mysql.sql` 一次建齐，云端无需线上 ALTER
- 外部环境：云 MySQL 实例 `cynosdbmysql-gjsimu6g` 上 `mentorloop`（桌面）与 `mentorloop_mp`（MP）同库实例；跨库 `SELECT` 要求连接账号对 `mentorloop` 有读权限（现状 root 满足）；真实跨库查询只能在云端 smoke 验证（本地无 MySQL）
- 契约：**否**——`types/` 与 `api/` 零变更；出参结构不变（`/membership/quota` 仍为 `QuotaView` 三字段），`memberUntil` 值语义扩展（可来自桌面 VIP 映射）登记于本卡附节，不触发契约冻结

## 4. 验收标准

- [ ] 单测：手机号登录命中桌面同号用户（vip.level≥1 未过期）→ `desktop_user_id` 写入 + `quota.memberUntil` = 桌面 `expireAt`
- [ ] 单测：桌面 `vip.level=0` 或已过期 → 不映射，`memberUntil` 保持本地值
- [ ] 单测：桌面 `expireAt=null`（长期有效）→ `memberUntil` 映射为长期哨兵值（2100-01-01）
- [ ] 单测：桌面无同号用户 → 不绑定，行为与现状完全一致
- [ ] 单测：本地已有更晚 `member_until`（MP 自购）→ 取 max 不回退
- [ ] 单测：`DESKTOP_DB_NAME` 未配置 → 绑定逻辑不触发、零跨库查询
- [ ] `baseline-mp-mysql.sql` 的 `users` 表含 `desktop_user_id` 列（与 schema.sql 一致）
- [ ] G2：server vitest 全绿 + tsc 0 错（纯服务端改动，客户端构建跳过）
- [ ] 云端 smoke（并入部署 runbook）：桌面同号 VIP 用户 MP 短信登录 → `GET /membership/quota` 返回桌面到期时间

## 5. 风险与对策

| 风险                                               | 等级 | 对策                                                                                                                      |
| -------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 桌面端改表结构/vip JSON 形态，静默破坏 MP 只读查询 | 中   | SELECT 列窄化（仅 id/phone/vip）+ `JSON.parse` 容错（异常视为非会员）；登记技术债：桌面权益逻辑复杂化后迁移为桌面内部 API |
| 桌面 `users.phone` 仅普通 KEY 非唯一，可能多行命中 | 低   | 仅唯一命中才绑定；多命中放弃绑定并 console.warn，不影响登录主流程                                                         |
| root 连接具备跨库写权限，MP 缺陷可污染桌面数据     | 低   | MP 代码对 `mentorloop` 只 SELECT；runbook 建议后续改专用账号（SELECT@mentorloop + ALL@mentorloop_mp）                     |
| 跨库查询增加登录/quota 延迟                        | 低   | 每请求至多 1 次窄查询，命中 `idx_users_phone` / `uq_auth_provider_uid` 索引；仅 `DESKTOP_DB_NAME` 配置时启用              |
| 长期会员（expireAt=null）与本地短期会员合并语义    | 低   | max 合并 + 每次登录/quota 重同步，自愈                                                                                    |

## 6. 产物路径

- 新增：`server/src/services/desktop-link.ts`、`server/src/desktop-link.spec.ts`、`docs/tasks/2026-10-09-mp-account-link.gate.md`
- 修改：`server/src/schema.sql`、`server/src/db.ts`（migrate 加 ALTER）、`server/src/services/auth.ts`、`server/src/routes/membership.ts`、`server/src/config.ts`、`server/.env.example`、`deploy/cloud/baseline-mp-mysql.sql`

## 7. 角色

- 主责：BE（mentorloop-server-conventions）
- 配合：PO（双裁决已定）、QA（mentorloop-quality-gate）

## 8. 负责人

BE 主责；执行 Agent = TRAE（本会话）；最终负责人 = 用户（PO）

---

## 附：实现基线（引用桌面端源码钉死的规则，实现时勿再调研）

1. **桌面 VIP 判定** = [effectiveVip](file:///e:/LsqCoding/MentorLoop/server/utils/db.ts#L1707-L1712)：解析 `users.vip` JSON → `active = level > 0 && (!expireAt || expireAt > now)`；`expireAt` 为空视为长期有效。MP 映射：active → `member_until = expireAt ?? 4102416000000`（2100-01-01 哨兵），再与本地取 max。
2. **桌面表**（[baseline-mysql.sql](file:///e:/LsqCoding/MentorLoop/deploy/cloud/baseline-mysql.sql)）：`users(id VARCHAR(64), phone, vip JSON)`（L173），`auth_identities(user_id, provider, provider_uid)`（L192，唯一键 provider+provider_uid）；`users.phone` 有 idx_users_phone 普通 KEY。
3. **MP 侧消费点**：`isMember(u)` / `getQuota(u)`（[quota.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/quota.ts)）读 `member_until`；客户端唯一入口 `GET /membership/quota`（[membership.uts#L83](file:///e:/LsqCoding/Mentorloop-app/api/membership.uts#L83)）——服务端映射后客户端零感知。
4. **本地迁移机制**：`db.ts migrate()` try/catch ALTER（[db.ts#L41](file:///e:/LsqCoding/Mentorloop-app/server/src/db.ts#L41)），加列照抄该模式。
5. **测试策略**：绑定/映射逻辑用注入 stub（桌面身份读取函数）单测；MySQL 跨库 SQL 本身云端 smoke 验证。
