# 任务卡：小程序语音链路可行性分析与通道选型（个人主体）

- 日期：2026-10-19
- 关联：里程碑 M3（语音面试能力补全）/ 真机走查 2026-10-19 缺口「无音频进·无音频出·无转写上屏」
- 性质：**分析卡（只做可行性核实，不动手实现）**

## 1. 目标

在「**个人主体小程序 + 微信云托管**」这一硬约束下，核实语音出（TTS 念题）与语音入（ASR 作答）各自**到底能走哪条通道**，产出带官方来源的方案对比与推荐项，交 PO 裁决——本轮不写实现代码。

## 2. 范围

- 做：5 项官方文档核实（合法域名 / 备案 / 云托管默认域名与公网访问 / TTS 替代路径 / 录音授权）；3 条方案对比；推荐项与回退路径；本卡立卡与用户裁决留痕。
- 不做：不改 `manifest.json`；不改任何云配置（服务公网访问、域名、环境变量）；不写业务实现代码；不申请第三方账号；不动线上服务。

## 3. 依赖

- 前置（已实证的断点，来自 2026-10-19 走查与代码核对）：
  - `manifest.json` `mp-weixin` 段未声明 wechatSI 插件 → [speech.uts](file:///e:/LsqCoding/Mentorloop-app/api/speech.uts) 的 `requirePlugin('wechatSI')` 失败 → TTS 走 `speakSilent`（只字幕不出声）
  - [env.uts](file:///e:/LsqCoding/Mentorloop-app/api/env.uts#L28) `API_BASE_URL = ''` → `client.upload` 与 `api/asr.uts` 的 upload 通道显式报错
  - 云托管服务 `OpenAccessTypes=MINIAPP` → 公网 HTTPS 直调返回 `SERVICE_FORBIDDEN`
- 外部环境：微信公众平台后台「域名配置」权限、云托管控制台（环境 `prod-d6gaa83ds8accb61b`）、第三方 ASR/TTS 账号（后置，选型确定后再办）
- 契约：本卡**不改** `types/` 或 `api/`；若选定方案落地涉及上传/转写契约变更，由后续实施卡触发契约冻结

## 4. 验收标准

- [ ] 5 项核实（a–e）每条都有官方来源链接，或明确标注 unverified
- [ ] 方案对比覆盖 合规 / 成本 / 周期 / 风险 / 改动面 / 依赖 六维
- [ ] 推荐项给出「首选 + 回退」两级路径与**触发回退的判定条件**
- [ ] 用户（PO）裁决已留痕，选定方案与理由写回本卡 §12

## 5. 风险与对策

| 风险                                                           | 等级 | 对策                                                                  |
| -------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| 推荐方案依赖「个人主体可用云存储」这一 unverified 前提         | 高   | 首选方案落地前先跑一次最小 POC（见 §11 命门清单），POC 不过即回退 B   |
| 社区存在与官方文档相悖的说法（如「个人主体不能配服务器域名」） | 中   | 一律以官方文档为准，社区说法仅作 unverified 记录；关键项真机/后台实测 |
| ICP 备案周期不可控（个人备案数周）                             | 中   | 方案 B 前置周期单独列出，不阻塞方案 A 的并行评估                      |
| 第三方 ASR 按量计费带来成本敞口                                | 低   | 选型时列出计费口径；先按「单场音频量级」估算再决策                    |

## 6. 产物路径

- 新增：`docs/tasks/2026-10-19-mp-voice-channel-feasibility.md`（本卡）
- 修改：（无，分析阶段零代码）

## 7. 角色

- 主责：FA（可行性分析师）
- 配合：MP-PM（平台能力边界与合规）/ BE（服务端通道）/ PO（范围与裁决）

## 8. 负责人

FA + 执行 Agent

## 9. 开工前质询（未决项清单）

| #   | 质询                                                                    | 结论                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 「个人主体不能用服务器域名」是否属实？                                  | 已查证：官方域名文档「服务器域名」限制项**未列主体限制**（仅「业务域名」写明仅非个人主体）→ 个人主体**可配** request/uploadFile 合法域名；社区相反说法为未经证实的 AI 回答 |
| 2   | 云托管默认域名能否直接填进小程序合法域名？                              | 已查证（官方明文）：**否**——「小程序后台无法配置使用默认公网域名」，默认域名仅测试用、勿用于生产                                                                           |
| 3   | 是否存在「免配合法域名/免备案」的通道？                                 | 已查证（官方）：**有**——云托管对象存储 `fileID` 可直接作 `createInnerAudioContext.src`（`cloud://` 私有协议，不经域名校验）；`callContainer` 亦免域名（但 100KB 硬限）     |
| 4   | 个人主体能否使用云开发/云存储？                                         | **已查证（POC 通过）**：环境存储已开通（`tcb storage list` 成功）；个人主体客户端 `wx.cloud.uploadFile` 实测成功、`fileID` 可播、可换公网临时链接 → 结论成立               |
| 5   | 微信同声传译**服务端**接口（`addvoicetorecofortext`）是否同样限非个人？ | 待定（与插件类目同源，疑同样受限）；不阻塞选型——服务端已有第三方 ASR driver（阿里云/wx）可替换                                                                             |
| 6   | 录音在个人主体真机是否可用？                                            | 待定：官方 API 无主体限制，社区有「个人主体不支持录音」反例（未验证）→ 需真机实测                                                                                          |

## 10. 取证结论（官方来源）

| #   | 核实项                       | 结论                                                                                                    | 来源                                                                                                                                                | 置信度      |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| a1  | 个人主体配服务器域名         | 可配（`request`/`uploadFile`/`downloadFile` 均未列主体限制）                                            | [域名管理](https://developers.weixin.qq.com/doc/oplatform/developers/basic_func/domain.html)                                                        | 官方        |
| a2  | 合法域名硬性要求             | 必须 HTTPS；**域名必须经 ICP 备案**；带端口有严格规则                                                   | [网络使用说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)                                                     | 官方        |
| a3  | 云托管默认域名可否配进小程序 | **不可**：官方「小程序后台无法配置使用默认公网域名」，默认域名仅测试用                                  | [云托管开发常识 §8](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/debug/know.html)                           | 官方        |
| b1  | 个人能否 ICP 备案            | 能（备案系统设「个人备案」类型）                                                                        | [腾讯云备案限制](https://cloud.tencent.com/document/product/243/18911)                                                                              | 官方        |
| b2  | 云托管绑自定义域名           | 强制 ICP 备案；云托管**本身不支持备案**，需另购服务器完成备案                                           | [自定义域名](https://developers.weixin.qq.com/minigame/dev/wxcloudrun/src/guide/domain/index.html)                                                  | 官方        |
| c1  | 云托管放开公网访问           | 可开（控制台「服务设置-公网访问」），但产出的仍是**默认公网域名** → 配不进小程序、不能 `request` 直调   | [服务设置](https://developers.weixin.qq.com/minigame/dev/wxcloudrun/src/guide/service/pipeline.html)                                                | 官方        |
| c2  | 公网访问安全代价             | 官方明确：云托管**对公网域名无任何安全防护**、公网调用不带微信用户信息、**须自行做登录鉴权**            | [云托管开发常识 §7](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/debug/know.html)                           | 官方        |
| d1  | 服务端预合成音频 + 播放      | 可行，但 `InnerAudioContext.src` 域名同样受校验 → 仍需已备案域名                                        | [网络使用说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)                                                     | 官方        |
| d2  | **云存储 `fileID` 直接播放** | **可行且免域名**：`fileID` 可直接填入 `createInnerAudioContext.src`，走 `cloud://` 私有协议不经域名校验 | [云托管对象存储-小程序组件](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/development/storage/miniapp/compon.html) | 官方        |
| d3  | 官方个人可用 TTS             | **无**：CloudBase「深度合成」类目仅向非个人主体开放                                                     | [算法备案说明](https://docs.cloudbase.net/ai/release/algorithm-filing)                                                                              | 官方        |
| e1  | 录音主体限制                 | 官方 API 无主体限制；社区有「个人主体不支持录音」说法（疑为服务类目问题）                               | [wx.getRecorderManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.getRecorderManager.html)                             | 官方 / 社区 |
| e2  | 录音授权                     | `scope.record` 授权；须在「用户隐私保护指引」声明「访问你的麦克风」并通过审核                           | [授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html)                                                      | 官方        |
| e3  | 音频产出用途                 | `tempFilePath` 可 `wx.uploadFile`（受域名约束）或 `wx.cloud.uploadFile`（云存储，免域名）               | [RecorderManager.start](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html)                             | 官方        |

## 11. 方案对比与推荐

### 方案 A（首选）：云存储私有链路（`cloud://` fileID，免域名）

- **下行 TTS**：服务端合成/预置音频 → 云存储 → 返回 `fileID` → 客户端 `createInnerAudioContext.src = fileID` 直接播放（官方支持）
- **上行 ASR**：客户端 `wx.cloud.uploadFile` 上传录音 → 得 `fileID` → 经 `callContainer` 把 `fileID`（小体积 JSON）交服务端 → 服务端读音频 → 送第三方 ASR（阿里云 NLS，driver 已在仓）
- 合规：不需要 ICP 备案、不需要自有域名；备案与小程序主体无关
- 成本：第三方 ASR 按量（阿里云 NLS 有免费额度）+ 云存储流量
- 周期：**最短**（无备案等待）
- 风险：命门是「个人主体该环境的云存储可用性」，标 unverified → 必须先跑 POC

**POC 三问（2026-10-19 实测，三点全过 → 方案 A 成立）**：

| #   | 命门                               | 结果    | 实证                                                                                                                                                  |
| --- | ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 个人主体能否 `wx.cloud.uploadFile` | ✅ 可以 | 真机/模拟器上下文实调：`statusCode 204`，返回 `cloud://prod-d6gaa83ds8accb61b.7072-*/poc/probe-*.txt`；环境存储本身经 `tcb storage list` 确认已开通   |
| 2   | `fileID` 能否直接出声（免域名）    | ✅ 能   | 生成真实 WAV（8k 单声道 440Hz）→ 上传 → `InnerAudioContext.src = fileID`，事件流 `play` → `ended`，`ok: true`（走 `cloud://` 私有协议，未配合法域名） |
| 3   | 服务端能否取到音频字节             | ✅ 可以 | 客户端 `getTempFileURL` → `https://7072-prod-*.tcb.qcloud.la/poc/tone-*.wav`；本机 side 拉取 `200` + **24044 bytes**，与上传文件等大                  |

- 探针形态：`e:\LsqCoding\_poc-voice\cloud-storage-probe.mjs`（**独立脚本，未改动 App 代码**；经 `miniprogram-automator` `mp.evaluate` 在真上下文执行）。
- 探针产物已清理：云端 `poc/` 目录已删除，存储回到空列表。
- 残留待验（不阻塞选型）：POC-3 的「服务端」侧由本机出网等价模拟，云托管容器**内**出网到 `*.tcb.qcloud.la` 未逐字实测 → 实施卡首步补一条容器内 fetch 自检。

### 方案 B（回退）：自备已备案域名（正规公网链路）

- 买域名 + 大陆服务器完成 ICP 备案（个人备案可行）→ 云托管绑**自定义域名** → 回填 `API_BASE_URL` → `uni.uploadFile`/`downloadFile` 走公网
- 上行：`uni.uploadFile` → 自有域名 → 服务端 ASR；下行：返回音频 URL → `InnerAudioContext` 播放
- 合规：完全正规，官方文档无任何争议
- 成本：域名 + 备案服务器 + 证书；周期：**备案数周**（各省不一，不可控）
- 风险：周期长；需开公网访问（官方明示无安全防护 → 必须自行鉴权，服务端 `requireAuth` 已在）

### 方案 C（零成本兜底）：维持文字作答降级

- 现状：字幕承担信息 + 文字作答，TTS 静默降级
- 成本/周期/风险：皆为零；立即可用
- 代价：丢失「语音面试」产品卖点

### 推荐

**A 为主 + C 兜底**：先跑 A 的 POC 三问；三点全过 → 按 A 落地（TTS 与 ASR 可分两批，**TTS 先落地**，因其只依赖下行 fileID 播放，链路最短、风险最低）。任一命门不过 → 退 B（评估备案周期可行性，并行启动备案）。C 始终作为降级路径保留。

**为什么不让「个人主体」卡死全链路**：官方文档显示 server 域名**本身不对个人设限**，真正卡住的是「微信同声传译插件类目」与「云开发深度合成类目」——因此绕过插件、改用「云存储 + 第三方 ASR + 服务端合成 TTS」是有官方依据的可行路线。

## 12. 用户裁决

- **2026-10-19（选路）**：在「跑 A 的 POC / 直接落地 TTS / 启动 B 备案 / 维持 C」四选项中，用户选定 **「跑方案 A 的 POC 三问」** → 已执行，三点全过（见 §11）→ 方案 A 由「候选」升级为**已实证可行**。
- **待裁决（下一步）**：是否按方案 A 落地及批次拆分。建议：**TTS 先行**（只依赖下行 `fileID` 播放，链路最短）、ASR 后置（依赖上传 + 第三方 ASR 账号）；落地须另立实施卡，涉及上传/转写契约时触发契约冻结。

## 13. 进度记录

| 日期       | 事项                   | 结果                                                                                                                                               |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | 走查确认症状           | 真机无音频进出、无转写上屏（用户确认）                                                                                                             |
| 2026-10-19 | 定位三断点             | manifest 未声明 wechatSI / `API_BASE_URL` 空 / `OpenAccessTypes=MINIAPP`                                                                           |
| 2026-10-19 | 官方核实（FA + MP-PM） | §10 表 13 条结论落定，含 a3「默认域名不可用」、d2「fileID 免域名播放」两条关键定性                                                                 |
| 2026-10-19 | 立卡交付               | 本卡 §11 方案对比与推荐；等用户裁决                                                                                                                |
| 2026-10-19 | 用户裁决选路           | 选「跑方案 A 的 POC 三问」                                                                                                                         |
| 2026-10-19 | POC 三问实测           | 三点全过：①uploadFile 成功（204 + `cloud://` fileID）②`fileID` 直接播放 `play→ended` ③`getTempFileURL` 公网链接可 fetch（200/24044B）→ 方案 A 成立 |
| 2026-10-19 | 探针清理               | 云端 `poc/` 已删、存储回空；App 代码零改动                                                                                                         |
