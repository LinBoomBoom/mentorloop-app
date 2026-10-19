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
- 外部环境：**腾讯云 TTS 开通 + SecretId/SecretKey**（用户提供）；**密钥注入通道受阻**（见下）；**云存储服务端写入首次实测**（环境↔appid 绑定不符会报 85088）。

**注入通道取证（2026-10-19）**：

| 事实                                                                                                                                               | 证据                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 云端服务 EnvParams 仅 9 键（`PORT/MYSQL_*/JWT_SECRET/MOCK_SMS_CODE/DESKTOP_DB_NAME`），**无 `WX_APPID`/`WX_SECRET`**                               | `tcb cloudrun detail --json` 解析键名（未打印值）                                    |
| 线上 `asr-wx` 驱动长期降级，根因即此（缺凭据，非代码缺陷）                                                                                         | 同上 + `asr-wx.ts` `ready=false` 分支                                                |
| **CLI 无法注入新变量**：CloudBase API「云托管相关接口」只有 `DescribeCloudBaseRunServerVersion` / `DescribeCloudBaseBuildService` 两个**只读**接口 | [云开发 API 概览](https://cloud.tencent.com/document/api/876/34809) 云托管相关接口段 |
| CLI `tcb cloudrun deploy` 无 env 参数选项；`version` 子命令无「创建带变量的版本」                                                                  | `tcb cloudrun deploy --help` / `tcb cloudrun version --help`                         |
| 控制台「环境变量区不能新增键」（本仓 2026-10-19 实测记录）与 M1「在版本配置里填变量」的表述**存在矛盾**                                            | 本仓 `project_memory.md` 云托管运维三坑；待用户在控制台确认                          |

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

| #   | 质询                         | 结论                                                                                                                                                                   |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 免域名播放通道是否真的成立？ | 已查证（本仓 POC 实证）：`fileID` 作 `InnerAudioContext.src` 事件流 `play→ended`，`cloud://` 不经域名校验                                                              |
| 2   | 服务端能否写云存储？         | 已查证（官方文档）：`POST https://api.weixin.qq.com/tcb/uploadfile?access_token=` 拿上传链接再 multipart POST；存储接口无主体限制。**待实测**（85088 绑定风险）        |
| 3   | TTS 引擎选谁？               | 已决策（用户）：**腾讯云 TTS**（个人可开通、800 万字符免费额度、输出 mp3/wav 16k 契合播放）                                                                            |
| 4   | 没有密钥时链路能否先验证？   | 已决策：`ttsProvider=probe` 产出内置探针音（仅链路验证，日志与响应 `provider` 明标），`stub` 为诚实降级（空 fileID）                                                   |
| 5   | 是否要服务端缓存已合成音频？ | 已决策：**不做**（YAGNI）——面试官念题通常一次性，重复合成成本可忽略；额度 800 万字符覆盖上万场                                                                         |
| 6   | 密钥如何注入云端？           | 已查证（CLI 不可行）：CloudBase API 无云托管更新接口、CLI deploy 无 env 选项。**待用户确认控制台**（环境变量区 vs 版本配置）；不能则转「密钥入库」或「云调用自动凭据」 |
| 7   | 房间页调用方是否需要改？     | 已查证：无需——`speak()` / `onTtsState` 签名与语义不变，房间页零改动                                                                                                    |

## 10. 进度记录

| 日期       | 事项           | 结果                                                                                                                                           |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | 立卡 + 冻结    | 本卡 + `docs/contracts/2026-10-19-tts-outbound.freeze.md` 落盘                                                                                 |
| 2026-10-19 | 实施前风险取证 | ①云端 EnvParams 仅 9 键、无 `WX_*` → 线上 asr-wx 长期降级根因锁定 ②CLI 无注入能力（API 只读 + deploy 无 env 选项） ③注入仅余控制台，等用户确认 |
