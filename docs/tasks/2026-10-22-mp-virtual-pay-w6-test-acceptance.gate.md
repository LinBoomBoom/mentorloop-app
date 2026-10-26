# G2 质量门记录：W6 虚拟支付测试与验收

- 日期：2026-10-26
- 任务卡：[2026-10-22-mp-virtual-pay-w6-test-acceptance.md](./2026-10-22-mp-virtual-pay-w6-test-acceptance.md)
- 结论：**G2 通过；W6 未收口**。单测、mock 回归、云端回读与推送链路已验证；平台「测试推送」按钮、小额真单与 App v3 JSAPI 真机回归仍待执行。

## 1. 命令与结果

| 检查        | 命令                                         | 结果                   |
| ----------- | -------------------------------------------- | ---------------------- |
| 客户端 Lint | `pnpm lint`                                  | 0 error / 0 warning    |
| 客户端格式  | `pnpm format:check`                          | 通过                   |
| 客户端类型  | `pnpm typecheck`                             | 通过                   |
| 客户端单测  | `pnpm test`                                  | 8 文件 / 117 用例全绿  |
| uvue 守卫   | `node scripts/check-uvue-css.mjs`            | OK（34 文件，0 违规）  |
| token 守卫  | `node scripts/check-design-tokens.mjs`       | A–H 全绿               |
| 服务端类型  | `pnpm --filter @mentorloop/server typecheck` | 通过                   |
| 服务端单测  | `pnpm --filter @mentorloop/server test`      | 29 文件 / 220 用例全绿 |
| 服务端构建  | `pnpm --filter @mentorloop/server build`     | 通过                   |

### 1.1 测试超时修正

首次执行服务端全量单测时，DB 集成用例在并行负载下出现 3–8 条 `Test timed out in 5000ms`（每次失败文件不同，单独串行执行全部通过），判定为默认 5s 阈值过紧，非业务失败。已在 [server/vitest.config.ts](../../server/vitest.config.ts) 将 `testTimeout` / `hookTimeout` 调整为 15s，复跑 `pnpm --filter @mentorloop/server test` 稳定 220/220 通过。

> 本地工作区含 2026-10-26 预上线降配改动（未提交），本次门禁与云端版本均基于该工作区状态。

## 2. 云端部署与配置回读

通过 `tcb cloudrun`（`--package=@cloudbase/cli dlx`）读取线上环境 `prod-d6gaa83ds8accb61b` / 服务 `mentorloop-mp-api`：

| 项            | 实测结果                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| 在线版本      | `mentorloop-mp-api-041`（UpdateTime `2026-10-26 09:56:54`）                  |
| 环境变量      | 25 键                                                                        |
| `MP_PAY_MODE` | `virtual`（满足生产禁用 mock 的要求）                                        |
| `MP_OFFER_ID` | `1450672438`                                                                 |
| `LLM_MODEL`   | `deepseek-v4-flash`                                                          |
| 默认域名      | `https://mentorloop-mp-api-324175-6-1501249243.sh.run.tcloudbase.com`        |
| `/healthz`    | 首请求 503（缩容冷启动），约 6s 后复请求 200，`driver=mysql`                 |
| 推送 GET 验签 | 直连 `/membership/virtual/notify?echostr=abc123` → 200 `abc123`              |
| 网关 GET 验签 | `/msgpush?echostr=abc123` → 200 `abc123`（云函数转发链路通）                 |
| 模拟推送 POST | 直连与网关均返回 `<ErrCode>0</ErrCode><ErrMsg>mock ok</ErrMsg>`              |
| 消息推送配置  | 页面显示「已启用」、明文模式、XML、URL 指向云函数 `/msgpush`；无独立测试按钮 |

> 冷启动风险：`min-num=0` 时首个推送可能 503，依赖平台重试或 60 分钟查单兜底。真单验收需确认到账时延；若不可接受，发布期应临时将最小副本调为 1。

## 3. Mock 模式回归（本地）

本地以默认 `MP_PAY_MODE=mock` 启动服务端，走真实 HTTP：

| 场景                      | 结果                                           |
| ------------------------- | ---------------------------------------------- |
| `platform=app` 下单       | `code=0`、`payParams=null`、返回 `orderId`     |
| `platform=mp-weixin` 下单 | `code=0`、`payParams=null`、返回 `orderId`     |
| 下单后额度                | `singleCreditsLeft` 0 → 6（两笔 3 次包均发放） |

## 4. 幂等与伪造推送

`server/src/virtual-notify.spec.ts` 14 例覆盖：

- 重复推送 → 只发货一次；已 PAID 直接回 `already paid`；
- `productId` 不一致、金额不一致、未知订单 → 不发货；
- 模拟推送（`IsMock=true`）→ 只回成功、不查单、不发货；
- 查单未支付 / 已退款 / 退款通知 → 对应状态迁移与权益回收；
- 查单兜底窗口（24h、间隔 <=0 关闭）。

推送不采信 XML，统一以服务端 `query_order` 为权威，伪造推送最多触发一次查单，不产生权益（W4 验收 §6）。

## 5. 未完成项（阻断 W6 收口）

| 项                            | 原因 / 下一步                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 平台「测试推送」按钮          | 已确认个人主体消息推送页无测试按钮；配置页显示「已启用」、明文模式、XML，URL 可达；以模拟推送与真单推送为准  |
| Android 小额真单              | **通过**：2026-10-26 11:47:22，`test_pay_01` 0.10 元，交易单号 `4500****6436`；订单 `o_003b****37d9` 已 PAID |
| iOS 小额真单                  | **当前不可执行**：Apple 支付仅支持现网/正式版，体验版无法完成 iOS 虚拟支付；待提审发布后再验（REL-3）        |
| 重复推送 / 伪造推送的真单复验 | **通过**：重放同一推送 3 次均返回 `already paid`，未重复发放                                                 |
| App v3 JSAPI 回归             | 需 App 真机与云端商户凭据（当前 `WX_MCH_*` 缺失），见红线卡                                                  |
| App 侧额度复核                | 服务端已 PAID 并发放；待用户在 App 确认单次卡 +1                                                             |
| `.accept.md`                  | 已产出                                                                                                       |

### 5.1 iOS 端验收口径（2026-10-26 核实）

Apple 支付需同时满足：iOS 15+、微信 8.0.68+、单笔 ≥ 1 元、中国大陆 App Store 账户；且 **Apple 支付不支持沙箱，仅支持现网环境**。官方社区答复进一步明确「体验版小程序无法在 iOS 设备上使用虚拟支付功能」。因此：

- 体验版 iOS 报「无法购买项目」属平台限制，不是签名或价格代码缺陷；
- 需小程序提审并发布正式版后，再执行 iOS 真单；
- 发布前需确认 MP 后台「虚拟支付 → 基本配置」已开启苹果 IAP，且小程序简称已配置。

## 6. 真单执行记录（2026-10-26）

| 步骤                     | 结果                                                           |
| ------------------------ | -------------------------------------------------------------- |
| Android 体验版支付       | 成功，`test_pay_01` 0.10 元，11:47:22                          |
| 平台交易单号             | `4500****6436`（脱敏）                                         |
| 业务订单号               | `o_003b****37d9`（脱敏）                                       |
| 云函数网关重放（首次）   | 504 `FUNCTIONS_TIME_LIMIT_EXCEEDED`（冷启动，云函数 30s 超时） |
| 云托管直连重放（预热后） | 200 `<ErrCode>0</ErrCode><ErrMsg>already paid</ErrMsg>`        |
| 重复重放 ×2              | 均 `already paid`，未重复发放                                  |

结论：订单已 PAID，`settleOrder` 同事务已执行 `grantBenefit`；真单支付、发货与幂等通过。App 侧单次卡 +1 待用户界面复核。

## 7. 产物

- 新增：本门禁记录
- 修改：`server/vitest.config.ts`（仅测试超时）
- 已产出：`docs/tasks/2026-10-22-mp-virtual-pay-w6-test-acceptance.accept.md`

## 8. 顺带发现（阻断发布，需 PO 裁决）

云端 EnvParams 回读时发现两项与支付无直接关系、但会影响真单验收前提的问题：

| 项           | 实测                                                                                                                                                        | 影响                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 短信登录     | 个人主体无法申请腾讯云自用签名（2025-09-18 起）；已移除手机绑定门控，MP 改为用户主动微信登录；云端未接短信时 `/auth/sms-code`、`/auth/login` 直接返回不可用 | 万能码不再可登录（云端手机号登录已关，仅本地/测试保留）；无需清理云端弱码变量即可部署                |
| App 支付模式 | `PAY_MODE` 未配置（默认 `mock`）；`WX_MCH_PRIVATE_KEY` / `WX_API_V3_KEY` 均不存在；App 端本期不上线                                                         | `isAppPayEnabled` 在云端无商户凭据时拒绝 `platform=app` 下单（400），不再免费发放；本地联调仍走 mock |

短信方案按腾讯云 SMS 实现并保留待用；App 端本期不上线，已用 `isAppPayEnabled` 拒绝云端 mock 下单。详见 [2026-10-26 登录与 App 支付红线收口](./2026-10-26-prelaunch-auth-and-app-pay-hardening.md)。
