# MentorLoop P1.3 微信支付与会员实施计划

生成日期：2026-09-24
范围：兑现服务端支付链路——下单、微信回调验签/解密、权益发放与幂等；**双模式**：默认 `PAY_MODE=mock` 零配置可跑（下单即发放），真实模式（`PAY_MODE=wx` 配置齐全）走微信 JSAPI 下单 + v3 回调。真实联调依赖商户号/证书/回调域名，计划内以「算法单测」保障正确性，联调留待资质就绪。

## 1. Context

前端购买链路已存在（`api/membership.uts`：order → requestWxPay → track），服务端 `POST /membership/order` 与 `/order/notify` 目前是 stub（返回 `payParams:null` / 空 ack），权益未真实发放。P1.3 让权限发放收敛到服务端（权威账本，与 P1.1 一致），并具备切换到真实微信支付的能力。

## 2. 服务端变更

**新增文件**

- `server/src/data/skus.ts`：服务端权威 SKU 目录（`skuId → {kind, priceCent, memberDays|singleCount}`，与前端 data/membership.uts 对齐）
- `server/src/services/payment.ts`：`createOrder` / `grantBenefit`（错误路径：member 叠加 `member_until`，single 累加 `single_quota_total`）/ 原子状态机 `CREATED→PAID`
- `server/src/services/wechat-pay.ts`：微信 v3 封装——JSAPI 下单请求签名（WECHATPAY2-SHA256-RSA2048）、PayParams 组装（`appid\nts\nnonce\nprepay_id=..\n` 的 RSA-SHA256 paySign）、回调验签（平台公钥）、resource AES-256-GCM 解密
- `server/src/routes/membership.ts`：从 misc.ts 拆出 `/membership/quota`、`/membership/order`、`/membership/order/notify`
- `server/src/services/payment.spec.ts`、`server/src/services/wechat-pay.spec.ts`

**修改文件**

- `server/src/config.ts` + `.env.example`：`payMode('mock'|'wx')`、`wxAppId/wxMchId/wxMchSerial/wxApiV3Key/wxMchPrivateKey/wxPlatformPublicKey/wxNotifyUrl`（默认 mock，真实字段可空）
- `server/src/schema.sql`：`orders` 加 `paid_at`、`transaction_id`
- `server/src/app.ts`：注册 `application/json` raw-body 解析器（回调验签需字节原文，仅多存 `(req as any).rawBody`）；实例化并暴露 `(app as any).wechatPay`（便于测试注入）
- `server/src/routes/misc.ts`（移除 membership 段）、`server/src/routes/index.ts`（注册 membershipRoutes）
- `server/e2e/smoke.mjs`（追加 mock 下单→quota 断言）、`server/README.md`

## 3. 关键实现要点

- **下单（mock）**：`POST /membership/order`（`requireAuth`）仅收 `{skuId}`，金额以 `data/skus.ts` 为准 → 建 CREATED 订单 → 同事务置 PAID + `grantBenefit` → 返回 `{orderId, payParams:null}`。
- **下单（真实）**：建 CREATED 订单 → 调 JSAPI 拿 `prepay_id` → 组装 PayParams 返回；**不在下单时发放**，等回调。
- **回调 notify（无鉴权）**：验签（`timestamp\nnonce\nrawBody` + 头 `Wechatpay-Signature`）失败 → 401；解密 `resource`（AES-256-GCM，APIv3 key，ciphertext 尾 16 字节为 tag）失败 → 400；校验 `trade_state==='SUCCESS'` 且 `amount.total === order.amount`（不一致拒绝并告警）→ 幂等发放 → 返回 `{code:'SUCCESS'}`。
- **幂等**：`UPDATE orders SET status='PAID' ... WHERE id=? AND status='CREATED'`，`changes===0` 即已处理，重复回调直接返回 SUCCESS；发放与状态迁移同一 `BEGIN...COMMIT` 事务。

## 4. 前端变更（api/membership.uts）

真后端分支：`data.payParams == null` 时视为支付完成（服务端 mock 已发放，本地不再 grant），`track('payment_success', {mock:true})` 并 `await fetchQuota()` 对账；有 payParams 时 `requestWxPay` 后同样 `await fetchQuota()` 同步服务端账本。`PayParams` 类型不变。

## 5. 测试

- `wechat-pay.spec.ts`（纯函数、伪造密钥）：签名串格式可被 `crypto.verify` 验回；AES 解密往返一致、错误 key/tag 抛错。
- `payment.spec.ts`（buildApp+inject+临时库）：mock 下单→quota（memberUntil>0 / single+10）；会员叠加约 60 天；**回调幂等**（fake wechatPay，notify 两次 → 只发放一次、两次均 SUCCESS）；金额不一致拒绝。
- 冒烟扩展：mock 下单→quota 变化。

## 6. 实施顺序

1. config + .env.example → 2. schema（orders 加列）→ 3. data/skus.ts → 4. payment.ts → 5. wechat-pay.ts → 6. app.ts（raw-body + wechatPay 暴露）→ 7. membership.ts 路由 + index/misc 接线 → 8. 前端 membership.uts 适配 → 9. 两个 spec + smoke 扩展 → 10. README/文档。

## 7. 验证

```bash
pnpm --filter @mentorloop/server typecheck && pnpm --filter @mentorloop/server test && pnpm --filter @mentorloop/server build
pnpm --filter @mentorloop/server dev    # 另开终端
node server/e2e/smoke.mjs               # 含新增 mock 支付断言
pnpm check                              # 前端不受影响保持全绿
```

## 8. 明确后置（不做进 P1.3）

真实 openid（依赖微信 code2session，需真实登录）；退款/退款回调；订单查询/关闭定时任务；商户平台证书自动轮换。均注释标明前置条件。
