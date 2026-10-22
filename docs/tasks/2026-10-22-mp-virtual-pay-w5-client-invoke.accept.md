# 验收结论：W5 客户端虚拟支付拉起

- 日期：2026-10-22
- 任务卡：[2026-10-22-mp-virtual-pay-w5-client-invoke.md](./2026-10-22-mp-virtual-pay-w5-client-invoke.md)
- 契约冻结：[2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md) §3 / §5.2
- 结论：**通过（代码与构建）**；真机拉起、三态交互与 iOS 真单归 W6。

## 1. 结果

| 项           | 结果                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| 拉起接口     | `globalThis.wx.requestVirtualPayment`（`mode` / `signData` / `paySig` / `signature`） |
| 基础库门控   | `wx.canIUse('requestVirtualPayment')`，不支持时明确提示不崩溃                         |
| iOS 版本门控 | `wx.getSystemInfoSync()` 读 `platform` + `version`，iOS 需 ≥ 8.0.68                   |
| 服务端 409   | 客户端错误对象已带 `statusCode`；409 → `wx.login` 重登后重试一次                      |
| -15007       | 同上路径自动重登重试一次；仍失败才提示                                                |
| -15002       | 换新单号重试一次                                                                      |
| 取消（-2）   | 静默返回，不弹失败提示（契约 §5.2）                                                   |
| 失败文案     | 关键码（-4/-15005/-15006/-15010/-15013/-15014/-15018/-15020）逐条映射                 |
| 支付后对账   | 成功后才 `fetchQuota()`；不本地发放、不误报成功                                       |
| 端侧分流     | 下单恒带 `platform`（MP=`mp-weixin`，App=`app`）；App v3 JSAPI 未改                   |

## 2. 验收标准核验（对照任务卡 §4）

- [ ] iOS 与 Android 真机各成功拉起一次（**待 W6 真机**；iOS 还依赖 IAP 生效）
- [x] 成功 / 取消 / 失败三态（代码级）：取消静默、失败按冻结文案、成功才埋点与对账
- [x] 基础库 < 2.19.2 明确提示且不崩溃
- [x] -15007 自动重登重试一次（服务端 409 复用同一路径）
- [x] 下单请求含 `platform`（MP=`mp-weixin`；App=`app`）
- [x] App 端 v3 JSAPI 回归通过
- [x] f1 结论落盘：官方文档 §5.3 直接给出 `wx.getSystemInfoSync()` 示例，无需自研 POC

## 3. 代码改动

| 文件                                                                               | 改动                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [api/virtual-pay.uts](../../api/virtual-pay.uts)                                   | 新增：版本比较、失败码文案、`PAY_CANCELLED`、重试判定（纯逻辑，可单测）      |
| [api/membership.uts](../../api/membership.uts)                                     | 虚拟支付分支、`canIUse` / iOS 版本门控、409 与 -15007 重登重试一次、静默下单 |
| [api/client.uts](../../api/client.uts)                                             | 非 2xx 错误对象携带 `statusCode`，并优先透出服务端 `message`（409 可被识别） |
| [pages/membership/paywall.uvue](../../pages/membership/paywall.uvue)               | 取消（`PAY_CANCELLED`）不提示失败                                            |
| [tests/membership-virtual-pay.spec.ts](../../tests/membership-virtual-pay.spec.ts) | 新增 7 例：版本门控、取消、失败码映射、重试判定                              |

## 4. 门禁记录（G2）

| 检查               | 命令                                          | 结果                                                                                        |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 客户端单测（全量） | `pnpm test`                                   | 8 files / **109 passed**                                                                    |
| Lint               | `npx eslint`（4 个改动文件 + 1 测试）         | 无输出                                                                                      |
| 小程序构建         | `pnpm build:mp-weixin`                        | DONE Build complete                                                                         |
| 产物核验           | 检索 `dist/build/mp-weixin/api/membership.js` | `requestVirtualPayment` / `canIUse` / `8.0.68` / `getSystemInfoSync` 均存在（条件编译生效） |
| uvue CSS 守卫      | `node scripts/check-uvue-css.mjs`             | 31 个 .uvue，0 违规                                                                         |
| 设计 token         | `node scripts/check-design-tokens.mjs`        | 全绿                                                                                        |

## 5. 关键实现说明

1. **重登只换 token**：`refreshWechatSession()` 调 `loginByWechat` 后只 `setProfile({ token })`，不清岗位/引导状态，避免支付中途把用户画像打回默认。
2. **下单走静默请求**：`requestSilent` + 页内统一提示，避免「服务端 toast + 页内 toast」双弹。
3. **重试上限**：最多两次（首发 + 一次），不做循环重试，防止 -15007 风暴。
4. **虚拟支付仅在 MP 编译**：非 MP 端 `requestVirtualPay` 被条件编译剔除，命中虚拟分支时抛「虚拟支付仅支持微信小程序端」。

## 6. 遗留 / 下一步

1. **W4 回调查单**：`/membership/virtual/notify` 发货推送 + `query_order` 兜底；B 端 `paySig` uri 为 `/xpay/query_order`。
2. **真机验收（W6）**：Android 小额真单 → 推送 → 发货 → 账本一致；iOS 待 IAP 生效后测。
3. **部署前置**：云端 `MP_PAY_MODE=virtual`（否则仍走 mock 直接发放）。
4. **老版本兼容**：基础库 < 2.19.2 或无虚拟支付能力时，仅提示升级，不降级到普通支付（个人主体无商户号）。

## 7. 签字

| 角色             | 结论                 | 日期       |
| ---------------- | -------------------- | ---------- |
| 审查 Agent（FE） | 通过                 | 2026-10-22 |
| 审查 Agent（BE） | 通过（接口对齐）     | 2026-10-22 |
| QA（含安全准入） | 通过（构建）/ 待真机 | 2026-10-22 |
