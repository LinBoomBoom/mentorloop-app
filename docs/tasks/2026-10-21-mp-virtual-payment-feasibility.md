# 任务卡：小程序个人主体虚拟支付接入可行性（分析卡）

- 日期：2026-10-21
- 最后修订：2026-10-22（代码复核后修订：SKU 数、行号、支付模式分流、session_key 刷新、openid 一致性、回调校验）
- 关联：里程碑 M2「支付与会员」/ 缺口「MP 端线上支付未接线」
- 性质：**分析卡（只做可行性核实，不改代码、不改配置、不动线上服务）**
- 结论先行：**可行**。平台侧门槛已满足；当前真正的阻塞是 `session_key` 链路与云端微信凭据，而不是接口能力。

---

## 1. 目标

在「个人主体小程序 + 工具类目 + 虚拟支付已开通 + 微信云托管」的既定前提下，核实微信虚拟支付接入的可行性与改动面，产出带官方来源的证据、代码差距清单、实施拆分与风险登记，供 PO 晚间分配任务。

## 2. 范围

- 做：
  - 核实个人主体虚拟支付的开通条件、限额、费率、终端限制；
  - 核实 `wx.requestVirtualPayment` 的版本要求、参数与错误码；
  - 盘点仓库内登录、支付、订单、回调的现状与缺口；
  - 给出首选接入路径、回退路径与任务拆分建议。
- 不做：
  - 不改任何客户端 / 服务端代码；
  - 不改云端环境变量、数据库结构、消息推送配置；
  - 不申请或变更微信支付 / 虚拟支付后台配置；
  - 不发起真实支付，不产生任何交易。

## 3. 依赖

- 前置（PO 于 2026-10-21 口述确认，仓库内无截图留证）：
  - 小程序已完成认证与备案；
  - 服务类目含「工具」；
  - 虚拟支付已开通。
- 外部环境（接入前必须拿到）：
  - `WX_APPID` / `WX_SECRET`：云端当前缺失，见 `docs/tasks/2026-10-20-mp-voice-channel-report.md:20` 与 `:50`（与 ASR 卡共用，避免重复取数）；
  - 虚拟支付后台的 `OfferID`、现网 `AppKey`；
  - 后台已发布的道具 `productId` 与价格；
  - 消息推送接收 URL；
  - iOS 端小程序简称（Apple 支付展示名）。
- 契约：**是**。`/membership/order` 请求体需新增 `platform: 'app' | 'mp-weixin'` 以实现端侧分流（`PAY_MODE` 管 App、`MP_PAY_MODE` 管 MP）；`payParams` 需扩展虚拟支付参数（`signData` / `paySig` / `signature` / `mode`）。落地前必须产出契约冻结单并由 FE / BE 双签。

## 4. 验收标准

- [ ] 每条平台结论都有官方来源链接，无法核实的明确标注 unverified。
- [ ] 代码现状逐项给出文件与行号，不凭印象描述。
- [ ] 差距清单每项标明主责角色与依赖关系。
- [ ] 首选路径与回退路径均给出，并写明触发回退的判定条件。
- [ ] PO 晚间分配时可直接按 §12 拆卡，无需再次调研。
- [x] §11 行号与 SKU 数已按源码逐条复核（2026-10-22）。

## 5. 风险与对策

| 风险                                                                          | 等级 | 对策                                                                                                                              |
| ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| 云托管链路优先采信 `X-WX-OPENID`，跳过 `jscode2session`，拿不到 `session_key` | 高   | 登录路由在拿到 code 时仍调用 `code2session`，只把 `session_key` 落服务端，绝不下发客户端                                          |
| 云端缺 `WX_APPID` / `WX_SECRET`                                               | 高   | 作为 W0 前置项先补齐并回读确认，否则虚拟支付签名必然失败（-15005 / -15007）                                                       |
| `session_key` 泄露                                                            | 高   | 仅服务端存储与读取；不写日志、不下发、不进入埋点；每次 `wx.login` 覆盖刷新；支付前校验新鲜度，-15007 触发重登并重试一次（限一次） |
| 虚拟支付 `OfferID` / `AppKey` 泄露                                            | 高   | 仅存服务端云端变量；不写日志、不下发客户端、不进入埋点；与 `WX_SECRET` 同等敏感级别管理                                           |
| 消息推送 URL 不可达（云托管默认域名限制）                                     | 中   | 首选云托管 HTTPS 直收；验证不通过则回退云函数接收并转发（官方支持云函数处理虚拟支付回调）                                         |
| 道具被按教育类复核，与「工具」类目不符                                        | 中   | 按实际功能如实提交，上线前由 MP-PM 按工具类目要求复核；若被判定教育类，回退个体工商户主体 + 普通支付                              |
| iOS 费率与结算周期                                                            | 中   | 12% Apple 佣金、结算约 45–60 天、退款由 Apple 决定；定价与现金流需提前计入                                                        |
| 月支付限额 10 万元                                                            | 低   | 超限前无解，只能升级主体；作为业务预警项登记                                                                                      |
| 误用现有 v3 JSAPI 卖虚拟道具                                                  | 高   | MP 端强制走 `MP_PAY_MODE=virtual`；`PAY_MODE=wx` 仅保留给 App 端；服务端以 `platform` 字段分流                                    |

## 6. 产物路径

- 新增：`docs/tasks/2026-10-21-mp-virtual-payment-feasibility.md`（本卡）
- 后续实施阶段预计涉及（本卡不改）：
  - 服务端：`server/src/services/virtual-pay.ts`（新增）、`server/src/services/auth.ts`、`server/src/routes/auth.ts`、`server/src/routes/membership.ts`、`server/src/app.ts`、`server/src/config.ts`、`server/src/data/skus.ts`（新增 `wxProductId` 字段，保持唯一权威）、`server/src/schema.sql`、`deploy/cloud/baseline-mp-mysql.sql`
  - 客户端：`api/membership.uts`、`api/auth.uts`、`App.uvue`
  - 文档：`docs/contracts/2026-10-21-virtual-pay.freeze.md`（待产出）
- 说明：`session_key` 不下发客户端，`types/auth.uts` 的 `AuthResult` 无需变更。

## 7. 角色

- 主责：FA（可行性分析师）
- 配合：MP-PM（类目、道具、审核）、BE（签名 / 回调 / 订单）、FE（客户端拉起与版本兼容）、QA（联调与真机取证）、PO（范围与裁决）、LC（支付合规与税务）

## 8. 负责人

FA + 执行 Agent

---

## 9. 开工前质询（未决项清单）

| #   | 质询                                  | 结论                                                                                                                                         |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 个人主体能不能开虚拟支付？            | **已查证**：能，但限「工具」类目，且须完成认证与备案；全终端月限额 10 万元（官方《虚拟支付：个人》）                                         |
| 2   | 项目资质是否满足？                    | **已决策**：PO 2026-10-21 确认认证、备案、工具类目、虚拟支付均已就绪；仓库无凭证，接入前补后台截图留痕                                       |
| 3   | 有静默登录是否就能支付？              | **已查证**：不能。虚拟支付的用户态签名依赖 `session_key`，当前只取 `openid`                                                                  |
| 4   | 云托管链路会不会跳过 `code2session`？ | **已查证（会）**：`routes/auth.ts:108-125` 在 `TRUST_WX_HEADERS=true` 且有 `X-WX-OPENID` 时直接采信头，不再用 code 换会话 → 无 `session_key` |
| 5   | 现有 v3 JSAPI 支付能否复用？          | **已查证（不能）**：`wechat-pay.ts` 走普通商户号 JSAPI；个人主体不在商户号支持主体内，虚拟支付是另一套接口与签名                             |
| 6   | 订单与权益模型能否复用？              | **已查证（能）**：`orders` 表与 `settleOrder` 的 CREATED→PAID 原子迁移可直接复用；平台单号可写入 `transaction_id`                            |
| 7   | 现有订单号符合 `outTradeNo` 规则吗？  | **已查证（符合）**：`newId('o')` 生成 `o_` + 12 位，共 14 字符，字母开头，满足 8–32 位且不以 `_` 开头                                        |
| 8   | 客户端接口是否可用？                  | **已查证**：`wx.requestVirtualPayment` 需基础库 ≥ 2.19.2，iOS 需微信 ≥ 8.0.68；项目已有 `globalThis.wx` 调用先例                             |
| 9   | 支付结果如何可靠送达？                | **已决策**：以发货推送为主、`query_order` 定时查单兜底；推送地址首选云托管，验证不通过回退云函数接收转发（验证日期 2026-10-22）              |
| 10  | 道具价格如何保证一致？                | **已查证**：`goodsPrice` 必须与后台道具价格逐分一致；服务端 `skus.ts` 为唯一权威，客户端不得传价                                             |
| 11  | 类目与道具表述风险如何处理？          | **已决策**：按实际功能如实提交，MP-PM 上线前复核；若被判定教育类则回退个体工商户主体方案                                                     |
| 12  | 月限额 10 万是否阻塞？                | **已决策（不阻塞）**：当前阶段无影响；接近限额前启动主体升级评估                                                                             |

---

## 10. 取证结论（官方来源）

| #   | 核实项                   | 结论                                                                                                                                                                                                                                                                      | 来源                                                                                                                                       | 置信度     |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| a1  | 个人主体虚拟支付开放范围 | 个人主体、类目含「工具」、已完成认证与备案即可开通                                                                                                                                                                                                                        | [虚拟支付：个人](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)      | 官方       |
| a2  | 个人主体支付限额         | 全终端月支付限额 10 万元                                                                                                                                                                                                                                                  | 同上                                                                                                                                       | 官方       |
| a3  | 费率                     | Android 等 1% 腾讯技术服务费；iOS 12% Apple 佣金                                                                                                                                                                                                                          | 同上                                                                                                                                       | 官方       |
| a4  | iOS 附加要求             | 需微信客户端 ≥ 8.0.68，且配置小程序简称用于 Apple 展示                                                                                                                                                                                                                    | 同上                                                                                                                                       | 官方       |
| a5  | 结算与退款               | Android T+3；iOS 约 45–60 天；iOS 退款由用户向 App Store 申请，开发者不能主动退                                                                                                                                                                                           | 同上                                                                                                                                       | 官方       |
| b1  | 客户端接口与版本         | `wx.requestVirtualPayment` 基础库 2.19.2 起支持，低版本用 `wx.canIUse` 判断                                                                                                                                                                                               | [wx.requestVirtualPayment](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html)                     | 官方       |
| b2  | 下单参数                 | 顶层仅 `signData` / `paySig` / `signature` / `mode`；`signData` 必须以 JSON 字符串传入，含 `offerId` / `buyQuantity` / `env` / `currencyType` / `productId` / `goodsPrice` / `outTradeNo` / `attach`；`env` 现网只能为 0                                                  | 同上                                                                                                                                       | 官方       |
| b3  | 订单号规则               | 8–32 字符，仅数字、大小写字母与 `_`、`-`、`*`、`@` 及竖线符号；不能以 `_` 开头，且不可复用                                                                                                                                                                                | 同上                                                                                                                                       | 官方       |
| b4  | 关键错误码               | -15002 单号重复、-15005 用户态签名错误、-15006 支付签名错误、-15007 `session_key` 过期、-15010 道具未发布、-15011 `env` 非 0、-15013 道具价格错误、-15014 发布未生效（约 10 分钟）、-15016 `signData` 格式错误、-15018 道具审核不通过、-15020 操作过快、-15021 小程序限频 | 同上                                                                                                                                       | 官方       |
| c1  | 签名算法                 | `paySig = HMAC-SHA256(AppKey, uri + "&" + postBody)`；`signature = HMAC-SHA256(sessionKey, signData)`；`postBody` 必须与实际请求体完全一致                                                                                                                                | [虚拟支付：个人 §5.5](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person) | 官方       |
| d1  | 回调接收方式             | 云开发支持通过消息推送能力接收虚拟支付回调，可在云函数中处理发货                                                                                                                                                                                                          | [小程序虚拟支付回调处理](https://developers.weixin.qq.com/minigame/dev/wxcloud/guide/wechatpay/virtual-payment-callback.html)              | 官方       |
| e1  | 普通微信支付主体限制     | 小程序支付商户号支持主体为个体工商户、企业、事业单位、政府机关、社会组织，不含个人                                                                                                                                                                                        | [小程序支付接入准备](https://pay.weixin.qq.com/doc/v3/merchant/4015459512)                                                                 | 官方       |
| f1  | iOS 微信客户端版本读取   | 小程序内如何可靠读取微信版本（用于 ≥ 8.0.68 判定）未核实；`wx.getSystemInfoSync().version` 语义待小 POC 确认                                                                                                                                                              | —                                                                                                                                          | unverified |

> d1 链接为小游戏侧文档；小程序侧的推送配置与 XML 响应已由《虚拟支付：个人》§5.4.1 确认（MP 后台 → 开发管理 → 消息推送），无需再按小游戏文档推断。f1 为 unverified 项，W5 前必须用真机 POC 收口。

---

## 11. 代码现状盘点

| 能力               | 现状                                                             | 证据                                                                                |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 静默登录           | 已实现：启动时 `uni.login` 取 code，换 JWT                       | `App.uvue:54-72`、`api/auth.uts:27-32`、`server/src/routes/auth.ts:99-133`          |
| openid 获取        | 已改造（W2）：code 优先真实换取，`X-WX-OPENID` 仅兜底            | `server/src/routes/auth.ts:100-147`                                                 |
| session_key        | 已获取并存储（W2）；仅服务端可读，不下发                         | `server/src/services/auth.ts:100-186`、`server/src/schema.sql:4-23`                 |
| 支付模式           | 仅 `mock` / `wx` 两态，且为全局单值（无法按端分流）              | `server/src/config.ts:23,72,121`                                                    |
| 支付实现           | 普通微信支付 v3 JSAPI，依赖商户号与 `payer.openid`               | `server/src/services/wechat-pay.ts:73-119`、`server/src/routes/membership.ts:47-57` |
| 订单与发放         | 可直接复用；CREATED→PAID 原子迁移保证幂等                        | `server/src/services/payment.ts:101-116`、`server/src/schema.sql:98-108`            |
| 商品目录           | 5 个 SKU（含 `resume_pack_3`），金额以分为单位                   | `server/src/data/skus.ts:14-56`                                                     |
| 回调解析           | Fastify 仅注册了 JSON 解析器并保留 rawBody                       | `server/src/app.ts:43-61`                                                           |
| 客户端支付         | 目前只有 `uni.requestPayment`                                    | `api/membership.uts:64-83`                                                          |
| 客户端原生 wx 调用 | 已有 `globalThis.wx` 先例，可直接调用 `wx.requestVirtualPayment` | `api/client.uts:280-286`                                                            |
| 云端微信凭据       | 已补齐并回读（2026-10-22；`WX_APPID`/`WX_SECRET` MATCH）         | `docs/tasks/2026-10-22-mp-virtual-pay-w0-credentials-goods.accept.md`               |

---

## 12. 差距与实施拆分

> 以下为建议拆卡，不代表已排期；顺序按依赖排列。W0 与 W1a 可并行；W1b 依赖 W0。

| 编号 | 工作包                                                                                                                                                                                                                            | 主责            | 依赖         | 产物 / 验收                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------ | ----------------------------------------------------------------------------------------- |
| W0   | 凭据与商品准备：补齐云端 `WX_APPID` / `WX_SECRET`（与 ASR 卡共用）；录入 `OfferID`、现网 `AppKey`；后台发布 5 个道具且价格与 `skus.ts` 逐分一致；配置 iOS 简称；确定消息推送 URL；LC 复核结算账户、退款政策与 iOS 45–60 天现金流  | PO + MP-PM + LC | 无           | 后台截图 + 云端变量回读；5 个道具价格逐分对齐；LC 合规确认单                              |
| W1a  | 契约冻结（结构）：`/membership/order` 请求体增 `platform: 'app' \| 'mp-weixin'`；`payParams` 扩展虚拟支付参数（`signData` / `paySig` / `signature` / `mode`）；明确 `PAY_MODE`（App）与 `MP_PAY_MODE`（MP）双变量分流             | BE + FE         | 无           | 冻结单双签；FE / BE 对出参与平台分流理解一致（不依赖真实 OfferID）                        |
| W1b  | 契约冻结（取值）：将 W0 的 `OfferID` / `AppKey` / 各道具 `productId` 写入契约常量或配置约定                                                                                                                                       | BE              | W0           | 取值与 W0 后台截图一致；`skus.ts` 的 `wxProductId` 映射明确                               |
| W2   | 服务端会话：`code2Session` 返回 `{openid, session_key}`；`users` 增列或独立表存储；登录路由拿到 code 时始终刷新并校验「header openid 与 code2session openid 一致」，不一致则拒绝；不下发、不落日志；支付前校验 session_key 新鲜度 | BE              | W1a          | 单测覆盖「头优先 + code 刷新 + openid 一致性校验」；DB 可回读；响应无 session_key         |
| W3   | 服务端下单：新增 `virtual-pay.ts`，生成 `signData`、双签名，`MP_PAY_MODE=virtual` 分支复用 `createOrder`；从 `skus.ts` 的 `wxProductId` 取道具 ID 与价格                                                                          | BE              | W2 + W1b     | 签名与官方示例一致；错误码映射（-15002/-15005/-15006/-15007/-15010/-15014）               |
| W4   | 回调、查单与退款：新增 XML 解析与发货推送路由；校验 `outTradeNo` / `productId` / 金额三元一致；按平台单号幂等发放；定时 `query_order` 补发（CREATED 且 24h 内、5 分钟一次、命中即停）；处理 `xpay_refund_notify`                  | BE              | W3           | 重复推送只发一次；金额/productId 不符则拒收；推送丢失可由查单补发；退款后权益回收规则明确 |
| W5   | 客户端拉起：新增虚拟支付分支，`globalThis.wx.requestVirtualPayment`；基础库与 iOS 微信版本校验（先用 POC 确认版本读取 API，见 f1）；失败码提示；遇 -15007 重登重试一次；支付后同步服务端账本                                      | FE              | W1a + W1b    | 真机可拉起；取消 / 失败 / 成功三态正确；-15007 可自动重试；低版本有明确提示               |
| W6   | 测试与验收：签名单测、回调幂等与金额校验测试、小额真单、订单对账、mock 模式回归                                                                                                                                                   | QA + BE + FE    | W3 / W4 / W5 | 单测全绿；真单支付→推送→发货→账本一致；G2 门禁通过                                        |

### 明确不纳入本阶段

- 不做代币充值（`short_series_coin`），只做道具直购；
- 不做订阅自动续费（Apple 会员订阅能力另立卡）；
- 不改 App 端现有 v3 JSAPI 支付链路；
- 不做多商户 / 分账 / 发票自动化。

---

## 13. 推荐路径与回退

### 首选

- **MP 端**：`MP_PAY_MODE=virtual`，`wx.requestVirtualPayment` + 服务端双签名；发货以推送为主、查单兜底。
- **回调**：云托管暴露 HTTPS 接收消息推送；按平台单号幂等写回 `orders.transaction_id`。
- **App 端**：保持现有 `PAY_MODE=wx` 与 v3 JSAPI 不变；服务端以请求体 `platform` 字段在两个模式间分流，互不影响。
- **iOS**：PO 2026-10-22 开通 IAP；开通后走同一 `wx.requestVirtualPayment`，客户端仅需校验微信 ≥ 8.0.68。

### 回退

- 若云托管默认域名不能作为消息推送地址：改用云函数接收虚拟支付回调，校验后转发到云托管内部接口；官方支持云函数处理该回调。
- 若道具被判定不属于工具类目：停止 MP 端虚拟支付上线，转个体工商户主体 + 普通支付方案，另行立卡。

### 触发回退的判定条件

1. 消息推送配置保存后，平台测试推送连续失败且无法通过云托管域名修复；
2. 道具审核被驳回且理由指向服务类目，而非素材或价格。

---

## 14. 结论与交接

**可行性结论：可行。** 平台资质、类目与虚拟支付开通是最大门槛，均已跨过；剩余工作全部是工程实现。

**两个硬阻塞（2026-10-22 状态）：**

1. ~~云端缺 `WX_APPID` / `WX_SECRET`~~ **已解除**（2026-10-22 回读 MATCH，24 键；`MP_OFFER_ID` / `MP_APP_KEY` 已注入）；剩余 W0 阻塞是 5 个道具发布；
2. ~~`session_key` 未获取、未存储~~ **已解除**（W2：code 优先换取并落库，header 仅兜底，出参不含 session_key）。

**一个待验证项：** 消息推送 URL 已确定为默认云托管域名 + `/membership/virtual/notify`（域名 `/healthz` 实测 200）；平台测试推送待 W4 路由部署后执行。

**晚间分配建议：** W0（凭据与商品）与 W1a（契约结构）可并行开工；W1b 取值待 W0；W2 依赖 W1a，W3 依赖 W2 + W1b；W5 可在 W1a + W1b 完成后与 W3 并行；W4 与 W6 最后收口。

---

## 15. 拆卡分发记录（2026-10-22）

> 已按 §12 拆为 8 张实施卡并落盘，均含八要素与 §9 闭环。W1b 在原依赖 `W0` 基础上追加 `W1a`，避免两张卡并发编辑同一冻结单。

| 卡                                                                            | 工作包                                            | 主责 | 依赖         | 分发批次                |
| ----------------------------------------------------------------------------- | ------------------------------------------------- | ---- | ------------ | ----------------------- |
| [W0 凭据与商品](./2026-10-22-mp-virtual-pay-w0-credentials-goods.md)          | 凭据 / 5 道具 / iOS 简称 / 推送 URL / LC 合规     | PO   | 无           | 第 1 批                 |
| [W1a 契约冻结（结构）](./2026-10-22-mp-virtual-pay-w1a-contract-structure.md) | `platform` 字段、`payParams` 联合类型、双模式语义 | BE   | 无           | 第 1 批                 |
| [W1b 契约冻结（取值）](./2026-10-22-mp-virtual-pay-w1b-contract-values.md)    | `OfferID` / `AppKey` / 5 个 `productId` 映射      | BE   | W0 + W1a     | 第 2 批                 |
| [W2 服务端会话](./2026-10-22-mp-virtual-pay-w2-session-key.md)                | `session_key` 落库、openid 一致性、刷新           | BE   | W1a          | 第 2 批                 |
| [W3 服务端下单](./2026-10-22-mp-virtual-pay-w3-virtual-order.md)              | 签名、`wxProductId`、平台分流                     | BE   | W2 + W1b     | 第 3 批                 |
| [W4 回调与查单](./2026-10-22-mp-virtual-pay-w4-callback-query-refund.md)      | XML 推送、三元校验、查单、退款                    | BE   | W3           | 第 4 批                 |
| [W5 客户端拉起](./2026-10-22-mp-virtual-pay-w5-client-invoke.md)              | `requestVirtualPayment`、版本校验、-15007 重试    | FE   | W1a + W1b    | 第 3 批（可与 W3 并行） |
| [W6 测试与验收](./2026-10-22-mp-virtual-pay-w6-test-acceptance.md)            | 单测、小额真单、对账、G2                          | QA   | W3 / W4 / W5 | 第 5 批                 |

**分发说明：**

1. 第 1 批并行下发 W0 与 W1a；W0 的外部等待（道具审核、推送 URL 验证）不阻塞 W1a。
2. W1b 必须等 W1a 双签后再追加取值章节（同一冻结单，禁止并发编辑）。
3. W2 可在 W1a 完成后立即开工，不必等 W0。
4. W3 与 W5 可在 W2 + W1b 完成后并行；W5 的 iOS 版本读取先做 f1 POC。
5. W4 依赖 W3 的订单号与签名实现；W6 最后收口。
6. 任一卡触发 §13 回退条件时，停止本批下发并回报 PO。

**进度（2026-10-22）：** W1a 已双签并完成（[冻结单](../contracts/2026-10-21-virtual-pay.freeze.md)）；W2 已实施，`auth.spec.ts` 9 项与全量 171 项单测、typecheck、lint 均通过；云端凭据已注入并回读（24 键，RequestId `7d580a26-...`）；W0 仅剩 5 个道具 ID；其余待启动。
