# MentorLoop 小程序 & App 基础框架（uni-app x）

学面一体·智能导师 — AI 数字人面试训练产品客户端基础框架。
同一套 uni-app x 代码库，编译到 **微信小程序 + Android + iOS**。

## 文档来源
依据工作台 `MentorLoop_0x_*.md` 系列（项目定位 / 功能 / UI-UX / 技术架构 / 研发运营 / 预算合规）搭建。

## 技术结论
- 框架：uni-app x（uvue 页面 + UTS 原生插件隔离平台差异）。
- 数据：Mock 优先。`api/BASE_URL` 留空即走 `api/mock/*` 假数据，本地即可跑通全流程；接真后端只改 `BASE_URL`。
- 状态机：`store/interview-session.uts` 实现文档 04 的 `CREATED→…→COMPLETED` 状态枚举与迁移，事件带幂等键。
- 数字人：`components/interviewer-avatar.vue` 为状态驱动 2.5D 占位，真实 UTS 渲染由 `utssdk/interviewer-avatar` 后续替换。

## 目录结构
```text
manifest.json / pages.json / App.vue / uni.scss   工程配置 + 主题
pages/          9 个页面（首页/准备/房间/总结/报告/训练/简历/成长/我的）
components/     公共组件 + 数字人占位
store/          面试状态机单例 + 用户态
types/          领域模型（interview/scoring/resume）
api/            请求客户端 + interview/resume/report + mock 假数据
utssdk/         四个 UTS 原生插件接口占位（audio/realtime/avatar/device）
styles/theme.uts 设计系统 Token（与 App.vue CSS 变量对齐）
docs/framework-plan.md  开工前技术方案与工作流
```

## 运行方式（需在 HBuilderX 中）
1. 用 HBuilderX 打开本目录（识别为 uni-app x 工程）。
2. 微信小程序：右上「运行 → 运行到小程序模拟器 → 微信开发者工具」。
3. App：连接真机或模拟器，「运行 → 运行到手机或模拟器」。
4. 真机音频/数字人/弱网 POC 见文档 04 §6，须经真机验收。

## 设计系统
| Token | 值 | 用途 |
|---|---|---|
| navy `#0F2C4C` | 面试房间深色背景 |
| smart `#5B6CFF` | 智能/进行中状态色 |
| reliable `#1FB6A6` | 完成/可靠 |
| bg-light `#F7F9FC` | 学习页浅背景 |

CSS 变量在 `App.vue` 的 `page` 中定义，页面通过 `var(--color-*)` 引用。

## 已知占位 / 待补项
- **tabBar 图标**：当前为纯文字 tab，需在 `static/` 补充 5 组 PNG 图标并在 `pages.json` 配置。
- **UTS 原生插件**：`utssdk/*` 仅方法签名与降级实现，真实录音/ASR/TTS/渲染需原生层（`app-android`/`app-ios`）补充。
- **后端服务**：当前全 Mock；正式的会话编排、评分、简历解析需对接文档 04 服务端。
- **数字人美术**：占位为 SVG/CSS 半身，真实 2.5D 角色/动作/口型资源需美术产出并接入 `avatar` 插件。

## 本环境说明
当前开发环境无 HBuilderX，无法编译/真机验证，文件严格按 uni-app x（uvue）官方约定编写；请在 HBuilderX 中打开运行，并对 uvue 受限 CSS（复杂定位/阴影）做真机核对。
