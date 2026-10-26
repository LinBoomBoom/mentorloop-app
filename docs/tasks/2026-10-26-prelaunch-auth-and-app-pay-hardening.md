# 任务卡：上线前登录与 App 支付红线收口

- 日期：2026-10-26
- 来源：W6 云端 EnvParams 回读（线上版本 `mentorloop-mp-api-041`）发现的发布红线，用户裁决「另立卡处理，不阻塞 W6」
- 关联：[W6 支付验收](./2026-10-22-mp-virtual-pay-w6-test-acceptance.md) · [W6 门禁](./2026-10-22-mp-virtual-pay-w6-test-acceptance.gate.md) · [系统问题清单](./2026-10-21-system-issue-inventory.md)

## 1. 目标

在上线提审前关闭两条云端红线：短信万能验证码可接管任意手机号；App 端未配置支付模式时下单直接免费发放权益。确保「登录可控、支付不白送」。

## 2. 范围

- 做：
  - 裁决手机号登录策略：接入真实短信通道，或提审前关闭手机号登录、仅保留微信登录；
  - 云端移除 `MOCK_SMS_CODE=123456` 与 `ALLOW_WEAK_SMS_CODE=true`，并回读确认；
  - 生产环境禁止 `platform=app` 走 mock 发放：显式拒绝或配置真实 JSAPI 商户凭据；
  - 更新发布 checklist 与启动安全守卫（如确需新增开关，同步 `config.ts` 与 `.env.example`）。
- 不做：
  - 不改会员 SKU、价格与 MP 虚拟支付链路；
  - 不做 App 支付产品化与 iOS IAP 开通；
  - 不改客户端支付 UI（除非需要展示「App 支付暂未开放」文案）。

## 3. 依赖

- 前置：PO 裁决登录策略与 App 支付上线节奏；
- 外部环境：真实短信服务商（若选接短信）、微信支付商户号与 API v3 凭据（若选开 App 支付）；
- 契约：默认否；若新增客户端可见错误码或开关字段，需先走契约冻结。

## 4. 验收标准

- [ ] 生产环境输入 `123456` 无法登录任意手机号；合法登录路径在真机可用；
- [ ] 生产环境 `platform=app` 下单要么返回真实 JSAPI 参数，要么明确报「App 支付暂未开放」，绝不直接发放权益；
- [ ] 云端 EnvParams 回读无 `ALLOW_WEAK_SMS_CODE=true`，`MOCK_SMS_CODE` 非 `123456`；
- [x] 启动安全守卫覆盖上述两项（代码已完成：云端强制 `SMS_PROVIDER=tencent`，缺配置/弱码/放行阀均拒绝启动）；
- [x] G2（lint / typecheck / 单测 / 构建）通过（服务端 30 文件 / 232 用例）；
- [ ] 真机验证登录与下单后产出 `.accept.md`。

## 5. 风险与对策

| 风险                             | 等级 | 对策                                                               |
| -------------------------------- | ---- | ------------------------------------------------------------------ |
| 改验证码后手机号登录不可用       | 高   | 先确定替代登录方式；提审前可临时只保留微信登录，并在登录页明确提示 |
| 真实短信通道未备案 / 模板未过审  | 中   | 尽早提交短信签名与模板；未通过前不要删除微信登录兜底               |
| 关闭 App mock 影响 App Beta 联调 | 中   | 用独立开关或独立环境保留联调能力，生产强制关闭                     |
| 云端配置改动导致服务无法启动     | 中   | 先本地用同配置跑 `assertCloudSafety`，再发布并回读 `/healthz`      |
| 开关绕过或被旧版本客户端利用     | 低   | 服务端强制校验 platform 与支付模式，不依赖客户端传参               |

## 6. 产物路径

- 新增：本任务卡、`.gate.md`、`.accept.md`
- 修改：`server/src/config.ts`、`server/.env.example`（如需开关）、云端 EnvParams、发布 checklist

## 7. 角色

- 主责：BE + DevOps
- 配合：PO（策略裁决）、QA（真机验证）、LC（短信合规与备案）

## 8. 负责人

BE + DevOps，执行 Agent（PO 裁决后开工）

## 9. 开工前质询（未决项）

| #   | 质询                               | 结论                                                                                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 提审前是否必须保留手机号登录？     | **已裁决（2026-10-26）**：不保留手机号绑定；MP 改为用户主动微信登录，购买不再要求绑定                                                                                                |
| 2   | 真实短信服务商与模板是否已就绪？   | **阻塞（2026-10-26 复核）**：腾讯云自 2025-09-18 起不再支持个人认证新增自用签名；个人只能申请「他用」企业签名，或升级为企业/个体工商户。微信手机号快速验证组件也仅对非个人主体开放。 |
| 3   | App 支付是否在本期上线？           | **待 PO 裁决**：不上线则生产拒绝 `platform=app`；上线则先补商户号与 v3 凭据                                                                                                          |
| 4   | 是否允许 App Beta 继续 mock 联调？ | **待裁决**：建议独立开关，生产默认关闭                                                                                                                                               |
| 5   | 是否需要新增契约字段？             | 默认不需要；若返回新业务码给客户端展示，再补冻结单                                                                                                                                   |

## 10. 实施记录（2026-10-26）

腾讯云 SMS 已接入代码层：

- 新增 `server/src/services/tc3.ts`（TC3 签名公共模块，TTS 改为复用）；
- 新增 `server/src/services/sms.ts`（SendSms、随机 6 位码、+86 号码、超时与错误码）；
- `server/src/services/auth.ts`：腾讯云模式下先发送成功再落库；失败返回 502；
- `server/src/config.ts`：新增 `SMS_PROVIDER` / `SMS_REGION` / `SMS_SDK_APP_ID` / `SMS_SIGN_NAME` / `SMS_TEMPLATE_ID` / `SMS_TIMEOUT_MS`；
- 云端启动守卫：必须 `SMS_PROVIDER=tencent`，且禁止 `MOCK_SMS_CODE=123456` 与 `ALLOW_WEAK_SMS_CODE=true`；
- 新增 `server/src/sms.spec.ts`；服务端 30 文件 / 232 用例、lint、typecheck、build 全绿。

待外部输入后才能部署验收：`SMS_SDK_APP_ID`、`SMS_SIGN_NAME`、`SMS_TEMPLATE_ID`、短信模板审核结果，以及 `TENCENTCLOUD_SECRET_ID/KEY` 的 SMS 权限。

> 部署前必须先更新云端 EnvParams；当前云端仍为 `MOCK_SMS_CODE=123456` + `ALLOW_WEAK_SMS_CODE=true`，直接部署新代码会被启动守卫拒绝。

### 10.1 资质复核（2026-10-26）

控制台创建签名时提示「没有可用的资质」，与官方规则一致：

- 腾讯云公告（2025-09-12 发布，2025-09-18 生效）：国内短信不再支持新增**个人认证自用资质**；个人认证用户只能申请「他用」企业签名，或升级为企业认证。
- 微信手机号快速验证组件：官方明确仅对**非个人开发者**且完成认证的小程序开放，个人主体不可用。
- 结论：**当前个人主体无法直接办理短信签名**。代码实现保留，但短信通道是否启用取决于主体策略。

可选路径：

1. 升级主体为个体工商户/企业（长期方案，可申请自用签名与微信手机号组件）；
2. 找企业授权「他用签名」（需企业资质 + 授权书，报备约 5–10 个工作日）；
3. 不用短信：MP 改用微信登录（openid）作为身份，购买不再强制手机号绑定（最快，需产品裁决）。

### 10.2 已执行：路径 3（2026-10-26 用户裁决）

用户选择「去掉手机绑定功能，用户只需登录；且不自动静默登录，让用户主动点击同意」。已实施：

| 改动                     | 内容                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 启动不再静默登录         | `App.uvue` 移除 onLaunch 的 `uni.login` + `loginByWechat`                                                                            |
| 首页/我的/账号与安全入口 | `goLogin()` 只打开登录层，由用户主动点「微信登录」                                                                                   |
| 面试 prep 入口           | 未登录时直接弹登录层，不再自动静默拉起                                                                                               |
| 登录层（MP）             | 展示微信登录卡 + 协议勾选；`doLogin` 走 `uni.login` → `/auth/wechat`；App 端仍为手机号验证码                                         |
| 购买门控                 | 服务端移除 `/membership/order` 的 409/40902 前置校验；客户端移除绑定半屏层与 `PHONE_REQUIRED`                                        |
| 删除                     | `components/ml-phone-bind-sheet.uvue`、`api/auth.uts` 的 `bindPhone` / `fetchMyPhone`、mock 对应实现、`userStore.hasPhoneIdentity()` |
| 保留                     | 服务端 `/me/phone` 与 `bindPhoneToUser`（不再作为购买门控）                                                                          |

G2 复核：客户端 `lint` / `typecheck` / `test`（117）/ uvue 守卫 / token 守卫 / `build:mp-weixin`；服务端 `typecheck` / `test`（232）/ `format` 全绿。

> 短信通道相关代码（`services/sms.ts`、`services/tc3.ts`、云端 `SMS_PROVIDER` 守卫）保留，主体升级或拿到「他用签名」后可直接启用。

### 10.3 只专注 MP 端上线（2026-10-26 用户裁决）

App 端本期不上线，仅 MP 端发布。据此收敛两处风险：

| 风险                          | 处置                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 手机号万能码可登录任意账号    | 新增 `isPhoneLoginEnabled(env)`：云端未启用腾讯云 SMS 时，`/auth/sms-code` 与 `/auth/login` 直接返回 400「手机号登录暂不可用」，仅保留 `/auth/wechat`；本地/测试不受影响 |
| `platform=app` 下单免费发权益 | 新增 `isAppPayEnabled(env)`：云端未配置真实商户凭据（`PAY_MODE=wx`）时拒绝 App 下单，返回 400「App 端支付暂未开放」；本地联调仍走 mock                                   |

启动守卫同步放宽：云端**不再强制** `SMS_PROVIDER=tencent`（个人主体办不了，强制会导致无法部署）；`MOCK_SMS_CODE=123456` 与 `ALLOW_WEAK_SMS_CODE=true` 降为告警，仅在手机号登录启用时才提示。`SMS_PROVIDER=tencent` 时凭据缺项仍拒绝启动。

G2 复核：服务端 `typecheck` / `test`（233，新增 App 支付可用性、云端手机号登录关闭用例）/ `build`；客户端 `lint` / `typecheck` / `test`（117）/ uvue 守卫 / token 守卫 / `build:mp-weixin`。

> 云端 EnvParams 无需新增键即可部署新版本；`MOCK_SMS_CODE` / `ALLOW_WEAK_SMS_CODE` 可暂留（手机号登录已关，无暴露面），主体升级后再清理。

### 10.4 部署与线上核验（2026-10-26）

- 部署：`tcb cloudrun deploy -e prod-d6gaa83ds8accb61b -s mentorloop-mp-api --source . --port 8787 --min-num 0 --max-num 2 --open-access-types OA,PUBLIC,MINIAPP --wait --force --yes`
- 结果：新版本 `mentorloop-mp-api-042` 上线；访问策略 `OA PUBLIC MINIAPP` 与规格 `0.5C/1G、副本 0–2` 保持不变；EnvParams 未改动。
- 线上核验：

| 项                    | 结果                                                    |
| --------------------- | ------------------------------------------------------- |
| `GET /healthz`        | 200，`driver=mysql`                                     |
| `POST /auth/sms-code` | 400「手机号登录暂不可用，请使用微信登录」（万能码失效） |
| `POST /auth/login`    | 400「手机号登录暂不可用，请使用微信登录」               |
| `POST /auth/wechat`   | 可达（无 code 时 400「缺少微信身份凭证」，符合预期）    |

> 部署期间发现并修复：`server/data/` 累积了 3360 个单测 `test-*.db` 与 250+ 个 `test-uploads-*` 目录（约 3.5 GB），导致构建上下文上传卡住。已新增 `server/.dockerignore`（排除 `data/`、`node_modules/`、`dist/`、`e2e/`）并在 `vitest.global-setup.ts` 中于跑测前后清理 `./data/test-*`；清理后 `server/data` 由 3.5 GB 降至 1.6 MB。
>
> 真机待验：MP 微信登录 → 面试 → 报告 → 会员支付（虚拟支付）全链路。

参考：

- [腾讯云短信个人认证资质调整公告](https://cloud.tencent.com/announce/detail/2127)
- [腾讯云短信签名常见问题](https://cloud.tencent.com/document/product/382/13300)
- [微信手机号快速验证组件](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/getPhoneNumber.html)
