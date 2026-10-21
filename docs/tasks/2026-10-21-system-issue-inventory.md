# 系统问题清单（2026-10-21 基线）

> 性质：**现状盘点报告**（不新建需求，不替代任务卡）
> 口径：每条均已在代码/配置中取证，附文件与行号；未经证实的事项不列入。
> 上游：语音链路批次已全部落地并推送（`d53112f` → `a5e3b0b`，工作区干净）。
> 状态更新（2026-10-21）：P1-3 / P1-4 / P2-6 已由[批次 1+2 任务卡](./2026-10-21-voice-storage-hardening.md)关闭（代码 + 单测，G2/G3 通过）；真机走查与云端凭据联调待执行，见[验收结论](./2026-10-21-voice-storage-hardening.accept.md) §5。
> 状态更新（2026-10-21）：P1-2 已由[简历 AI 深度评审任务卡](./2026-10-21-resume-ai-review.md)关闭批次 1（真实抽取 + 证据锚定评审 + 历史 + 额度，G2/G3 通过）；批注版 PDF（批次 2）待启动，见[验收结论](./2026-10-21-resume-ai-review.accept.md) §5。
> 关联：[TTS 实施卡](./2026-10-19-mp-voice-tts-outbound.md) · [ASR 上行卡](./2026-10-21-mp-asr-upload-and-resume-picker.md) · [阶段汇报](./2026-10-20-mp-voice-channel-report.md)

## 1. 判定规则

| 标记          | 含义                                           |
| ------------- | ---------------------------------------------- |
| ✅ 已有最优解 | 代码机制或官方能力已具备，只差执行/接线        |
| 🔶 方向明确   | 路径已确认，但缺具体实现，属可控工作量         |
| ❓ 需决策     | 存在多个候选方案，取舍取决于产品/成本/合规判断 |

## 2. 总表

| #   | 优先级 | 问题                           | 类型          | 结论                              |
| --- | ------ | ------------------------------ | ------------- | --------------------------------- |
| 1   | P0     | 云端万能验证码仍放行           | 上线阻断/安全 | ✅ 已有最优解（只差执行）         |
| 2   | P1     | 简历解析与改写为占位实现       | 功能缺失      | ❓ 需决策（抽取 + 结构化选型）    |
| 3   | P1     | 单次录音无 60s 上限            | 功能体验/平台 | ✅ 已有最优解                     |
| 4   | P1     | 云存储对象堆积、注销不清云对象 | 资源/合规     | 🔶 方向明确（先去查生命周期规则） |
| 5   | P2     | 微信域名 TLS 校验被定向放宽    | 安全加固      | 🔶 方向明确（CA pinning）         |
| 6   | P2     | `cloud://` fileID 无属主校验   | 越权风险      | ✅ 已有最优解（路径前缀约定）     |
| 7   | P2     | 微信语音识别为旧接口           | 平台下线风险  | ✅ 已有最优解（降级 + 备选路径）  |
| 8   | P3     | TTS 超长文本静默截断           | 边界行为      | 🔶 方向明确                       |
| 9   | P3     | 凭据明文暴露面                 | 安全卫生      | ✅ 已有最优解（轮换）             |

## 3. 逐项详情

### P0-1 云端万能验证码仍放行

- **现状**：生产云托管 EnvParams 中 `MOCK_SMS_CODE=123456` 且 `ALLOW_WEAK_SMS_CODE=true`（部署 012 批次注入）。当前任何人输 `123456` 即可登录任意手机号。
- **证据**：[config.ts#L121](file:///e:/LsqCoding/Mentorloop-app/server/src/config.ts#L121) 读取放行阀；[config.ts#L181-L183](file:///e:/LsqCoding/Mentorloop-app/server/src/config.ts#L181-L183) 守卫只在「未显式放行」时拒绝启动。
- **影响**：上架即安全事故。
- **最优解 ✅**：机制已完备，无需改代码。发布前把云端 `MOCK_SMS_CODE` 改为随机值并删除 `ALLOW_WEAK_SMS_CODE`（或置 `false`），重启服务即恢复真实短信校验。
- **落点**：写入发布 checklist（[release 检查项]）；本地联调不受影响。

### P1-2 简历解析与改写为占位实现

- **现状**：`POST /resume/parse` 只把 `originalUrl` 入库，**完全不读取文件内容**，返回固定结果（3 个项目 / Java 栈 / 固定 gap）；`POST /resume/optimize` 同样返回固定建议稿。客户端已真实上传到云存储，但服务端未消费。
- **证据**：[resume.ts#L9-L37](file:///e:/LsqCoding/Mentorloop-app/server/src/services/resume.ts#L9-L37)（固定 payload）、[resume.ts#L40-L53](file:///e:/LsqCoding/Mentorloop-app/server/src/services/resume.ts#L40-L53)（固定建议）；[misc.ts#L50-L67](file:///e:/LsqCoding/Mentorloop-app/server/src/routes/misc.ts#L50-L67) 路由只透传 `fileUrl`，`name` 直接取 `basename(fileUrl)`（`cloud://` 场景下文件名会退化）。
- **影响**：用户上传的简历对结果零影响，"解析"名不副实；这是用户已明确指出的错误预期。
- **需决策 ❓**，三个必须回答的问题：
  1. **输入格式范围**：仅 PDF/DOCX？相册入口选的图片是否支持（OCR 还是直接拒绝并提示）？
  2. **抽取实现**：自建文本抽取 + 规则映射，还是接 LLM 做结构化（成本/延迟/失败重试）？
  3. **失败语义**：抽取失败时是降级为空结果、还是明确提示"无法解析请重传"，契约出参是否需新增字段（当前出参已冻结，加字段属契约变更）。
- **前置校验缺口**：客户端与服务端均无文件大小/页数/类型校验。
- **建议**：单独立卡，先做"格式白名单 + 失败降级"，再做真实抽取，避免一次改到契约。

### P1-3 单次录音无 60s 上限

- **现状**：小程序录音启动参数只有格式/采样率/声道/码率，无 `duration` 上限；房间页 `startRecord()` 也无计时器。微信 ASR 硬限 1MB / 60s，超限后服务端按 1MB 校验失败 → 降级空文本 → 用户只看到"没听清，请重录"。
- **证据**：[speech.uts#L311-L316](file:///e:/LsqCoding/Mentorloop-app/api/speech.uts#L311-L316)（无 duration）、[asr-wx.ts#L19](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-wx.ts#L19)（1MB 硬限）、[room.uvue#L578](file:///e:/LsqCoding/Mentorloop-app/pages/interview/room.uvue#L578)（无时长保护）。
- **最优解 ✅**：客户端 `recorder.start({ duration: 55000 })` + 录音 UI 倒计时/到时自动停止并直接送转写。留 5s 余量防临界超限。
- **工作量**：小，单点改动，无需契约变更。

### P1-4 云存储对象堆积、注销不清云对象

- **现状**：①TTS 每合成一段就在 `tts/<tag>/<ymd>/` 留一个 mp3，永久堆积（仅测试期已残留 12 个）；②简历改走 `cloud://` fileID 后，注销逻辑只匹配本地 `resumes/` 前缀，云对象永不删除；③ASR 录音已做到客户端 best-effort 删除 + 服务端临时文件及时清理，此项无问题。
- **证据**：[tts.ts#L270](file:///e:/LsqCoding/Mentorloop-app/server/src/services/tts.ts#L270)（写入路径）、[me.ts#L43-L53](file:///e:/LsqCoding/Mentorloop-app/server/src/routes/me.ts#L43-L53)（只收集 `resumes/` 本地文件）。
- **方向明确 🔶**：
  1. 先查证 **TCB 存储是否支持按前缀配置生命周期规则**（支持则 `tts/` 配 7 天自动过期，是最省事的最优解）；
  2. 不支持则改代码：TTS 播完即删（需权衡重复念题是否重合成）或按 `tts/<uid>/` 归档后随注销清理；
  3. 注销逻辑补一条：收集该用户全部 `cloud://` fileID → 调 `/tcb/batchdeletefile` 批量删除。
- **注意**：这属于「合规 + 成本」双重要求，注销不清理云上简历是明确的合规缺口。

### P2-5 微信域名 TLS 校验被定向放宽

- **现状**：容器访问 `api.weixin.qq.com` 被云托管「云调用」网关用自签证书接管，Node fetch 报 `DEPTH_ZERO_SELF_SIGNED_CERT`。当前实现对命中自签错误码的请求改用 `node:https` + `rejectUnauthorized:false`。
- **证据**：[wx-http.ts#L12](file:///e:/LsqCoding/Mentorloop-app/server/src/services/wx-http.ts#L12)（错误码白名单）、[wx-http.ts#L67](file:///e:/LsqCoding/Mentorloop-app/server/src/services/wx-http.ts#L67)（放宽点）。
- **影响**：仅对 weixin 域名降级，TTS 等其它域名仍严格校验；但本质是"放弃校验"，属于可被中间人利用的口子（当前仅内网出网链路）。
- **方向明确 🔶**：抓取网关自签证书链 → 用 `NODE_EXTRA_CA_CERTS` 指定信任锚 → 删除放宽分支，恢复严格校验。若证书轮换频繁，需配自动更新。
- **已排除**：小程序后台（开发设置 / 服务设置 / 微信网关）与控制台均无「开放接口服务」开关可关，控制台侧无解，只能代码侧处理。

### P2-6 `cloud://` fileID 无属主校验

- **现状**：`/interview/asr-cloud` 与 `/resume/parse` 都只校验 `cloud://` 前缀，任何登录用户可传他人 fileID 读取内容（ASR 会把他人录音转写成文本返回）。
- **证据**：[asr-cloud.ts#L17-L19](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-cloud.ts#L17-L19)（唯一校验是前缀）、[misc.ts#L63-L66](file:///e:/LsqCoding/Mentorloop-app/server/src/routes/misc.ts#L63-L66)（`fileUrl` 无格式约束）。
- **影响**：当前简历解析是占位实现，危害有限；**简历真实解析上线后立即升级为越权读取**，必须与 P1-2 同批处理。
- **最优解 ✅**：客户端上传路径约定 `asr/<uid>/...`、`resumes/<uid>/...`；服务端校验 fileID 中必须包含当前 uid 段，否则 403。

### P2-7 微信语音识别为旧接口

- **现状**：`addvoicetorecofortext` / `queryrecoresultfortext` 官方文档挂在「服务号 → 智能接口」分类下，小程序可调用但存在限流/下线风险；且有 10s 内查询的时效要求。
- **证据**：[asr-wx.ts#L120](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-wx.ts#L120)、[asr-wx.ts#L145](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-wx.ts#L145)。
- **最优解 ✅**：失败即诚实降级（返回空文本，不伪造、不阻塞）；备选路径明确——切腾讯云 ASR（已有腾讯云账号与签名基础设施，改动集中在 `asr-wx.ts` 一个驱动）。触发条件：出现连续限流或官方公告下线时切换。

### P3-8 TTS 超长文本静默截断

- **现状**：超过 200 字直接 `substring` 截断，调用方无感知，用户听到的是半句话。
- **证据**：[tts.ts#L13](file:///e:/LsqCoding/Mentorloop-app/server/src/services/tts.ts#L13)、[tts.ts#L36](file:///e:/LsqCoding/Mentorloop-app/server/src/services/tts.ts#L36)。
- **影响**：当前题干均短于 200 字，暂不触达；追问文本增长后可能命中。
- **方向明确 🔶**：①长度超限时按句子切分多次合成 + 客户端顺序播放；或 ②换长文本接口（单次上限需查证官方文档）。属边界行为，非阻塞。

### P3-9 凭据明文暴露面

- **现状**：腾讯云子用户密钥、`WX_SECRET` 在调试过程中出现过明文（对话与任务卡排查记录）；`server/.env` 为明文（已 gitignore，未入库）。
- **最优解 ✅**：上线前在 CAM 控制台轮换子用户密钥、在公众平台重置 AppSecret，并回写云端环境变量；同步排查任务卡中是否有残留明文需脱敏。

## 4. 建议批次

| 批次   | 内容                                   | 性质                   |
| ------ | -------------------------------------- | ---------------------- |
| 批次 1 | P1-3 录音时长上限 + P3-8 截断提示      | 纯客户端/小改，可并行  |
| 批次 2 | P1-4 云存储清理 + P2-6 fileID 属主校验 | 服务端改动，同属数据面 |
| 批次 3 | P1-2 简历真实解析（含契约变更评估）    | 需先决策，单独立卡     |
| 批次 4 | P2-5 CA pinning 恢复严格校验           | 证书链取证后实施       |
| 批次 5 | P0-1 + P3-9 发布前安全收口             | 发布 checklist 条目    |

## 5. 证据来源

- 代码：[config.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/config.ts) · [resume.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/resume.ts) · [tts.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/tts.ts) · [asr-wx.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-wx.ts) · [asr-cloud.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/asr-cloud.ts) · [wx-http.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/services/wx-http.ts) · [me.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/routes/me.ts) · [misc.ts](file:///e:/LsqCoding/Mentorloop-app/server/src/routes/misc.ts) · [speech.uts](file:///e:/LsqCoding/Mentorloop-app/api/speech.uts) · [asr.uts](file:///e:/LsqCoding/Mentorloop-app/api/asr.uts)
- 卡片：[ASR 上行卡 §11 遗留](./2026-10-21-mp-asr-upload-and-resume-picker.md) · [TTS 实施卡 §13/§14/§15](./2026-10-19-mp-voice-tts-outbound.md)
- 平台侧：微信小程序后台三处设置页枚举（无「开放接口服务」开关）；微信 ASR 官方文档硬限 1MB/60s；云托管默认域名不可配小程序服务器域名。
