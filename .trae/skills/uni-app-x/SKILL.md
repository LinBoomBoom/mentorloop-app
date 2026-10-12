---
name: uni-app-x
description: uni-app x 平台开发权威知识库，覆盖项目结构、uvue/UTS 规范、组件与 easycom、uni API、ucss 样式子集、原生 SDK、运行调试与 vapor 性能。写 .uvue/.uts 或排查编译运行问题时使用。中文触发 uni-app x uvue UTS ucss 蒸汽模式 原生插件 真机调试。Do not use for 经典 uni-app。
metadata:
  version: '1.0.0'
  domain: mentorloop-app
  last_updated: '2026-10-12'
---

# uni-app x 平台知识库

基于官方知识库（HBuilderX uni-agent knowledge-repo）提炼的 uni-app x 开发权威参考。用于编写 `.uvue` / `.uts`、配置 `manifest.json` / `pages.json`、集成原生能力与 uts 插件、排查编译 / 运行 / 性能问题。

## 何时应用

- 编写或修改 `.uvue` 页面 / 组件、`.uts` 逻辑、`main.uts`、`App.uvue`。
- 配置 `manifest.json`（`uni-app-x` 节点 / 图标 / 权限 / 模块）、`pages.json`（页面注册 / globalStyle / tabBar / easycom）。
- 使用内置组件、easycom 自动导入、`$refs` / `$callMethod` 组件调用。
- 调用 `uni.*` API、uts 内置对象（`UTSAndroid` / `UTSiOS` / `UTSHarmony`）或平台原生 API。
- 编写 uts 插件（`uni_modules/utssdk`）、集成原生 SDK、混合开发联调。
- 真机运行、自定义基座、条件编译、静态资源处理、性能优化（蒸汽模式 / 启动时序）。

## 不负责

- **uni-app js 引擎版**（`.vue` + `main.js`）：判定标准是 `manifest.json` 中是否存在 `uni-app-x` 节点。无该节点即为 js 引擎版，本技能不适用。
- **通用 web 前端知识**（HTML/CSS/JS 完整布局、浏览器兼容）：本技能只覆盖 ucss 约束下的子集。
- **个别三方插件的 API**：本技能覆盖 uni_modules / uts 插件机制，插件自身 API 需查其文档。

## 本项目覆盖（优先级最高）

本仓库 `manifest.json` 的 `uni-app-x.vapor` 为 `true`（蒸汽模式）。以下项目硬约束**优先于本技能 references 中的通用描述**，若通用文档说"可以"而此处说"不许"，以本节为准。正本见根 `README.md` §5、`.trae/skills/mentorloop-system-spec`、`docs/sop/domain-uniappx-sop.md`。

- **组件范式**：只允许 `<script setup lang="uts">` 组合式；**禁选项式 API、禁 mixin**（references 称两者可混用，本项目不允许）。
- **UTS 类型**：对象类型只用 `type`，**禁 `interface`**；空值只用 `null`，**禁 `undefined`**；对象字面量必须 `as NamedType`。
- **样式（Tailwind 原子类）**：禁 `gap-*` / `space-*`（用 `mt-*` / `ml-*`）；禁透明度修饰符（用内联 `rgba()`）；禁复杂后代选择器；文字样式写在 `<text>` 上；单位 rpx。
- **Tailwind 管线**：CSS 生成由 `weapp-tailwindcss` 独占，勿再注册 `tailwindcss()` / `@tailwindcss/postcss` / `@tailwindcss/vite`；token 三处同步（`main.css` `@theme` ↔ `styles/theme.uts` ↔ `MASTER.md` §A1）。
- **模块边界**：`engine/` 纯逻辑（无 UI / 无 `uni.*`）；`api/` 是契约层（改动走 G1 契约冻结）；`utssdk/` 降级实现不得伪造结果。
- **构建产物纪律**：小程序端固定 `pnpm dev:mp-weixin`（CLI watch）+ 微信开发者工具导入 `dist/dev/mp-weixin`；HBuilderX 仅用于 App 真机调试；性能只认 release 包。
- **隐私红线**：不留存原始录音 / 音频；AI 不得改写原始证据或分数；面试房间内不展示实时分数。

## 能力优先级

| 优先级 | 主题     | 要点                                                                                 |
| ------ | -------- | ------------------------------------------------------------------------------------ |
| 高     | 项目身份 | `manifest.json` 必须有 `uni-app-x` 节点，否则被识别为 js 引擎版；入口是 `main.uts`。 |
| 高     | 页面注册 | 所有页面必须在 `pages.json` 注册，首页为 `pages` 首项；页面后缀必须 `.uvue`。        |
| 高     | uts 语法 | 联合类型仅支持 `\| null`；选项式 `data` 需 `as` 显式声明；可选属性返回需 `??` 兜底。 |
| 高     | CSS 子集 | App 端仅 flex 布局与绝对定位；仅 class 选择器；样式不继承；flex 默认纵向。           |
| 高     | 组件调用 | 内置组件用 `$refs` + `.`；非 easycom 组件用 `$callMethod`；组件名全小写连字符。      |
| 中     | 原生能力 | 规范做法是封装为 uts 插件；iOS JS 驱动模式下页面不可直接调 swift API。               |
| 中     | 性能     | 蒸汽模式仅支持组合式；谨慎在 `main.uts` 顶层 / `onLaunch` 写业务代码。               |
| 中     | 插件生态 | uni_modules 是官方插件方案，uts 插件编译为原生语言跨平台复用。                       |

## 如何使用本技能

1. 先读 `references/` 中与当前任务最相关的文档（见下表），再动手写代码。
2. 涉及具体 API / 组件 / 配置项时，核对平台兼容性（Android / iOS / HarmonyOS / Web / 小程序）。
3. 遇到编译错误，先对照 `references/uts-language.md` 的常见错误清单检查 uts 类型约束。
4. 涉及框架能力 / 版本兼容判断，按 `mentorloop-role-feasibility-analyst` 要求以官方文档核实，禁止凭直觉断言。

## 参考文档

| 文件                              | 说明                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| `references/project-structure.md` | 项目结构：manifest.json、main.uts、App.uvue、pages.json、静态资源目录 |
| `references/page-uvue.md`         | 页面与 uvue：SFC 规范、组合式/选项式、页面生命周期、蒸汽模式约束      |
| `references/uts-language.md`      | uts 语言：语法、类型、编译目标、uts 插件、常见编译错误                |
| `references/components.md`        | 组件：内置/ext/uvue/原生 uts 组件、easycom、调用方式                  |
| `references/api.md`               | API：uni.*、全局 API、uts 内置对象、平台原生 API、栈顶页面            |
| `references/css-styles.md`        | CSS（ucss）：flex 子集、选择器限制、优先级、条件编译、预编译          |
| `references/native-sdk.md`        | 原生 SDK：iOS/Android/HarmonyOS 混编、原生资源导出、包体积            |
| `references/run-debug.md`         | 运行调试：真机运行、标准/自定义基座、编译缓存、控制台日志             |
| `references/performance.md`       | 性能优化：启动时序、蒸汽模式、静态资源、编译缓存                      |
| `references/plugin-ecosystem.md`  | 插件生态：uni_modules、uts 插件、插件市场、web 生态兼容               |

## 快速判定（先问三件事）

1. **项目类型**：`manifest.json` 里有没有 `uni-app-x` 节点？有 → uni-app x（本技能适用）。
2. **平台**：目标是 Android / iOS / HarmonyOS / Web / 小程序中的哪些？影响编译目标与 API 兼容性。
3. **渲染模式**：`uni-app-x.vapor` 是否为 `true`？蒸汽模式仅支持组合式 API，写法需相应收敛（本项目为 `true`）。
