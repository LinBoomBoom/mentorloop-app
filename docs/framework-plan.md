# MentorLoop 小程序 & App 基础框架方案（uni-app x）

生成日期：2026-09-20
范围：根据 01–06 号文档，搭建可运行于「微信小程序 + Android/iOS App」的**基础框架**（同一套 uni-app x 代码库），不含后端真实服务与数字人美术资源。

---

## 1. 现状与差距

| 项         | 现状                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| 工作区     | `E:\LsqCoding\Mentorloop-app` 仅含 `.git`，无任何源码                       |
| 文档       | 已确认产品定位、功能、UI/UX、技术架构、里程碑、预算合规                     |
| 已冻结决策 | uni-app x 单代码库跨端；自研 2.5D 数字人；AI 引擎独立设计；首发 Java 后端岗 |
| 缺口       | 没有任何客户端脚手架、路由、设计系统、状态机或数据层基线                    |

结论：需要从 0 搭出符合文档架构的客户端骨架，使后续页面、UTS 插件、后端对接可在同一结构上并行展开。

---

## 2. 推荐方案

**采用 uni-app x 单一代码库**（与文档 04 结论一致）：70–80% 页面/业务/状态跨端复用，20–30% 实时音频、数字人渲染、设备权限封装为 UTS 原生插件占位。

| 维度   | 推荐方案                       | 备选方案                   | 取舍                                                |
| ------ | ------------------------------ | -------------------------- | --------------------------------------------------- |
| 框架   | uni-app x（uvue）              | 原生小程序 + 原生 App 双线 | 单代码库省维护，符合文档冻结决策                    |
| 跨端   | MP + Android + iOS 同库        | 仅 MP 首发                 | 文档要求 App Beta 跟随，同库分批上架                |
| 数据层 | Mock 优先 + 可替换 API 客户端  | 仅定义接口不实现           | Mock 让框架本地即可跑通流程，接口边界清晰可换真后端 |
| 状态机 | uts 单例 + 显式状态枚举        | Pinia                      | uni-app x 对 Pinia 支持有限，单例更稳、零依赖       |
| 数字人 | 占位 2.5D 组件（状态驱动动画） | 仅空容器                   | 占位让房间页可联调状态机，真实 UTS 渲染后续替换     |

---

## 3. 目录结构（拟建）

```text
Mentorloop-app/
├── manifest.json              # 应用配置（MP/App 双端、权限、模块）
├── pages.json                 # 路由 + tabBar + 全局样式
├── App.vue                    # 应用入口
├── main.uts                   # 入口（HBuilderX 自动注入，可选）
├── uni.scss                   # 主题变量（颜色/字号）
├── docs/framework-plan.md     # 本方案
├── pages/                     # 业务页面（uvue）
│   ├── index/index.vue            # 首页：Hero「开始面试」+ 入口
│   ├── interview/
│   │   ├── prep.vue                # 准备页：岗位/简历确认/设备检测
│   │   ├── room.vue                # 面试房间：数字人+字幕+控制条
│   │   └── summary.vue             # 面试总结（二次确认退出）
│   ├── report/report.vue           # 详细报告：总评/雷达/证据卡/训练计划
│   ├── training/training.vue       # 专项训练
│   ├── resume/resume.vue           # 简历优化
│   ├── growth/growth.vue           # 我的成长
│   └── mine/mine.vue               # 我的
├── components/                # 公共组件（uvue）
│   ├── ml-button.vue / ml-card.vue / ml-tag.vue / ml-nav-bar.vue
│   └── interviewer-avatar.vue     # 2.5D 数字人占位（状态驱动）
├── store/                     # 轻量状态（uts 单例）
│   ├── interview-session.uts      # 面试状态机 + 本地草稿
│   └── user-profile.uts           # 用户/登录态
├── api/                       # 数据访问层
│   ├── client.uts                # 统一请求/WS 客户端（封装 uni.request）
│   ├── interview.uts / resume.uts / report.uts
│   └── mock/                     # mock 数据（无后端时本地跑通）
├── utssdk/                    # UTS 原生插件接口（占位，真实实现后续）
│   ├── interviewer-audio/     # 录音/降噪/音频焦点/中断恢复
│   ├── interviewer-realtime/  # 流式 ASR/TTS/断线重连/缓冲
│   ├── interviewer-avatar/    # 口型/动作/缓存/渲染桥接
│   └── interviewer-device/    # 权限/网络/前后台/诊断
├── types/                     # 领域模型（uts 类型）
│   ├── interview.uts          # 会话/题目/状态机事件（含幂等键）
│   ├── scoring.uts            # 评分维度/报告
│   └── resume.uts
├── styles/theme.uts           # 颜色/字号常量（供 uts 引用）
└── static/                    # 图标/占位图（tabBar 图标需后续补 PNG）
```

---

## 4. 设计系统 Token（来自文档 03）

| Token              | 值                       | 用途                       |
| ------------------ | ------------------------ | -------------------------- |
| `--color-navy`     | 深海军蓝 `#0F2C4C`       | 面试房间背景（深色低干扰） |
| `--color-smart`    | 紫蓝 `#5B6CFF`           | 智能/进行中状态色          |
| `--color-reliable` | 青绿 `#1FB6A6`           | 完成/可靠状态              |
| `--color-bg-light` | `#F7F9FC`                | 普通学习页浅背景           |
| 正文               | 14–16px                  | 最小可读                   |
| 关键结论           | ≥18px                    | 报告/总评                  |
| 动效               | 尊重系统「减少动态效果」 | 仅表状态变化               |

---

## 5. 页面清单（9 个）

底部 tabBar（5 项）：`首页 / 专项训练 / 简历优化 / 我的成长 / 我的`。
`开始面试` 为首页 Hero CTA，进入 `prep → room → summary`，报告独立页。

| 页面              | 关键骨架内容                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| index             | 当前岗位、最近报告、下一项训练；Hero「开始面试」；次级入口                        |
| interview/prep    | 岗位选择、公司类型、时长/难度；设备检测（麦克风/网络/录音授权）未过给路径         |
| interview/room    | 顶部退出/网络/剩余时间；中部数字人；下部字幕+实时转写占位；底部录音/暂停/文字辅助 |
| interview/summary | 本次覆盖能力、题目数；结束二次确认                                                |
| report            | 第一屏：总评/最强项/最高优先级改进；雷达/证据卡/风险/训练计划                     |
| training          | 3/5/10 分钟碎片化训练；薄弱项一键加入计划                                         |
| resume            | 原句 vs 建议稿；AI 改写标「建议稿」，虚构数据醒目标记                             |
| growth            | 多场能力变化对比                                                                  |
| mine              | 账户、订阅、数据删除入口（隐私透明）                                              |

---

## 6. 面试状态机（来自文档 04）

`store/interview-session.uts` 实现显式状态枚举与迁移：

```text
CREATED → DEVICE_CHECK → READY → ASKING → LISTENING → TRANSCRIBING
→ FOLLOW_UP_DECISION → NEXT_QUESTION | WRAP_UP → REPORT_GENERATING → COMPLETED
```

- 所有关键事件带 `sessionId / questionId / eventSeq / idempotencyKey`。
- 客户端保存转写与作答草稿；网络恢复按序补传。
- 录音异常/切后台/来电/权限收回 → 可恢复状态，不静默丢答案。

---

## 7. UTS 插件接口（占位，真实原生实现后续）

`utssdk/` 下四个插件只定义**方法签名与回调契约**，不实现原生逻辑：

- `interviewer-audio`：`startRecord() / stopRecord() / onAudioFrame(cb) / requestFocus()`
- `interviewer-realtime`：`streamASR(audio) / playTTS(text) / onReconnect(cb)`
- `interviewer-avatar`：`setState(idle|asking|listening|followup|summary) / syncLip(phoneme)`
- `interviewer-device`：`checkPermission() / onNetworkChange(cb) / onForeground(cb)`

---

## 8. 数据/API 层（Mock 优先）

- `api/client.uts`：封装 `uni.request` + WebSocket，统一错误、重试、限流钩子。
- `api/interview.uts / resume.uts / report.uts`：以 `types/` 中领域模型为准定义函数签名。
- `api/mock/*`：首发无后端时返回结构化假数据，使全流程本地可跑通；切换真后端只改 `client` 指向。

---

## 9. 风险与对策

| 风险                                  | 对策                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| 本环境无 HBuilderX，无法编译/真机验证 | 严格按官方 uvue 约定写文件；交付后由你在 HBuilderX 打开运行；关键不确认点加注释 |
| uvue 样式能力受限（无复杂定位/阴影）  | 房间页用 flex 布局，动画放原生层/绘制层（文档 04 性能规则 1）                   |
| tabBar 需 PNG 图标                    | 框架先用文字 tabBar，图标留 `static/` 后续补                                    |
| 数字人无美术资源                      | 用 SVG/CSS 占位 2.5D 半身 + 状态机驱动表情/口型，真实资源后续替换               |
| 接口契约可能变动                      | 先冻结 `types/` 与 `api/*` 签名，前后端并行                                     |

---

## 10. 工作流拆解（分阶段、可逐步审查）

- **W1 工程基座**：`manifest.json` / `pages.json` / `App.vue` / `uni.scss` / `styles/theme.uts` —— 产出：可在 HBuilderX 打开并预览空壳的工程。
- **W2 设计系统与组件**：`components/*`（button/card/tag/nav-bar）+ 主题接入 —— 产出：可复用 UI 原子。
- **W3 领域模型与状态机**：`types/*` + `store/interview-session.uts` + `store/user-profile.uts` —— 产出：可单测的状态机（不依赖 UI/后端）。
- **W4 API/数据层**：`api/client.uts` + `interview/resume/report.uts` + `mock/*` —— 产出：本地可跑通的数据流。
- **W5 页面骨架**：9 个页面 uvue 文件，接 tabBar 与状态机 —— 产出：可导航的全站骨架。
- **W6 面试房间核心**：`room.vue` + `interviewer-avatar.vue` 占位 + 控制条 + 状态联动 —— 产出：核心流程可演示。
- **W7 UTS 插件接口**：`utssdk/*` 四个签名占位 —— 产出：原生能力接入点就绪。
- **W8 自测与文档**：逐页冒烟、README/运行说明、标注待补项 —— 产出：可交付审查的框架。

（每步完成后单独 commit，按模块不混改。）

---

## 11. 待用户拍板的决策点

见随附提问。确认后按 W1→W8 顺序执行。
