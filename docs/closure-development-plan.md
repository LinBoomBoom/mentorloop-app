# MentorLoop 闭环补齐开发计划

生成日期：2026-09-24
依据：`MentorLoop_00`–`MentorLoop_06`、`framework-plan.md`、`engineering-toolchain-plan.md`、`project-execution-plan.md`、`README.md` 及当前代码库逐文件盘点。
定位：本文档是 `project-execution-plan.md` 的**补充执行清单**，只聚焦"业务闭环尚未形成"的部分，不重复里程碑与预算内容。范围变更须经产品负责人确认。

---

## 0. 结论摘要

当前状态：**前端交互闭环 ≈ 完成；业务闭环 ≠ 完成。**

- 已跑通（Mock 数据下）：首页 → 设备检测 → 面试房间 → 总结打分 → 报告 → 训练 / 成长 / 会员门控。
- 未闭环的三类根因：
  1. **无后端**：`api/client.uts` 的 `BASE_URL` 为空，全部请求走 `api/mock/*`，数据不可跨设备、评分/报告非真实 AI 产出、支付无真实回调。
  2. **原生能力为占位**：`utssdk/` 四个插件仅契约与降级实现，App 端 ASR 直接抛错，数字人为 CSS 静态形象。
  3. **两条支线断裂**：简历线的"保存/导出"仅 toast；训练线"报告薄弱项 → 定向训练 → 结果回写"未打通。

---

## 1. 闭环缺口总览

| 编号 | 缺口                              | 依赖        | 优先级 |
| ---- | --------------------------------- | ----------- | ------ |
| 1    | 训练闭环未打通（定向出题 + 回写） | 无（前端）  | P0     |
| 2    | 简历线断裂（保存 / 导出）         | 无（前端）  | P0     |
| 3    | 题库与岗位内容不足                | 无（内容）  | P0     |
| 4    | "我的"页多处 toast 占位           | 无（前端）  | P0     |
| 5    | 后端服务为 0                      | 后端        | P1     |
| 6    | 评分 / 报告未接 LLM               | 后端 + AI   | P1     |
| 7    | 真实微信支付未接入                | 后端        | P1     |
| 8    | 跨设备数据同步为 0                | 后端        | P1     |
| 9    | `interviewer-audio` 原生实现为 0  | 原生        | P2     |
| 10   | `interviewer-realtime` 为 0       | 原生        | P2     |
| 11   | `interviewer-avatar` 为 0         | 原生 + 美术 | P2     |
| 12   | `interviewer-device` 为 0         | 原生        | P2     |
| 13   | App 端 ASR 不可用                 | 原生 + 后端 | P2     |
| 14   | 未经真机编译验证                  | 工程        | P3     |
| 15   | 测试覆盖不足                      | 工程        | P3     |
| 16   | 合规项未落地                      | 合规        | P3     |

---

## 2. P0 · 前端可独立闭环（不依赖后端 / 原生）

> ⚠️ 本节各小节的「现状 / 待办」是 **2026-09-24 的断点描述**，保留作历史留痕；**最新复核状态见 §8（2026-10-15）**。阅读排期时以 §7 + §8 为准。

### 2.1 训练闭环真正打通（最高优先）

**现状**

- 报告页训练计划卡片点击只 `switchTab`，不携带任务参数：`pages/report/report.uvue` → `goTraining()`。
- 训练房间出题仅按岗位蓝图随机选，不使用 `taskId` / 维度过滤：`pages/training/room.uvue` → `nextQuestion()`。
- 训练完成后仅弹 toast 并返回，结果不落库：`pages/training/room.uvue` → `finishTraining()`。
- 成长页只读取面试报告，不含训练记录：`pages/growth/growth.uvue`。

**待办**

1. 报告页训练计划卡片带参跳转（`taskId` / `dimension` / `durationMin` / `source=report`）。
2. 扩展 `engine/question-selector.uts` 的 `selectNext()` 支持按维度 / 知识点过滤，训练房间按传入任务定向出题。
3. 新增 `store/training-history.uts`，训练完成写入记录（含错因分类：不会 / 说不清 / 项目证据不足 / 推理不完整 / 表达结构差，见文档 02 §2.3）。
4. 成长页合并展示面试报告与训练记录，支持按维度追溯。

**涉及文件**：`pages/report/report.uvue`、`pages/training/room.uvue`、`engine/question-selector.uts`、`store/training-history.uts`（新增）、`pages/growth/growth.uvue`

> 📌 2026-10-15 更正：`pages/growth/growth.uvue` 已随 IA 收敛（任务卡 `2026-10-14-ia-consolidation.md`）删除，其职责由 `components/ml-growth-panel.uvue` 在报告页「成长趋势」分段承接。原文「成长页」一律读作「报告页 · 成长趋势分段」。

**闭环判定标准**：报告薄弱项点进去，出的是该维度题；训练结果在成长页可追溯、可与面试报告对照。

---

### 2.2 简历线闭环

**现状**

- 解析与改写建议可产出，但"保存改写""导出投递版本"只有 toast：`pages/resume/resume.uvue` → `saveAll()` / `exportVersion()`。
- 三个投递版本为静态配置，未按岗位动态生成。

**待办**

1. 新增 `store/resume-draft.uts`，`saveAll()` 真实持久化（本地存储）。
2. 导出真实生成文件（小程序写临时文件 / 复制；App 走文件系统），替换现有 toast。
3. 投递版本改为按目标岗位动态生成（复用 `optimizeResume` 契约）。

**涉及文件**：`pages/resume/resume.uvue`、`store/resume-draft.uts`（新增）、`api/resume.uts`

**闭环判定标准**：改动能保存、能导出、重进页面仍在；投递版本内容随岗位变化。

---

### 2.3 题库与岗位内容补齐

**现状**

- 题库仅 25 题，且只有 `java-backend` 可用，其余 3 个方向置灰：`data/position-options.uts`。

**待办**

1. 按文档 02 §3.1 为每个新岗位补 ability-map 与 question-bank。
2. 在 `POSITION_OPTIONS` 中打开对应岗位的 `available`。
3. 内容需经产品与内容审核确认（文档 05 §3）。

**涉及文件**：`data/position-options.uts`、`data/*-map.uts`（新增）、`data/question-bank.uts`

**闭环判定标准**：至少第二个岗位（如前端）端到端可完成面试并出报告。

---

### 2.4 "我的"页功能落地或明确置灰

**现状**：账号与安全、面试偏好、隐私与数据、关于均为 toast 占位：`pages/mine/mine.uvue`。

**待办**：能做的落地（面试偏好写入 `userStore.profile`），暂不能做的标注"即将上线"，不用假 toast 冒充已完成。

**涉及文件**：`pages/mine/mine.uvue`、`store/user-profile.uts`

---

## 3. P1 · 需要后端（前端契约已预留，填 `BASE_URL` 即可切换）

### 3.1 后端服务与网关

`api/client.uts` 的 `BASE_URL` 目前为空。需实现端点（契约已在各 api 文件注释中冻结）：

| 域   | 端点                                                                 | 契约来源             |
| ---- | -------------------------------------------------------------------- | -------------------- |
| 面试 | `/interview/session`、`/interview/next`、`/interview/answer`         | `api/interview.uts`  |
| ASR  | `/interview/asr`（multipart 音频上传）                               | `api/asr.uts`        |
| 简历 | `/resume/parse`、`/resume/optimize`                                  | `api/resume.uts`     |
| 报告 | `/report`                                                            | `api/report.uts`     |
| 认证 | `/auth/sms-code`、`/auth/login`、`/auth/wechat`                      | `api/auth.uts`       |
| 会员 | `/membership/order`、`/membership/quota`、`/membership/order/notify` | `api/membership.uts` |
| 埋点 | `/track/batch`                                                       | `api/tracking.uts`   |

**要求**：客户端与后端先冻结接口契约再并行（文档 05 协同铁律）；额度与权益以服务端为准。

---

### 3.2 评分 / 报告接 LLM

**现状**：规则 v1 关键词打分，`motivation` 维度固定给 B：`engine/scorer.uts`。

**待办**：保留规则分作为锚点，LLM 只负责解释与优秀回答示例生成，**不得修改已确认的原始证据与分数**（文档 02 §3.5）。

**涉及文件**：`engine/scorer.uts`、`api/report.uts`、`engine/rubric.uts`

---

### 3.3 真实微信支付

**现状**：Mock 直接发放权益；`requestWxPay` 已封装但无后端订单：`api/membership.uts`。

**待办**：接入后端创建订单 + 微信支付回调，`/membership/quota` 以服务端账本为准。

---

### 3.4 跨设备数据同步

登录态、报告历史、训练记录、简历草稿需随账号同步，替换当前纯本地存储。

---

## 4. P2 · 需要原生插件（`utssdk/` 现为占位）

| 编号 | 插件                   | 待实现                                      | 现状                                                   |
| ---- | ---------------------- | ------------------------------------------- | ------------------------------------------------------ |
| 9    | `interviewer-audio`    | 录音、降噪、音频焦点、中断恢复              | `utssdk/interviewer-audio/index.uts` 仅 `console.warn` |
| 10   | `interviewer-realtime` | 实时音频通道                                | 占位                                                   |
| 11   | `interviewer-avatar`   | 2.5D 数字人渲染（口型 / 表情 / 姿态状态机） | 当前为 `components/interviewer-avatar.uvue` CSS 形象   |
| 12   | `interviewer-device`   | 设备检测                                    | 占位                                                   |
| 13   | App 端 ASR             | 打通云端转写                                | `api/asr.uts` Mock 下抛 `ASR_MOCK_UNAVAILABLE`         |

**要求**：数字人需美术资产先行；口型 / 音频帧不进响应式状态（文档 04 性能规则）。

---

## 5. P3 · 工程与合规

1. **真机编译验证**：README 明确标注未在 HBuilderX 编译验证，需跑通小程序 / Android / iOS 三端。
2. **测试覆盖**：当前仅状态机单测（`tests/`），需补选题器、评分器、闭环 E2E。
3. **合规**：ICP / App 备案、隐私政策与用户协议真实链接（登录页现为文案）、数据自助删除入口（`pages/mine/mine.uvue` 现仅提示）。

---

## 6. 建议执行顺序

1. **P0-2.1 训练闭环** —— 不依赖后端，做完即可让"面试 → 报告 → 训练 → 成长"从半闭环变为真闭环，收益最大。
2. P0-2.2 简历线闭环、P0-2.4 "我的"页落地 —— 同为纯前端，可与 2.1 并行。
3. P0-2.3 题库扩充 —— 内容工作，可与后端并行推进。
4. P1 后端契约冻结 → 后端服务 → 评分 LLM / 支付。
5. P2 原生插件（数字人美术资产需提前启动）。
6. P3 工程与合规随发布节奏收口。

---

## 7. 状态跟踪表

| 编号 | 项                     | 状态                                                                                                                                                                                                                                                                                                                             | 负责人 | 验收结论 |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| 1    | 训练闭环打通           | ✅ 已完成（2026-09-24）                                                                                                                                                                                                                                                                                                          |        |          |
| 2    | 简历线闭环             | ✅ 已完成（2026-09-24）                                                                                                                                                                                                                                                                                                          |        |          |
| 3    | 题库与岗位补齐         | ✅ 已完成（2026-09-24）                                                                                                                                                                                                                                                                                                          |        |          |
| 4    | "我的"页功能落地       | ✅ 已完成（2026-09-24）                                                                                                                                                                                                                                                                                                          |        |          |
| 5    | 后端服务与网关         | ✅ P1.1 已完成（2026-09-24：登录/面试/报告/简历/配额/埋点真后端；ASR 降级、支付 stub 待 P1.2/P1.3）                                                                                                                                                                                                                              |        |          |
| 6    | 评分 / 报告接 LLM      | ✅ P1.2 已完成（2026-09-24：规则分锚点 + LLM 解释/优秀示例；可配置默认关闭，失败回退纯规则）                                                                                                                                                                                                                                     |        |          |
| 7    | 真实微信支付           | ✅ P1.3 已完成（2026-09-24：双模式——mock 下单即发放 / wx 模式 JSAPI 下单 + v3 回调验签与 AES 解密 + 幂等发放；真实联调待商户资质）                                                                                                                                                                                               |        |          |
| 8    | 跨设备数据同步         | ✅ 已完成（2026-09-24：GET /me/reports 报告历史随账号同步，前端真后端模式先展示本地再异步刷新；训练/简历草稿仍本地并在页面标注）                                                                                                                                                                                                 |        |          |
| 9    | `interviewer-audio`    | ✅ P2-9 已完成（2026-09-24：Android 原生层 MediaRecorder(VOICE_COMMUNICATION 降噪)+ 音频焦点 + 中断恢复；index.uts 跨端契约/降级；已接线 api/speech.uts 增强优先；原生编译验证归 P3-14）                                                                                                                                         |        |          |
| 10   | `interviewer-realtime` | ✅ P2-10 已完成（2026-09-24：WS 传输/指数退避重连/离线缓冲/TTS 播放；App 端流式识别已接线；服务端 /ws/realtime 契约已冻结待实现）                                                                                                                                                                                                |        |          |
| 11   | `interviewer-avatar`   | ✅ P2-11 渲染桥已完成（2026-09-24：跨端契约（状态机/资产插槽位/预加载/释放）+ 资产清单 `data/avatar-assets.uts` + 组件接线（有帧图渲染帧图，无资产自动降级 CSS 形象）；2.5D 原生渲染与口型状态机待美术资产 + 原生层（app-android），美术资产先行）                                                                               |        |          |
| 12   | `interviewer-device`   | ✅ P2-12 已完成（2026-09-24：跨端 UTS 实现——checkPermission（只读授权+网络，不弹窗）/onNetworkChange/onForeground/diagnose（mic: ok/denied/unavailable，net: ok/none，失败返回 unknown 不伪造）；prep 页接入只读预检 + 断网即时提示；Android 原生增强（RECORD_AUDIO 细粒度/AudioManager）留 app-android 扩展，真机验证归 P3-14） |        |          |
| 13   | App 端 ASR             | ✅ P2-13 已完成（2026-09-24：服务端 ASR 驱动注册表 stub/aliyun + multipart 上传端点（鉴权/落盘/清理）；默认 stub 明确降级不伪造转写；aliyun NLS FileTrans 签名与轮询实现（需云账号密钥 + 对象存储公网链接，真实联调待部署项））                                                                                                  |        |          |
| 14   | 真机编译验证           | 🟡 进行中（小程序端 `pnpm build:mp-weixin` 已多次跑通并核验构建产物；Android / iOS 两端未验；真机交互走查归 G3）                                                                                                                                                                                                                 |        |          |
| 15   | 测试覆盖               | 🟡 部分完成（2026-10-15 复核：`tests/` 6 个 spec；`pnpm test` 89 用例全绿；`tests/evals/` 固定评测集 25 条覆盖选题/追问/评分三层，基线见 `docs/evals/2026-09-24-baseline-v1.md`；服务端 `server/src/*.spec.ts` 齐备。缺口：客户端**闭环 E2E** 与 UI 层自动化仍缺）                                                               |        |          |
| 16   | 合规项                 | 🟡 部分完成（2026-10-15 复核：数据自助删除入口已落地——`pages/mine/security.uvue` 注销账号双重确认 + `api/auth.uts` `deleteAccount()` 幂等；ICP/App 备案、隐私政策与用户协议真实链接仍未核）                                                                                                                                      |        |          |

---

## 8. 2026-10-15 复核记录（P0 缺口盘点）

复核方式：逐项对照 §2 的「待办 / 闭环判定标准」与当前代码真值（文件 + 行号）。
**结论：§2 描述的 P0 断裂项已全部修复；P0 口径内无实质缺口残留。** §2「现状」未回写（已加节首警示），另修正 4 处 stale 登记。

| 缺口               | 台账 §2 声称的现状                                                                    | 代码真值（2026-10-15）                                                                                                                                                                                                                                                                                                   | 差距                                                                        |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 2.1 训练闭环       | 报告卡只 `switchTab` 不带参；训练房间不按维度出题；训练结果不落库；成长页不含训练记录 | 全链路打通：`pages/report/report.uvue` `startPlanTask()` 带 `taskId/title/durationMin/source=report/domain`；`pages/training/room.uvue` 接 `domain` 并 `selectNext({ focusDomain, maxQuestions })`；`finishTraining` 写 `store/training-history.uts`；`components/ml-growth-panel.uvue` 合并 `trainingHistory.recent(5)` | **已闭环**。唯一偏差：判定标准中的「成长页」已删，由 `ml-growth-panel` 承接 |
| 2.2 简历线         | 保存 / 导出只 toast；投递版本为静态配置                                               | `pages/resume/resume.uvue`：`saveAll()` 经 `resumeDraft.save()` 真持久化；`exportVersion()` 按岗位 + 采用标记 `buildResumeContent()` 生成内容 → `addVersion()` 持久化 → `writeVersionFile()` 写文件 + 剪贴板保底；重进页面有草稿提示 `refreshDraftHint()`                                                                | **已闭环**。投递版本仍为 3 个固定 `name`（内容按岗位动态生成），非阻断      |
| 2.3 题库与岗位内容 | 题库仅 25 题，且只有 `java-backend` 可用，其余 3 个方向置灰                           | 25 题（`data/question-bank.uts`，含 2 条 wrapup）；`data/position-options.uts` 中 `frontend` / `backend` 均 `available: true`（`devops` / `ai` 仍 false）                                                                                                                                                                | **判定标准达成**（第二个岗位可端到端）。扩到 devops/ai 仍属内容待办         |
| 2.4「我的」页      | 账号与安全 / 面试偏好 / 隐私与数据 / 关于 均为 toast 占位                             | `pages/mine/mine.uvue` 四入口均 `navigateTo` 真实页面（`security` / `prefs` / `privacy` / `about`，页面文件齐备），无假 toast                                                                                                                                                                                            | **已闭环**                                                                  |

### 8.1 本次修正的 stale 登记

| #   | 位置                     | 原登记                          | 修正后                                                                       |
| --- | ------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| 1   | §2.1 涉及文件 / 判定标准 | 引用 `pages/growth/growth.uvue` | 加更正批注：已随 IA 收敛删除，改由报告页「成长趋势」分段承载                 |
| 2   | §7 第 14 行 真机编译验证 | 未开始                          | 🟡 进行中（小程序端编译已通，Android / iOS 未验）                            |
| 3   | §7 第 15 行 测试覆盖     | 未开始                          | 🟡 部分完成（6 spec / 89 用例 / 25 条评测集；缺客户端闭环 E2E 与 UI 自动化） |
| 4   | §7 第 16 行 合规项       | 未开始                          | 🟡 部分完成（数据自助删除入口已落地；备案与协议链接未核）                    |

### 8.2 复核后的执行顺序（接 §6）

P0 已清空，后续按 §6 第 6 条收口：P3 真机编译验证（App 两端）→ 客户端闭环 E2E 补测 → 合规公示项；内容侧可并行推进 2.3 的 devops / ai 题库。
