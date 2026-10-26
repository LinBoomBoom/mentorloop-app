# 验收记录：W6 虚拟支付测试与验收（MP 分项）

- 日期：2026-10-26
- 任务卡：[2026-10-22-mp-virtual-pay-w6-test-acceptance.md](./2026-10-22-mp-virtual-pay-w6-test-acceptance.md)
- 门禁记录：[.gate.md](./2026-10-22-mp-virtual-pay-w6-test-acceptance.gate.md)
- 结论：**MP 虚拟支付主链路通过**（Android 真单 → 推送/查单 → 发货 → 幂等）。iOS 待正式版发布后补验，App v3 JSAPI 待商户凭据，均不阻塞本次 MP 分项验收。

## 1. 真单信息

| 项           | 值                                     |
| ------------ | -------------------------------------- |
| 平台         | Android 体验版                         |
| 道具         | `test_pay_01`（0.10 元，1 场）         |
| 支付时间     | 2026-10-26 11:47:22                    |
| 平台交易单号 | `4500****6436`（脱敏）                 |
| 业务订单号   | `o_003b****37d9`（脱敏，线上库可检索） |
| 支付结果     | 微信支付成功                           |

## 2. 服务端核验（2026-10-26）

对上述业务订单重放发货推送（`Event=xpay_goods_deliver_notify`、`ProductId=test_pay_01`、不带 `IsMock`）：

| 请求                 | 结果                                                         |
| -------------------- | ------------------------------------------------------------ |
| 云函数网关（首次）   | 504 `FUNCTIONS_TIME_LIMIT_EXCEEDED`（冷启动，函数 30s 超时） |
| 云托管直连（预热后） | 200 `<ErrCode>0</ErrCode><ErrMsg>already paid</ErrMsg>`      |
| 重复推送 ×2          | 均返回 `already paid`，未重复发放                            |

结论：

- 订单已处于 `PAID`，说明此前真实推送或查单兜底已完成结算；
- `settleOrder` 在 `CREATED→PAID` 原子迁移成功的同一事务内执行 `grantBenefit`，因此 `already paid` 即代表权益已发放；
- 重复推送返回 `already paid`，幂等成立。

## 3. 账本与权益

- `test_pay_01` 对应 `singleCount=1`；
- 服务端已完成发放；App 侧「单次卡」应为 1 次（待用户界面复核截图留痕）；
- 未使用部分可退款回收，已使用部分不追缴（W4 口径）。

## 4. 未覆盖 / 转后续

| 项                   | 状态                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| iOS 真单             | 体验版不支持 Apple 支付，需小程序提审发布正式版后补验（REL-3）              |
| App v3 JSAPI 回归    | 云端缺 `WX_MCH_PRIVATE_KEY` / `WX_API_V3_KEY`，待商户凭据与 `PAY_MODE` 决策 |
| 平台「测试推送」按钮 | 个人主体消息推送页无该按钮；以模拟推送 + 真实推送替代，已验证               |

## 5. 证据索引

- 云端回读与模拟推送：[.gate.md](./2026-10-22-mp-virtual-pay-w6-test-acceptance.gate.md)
- 推送处理与幂等实现：`server/src/services/virtual-notify.ts`、`server/src/virtual-notify.spec.ts`
- 结算与发放：`server/src/services/payment.ts`（`settleOrder` / `grantBenefit`）
- 道具定义：`server/src/data/skus.ts`（`test_pay_01`，`priceCent=10`）
