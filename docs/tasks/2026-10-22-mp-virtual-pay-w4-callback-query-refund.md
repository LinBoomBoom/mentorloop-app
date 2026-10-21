# 任务卡：W4 虚拟支付回调、查单与退款

- 日期：2026-10-22
- 关联：里程碑 M2「支付与会员」/ 父卡 [2026-10-21-mp-virtual-payment-feasibility.md](./2026-10-21-mp-virtual-payment-feasibility.md) §12 W4

## 1. 目标

让支付结果可靠落账：发货推送为主、查单补发兜底、退款可回收权益，重复通知不重复发放。

## 2. 范围

- 做：
  - 新增 `text/xml` 解析器并保留 rawBody；
  - 新增 `POST /membership/virtual/notify`：校验 `outTradeNo` / `productId` / 金额三元一致，返回 `<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>`；
  - 复用 `settleOrder` 的 CREATED→PAID 原子迁移；
  - 定时 `query_order`：CREATED 且 24h 内、5 分钟一次、命中即停；
  - 处理 `xpay_refund_notify` 与权益回收；
  - 按平台要求返回成功 / 失败响应，失败让平台重试。
- 不做：
  - 不改 App 端 `/membership/order/notify`（v3）；
  - 不做发票 / 分账；
  - 不做订阅续费。

## 3. 依赖

- 前置：W3（下单与订单号）
- 外部环境：消息推送 URL（W0）、`AppKey`（W0）
- 契约：否（内部路由，不新增客户端字段）

## 4. 验收标准

- [ ] XML 解析器保留 rawBody，验签可用
- [ ] 成功响应为官方 XML 格式（`<xml><ErrCode>0</ErrCode>...`），失败时返回非 0 让平台重试
- [ ] 重复推送只发放一次（幂等测试）
- [ ] `outTradeNo` / `productId` / 金额任一不符 → 拒收并告警
- [ ] 推送丢失场景下查单可在 5 分钟内补发
- [ ] 退款通知后权益回收规则落库并有测试
- [ ] 查单扫描窗口与终止条件有单测

## 5. 风险与对策

| 风险                         | 等级 | 对策                                                        |
| ---------------------------- | ---- | ----------------------------------------------------------- |
| XML 解析器缺失导致 415 / 400 | 高   | 与 JSON 解析器并列注册，保留 rawBody（参考 `app.ts:43-61`） |
| 伪造回调                     | 高   | 校验三元一致 + 平台来源；不一致直接拒收                     |
| 查单无限扫描历史单           | 中   | 限 CREATED 且 24h 内、命中即停                              |
| 退款回收规则不清             | 中   | 未使用整单回收；已使用按剩余额度回收，规则写入冻结单        |

## 6. 产物路径

- 修改：`server/src/app.ts`、`server/src/routes/membership.ts`、`server/src/services/virtual-pay.ts`、`server/src/services/payment.ts`
- 新增：`server/src/services/virtual-pay-query.ts`（或并入 `virtual-pay.ts`，开工时二选一）、`server/src/services/virtual-pay.spec.ts`

## 7. 角色

- 主责：BE
- 配合：QA（幂等 / 伪造 / 补发用例）、FE（推送延迟对账）

## 8. 负责人

后端工程师 + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询               | 结论                                                                                                                                                 |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 回调内容类型？     | **已查证**：虚拟支付发货推送为 XML（父卡 W4）；Fastify 现仅注册 JSON（`app.ts:43-61`）                                                               |
| 2   | 幂等靠什么？       | **已查证**：`payment.ts:101-116` 的 CREATED→PAID 原子迁移，重复回调返回 false                                                                        |
| 3   | 金额校验有无先例？ | **已查证**：`membership.ts:109-112` 已做金额比对，虚拟支付沿用                                                                                       |
| 4   | 推送响应格式？     | **已查证**：官方返回 `<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>`；失败平台最多重试 15 次                                   |
| 5   | 推送 URL 是什么？  | **已查证**：默认云托管域名 `https://mentorloop-mp-api-324175-6-1501249243.sh.run.tcloudbase.com` + `/membership/virtual/notify`；`/healthz` 实测 200 |
