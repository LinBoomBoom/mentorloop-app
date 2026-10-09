# G2 门禁记录：小程序端与桌面端账号互通（桌面→MP 单向权益）

- 日期：2026-10-09
- 任务卡：[2026-10-09-mp-account-link.md](./2026-10-09-mp-account-link.md)
- PO 双裁决：①权益方向=桌面→MP 单向；②实现路径=跨库只读直查（不动桌面仓库）

## 变更物

- 新增 `server/src/services/desktop-link.ts`：跨库只读网关（`createDesktopGateway`，库名标识符校验）+ 桌面 `effectiveVip` 同义映射（`parseDesktopVip` 容错对象/字符串双形态）+ `syncDesktopLink`（绑定 + `member_until = max(本地, 桌面)`，原地更新 user，失败吞掉不阻塞主流程）；长期会员哨兵 `LONG_TERM_VIP_UNTIL = 2100-01-01`
- 新增 `server/src/desktop-link.spec.ts`（11 用例：vip 解析容错、映射规则、唯一命中绑定、非会员只绑定、取 max 不回退、多命中放弃、零命中不动、幂等、openid 预留路径、开关关闭零开销、SQLite 跨库失败集成容错）
- 修改 `server/src/config.ts`（`DESKTOP_DB_NAME`，默认空=关闭，零配置可跑）+ `.env.example`
- 修改 `server/src/schema.sql` + `server/src/db.ts` migrate（`users.desktop_user_id`，try/catch ALTER）+ `deploy/cloud/baseline-mp-mysql.sql`（同列 VARCHAR(64)）
- 修改挂载点：`services/auth.ts`（loginByPhone/loginByWechat）、`routes/membership.ts`（quota 读取刷新）、`services/quota.ts` + `services/report.ts`（consumeInterview 加 env 参，防桌面新购 VIP 后误扣免费额度）

## 门禁执行

| 项                                         | 结果                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| server tsc --noEmit                        | ✅ 0 错                                                                                                       |
| server vitest                              | ✅ 58/58（10 文件，新增 11 例）                                                                               |
| server build（tsc emit）                   | ✅                                                                                                            |
| 根 vitest（含 asi-guard 扫描 server 源码） | ✅ 59/59                                                                                                      |
| format:check                               | ✅ 全绿（3 文件 prettier 修复后）                                                                             |
| 契约                                       | types/ 与 api/ 零变更；`/membership/quota` 出参结构不变（memberUntil 值语义扩展登记于任务卡附节），不触发冻结 |
| 范围裁剪                                   | 纯服务端改动：跳过 uvue 守卫与 build:mp-weixin                                                                |

## 验收标准对照（卡 §4）

- [x] 唯一手机号命中 → `desktop_user_id` 写入 + `memberUntil`=桌面 expireAt
- [x] 桌面 level=0 或已过期 → 不映射
- [x] 桌面 expireAt=null → 长期哨兵
- [x] 桌面无同号用户 → 行为与现状一致
- [x] 本地更晚 member_until → max 不回退
- [x] DESKTOP_DB_NAME 未配置 → 网关 null、零跨库查询
- [x] baseline-mp-mysql.sql users 含 desktop_user_id
- [x] G2 命令全绿
- [ ] 云端 smoke → 已并入 [对齐任务 runbook](./2026-10-08-mp-cloud-alignment.gate.md)（runbook 环境变量与 smoke 清单均已增量更新）

## 部署增量（相对对齐任务 runbook）

1. 控制台版本配置加 `DESKTOP_DB_NAME=mentorloop`（不配则互通关闭、行为同现状）
2. `mentorloop_mp` 未建库则直接用最新 baseline SQL（已含新列）；已建过则补一句 `ALTER TABLE users ADD COLUMN desktop_user_id VARCHAR(64) NULL`
3. 跨库 SELECT 要求连接账号对 `mentorloop` 库有读权限（root 现状满足）

## 遗留 / 技术债登记

- 桌面端改表结构或 vip JSON 形态会静默影响 MP 只读查询（SELECT 窄化为 id/phone/vip + 容错降级）；权益逻辑复杂化后应迁桌面内部 API
- 建议改专用 MySQL 账号（SELECT@mentorloop + ALL@mentorloop_mp），消除 MP 连接的跨库写权限
- MP 内部 openid/phone 双账号合并（同一人两种登录两行 users）为既存缺口，未在本卡范围，需另立任务卡
- 微信 openid 绑定为预留路径：桌面端当前无微信登录写入 auth_identities，实际打通以手机号为主
