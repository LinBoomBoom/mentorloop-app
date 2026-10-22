# 任务卡：W3 服务端虚拟支付下单与签名

- 日期：2026-10-22
- 关联：里程碑 M2「支付与会员」/ 父卡 [2026-10-21-mp-virtual-payment-feasibility.md](./2026-10-21-mp-virtual-payment-feasibility.md) §12 W3

## 1. 目标

MP 端下单返回可直接拉起 `wx.requestVirtualPayment` 的签名参数，金额与道具以 `skus.ts` 为唯一权威。

## 2. 范围

- 做：
  - 新增 `server/src/services/virtual-pay.ts`：生成 `signData`、`paySig`、`signature`；
  - `MP_PAY_MODE=virtual` 分支复用 `createOrder`；
  - `skus.ts` 增 `wxProductId`，由 W1b 取值；
  - 下单按 `platform` 分流：`mp-weixin` → virtual，`app` → 现有 wx / mock；
  - 错误码映射。
- 不做：
  - 不改 App 端 v3 JSAPI；
  - 不做回调与查单（W4）；
  - 不做代币充值。

## 3. 依赖

- 前置：W2（session_key 可用）、W1b（道具取值）
- 外部环境：云端 `OfferID` / `AppKey`（W0）
- 契约：是（按 W1a 冻结单实现）

## 4. 验收标准

- [x] 签名单测覆盖官方算法：`paySig = HMAC(AppKey, "requestVirtualPayment&"+signData)`、`signature = HMAC(sessionKey, signData)` 可复算一致（官方文档只给算法未给固定向量，改为「按算法原文拼接复算 + 换密钥/换报文必变」双重断言）
- [x] `goodsPrice` 取自 `skus.ts`，请求体传价被忽略
- [x] `platform=mp-weixin` 且 `MP_PAY_MODE=virtual` 返回 `provider: 'virtual'`
- [x] `platform=app` 行为与改动前一致（回归测试）
- [ ] -15002 / -15005 / -15006 / -15007 / -15010 / -15014 有明确映射（**文案已在冻结单 §5.2 冻结，代码落点归 W5 客户端 fail 回调**；服务端 400/409/500 分支已实现并有单测）
- [x] 订单号沿用 `newId('o')`，符合订单号规则
- [x] 既有 `payment.spec.ts` 的 mock / wx 用例已补 `platform` 并通过

## 5. 风险与对策

| 风险                       | 等级 | 对策                                        |
| -------------------------- | ---- | ------------------------------------------- |
| 签名原文与实际请求体不一致 | 高   | 单测固定向量；`postBody` 只序列化一次并复用 |
| 客户端传价                 | 高   | 服务端只认 `skuId`，价格从 `skus.ts` 取     |
| 重复单号 -15002            | 中   | 每次下单新建订单号；仍失败则重开一次并记录  |
| 两端模式互相影响           | 高   | 双变量 + `platform` 分流，禁止共用单值      |

## 6. 产物路径

- 新增：`server/src/services/virtual-pay.ts`、`server/src/services/virtual-pay.spec.ts`
- 修改：`server/src/routes/membership.ts`、`server/src/config.ts`、`server/src/data/skus.ts`、`server/src/services/payment.spec.ts`（下单用例补 `platform`）

## 7. 角色

- 主责：BE
- 配合：QA（签名与分流用例）、FE（出参联调）

## 8. 负责人

后端工程师 + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询                       | 结论                                                                      |
| --- | -------------------------- | ------------------------------------------------------------------------- |
| 1   | 金额从哪来？               | **已查证**：`skus.ts` 唯一权威，客户端只传 `skuId`（`membership.uts:45`） |
| 2   | 订单号是否合规？           | **已查证**：`newId('o')` 为 `o_` + 12 位，共 14 字符，字母开头            |
| 3   | 签名参数从哪取？           | **已决策**：`OfferID` / `AppKey` 走云端变量；`productId` 走 `skus.ts`     |
| 4   | 失败后能否复用同一订单号？ | **已决策**：不复用；每次下单新建，避免 -15002                             |
