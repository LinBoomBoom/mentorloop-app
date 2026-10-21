# 任务卡：W1a 虚拟支付契约冻结（结构）

- 日期：2026-10-22
- 关联：里程碑 M2「支付与会员」/ 父卡 [2026-10-21-mp-virtual-payment-feasibility.md](./2026-10-21-mp-virtual-payment-feasibility.md) §12 W1a

## 1. 目标

冻结 `/membership/order` 的端侧分流字段与虚拟支付 `payParams` 出参结构，让 FE / BE 在写代码前对同一份契约双签。

## 2. 范围

- 做：
  - 请求体增 `platform: 'app' | 'mp-weixin'`（必填，非法值 400）；
  - `payParams` 定义为可辨识联合：`provider: 'wxpay'`（App）与 `provider: 'virtual'`（MP）；
  - 冻结 `PAY_MODE`（App，`mock | wx`）与 `MP_PAY_MODE`（MP，`mock | virtual`）语义与优先级；
  - 冻结错误码到用户提示的映射；
  - 产出冻结单并 FE / BE 双签。
- 不做：
  - 不写实现；
  - 不填 `OfferID` / `AppKey` / `productId` 真实值（归 W1b）；
  - 不改 App 端 v3 JSAPI 行为。

## 3. 依赖

- 前置：无（结构冻结不依赖真实取值）
- 外部环境：无
- 契约：**是**（本卡即契约冻结）

## 4. 验收标准

- [x] 冻结单落盘 `docs/contracts/2026-10-21-virtual-pay.freeze.md`
- [x] `platform` 必填、默认值策略与非法值处理明确
- [x] `payParams` 联合类型字段逐项列全（`orderId` / `provider` / 虚拟支付四参数）
- [x] `PAY_MODE` 与 `MP_PAY_MODE` 取值域、优先级、缺省行为明确
- [x] 错误码映射覆盖 -15002 / -15005 / -15006 / -15007 / -15010 / -15014
- [x] FE、BE 双签留痕（2026-10-22，PO 批准进入 W2）

## 5. 风险与对策

| 风险                       | 等级 | 对策                                                                                          |
| -------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| `platform` 可伪造          | 中   | 服务端以 `session_key` / `X-WX-OPENID` 做一致性校验（W2）；伪造仅影响支付模式选择，不授予权益 |
| 冻结后变更                 | 高   | 重走冻结流程并在父卡风险登记                                                                  |
| 客户端与服务端类型副本漂移 | 中   | 冻结单列出两侧文件位置：`api/membership.uts:13-21`、`services/wechat-pay.ts:14-21`            |

## 6. 产物路径

- 新增：`docs/contracts/2026-10-21-virtual-pay.freeze.md`
- 修改：无

## 7. 角色

- 主责：BE
- 配合：FE（双签）、QA（可测性）、PO（范围裁决）

## 8. 负责人

后端工程师 + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询                        | 结论                                                                                                                                                                                                                                     |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 必须加 `platform` 吗？      | **已查证**：`config.ts:23/72/121` 为全局单值，`membership.uts:45` 只传 `{skuId}`，不加字段无法分流                                                                                                                                       |
| 2   | 现有 `payParams` 能复用吗？ | **已查证**：`membership.uts:13-21` 仅 6 个固定字段，需改为可辨识联合                                                                                                                                                                     |
| 3   | 是否触发 `types/` 变更？    | **已查证**：`types/auth.uts:8-12` 的 `AuthResult` 不变；`PayParams` 在 `api/` 内，属契约冻结范围                                                                                                                                         |
| 4   | 冻结单命名？                | **已决策**：沿用父卡 §6 指定路径 `2026-10-21-virtual-pay.freeze.md`                                                                                                                                                                      |
| 5   | 虚拟支付客户端参数结构？    | **已查证**：官方 API 文档（2026-10-22 抓取）顶层仅 `signData` / `paySig` / `signature` / `mode`；`signData` 为 JSON 字符串，含 `offerId` / `buyQuantity` / `env` / `currencyType` / `productId` / `goodsPrice` / `outTradeNo` / `attach` |
