# 汇报：小程序虚拟支付接入第 1 批（W0 / W1a / W2）

- 日期：2026-10-22
- 关联：父卡 [2026-10-21-mp-virtual-payment-feasibility.md](./2026-10-21-mp-virtual-payment-feasibility.md) §12
- 范围：第 1 批 W0 + W1a，并按 PO 决策追加 W2
- 结论：**W1a 契约冻结完成并双签；W2 服务端 `session_key` 链路实现并通过 G2；W0 云端凭据已注入回读，仅剩 5 个道具 ID**

## 1. 结果总览

| 工作包        | 状态     | 产物 / 证据                                                               |
| ------------- | -------- | ------------------------------------------------------------------------- |
| W0 凭据与商品 | 部分完成 | 云端 24 键回读 MATCH；`MP_OFFER_ID` / `MP_APP_KEY` 已注入；5 个道具待发布 |
| W1a 契约冻结  | 完成     | [冻结单](../contracts/2026-10-21-virtual-pay.freeze.md) FE / BE 双签      |
| W2 服务端会话 | 完成     | `session_key` 落库、openid 一致性、24h 新鲜度兜底；9 项新测试             |

## 2. 关键决策

1. **支付模式双变量**：`PAY_MODE` 管 App，`MP_PAY_MODE` 管 MP；`/membership/order` 请求体新增 `platform`，服务端按端分流。
2. **`payParams` 可辨识联合**：`provider: 'wxpay' | 'virtual'`；虚拟支付只含 `mode` / `signData` / `paySig` / `signature`，`signData` 以 JSON 字符串传递。
3. **`session_key` 链路**：登录路由 code 优先真实换取，`X-WX-OPENID` 仅兜底；header 与 code 的 openid 不一致直接 400；密钥仅服务端可读，永不下发。
4. **退款口径**：仅未发货 / 重复支付可退；已发放虚拟权益不退；iOS 退款由 Apple 决定。
5. **iOS IAP**：PO 2026-10-22 开通中；W5 双端实现，iOS 真机支付测试待生效后执行。
6. **消息推送 URL**：默认云托管域名 + `/membership/virtual/notify`；域名 `/healthz` 实测 200，平台测试推送待 W4 路由部署。

## 3. 代码改动

| 文件                                                                      | 改动                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [routes/auth.ts](../../server/src/routes/auth.ts#L92-L147)                | code 优先换取、header 兜底、openid 一致性校验、session_key 落库                        |
| [services/auth.ts](../../server/src/services/auth.ts#L95-L186)            | `WxSession`、`loginByWechat(sessionKey)`、`getSessionKey` / `getFreshSessionKey`       |
| [schema.sql](../../server/src/schema.sql#L4-L23)                          | `users` 增 `session_key` / `session_key_updated_at`                                    |
| [baseline-mp-mysql.sql](../../deploy/cloud/baseline-mp-mysql.sql#L10-L18) | 云端 MySQL 建表同步                                                                    |
| [db.ts](../../server/src/db.ts#L23-L28)                                   | MySQL 增量迁移与本地 SQLite 迁移补齐                                                   |
| [auth.spec.ts](../../server/src/auth.spec.ts#L78-L230)                    | 9 项测试：成功落库、响应/日志不泄露、不一致拒绝、错误码、网络失败、header 兜底、新鲜度 |

## 4. 验证与门禁

- G2 服务端：`typecheck` + `test`（23 files / **171 passed**）+ `build` 全部通过。
- `eslint`：改动文件无输出。
- 云端：`UpdateCloudRunServerConfig` 注入成功，回读 **24 键**；`WX_APPID`、`WX_SECRET`、`MP_OFFER_ID`、`MP_APP_KEY` 均 MATCH；RequestId `7d580a26-1151-4f15-b4b4-985b959b5a2a`。
- 服务健康：`/healthz` 返回 **200**。
- 密钥卫生：仓库 grep 无 `WX_SECRET` / 现网 AppKey 明文；临时注入脚本已删除。

## 5. 文档产物

- 契约冻结：[2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md)
- 实施卡（8 张）：W0 / W1a / W1b / W2 / W3 / W4 / W5 / W6，见父卡 §15 分发记录
- W0 执行记录：[2026-10-22-mp-virtual-pay-w0-credentials-goods.accept.md](./2026-10-22-mp-virtual-pay-w0-credentials-goods.accept.md)
- 父卡同步：§10 b2/b4 补官方参数与错误码；§11 更新代码现状；§13 补 iOS；§14 更新阻塞状态；§15 补进度

## 6. 当前阻塞

1. **5 个 `productId` 未回填**：道具管理发布后，W1b 才能完成取值章节，W3 才能开工。
2. **消息推送平台测试**：URL 已确定，但 `/membership/virtual/notify` 由 W4 实现，当前测试推送会 404。
3. **W2 代码未部署**：云端变量已就绪，但线上仍运行旧版本；`session_key` 链路要等下次部署才生效。
4. **iOS IAP 生效中**：代码双端实现，真机支付测试待 IAP 开通完成。

## 7. 风险

| 风险                                                    | 等级 | 对策                                                 |
| ------------------------------------------------------- | ---- | ---------------------------------------------------- |
| 旧 App 包不传 `platform` → 400                          | 中   | 契约冻结已登记；上线前确认无存量旧包，或发版同步更新 |
| `UpdateCloudRunServerConfig` 为配置级更新，新版本才生效 | 中   | W3 部署后回读并验证                                  |
| 默认云托管域名作为推送 URL 未平台验证                   | 中   | W4 部署后点测试推送；失败回退云函数转发              |
| 退款文案未写入购买页 / 协议                             | 中   | 用 §1.5 草案，LC 定稿后上线                          |
| iOS 12% 佣金与 45–60 天结算                             | 中   | IAP 生效后纳入定价与现金流复核                       |

## 8. 经验沉淀

1. 契约冻结必须对照官方 API 文档确认参数层级：`signData` 是字符串，顶层只有 `signData` / `paySig` / `signature` / `mode`。
2. `api/membership.uts` 是 App / MP 共用文件，`platform` 不是 MP-only 改动；App 侧必须同步带 `platform='app'`。
3. 云托管测试中 `trustWxHeaders` 必须在 `buildApp` 前设置，否则 app 层剥离 `X-WX-*` 头的钩子会先删头。
4. PowerShell 5 不支持 `&&`，且会吞掉 `tcb api --body` 的 JSON 引号；用 Node 入口 + Python argv 传参可稳定调用。
5. `UpdateCloudRunServerConfig` 的 `EnvParams` 是 JSON 对象字符串，必须合并旧键后整体提交，不能只传新增键。

## 9. 下一步

1. PO 回填 5 个 `productId` → W1b 冻结取值。
2. W3 服务端签名与虚拟支付下单。
3. W5 客户端双端拉起；W3 / W5 可并行。
4. W4 回调、查单与退款；W6 小额真单验收。
5. 部署新版本并完成推送 URL 平台测试。
