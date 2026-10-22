# 验收结论：W4 虚拟支付推送、查单与退款

- 日期：2026-10-22
- 任务卡：[2026-10-22-mp-virtual-pay-w4-callback-query-refund.md](./2026-10-22-mp-virtual-pay-w4-callback-query-refund.md)
- 契约冻结：[2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md) §11.6 / §11.7
- 结论：**通过（代码与单测）**；平台测试推送与真单补发归 W6。

## 1. 结果

| 项       | 结果                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| 推送端点 | `POST /membership/virtual/notify`（无鉴权，XML 回包）                                            |
| XML 解析 | `application/xml` / `text/xml` 解析器保留 `rawBody`；零依赖极简解析（支持 CDATA）                |
| 发货权威 | **一律以 `query_order` 查单为准**，不采信 XML 内容本身                                           |
| 三元校验 | `outTradeNo`（本地订单存在）/ `productId`（= `skus.wxProductId`）/ 金额（`order_fee == amount`） |
| 幂等     | 已 PAID 直接回 `already paid`；`settleOrder` 的 CREATED→PAID 原子迁移兜底                        |
| 模拟推送 | `IsMock=true` 只回成功，不查单、不发货（官方要求）                                               |
| 退款     | `xpay_refund_notify` → 查单确认状态 5/8 → 订单 `REFUNDED` + 按剩余额度回收                       |
| 查单兜底 | CREATED 且 24h 内、5 分钟一轮、命中即停；`server.ts` 仅在 virtual 模式启动                       |
| 回包     | `<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[...]]></ErrMsg></xml>`                                |

## 2. 验收标准核验（对照任务卡 §4）

- [x] XML 解析器保留 rawBody
- [x] 成功回包为官方 XML；查单失败返回非 0 让平台重试
- [x] 重复推送只发放一次（单测：第二次回 `already paid`，额度不再增加）
- [x] 三元任一不符 → 拒收并告警（单测覆盖 productId / 金额两种）
- [x] 查单可在中途补发（单测覆盖「只补已支付」「24h 外不扫描」；真实补发待 W6）
- [x] 退款回收规则落库并有单测
- [x] 扫描窗口与终止条件有单测

## 3. 代码改动

| 文件                                                                                 | 改动                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [server/src/services/virtual-notify.ts](../../server/src/services/virtual-notify.ts) | 新增：XML 解析、推送处理、退款回收、查单兜底与定时器                  |
| [server/src/services/virtual-pay.ts](../../server/src/services/virtual-pay.ts)       | 新增：`query_order`（B 端 uri `/xpay/query_order`）+ 测试注入         |
| [server/src/services/payment.ts](../../server/src/services/payment.ts)               | 新增 `revokeOrderBenefit`：按剩余额度回收（member / single / resume） |
| [server/src/routes/membership.ts](../../server/src/routes/membership.ts)             | 新增 `/membership/virtual/notify` 路由                                |
| [server/src/app.ts](../../server/src/app.ts)                                         | 注册 `application/xml` / `text/xml` 解析器（保留 rawBody）            |
| [server/src/server.ts](../../server/src/server.ts)                                   | 启动查单兜底定时器（virtual 模式且密钥齐全）                          |
| [server/src/virtual-notify.spec.ts](../../server/src/virtual-notify.spec.ts)         | 新增 12 例：XML、发货、幂等、mock、三元、退款、兜底窗口               |

## 4. 门禁记录（G2）

| 检查       | 命令                                   | 结果                      |
| ---------- | -------------------------------------- | ------------------------- |
| 类型检查   | `npx tsc --noEmit -p tsconfig.json`    | 通过                      |
| 服务端构建 | `npm run build`                        | 通过                      |
| 全量单测   | `npx vitest run`                       | 26 files / **195 passed** |
| Lint       | `npx eslint`（7 个改动文件）           | 无输出                    |
| Prettier   | `npx prettier --check`（7 个改动文件） | 全部通过                  |

### 4.1 本地真实 HTTP 冒烟（非 inject）

以 `MP_PAY_MODE=virtual` 启动本地服务（`npx tsx src/server.ts`，端口 8799），用 `application/xml` / `text/xml` 各发一次：

| 请求                     | 响应                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `IsMock=true` 的发货推送 | `200`，`Content-Type: application/xml`，`<ErrCode>0</ErrCode>…mock ok`      |
| 未知订单的真实推送       | `200`，`<ErrCode>0</ErrCode>…order not found`（不查单、不出货、不触发重试） |

> 平台「测试推送」需要**先部署**新版本到云托管（当前线上仍是旧包，路由会 404）；本机无 `tcb` CLI 与 cloudbase 登录态，部署动作需在具备凭据的环境执行。

## 5. 安全口径（必须知悉）

官方《虚拟支付：个人》§5.4.1 要求「校验签名 + 幂等」，但**未公开道具直购推送的签名算法细节**（小游戏事件文档才有 `PayEventSig = HMAC(AppKey, event + '&' + payload)`，且结构不同）。

因此本期实现**不采信 XML 内容**：任何推送都会先调用 `query_order`（服务端 AppKey 签名），只有平台查单返回已支付、且金额与本地订单一致才发货。效果：

- 伪造推送最多触发一次查单，**不会产生权益**；
- 即使平台后续补充推送验签规则，该实现仍成立（查单结果是最终权威）；
- 代价：每笔订单多一次 WeChat API 调用（仅推送/兜底时发生，量级可忽略）。

若后续要补推送验签，应在 `handleVirtualNotify` 入口加一层签名校验，**不要**替换「查单为权威」这一层。

## 6. 退款回收规则（已落库）

| SKU 类型 | 回收方式                                          |
| -------- | ------------------------------------------------- |
| 面试包   | `single_quota_total -= 本单场次`，不低于已使用量  |
| 简历包   | `resume_single_total -= 本单次数`，不低于已使用量 |
| 会员     | `member_until -= memberDays`，不早于当前时间      |

即「未使用整单回收、已使用不追缴」，与任务卡 §5 对策一致。

## 7. 遗留 / 下一步

1. **W6 验收**：平台「消息推送 → 测试推送」应返回 `<ErrCode>0</ErrCode>`（此前 404，路由已就绪）；随后小额真单验证「支付 → 推送 → 发货 → 账本一致」。
2. **部署**：`MP_PAY_MODE=virtual` 必须显式设置，否则推送会被 `virtual pay disabled` 拒绝。
3. **通知订阅**：小程序虚拟支付的推送事件（含 `xpay_refund_notify`）统一投递到 MP 后台【开发管理 → 消息推送】配置的 URL，**无独立事件订阅入口**；`minigame_pay_refund_succ_notify` 是小游戏侧事件名，已被代码修正为 `xpay_refund_notify`（2026-10-22 核实官方「2.4 消息推送」）。
4. **观察项**：查单失败时回 `ErrCode=1` 会让平台重试（最多 13 次），若 `AppKey` 配错会持续重试并打日志，需在发布后盯一次。

## 8. 签字

| 角色             | 结论               | 日期       |
| ---------------- | ------------------ | ---------- |
| 审查 Agent（BE） | 通过               | 2026-10-22 |
| 审查 Agent（QA） | 通过（代码与单测） | 2026-10-22 |
| QA（真机/真单）  | 待 W6              |            |
