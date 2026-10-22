# 验收结论：W3 服务端虚拟支付下单与签名

- 日期：2026-10-22
- 任务卡：[2026-10-22-mp-virtual-pay-w3-virtual-order.md](./2026-10-22-mp-virtual-pay-w3-virtual-order.md)
- 契约冻结：[2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md) §3 / §11.3 / §11.6
- 结论：**通过（代码与单测）**；真机拉起与真实签名联调归 W5 / W6。

## 1. 结果

| 项               | 结果                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| `platform` 分流  | 必填校验；`app` 走 `PAY_MODE`，`mp-weixin` 走 `MP_PAY_MODE`                        |
| 虚拟支付 payData | `provider='virtual'`，含 `mode` / `signData` / `paySig` / `signature`              |
| 签名算法         | `paySig`（AppKey，uri 固定 `requestVirtualPayment`）、`signature`（sessionKey）    |
| 金额与道具       | 只认 `skus.ts`（`wxProductId` + `priceCent`），客户端不传价                        |
| session_key 缺失 | 409 「微信会话已过期，请重新进入小程序」（不建单、不发放）                         |
| 密钥泄露面       | 响应/日志均不含 `session_key` / `AppKey`（单测断言）                               |
| 回退开关         | `MP_PAY_MODE=mock` 立即恢复下单即发放，无需回滚代码                                |
| 客户端兼容       | `api/membership.uts` 已带 `platform`；遇到 `provider='virtual'` 明确报错待 W5 接入 |

## 2. 验收标准核验（对照任务卡 §4）

- [x] 签名按官方算法可复算一致（官方只给算法未给固定向量；已用「原文拼接复算 + 换密钥/换报文必变」双断言）
- [x] `goodsPrice` 取自 `skus.ts`，客户端传价被忽略
- [x] `mp-weixin` + `virtual` 返回 `provider: 'virtual'`
- [x] `platform=app` 行为与改动前一致（mock 发放 / wx JSAPI 回归）
- [ ] 错误码 → 用户提示映射：文案已在冻结单 §5.2 冻结，**代码落点归 W5 fail 回调**；服务端 400 / 409 / 500 已实现
- [x] 订单号沿用 `newId('o')`（14 字符，字母开头，符合 8–32 位规则）
- [x] 既有 `payment.spec.ts` 补 `platform` 后全绿

## 3. 代码改动

| 文件                                                                                                                                 | 改动                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [server/src/services/virtual-pay.ts](../../server/src/services/virtual-pay.ts)                                                       | 新增：`buildSignData` / `calcPaySig` / `calcSignature` / `createVirtualPayParams` |
| [server/src/routes/membership.ts](../../server/src/routes/membership.ts)                                                             | `platform` 必填与分流；虚拟支付 409 / 400 / 500 分支                              |
| [server/src/config.ts](../../server/src/config.ts)                                                                                   | 新增 `mpPayMode` / `mpOfferId` / `mpAppKey`；启动守卫（见 §5）                    |
| [server/src/services/virtual-pay.spec.ts](../../server/src/services/virtual-pay.spec.ts)                                             | 新增：签名与 payData 结构 6 例                                                    |
| [server/src/virtual-order.spec.ts](../../server/src/virtual-order.spec.ts)                                                           | 新增：路由分流 6 例（400 / 409 / 200 / 回归 / 回退）                              |
| [server/src/services/payment.spec.ts](../../server/src/services/payment.spec.ts)、[server/e2e/smoke.mjs](../../server/e2e/smoke.mjs) | 下单用例补 `platform: 'app'`                                                      |
| [api/membership.uts](../../api/membership.uts)                                                                                       | 下单带 `platform`；`provider='virtual'` 明确报错待 W5                             |
| [server/.env.example](../../server/.env.example)                                                                                     | 补 `MP_*` 与成本红线说明                                                          |

## 4. 门禁记录（G2）

| 检查           | 命令                                | 结果                      |
| -------------- | ----------------------------------- | ------------------------- |
| 类型检查       | `npx tsc --noEmit -p tsconfig.json` | 通过                      |
| 服务端构建     | `npm run build`                     | 通过                      |
| 全量单测       | `npx vitest run`                    | 25 files / **183 passed** |
| Lint（服务端） | `npx eslint`（7 个改动文件）        | 无输出                    |
| 客户端构建     | `pnpm build:mp-weixin`              | DONE Build complete       |
| Lint（客户端） | `npx eslint api/membership.uts`     | 无输出                    |

## 5. 同批合入的成本红线（成本卡 D2 / D3）

| 项                 | 实现                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| D2 TTS 音色白名单  | `APPROVED_TTS_VOICE_TYPES = [101001]`；云端非白名单音色**拒绝启动**（成本差 4–21 倍） |
| 虚拟支付配置完整性 | `MP_PAY_MODE=virtual` 但缺 `MP_OFFER_ID` / `MP_APP_KEY` → 拒绝启动                    |
| 生产 mock 告警     | 云端 `MP_PAY_MODE=mock` 启动时告警：小程序端下单将直接发权益、不产生支付              |
| D3 弃用模型告警    | `deepseek-chat` / `deepseek-reasoner` 启动告警，建议显式改 `deepseek-v4-flash`        |

## 6. 遗留 / 下一步

1. **W5 客户端拉起**：`wx.requestVirtualPayment` + 基础库 `canIUse` + iOS ≥ 8.0.68 + -15007 重登重试一次 + 错误码文案。
2. **W4 回调与查单**：`/membership/virtual/notify` XML 解析、三元校验、`query_order` 兜底；B 端 paySig 的 uri 为 `/xpay/query_order`，**不可复用 C 端常量**。
3. **部署前置**：云端变量补 `MP_PAY_MODE=virtual`（含 `MP_OFFER_ID` / `MP_APP_KEY` 已就绪）；未设置时服务端告警且仍为 mock。
4. **真机验收**：W6 小额真单；`-15014` 属发布未生效（道具 2026-10-22 已发布）。

## 7. 签字

| 角色             | 结论                 | 日期       |
| ---------------- | -------------------- | ---------- |
| 审查 Agent（BE） | 通过                 | 2026-10-22 |
| 审查 Agent（FE） | 通过（客户端仅分流） | 2026-10-22 |
| QA（含安全准入） | 通过（代码）/ 待真机 | 2026-10-22 |
