# 门禁与执行记录：SEC-3 凭据轮换（第一波）

- 日期：2026-10-27
- 任务卡：[2026-10-27-credential-rotation.md](./2026-10-27-credential-rotation.md)
- 结论：**第一波完成**（JWT 轮换 + 弱码清理 + 规格回正）；6 项外部凭据待用户生成后执行第二波。

## 1. 第一波变更

| 项                     | 变更                                                |
| ---------------------- | --------------------------------------------------- |
| `JWT_SECRET`           | 替换为本地生成的 64 位随机值（旧值即刻失效）        |
| `MOCK_SMS_CODE`        | **删除**                                            |
| `ALLOW_WEAK_SMS_CODE`  | **删除**                                            |
| EnvParams 键数         | 25 → 23                                             |
| 容器规格               | 1C/2G → **0.5C/1G**（修复此前被接口覆盖重置的漂移） |
| 副本 / 端口 / 访问策略 | 0–2 / 8787 / `MINIAPP,OA,PUBLIC`（保持）            |
| 部署版本               | `mentorloop-mp-api-050`                             |
| TC3 回写 RequestId     | `a9d4433b-ed84-4384-9833-5493a57877ac`              |

## 2. 回读核验（部署后）

| 检查项                                  | 结果                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 在线版本                                | `mentorloop-mp-api-050`                                                                           |
| 规格                                    | `0.5C / 1G`，副本 `0–2`，端口 `8787`                                                              |
| 访问策略                                | `MINIAPP / OA / PUBLIC`                                                                           |
| EnvParams 键数                          | 23                                                                                                |
| `MOCK_SMS_CODE` / `ALLOW_WEAK_SMS_CODE` | 均不存在                                                                                          |
| `JWT_SECRET` 长度                       | 64（新值）                                                                                        |
| 业务配置保留                            | `MP_PAY_MODE=virtual`、`LLM_MODEL=deepseek-v4-flash`、`ASR_PROVIDER=wx`、`MP_OFFER_ID=1450672438` |

## 3. 功能验证

| #   | 请求                                | 结果                                                      |
| --- | ----------------------------------- | --------------------------------------------------------- |
| 1   | `GET /healthz`                      | 200，`driver=mysql`，`annotateFont=true`（库连接正常）    |
| 2   | `POST /admin/grant-resume-quota`    | 404 Route not found（临时通道仍为关闭状态）               |
| 3   | `POST /auth/sms-code`               | 400「手机号登录暂不可用」（弱码删除后行为不变）           |
| 4   | `POST /auth/wechat`（无 code）      | 400「缺少微信身份凭证」                                   |
| 5   | `POST /resume/annotate`（无 token） | 401                                                       |
| 6   | 旧登录态                            | 开发者工具 storage 中 token 已为空（客户端 401 自动登出） |

> 第 6 项为 JWT 轮换的预期副作用：所有已登录用户需重新微信登录一次。

## 4. 顺带修复的配置漂移

2026-10-27 注入/移除临时运维令牌时，调用 `UpdateCloudRunServerConfig` 只传了 `EnvId / ServerName / EnvParams`，该接口对 `ServerBaseConfig` 是**覆盖**语义，未传的 `Cpu/Mem` 被重置为默认 `1C/2G`（原为降配后的 `0.5C/1G`）。

本次回写已显式带上 `Cpu / Mem / MinNum / MaxNum / Port / OpenAccessTypes`，并在部署后逐项回读确认已恢复。

> 结论：**任何** `UpdateCloudRunServerConfig` 调用都必须传全量 `ServerBaseConfig`，否则会静默重置规格。此条已写入任务卡 §3 警示。

## 5. 第二波待办（需用户生成新值）

| 变量                                    | 生成位置                           | 状态 |
| --------------------------------------- | ---------------------------------- | ---- |
| `MYSQL_PASSWORD`                        | 腾讯云 TDSQL-C → 账号管理          | 待填 |
| `WX_SECRET`                             | 微信公众平台 → 开发设置            | 待填 |
| `TENCENTCLOUD_SECRET_ID` / `SECRET_KEY` | 腾讯云 CAM → 用户 → API 密钥       | 待填 |
| `LLM_API_KEY`                           | DeepSeek 控制台 → API Keys         | 待填 |
| `MP_APP_KEY`                            | 微信公众平台 → 虚拟支付 → 基本配置 | 待填 |

填写位置：`D:\mentorloop-secrets\rotation-2026-10-27.txt`（一行一个 `KEY=value`）。填好后执行 `node rotate.mjs dry` 预览，再 `apply` 并部署。

## 6. 风险提示

- 第二波中 `MYSQL_PASSWORD` 与 `WX_SECRET` 属于**破坏性窗口**：库密码改完到注入之间服务会连库失败；微信 Secret 重置后旧值不可逆。建议在低峰期一次完成。
- 上一个版本（`-050`）仍持有当前值，可作为回滚点；确认稳定后再废弃旧凭据。
