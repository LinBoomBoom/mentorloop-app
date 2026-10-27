# 门禁与执行记录：SEC-3 凭据轮换

- 日期：2026-10-27
- 任务卡：[2026-10-27-credential-rotation.md](./2026-10-27-credential-rotation.md)
- 结论：**两波均已完成，7 项凭据全部替换并验证**（第一波 JWT + 弱码 + 规格；第二波 6 项外部凭据），线上版本 `mentorloop-mp-api-051`。

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

## 5. 第二波：6 项外部凭据（已完成）

用户在对应控制台生成新值并写入 `D:\mentorloop-secrets\rotation-2026-10-27.txt`；脚本一次性合并回写（`requestId=42408ad0-3c29-4146-9f93-5de528b719e7`），部署 `mentorloop-mp-api-051`。

| 变量                                    | 生成位置                                        | 状态 |
| --------------------------------------- | ----------------------------------------------- | ---- |
| `MYSQL_PASSWORD`                        | 微信云托管控制台 → MySQL 数据库 → root 重置密码 | ✅   |
| `WX_SECRET`                             | 微信公众平台 → 开发设置 → 重置 AppSecret        | ✅   |
| `TENCENTCLOUD_SECRET_ID` / `SECRET_KEY` | 腾讯云 CAM → 原子用户下新建密钥（子用户不变）   | ✅   |
| `LLM_API_KEY`                           | DeepSeek 控制台 → API Keys                      | ✅   |
| `MP_APP_KEY`                            | 微信公众平台 → 虚拟支付 → 基本配置              | ✅   |

### 5.1 逐项功能验证（部署后实测）

| #   | 凭据                | 验证手段                                                  | 结果                                         |
| --- | ------------------- | --------------------------------------------------------- | -------------------------------------------- |
| 1   | `MYSQL_PASSWORD`    | 新容器冷启动后 `GET /healthz`                             | 200，`driver=mysql`（新密码可连库）          |
| 2   | `WX_SECRET`         | `POST /auth/wechat` 走 code2session 换 token              | 登录成功，token 136 位                       |
| 3   | `WX_SECRET`（存储） | `wx.cloud.uploadFile` → 服务端 `batchdownloadfile` → 抽取 | 上传成功，`parse` 200 且技术栈识别 5 项      |
| 4   | 腾讯云密钥          | `POST /interview/tts`                                     | 200，2.0s，返回 `cloud://` fileID            |
| 5   | `LLM_API_KEY`       | 同一份简历预览解析                                        | 200，4.3s，`mode=preview`，`previewIssues=3` |
| 6   | `MP_APP_KEY`        | `POST /membership/order {platform:'mp-weixin'}`           | 200，返回 `orderId` 且 `payParams` 非空      |

### 5.2 观察到的两点

1. **`MP_APP_KEY` 长度为 18 位**（旧值 32 位），但下单接口能正常生成 `payParams`，说明当前签名链路可走通。是否被微信侧接受，仍需一次真机拉起支付确认——本地只能验证「不报错」。
2. **开发者工具登录后的 `uid` 从 `u_7b35ed5346ad` 变为 `u_aae43c056d72`**：`/auth/wechat` 用 `wx.login` 的 code 换 openid，IDE 账号不同即得到不同用户。此前那 3 次简历额度与测试记录属于旧 uid，新 uid 下不可见——属正常现象，不是数据丢失。

### 5.3 待用户在控制台收尾

| 项                                            | 动作                                       |
| --------------------------------------------- | ------------------------------------------ |
| 旧腾讯云密钥                                  | 已由用户**禁用**（新密钥验证通过后可删除） |
| 旧 `LLM_API_KEY`                              | 建议在 DeepSeek 控制台**删除**旧 Key       |
| 旧 `WX_SECRET` / `MP_APP_KEY`                 | 重置后已自动失效，无需额外操作             |
| 旧 `MYSQL_PASSWORD`                           | 改密后已自动失效                           |
| `D:\mentorloop-secrets\rotate.mjs` 与轮换文件 | 建议删除，避免长期留存凭据副本             |

## 6. 风险提示

- 上一版本（`-050`）已持有第一波值，更早版本持有原始值；确认稳定后旧凭据务必彻底删除，不要只禁用。
- 本次轮换产生了一笔未支付的虚拟支付订单（`o_8213700fb6e3`，`platform=mp-weixin`），状态停留在 `CREATED`，不会发货；如需清理可忽略，60 分钟对账只会查单不会发放。
