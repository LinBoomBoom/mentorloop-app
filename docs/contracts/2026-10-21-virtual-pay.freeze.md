# 契约冻结单：虚拟支付下单（platform 分流与 payParams 联合类型）

- 日期：2026-10-22
- 关联任务卡：[2026-10-22-mp-virtual-pay-w1a-contract-structure.md](../tasks/2026-10-22-mp-virtual-pay-w1a-contract-structure.md)
- 上游分析卡：[2026-10-21-mp-virtual-payment-feasibility.md](../tasks/2026-10-21-mp-virtual-payment-feasibility.md)
- 类型：字段变更 + 结构变更（新增端点分支，不新增端点）
- 状态：**已冻结（FE / BE 双签，2026-10-22）**

## 1. 端点变更

| 端点                | 方法 | 变更                                                                 |
| ------------------- | ---- | -------------------------------------------------------------------- |
| `/membership/order` | POST | 请求体新增必填 `platform`；`data.payParams` 由单一结构改为可辨识联合 |

## 2. 字段 diff

| 字段                                               | 变更前                       | 变更后                                   | 端              |
| -------------------------------------------------- | ---------------------------- | ---------------------------------------- | --------------- |
| `platform`                                         | 不存在                       | 必填，`'app' \| 'mp-weixin'`；其他值 400 | client → server |
| `payParams.provider`                               | `string`（实际恒 `'wxpay'`） | `'wxpay' \| 'virtual'`                   | server → client |
| `payParams.prepayId / nonceStr / timeStamp / sign` | 恒存在                       | 仅 `provider='wxpay'` 时存在             | server → client |
| `payParams.mode / signData / paySig / signature`   | 不存在                       | 仅 `provider='virtual'` 时存在           | server → client |

## 3. 端点契约（逐字）

```
POST /membership/order        （requireAuth；JSON）
请求体：{ "skuId": string, "platform": "app" | "mp-weixin" }

成功：{ "code": 0, "data": { "orderId": string, "payParams": PayParams | null }, "message": "" }
  mock 模式（app 用 PAY_MODE=mock；mp-weixin 用 MP_PAY_MODE=mock）→ payParams = null，服务端已发放
  app + PAY_MODE=wx                → payParams.provider = "wxpay"
  mp-weixin + MP_PAY_MODE=virtual  → payParams.provider = "virtual"

错误：
  未登录 / token 失效                 → 401
  platform 缺失或非法                 → 400 "平台参数不合法"
  skuId 不存在                        → 400 "商品不存在"
  MP virtual 且 session_key 缺失/过期  → 409 "微信会话已过期，请重新进入小程序"
  App wx 下单失败                     → 502 "微信下单失败"
  其他                                → 500 "下单失败"
```

## 4. 类型（两端逐字段一致）

客户端：[api/membership.uts:13-21](../../api/membership.uts#L13-L21)；服务端：[services/wechat-pay.ts:14-21](../../server/src/services/wechat-pay.ts#L14-L21) 与新增 `services/virtual-pay.ts`。

```ts
type WxPayParams = {
  provider: 'wxpay'
  orderId: string
  prepayId: string
  nonceStr: string
  timeStamp: string
  sign: string
}

type VirtualPayParams = {
  provider: 'virtual'
  orderId: string
  mode: 'short_series_goods'
  signData: string // JSON 字符串，结构见下
  paySig: string
  signature: string
}

type PayParams = WxPayParams | VirtualPayParams
```

`signData` 反序列化后的结构（服务端生成，客户端原样透传）：

```json
{
  "offerId": "<虚拟支付 OfferID>",
  "buyQuantity": 1,
  "env": 0,
  "currencyType": "CNY",
  "productId": "<skus.ts 的 wxProductId>",
  "goodsPrice": 2900,
  "outTradeNo": "<orderId>",
  "attach": "<orderId>"
}
```

- `offerId` / `AppKey` 由 W1b 取值，仅存服务端；
- `productId` 与 `goodsPrice` 来自 `skus.ts`，客户端不得传价（示例 2900 为 `single_pack_3`，实际按 SKU 取值）；
- `outTradeNo` 即 `orderId`（`newId('o')`，14 字符）；
- `attach` 固定为 `orderId`，发货推送原样回传，用于对账；
- `env` 现网固定 0，`currencyType` 固定 `CNY`；
- 顶层只传 `signData` / `paySig` / `signature` / `mode`，`signData` 必须以字符串形式传入。

## 5. 模式与错误码

### 5.1 模式解析

| 请求 `platform` | 使用变量      | 取值      | 行为                                   |
| --------------- | ------------- | --------- | -------------------------------------- |
| `app`           | `PAY_MODE`    | `mock`    | 下单即发放，`payParams=null`           |
| `app`           | `PAY_MODE`    | `wx`      | 返回 `provider='wxpay'`，沿用 v3 JSAPI |
| `mp-weixin`     | `MP_PAY_MODE` | `mock`    | 下单即发放，`payParams=null`           |
| `mp-weixin`     | `MP_PAY_MODE` | `virtual` | 返回 `provider='virtual'`              |

- 两个变量互不影响；禁止用单一 `PAY_MODE` 同时驱动两端。
- 默认值均为 `mock`，未配置时零配置可跑。
- **生产必须显式设置 `MP_PAY_MODE=virtual`**：缺省 `mock` 会在下单时直接发放权益，属部署级风险；W6 验收必须回读该键。

### 5.2 客户端错误码提示（`wx.requestVirtualPayment` fail）

| errCode                     | 含义                    | 客户端行为                             |
| --------------------------- | ----------------------- | -------------------------------------- |
| -2                          | 支付取消                | 静默返回，不提示失败                   |
| -1 / 1001 / -15001 / -15016 | 支付失败 / 参数错误     | 提示「支付失败，请重试」并上报         |
| -4                          | 风控拦截                | 提示「支付被风控拦截，请稍后再试」     |
| -15002                      | 单号重复                | 重新下单一次（新单号）                 |
| -15005 / -15006             | 用户态 / 支付签名错误   | 提示「支付参数异常」并上报（配置问题） |
| -15007                      | `session_key` 过期      | `wx.login` 重登 → 重试一次             |
| -15010 / -15018             | 道具未发布 / 审核不通过 | 提示「商品暂不可售」                   |
| -15011                      | `env` 非 0              | 上报配置错误，不提示用户               |
| -15013                      | 道具价格错误            | 提示「商品价格已更新，请重试」         |
| -15014                      | 发布未生效              | 提示「商品正在上架，请 10 分钟后重试」 |
| -15020 / -15021             | 操作过快 / 限频         | 提示「操作过于频繁，请稍后再试」       |

服务端 409 的处理：客户端错误对象需带 HTTP 状态码（W5 在 `api/client.uts` 的 `handleResponse` 补 `statusCode`），识别 409 后执行「重登 → 重试一次」。

## 6. 影响面

- 前端改动：`api/membership.uts`（`PayParams` 联合类型；下单请求两端分别带 `platform`，App=`app`、MP=`mp-weixin`；虚拟支付分支由 W5 实现）；`api/client.uts`（错误对象带 `statusCode`）。
- 服务端改动：`server/src/routes/membership.ts`（分流与错误码）、`server/src/services/wechat-pay.ts`（`PayParams` 类型导出）、`server/src/services/virtual-pay.ts`（新增，W3）、`server/src/config.ts`（`MP_PAY_MODE`）、`server/src/data/skus.ts`（`wxProductId`）。
- 规则镜像：无（不涉及选题 / 评分）。
- DB：无（`session_key` 归 W2）。

## 7. 兼容性

- 旧 App 包不传 `platform` → 400。上线前确认无存量旧包；若需兼容，服务端按 `app` 兜底属契约变更，须重新冻结。
- `provider='wxpay'` 分支字段与语义零变更；`PAY_MODE` 的 `mock | wx` 语义不变。
- `/membership/quota`、`/membership/order/notify`（v3）零变更。
- 回退：`MP_PAY_MODE=mock` 即恢复本地发放，无需回滚代码。
- `AuthResult`（`types/auth.uts:8-12`）不变；`session_key` 永不下发。

## 8. 不变项

- 客户端不得传价，服务端只认 `skuId`。
- 订单号规则沿用 `newId('o')`。
- App 端 v3 JSAPI 链路不改。
- 不做代币（`short_series_coin`）与订阅。

## 9. 双签

| 角色         | 结论 | 签署人                | 日期       |
| ------------ | ---- | --------------------- | ---------- |
| 客户端（FE） | 同意 | 执行 Agent（FE 视角） | 2026-10-22 |
| 后端（BE）   | 同意 | 执行 Agent（BE 视角） | 2026-10-22 |

> PO 于 2026-10-22 批准进入 W2；冻结后再变更须重走本流程并在任务卡风险登记。

## 10. 核验命令（冻结后由 W3 / W5 执行）

```bash
grep -n "platform" api/membership.uts server/src/routes/membership.ts
grep -n "VirtualPayParams\|wxProductId" api/membership.uts server/src/services/virtual-pay.ts server/src/data/skus.ts
cd server && npx vitest run src/services/payment.spec.ts src/services/wechat-pay.spec.ts
```

## 11. 取值（W1b 追加，2026-10-22）

> 本节只追加**取值**，不改 §1–§8 的结构与语义。取值来源：MP 后台【虚拟支付 → 基本配置 → 道具配置】，2026-10-22 已发布现网。

### 11.1 非敏感常量

| 项             | 取值                                 | 位置                               |
| -------------- | ------------------------------------ | ---------------------------------- |
| `AppID`        | `wx83b5d63ecd739421`                 | 云端变量 `WX_APPID`（与 ASR 共用） |
| `OfferID`      | `1450672438`                         | 云端变量 `MP_OFFER_ID`             |
| `env`          | `0`（现网；沙箱 1 会被 -15011 拒绝） | 服务端生成 `signData` 时硬编码     |
| `currencyType` | `CNY`                                | 同上                               |
| `buyQuantity`  | `1`                                  | 同上                               |

### 11.2 密钥（不落明文）

| 项               | 存放位置                                                        |
| ---------------- | --------------------------------------------------------------- |
| `AppKey`（现网） | 仅云端变量 `MP_APP_KEY`；仓库、日志、埋点、客户端一律不出现明文 |
| 沙箱 `AppKey`    | **不使用**（现网 `env` 只能为 0）                               |

### 11.3 `skuId → productId` 映射

后台「道具管理」允许自定义道具 ID，5 个道具**直接使用 skuId**，故 `productId === skuId`；`skus.ts` 的 `wxProductId` 与之逐字一致。

| `skuId`          | `wxProductId`    | 后台道具名称    | 价格（分） | 后台价格 | 一致 |
| ---------------- | ---------------- | --------------- | ---------- | -------- | ---- |
| `member_monthly` | `member_monthly` | AI面试会员30天  | 3900       | 39 元    | ✅   |
| `member_yearly`  | `member_yearly`  | AI面试会员365天 | 22800      | 228 元   | ✅   |
| `single_pack_3`  | `single_pack_3`  | 模拟面试3次包   | 2900       | 29 元    | ✅   |
| `single_pack_10` | `single_pack_10` | 模拟面试10次包  | 7900       | 79 元    | ✅   |
| `resume_pack_3`  | `resume_pack_3`  | 简历诊断3次包   | 2900       | 29 元    | ✅   |

- 发布状态：5/5 已发布现网，发布时间 2026-10-22（见 [W0 验收记录 §1.3](../tasks/2026-10-22-mp-virtual-pay-w0-credentials-goods.accept.md)）。
- 联调道具（隐藏入口，非本表正式 SKU，同样 `productId === skuId`）：`test_pay_01`（0.1 元 / 1 场，Android 联调）、`test_pay_1`（1 元 / 1 场，iOS 联调，Apple 支付最低 1 元）；均于 2026-10-22 发布现网，取值见 W0 验收记录 §1.3。
- 生效等待：发布后 ≥ 10 分钟；W3 联调若报 `-15014` 属未生效，不是签名错误。
- 价格唯一权威仍是 `skus.ts`，`goodsPrice` 必须与之逐分一致（客户端不得传价）。

### 11.4 双签（取值）

| 角色         | 结论 | 签署人                | 日期       |
| ------------ | ---- | --------------------- | ---------- |
| 客户端（FE） | 同意 | 执行 Agent（FE 视角） | 2026-10-22 |
| 后端（BE）   | 同意 | 执行 Agent（BE 视角） | 2026-10-22 |

### 11.5 取值核验

```bash
grep -n "wxProductId" server/src/data/skus.ts
# 后台：MP 后台 → 虚拟支付 → 基本配置 → 道具配置 → 「线上版本」应列出 5 条且价格一致
```

### 11.6 签名算法确认（W3 实施时对齐官方 §5.5，2026-10-22）

```text
paySig    = HMAC-SHA256(AppKey,     "requestVirtualPayment" + "&" + signData)   # hex
signature = HMAC-SHA256(sessionKey, signData)                                   # hex
```

- C 端调用 `wx.requestVirtualPayment` 时 uri **固定为 `requestVirtualPayment`**；B 端 `/xpay/*` 接口才用真实路径（如 `/xpay/query_order`）。
- `signData` 只序列化一次，签名与下发共用同一字符串（不格式化、不改键序）。
- 落点：`server/src/services/virtual-pay.ts`（`VIRTUAL_PAY_URI` / `calcPaySig` / `calcSignature`），单测 `virtual-pay.spec.ts`。
- W4 查单需按 B 端规则另算 paySig（uri 为 `/xpay/query_order`），不可复用本常量。

### 11.7 推送与查单实施口径（W4，2026-10-22）

- 新增服务端内部端点 `POST /membership/virtual/notify`（客户端不调用，故不改客户端契约）：接收发货推送与退款通知，回 XML。
- 已公开的官方接口：`POST https://api.weixin.qq.com/xpay/query_order?access_token=..&pay_sig=..`，请求体 `{openid, env, order_id}`，`pay_sig` 的 uri 为 `/xpay/query_order`。
- **发货权威为查单结果**：道具直购推送的验签规则官方未公开细节，故推送仅作为触发信号，一律查单确认后才发货（详见 W4 验收记录 §5）。
- 权益回收：退款确认后按「剩余额度」回收（面试包 / 简历包减总量、会员减天数），已使用部分不追缴。
