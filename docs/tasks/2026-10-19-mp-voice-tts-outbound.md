# 任务卡：MP 语音下行通道落地（面试官 TTS 出声）

- 日期：2026-10-19
- 关联：承接 `docs/tasks/2026-10-19-mp-voice-channel-feasibility.md`（方案 A，POC 三问已全过）；契约冻结 `docs/contracts/2026-10-19-tts-outbound.freeze.md`
- 性质：**实施卡（方案 A 下行批次）**

## 1. 目标

让小程序面试房间的**面试官真正出声**：服务端用腾讯云 TTS 合成题面音频 → 写入微信云存储 → 返回 `cloud://` fileID → 客户端 `InnerAudioContext` 直接播放（走免域名私有协议），替换当前 [speech.uts](file:///e:/LsqCoding/Mentorloop-app/api/speech.uts#L62-L73) 的 `speakSilent` 字幕降级。

## 2. 范围

- 做：服务端 TTS 驱动注册表（`stub | probe | tencent`）+ 云存储写入 + `POST /interview/tts` 路由 + 共享 access_token 模块；客户端 `api/tts.uts` + `speech.uts` 播放改造；双侧单测；契约冻结（已落盘）。
- 不做：**ASR 上行**（另立卡）；ICP 备案 / 自定义域名 / `API_BASE_URL` 回填；改 `manifest.json`；录音链路；房间 UI 布局改动；App 端原生 TTS（仍待 utssdk）。

## 3. 依赖

- 前置：方案 A POC 三问已过（见上卡 §11）；云存储环境 `prod-d6gaa83ds8accb61b` 已开通（`tcb storage list` 实证）。
- 外部环境：**腾讯云 TTS 已开通 + 免费资源包已领取 + 最小权限子用户密钥已注入**（2026-10-20 完成，见 §11）；**云存储服务端写入首次实测**（环境↔appid 绑定不符会报 85088）。

**注入通道取证（2026-10-19 ~ 10-20）**：

| 事实                                                                                                                                                                                                                                 | 证据                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 云端服务 EnvParams 仅 9 键（`PORT/MYSQL_*/JWT_SECRET/MOCK_SMS_CODE/DESKTOP_DB_NAME`），**无 `WX_APPID`/`WX_SECRET`**                                                                                                                 | `tcb cloudrun detail --json` 解析键名（未打印值）                                                                                                                     |
| 线上 `asr-wx` 驱动长期降级，根因即此（缺凭据，非代码缺陷）                                                                                                                                                                           | 同上 + `asr-wx.ts` `ready=false` 分支                                                                                                                                 |
| ~~CloudBase API 云托管接口只读~~ **更正**：存在写接口 `UpdateCloudRunServerConfig`，但 SDK 未暴露、CLI 命令已废弃且 `envId` 声明缺失（解析为 `undefined` 直接报错）                                                                  | `tcb run service:config` / `tcb run deploy` 实测均返回「请使用 -e 或 --envId 指定环境 ID」，源码 `ConfigServiceTcbr.execute` 读 `options.envId` 而该命令未声明此 flag |
| **可行注入通道（已实证）**：TC3-HMAC-SHA256 签名直调 `POST https://tcbr.tencentcloudapi.com`，Action=`UpdateCloudRunServerConfig`、Version=`2022-02-17`、`X-TC-Token` 用 tcb 登录态 STS 临时凭据（`~/.config/.cloudbase/auth.json`） | 2026-10-20 实调返回 `{"Response":{"RequestId":"1b8ead0c-..."}}`，回读 13 键齐全                                                                                       |
| 控制台「环境变量区」实为可编辑表单（含 JSON 模式切换 + 保存），但自动化点击该切换不稳定                                                                                                                                              | 浏览器实测（未完成保存，改用 API 通道）                                                                                                                               |

- 契约：**新增端点 + 新增 `api/tts.uts`** → 已冻结（`docs/contracts/2026-10-19-tts-outbound.freeze.md`）。改契约须重新冻结。

## 4. 验收标准

- [ ] `POST /interview/tts` 出入参与冻结记录**逐字一致**（G2 双端字段核对）
- [ ] 服务端 driver 三态有单测：`stub` 诚实降级（空 fileID）、`probe` 产出可播探针音、`tencent` 签名固定向量锁定
- [ ] 真机：面试房间题面出现时**既有声音又有字幕**；播报期间面试官状态为「说话中」，播报结束回「聆听」
- [ ] 失败路径：TTS 任一环节失败 → 回退 `speakSilent`，**流程不阻塞、不报错弹窗**
- [ ] 隐私：云存储不出现任何用户录音文件（仅合成音频）
- [ ] 调用方零改动：房间/训练页无需改一行即生效

## 5. 风险与对策

| 风险                                                                       | 等级 | 对策                                                                                                                                                            |
| -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 云存储**服务端**写入被拒（85088 环境未开通/绑定不符）                      | 高   | 实施首步实测 `tcb/uploadfile`；失败即回退「客户端 `wx.cloud.uploadFile` 上传服务端返回的音频字节」（客户端路径已 POC 通过）                                     |
| 腾讯云 TTS 密钥 / 微信凭据**无法注入**                                     | 高   | **已查证：`tcb api` 与 CLI 均无注入能力**。仅余控制台；若控制台亦不能新增键 → 退「密钥入库（DB 配置表）」或「云托管云调用自动凭据（微信侧）」，并在卡内重新冻结 |
| 腾讯云 TC3-HMAC-SHA256 签名实现错                                          | 中   | 固定向量单测锁定（对标仓内 `aliyunSign` 做法）                                                                                                                  |
| 音频格式/时长不被 `InnerAudioContext` 接受                                 | 低   | 已 POC：WAV 可播；固定输出 mp3/wav 16k                                                                                                                          |
| 新镜像含 `assertCloudSafety` → 云端 `MOCK_SMS_CODE` 若为默认值服务拒绝启动 | 中   | 线上已是 6 位非默认值（824193）；部署前复核一次                                                                                                                 |

## 6. 产物路径

- 新增：`server/src/services/tts.ts`、`server/src/services/wx-storage.ts`、`server/src/services/wx-access-token.ts`、`server/src/tts.spec.ts`、`api/tts.uts`
- 修改：`server/src/config.ts`、`server/.env.example`、`server/src/services/asr-wx.ts`（改走共享 token）、`server/src/routes/interview.ts`、`api/speech.uts`
- 文档：`docs/contracts/2026-10-19-tts-outbound.freeze.md`（已落盘）、本卡

## 7. 角色

- 主责：BE（服务端驱动 + 云存储 + 路由）
- 配合：FE（`api/tts.uts` + `speech.uts` 播放通道）/ FA（云存储服务端写入实测）/ QA（G2 门禁）
- 契约：PO（`mentorloop-contract-freeze`，已签）

## 8. 负责人

BE + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询                         | 结论                                                                                                                                                            |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 免域名播放通道是否真的成立？ | 已查证（本仓 POC 实证）：`fileID` 作 `InnerAudioContext.src` 事件流 `play→ended`，`cloud://` 不经域名校验                                                       |
| 2   | 服务端能否写云存储？         | 已查证（官方文档）：`POST https://api.weixin.qq.com/tcb/uploadfile?access_token=` 拿上传链接再 multipart POST；存储接口无主体限制。**待实测**（85088 绑定风险） |
| 3   | TTS 引擎选谁？               | 已决策（用户）：**腾讯云 TTS**（个人可开通、800 万字符免费额度、输出 mp3/wav 16k 契合播放）                                                                     |
| 4   | 没有密钥时链路能否先验证？   | 已决策：`ttsProvider=probe` 产出内置探针音（仅链路验证，日志与响应 `provider` 明标），`stub` 为诚实降级（空 fileID）                                            |
| 5   | 是否要服务端缓存已合成音频？ | 已决策：**不做**（YAGNI）——面试官念题通常一次性，重复合成成本可忽略；额度 800 万字符覆盖上万场                                                                  |
| 6   | 密钥如何注入云端？           | **已解决（2026-10-20 实证）**：TC3 签名直调 `UpdateCloudRunServerConfig` 注入成功，无需控制台手工、无需 wxcloud 扫码登录；注入后 13 键回读齐全                  |
| 7   | 房间页调用方是否需要改？     | 已查证：无需——`speak()` / `onTtsState` 签名与语义不变，房间页零改动                                                                                             |

## 10. 进度记录

| 日期       | 事项                              | 结果                                                                                                                                                                                                                                                                         |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | 立卡 + 冻结                       | 本卡 + `docs/contracts/2026-10-19-tts-outbound.freeze.md` 落盘                                                                                                                                                                                                               |
| 2026-10-19 | 实施前风险取证                    | ①云端 EnvParams 仅 9 键、无 `WX_*` → 线上 asr-wx 长期降级根因锁定 ②CLI 无注入能力（API 只读 + deploy 无 env 选项） ③注入仅余控制台，等用户确认                                                                                                                               |
| 2026-10-20 | 外部环境开通（执行 Agent 代操作） | ①TTS 服务已开通 ②领取「基础/精品音色免费资源包-800万字符」，有效期 2026-10-20 → 2027-01-20 ③创建子用户 `mentorloop-tts`（仅 `QcloudTTSFullAccess`、仅编程访问）④实测 `TextToVoice` 成功（`RequestId=da671167-...`，11 字 → 8928 字节 mp3）⑤注入 4 键至云托管，回读 13 键齐全 |

## 11. 外部环境落定（2026-10-20）

| 项         | 结果                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 腾讯云 TTS | 已开通（控制台勾选协议后「开通」，无实名阻断）                                                                                                                                    |
| 免费额度   | 「语音合成-通用（不含长文本）免费资源包-800万字符」，剩余 8,000,000，到期 2027-01-20；另两档（大模型 10 万 / 超自然 2 万）**未领取**，留作后用                                    |
| 凭据       | CAM 子用户 `mentorloop-tts`（UIN 下账号 ID 100053995028），仅挂 `QcloudTTSFullAccess`，仅编程访问；**无控制台登录权限**                                                           |
| 密钥落盘   | `server/.env`（`server/.gitignore` 已忽略 `.env`）；密钥未写入任何被追踪文件                                                                                                      |
| 云端注入   | `TTS_PROVIDER=tencent`、`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_TTS_REGION=ap-guangzhou` 已写入 `prod-d6gaa83ds8accb61b / mentorloop-mp-api`，原 9 键无丢失 |
| 生效时机   | 云托管环境变量**在创建新版本时生效**；当前线上版本仍为 `mentorloop-mp-api-008`，随本批实现部署一并生效                                                                            |
| 计费踩坑   | 仅开通服务、未领资源包时调用返回 `UnsupportedOperation.PkgExhausted`；**免费额度需在「语音合成 → 语音合成资源包」手动点领取**，不会自动发放                                       |
