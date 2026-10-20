# 小程序语音链路工作汇报（2026-10-19 ~ 10-20）

> 覆盖：可行性分析 → 方案 A POC → TTS 选型 → 契约冻结与实施卡 → 注入通道取证。
> 关联卡：[可行性卡](./2026-10-19-mp-voice-channel-feasibility.md) · [TTS 实施卡](./2026-10-19-mp-voice-tts-outbound.md) · [契约冻结](../contracts/2026-10-19-tts-outbound.freeze.md)

## 1. 背景与触发

真机走查（ISS 同期）发现语音链路整体断点：**无音频进、无音频出、无转写上屏**。用户裁决先做可行性分析（只分析不动手），再按证据推进。

## 2. 关键结论（全部来自官方文档或实证）

| #   | 结论                                                                                                                                                                                        | 来源                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | 个人主体仅限「业务域名」；`request`/`uploadFile`/`downloadFile` 服务器域名无主体限制                                                                                                        | 小程序官方文档             |
| 2   | 云托管默认公网域名 `*.tcloudbase.com` 小程序后台无法配置，仅测试用；绑自定义域名强制 ICP 备案                                                                                               | 云托管官方文档             |
| 3   | 免域名通道 POC 三问全过：个人主体 `wx.cloud.uploadFile` 上传成功（cloud:// fileID）；`InnerAudioContext.src = fileID` 真实出声（play→ended）；`getTempFileURL` 换公网链接可取回（HTTP 200） | 真机实证                   |
| 4   | 服务端写云存储官方通道：`POST /tcb/uploadfile` 拿上传链接 → multipart 上传得 file_id；环境未绑定报 85088                                                                                    | 微信服务端 API 文档        |
| 5   | TTS 选型定腾讯云 `tts.tencentcloudapi.com`（TC3 签名，个人可开通，基础/精品音色 800 万字符免费额度）                                                                                        | 腾讯云官方                 |
| 6   | 微信同声传译插件与云开发「深度合成」类目仅非个人主体可用——原方案不可行的直接原因                                                                                                            | 微信官方文档               |
| 7   | **线上 asr-wx 驱动长期降级的根因锁定**：云端 EnvParams 仅 9 键，缺 `WX_APPID`/`WX_SECRET`，属缺凭据非代码缺陷                                                                               | `tcb cloudrun detail` 实测 |

## 3. 已完成工作

1. **可行性卡落盘**：八要素 + 6 条质询收口 + 13 条官方取证（带来源链接）+ 三方案对比。
   - 方案 A：云存储私有链路（免域名免备案）✅ POC 通过
   - 方案 B：自备已备案域名（远期）
   - 方案 C：文字作答兜底（保底）
2. **POC 探针**（项目外 `e:\LsqCoding\_poc-voice\`，App 代码零改动）：`miniprogram-automator` + `mp.evaluate()` 直跑 wx API；云端探针产物已清理（存储回空列表）。
3. **契约冻结 + 实施卡**：
   - 新增 `POST /interview/tts`（requireAuth）：请求 `{text≤200字}` → 成功 `{fileID, provider, format, chars}`；诚实降级 `fileID=''`；失败 `fail(400)`。
   - 服务端新增 `services/tts.ts`（stub|probe|tencent 三态驱动）、`services/wx-storage.ts`、`services/wx-access-token.ts`（与 ASR 共享）。
   - 客户端新增 `api/tts.uts`；`speech.uts` 的 `speak()` 改为「取 fileID → 播放」，签名语义不变。
4. **注入通道取证**：CloudBase API 对云托管仅两个只读接口，`tcb cloudrun deploy` 无 env 参数 → **CLI 注入通道证伪**，仅余控制台一条路。

## 4. 当前阻塞（总闸）

> **2026-10-20 更新：总闸已放行。** 腾讯云 TTS 已开通、免费额度已领取、最小权限子用户密钥已生成并注入生产云托管（13 键回读齐全）。CLI 注入通道此前被判死，实际存在可行路径（TC3 签名直调 `UpdateCloudRunServerConfig`），详见 [TTS 实施卡 §11](./2026-10-19-mp-voice-tts-outbound.md)。下文 §4 保留原阻塞记录作为留痕。

## 4. 原阻塞（已解除）

云端服务 EnvParams 现仅 9 键，`TENCENTCLOUD_SECRETID/SECRETKEY` 与 `WX_APPID/WX_SECRET` 无处注入。等待用户控制台确认**两处入口**：

1. 「服务设置 → 环境变量」能否新增键（还是只能编辑已有 9 个的值）
2. 「部署新版本 → 版本配置」的环境变量列表旁有无「添加」

**分支预案**：

- 能新增 → 版本配置注入 5 个键（TTS 密钥 ×2 + `TTS_PROVIDER` + 顺带救活 asr-wx 的 `WX_APPID/WX_SECRET`），随即开工实施。
- 不能新增 → 改「密钥入库（DB 配置表）」并重新冻结契约。

**实际落定（2026-10-20）**：无需控制台手工——用 tcb 登录态 STS 临时凭据 TC3 签名直调 `tcbr.tencentcloudapi.com` 的 `UpdateCloudRunServerConfig`，一次注入 4 键成功。`WX_APPID/WX_SECRET` 仍缺（需微信公众平台侧 Secret，另属 ASR 卡）。

## 5. 代码影响与下一步

- **本阶段 App 代码零改动**，全部为取证与 SOP 产物（2 张任务卡 + 1 份契约冻结 + 本汇报）。
- 外部环境已就绪：TTS 开通、800 万字符免费包（至 2027-01-20）、子用户密钥、云端 4 键注入。
- 下一步按序：`impl-server`（TTS 驱动 + 云存储写入 + 路由）→ `impl-client`（tts.uts + speech.uts）→ 双侧单测 + G2 门禁 + 部署（新版本才使环境变量生效）+ 真机复验出声。
