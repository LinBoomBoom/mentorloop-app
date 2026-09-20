# MentorLoop 工程化工具链方案（Vue Vapor + Tailwind CSS 原子化）

生成日期：2026-09-20。版本事实均经联网核实（截至 2026-09-20）。

---

## 1. 关键结论与一处更正

### 更正：Tailwind 在 uni-app x 上「可行」
上一轮我说 uni-app x 不支持 Tailwind，**该结论错误**。核实结果：
`weapp-tailwindcss` v5 已支持 **uni-app x + Tailwind CSS 4**，通过 `uniAppX()` preset 接入，已验证 Web / 微信小程序 / Android / iOS / 鸿蒙。

### 更正 2：uni-app x「支持」Vapor —— 我上轮结论错误
上一轮我推断"Vapor 编译为直接 DOM 操作 → 小程序/原生 App 无 DOM → 不可用"。**该结论错误**，因为它是原理推断、未查阅官方文档。

查阅 uni-app x 官方文档《蒸汽模式》（https://uniapp.dcloud.net.cn/uni-app-x/app-vapor.html ，2026/9/17 更新）原文：

> 蒸汽模式，即 vapor，是 vue3 的新功能，去掉了虚拟 DOM。
> uni-app x 的蒸汽模式，包含了去掉虚拟 DOM 的 vue 框架，**以及 App 平台的一套基于原生渲染管线的、超过原生渲染速度的全新渲染引擎**。

关键：DCloud 并未依赖 DOM 实现 Vapor，而是为 App 平台自建**原生渲染管线**（可编译为 bytecode / nativecode），从而绕开了"无 DOM"限制。

### 蒸汽模式官方支持矩阵
| 平台 | 支持蒸汽模式所需 HBuilderX |
|---|---|
| 鸿蒙 HarmonyOS | 5.0+ |
| iOS | 5.11+ |
| Android | 5.21+ |
| **小程序 / Web** | **当前降级为 VDOM 模式运行，官方称后续升级为蒸汽模式** |

启用：`manifest.json` → `uni-app-x` 节点 → `vapor: true`。
渲染目标：`vapor-render-target: 'bytecode' | 'nativecode'`，默认 `bytecode`。
条件编译：`// #ifdef VUE3-VAPOR`。

### 蒸汽模式的硬约束（直接影响现有代码）
1. **仅支持组合式 API（`<script setup>`），不支持选项式 API、不支持 mixin。**
   → 现有 37 个文件全部是选项式写法（`export default { data(){}, methods:{} }`），**必须全量改造为组合式**才能开启蒸汽模式。
2. 无虚拟 DOM，依赖 VNode 行为的写法需调整。
3. CSS 避免复杂关系选择器（`.a .b`），倾向扁平 class —— **与 Tailwind 原子类天然契合**。
4. 官方建议老项目用 `uni-agent` 辅助转换。

### 修订后的架构结论
**不再需要为 Vapor 单独建 Web 子项目。** 在现有 uni-app x 项目直接开启蒸汽模式即可（小程序/Web 端暂降级 VDOM，官方承诺后续升级）。

---

## 2. 版本事实（联网核实）

| 组件 | 版本 | 要点 |
|---|---|---|
| Vue | **3.6**（2026-07-18 正式发布） | Vapor Mode 生产可用，按组件 opt-in（`<script setup vapor>`）；响应式引擎换为 alien-signals；通过 `vaporInteropPlugin` 与 VDOM 组件同树共存 |
| Vite | **8**（2026 已落地） | engines 要求 `^20.19.0 \|\| >=22.12.0`；Rolldown 1.0 已稳定 |
| Tailwind CSS | **4.3.x**（4.3.0 于 2026-05-08 发布） | CSS-first 配置：`@import "tailwindcss"` + `@theme` 块；**不再默认生成 `tailwind.config.js`**；`@tailwindcss/vite` peer: vite `^5.2 \|\| ^6 \|\| ^7 \|\| ^8` |
| Node.js | **24 LTS**（Active LTS 至 2028-04-30） | 需满足 weapp-tailwindcss 的 `^22.18.0 \|\| >=24.11.0` |
| pnpm | **11.x 稳定**（11.27.0）；12.x 为 Rust 重写、opt-in | 推荐 11（`latest` tag 仍指向 11），12 可后续评估 |
| weapp-tailwindcss | **v5** | 支持 uni-app x + Tailwind 4；要求 HBuilderX ≥ 5.11 |

### uni-app x 侧 Tailwind 的限制（必须接受）
- 原生 App 端**不支持** `gap` / `gap-x-*` / `gap-y-*`、`space-x-*` / `space-y-*` → 改用显式 `mt-*` / `ml-*` 或封装间距组件。
- **不要**同时注册 `@tailwindcss/vite` 或 `@tailwindcss/postcss`，生成交给 weapp-tailwindcss。
- 必须保持 `appType: 'uni-app-x'`；建议开启 `componentLocalStyles` 与 `styleIsolation: '2'`。

---

## 3. 修订后的架构：单一 uni-app x 仓库 + 蒸汽模式

Vapor 在 uni-app x 内原生可用（App 端走原生渲染管线；小程序/Web 暂降级 VDOM），因此**不再需要拆分 Web 子项目**。推荐保持单一仓库：

```text
Mentorloop-app/
├── manifest.json          # uni-app-x.vapor = true（开启蒸汽模式）
├── pages.json
├── App.uvue
├── main.css               # Tailwind 4 入口：@import "tailwindcss" + @source
├── vite.config.ts         # uni() + WeappTailwindcss(uniAppX(...))
├── pages/… components/…   # 全部改为 <script setup> 组合式
├── store/ types/ api/     # 领域模型与 API 契约（.uts）
└── utssdk/                # 原生插件
```

**若后续需要独立的 Web 官网 / 运营后台**，再按需引入 pnpm workspace monorepo 与 `apps/web`（Vue 3.6 + Vite 8 + `@tailwindcss/vite`）。但就「小程序 + App 客户端」目标而言，单仓即可。

---

## 4. 可选：独立 Web 项目工具链（Vue 3.6 + Vite 8 + Tailwind 4）
> 仅在确实需要独立 Web 官网 / 运营后台时才需要；小程序 + App 客户端请走 §5。

| 类别 | 选型 | 说明 |
|---|---|---|
| 框架 | Vue 3.6 | 性能敏感组件（面试房间、大表单、实时转写列表）加 `vapor` 开启；其余保持 VDOM，用 `vaporInteropPlugin` 互操作 |
| 构建 | Vite 8 | 原生 ESM + Rolldown，HMR 快 |
| 语言 | TypeScript 5.x + `vue-tsc` | 类型检查纳入 CI |
| CSS | **Tailwind CSS 4.3** via `@tailwindcss/vite` | 原子化；主题写在 CSS 的 `@theme` 块 |
| 路由 | Vue Router 4 | |
| 状态 | Pinia | 若接入 Vapor 需注意：Pinia 本身可正常工作 |
| 工具库 | VueUse | |
| 组件自动导入 | `unplugin-vue-components`（谨慎） | Vapor 组件需确认编译兼容，建议先用显式 import |
| 图标 | Iconify / `unplugin-icons` | |
| i18n | vue-i18n（如需） | |
| 无障碍 | `eslint-plugin-vuejs-accessibility` | 文档 03 有明确无障碍要求 |

**Tailwind 主题（设计 token）示例**：
```css
@import "tailwindcss";
@theme {
  --color-navy: #0F2C4C;
  --color-smart: #5B6CFF;
  --color-reliable: #1FB6A6;
  --color-bg-light: #F7F9FC;
}
```
→ 自动生成 `bg-navy`、`text-smart` 等工具类，与文档 03 视觉系统一致。

---

## 5. 小程序 / App 端工具链（uni-app x + 蒸汽模式）

| 类别 | 选型 | 说明 |
|---|---|---|
| 框架 | uni-app x（uvue）+ **蒸汽模式** | manifest `uni-app-x.vapor: true`；App 端走原生渲染管线，小程序/Web 暂降级 VDOM |
| HBuilderX | **≥ 5.21** | 5.0 鸿蒙 / 5.11 iOS / 5.21 Android 才支持蒸汽模式 |
| 写法 | **必须 `<script setup>` 组合式** | 蒸汽模式不支持选项式 API、不支持 mixin |
| CSS | Tailwind 4 via **weapp-tailwindcss v5** `uniAppX()` preset | 遵守 gap/space 限制；原子类契合"避免复杂选择器"约束 |
| 构建 | HBuilderX（编译/运行/打包） | VS Code 仅写代码 |
| 单位 | rpx | px 在安卓/iOS 会错乱 |
| 条件编译 | `// #ifdef VUE3-VAPOR` | 需区分模式时使用 |

`vite.config.ts` 关键片段：
```ts
import uni from '@dcloudio/vite-plugin-uni'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { uniAppX } from 'weapp-tailwindcss/presets'

export default defineConfig({
  plugins: [
    uni(),
    WeappTailwindcss(uniAppX({
      base: projectRoot,
      cssEntries: [resolve(projectRoot, 'main.css')],
      rem2rpx: true,
    })),
  ],
})
```
> 不要再注册 `tailwindcss()` / `@tailwindcss/postcss` / `@tailwindcss/vite`。

---

## 6. 质量与协作工具（全仓库统一）

| 类别 | 选型 | 说明 |
|---|---|---|
| 包管理 | pnpm 11 + workspace | 严格依赖隔离，避免幽灵依赖 |
| Node | 24 LTS | `engines` 锁定 + `.nvmrc` |
| Lint | ESLint 9（flat config）+ `eslint-plugin-vue` | Vue SFC 支持成熟（Biome 对 Vue SFC 支持仍有限） |
| 格式化 | Prettier | 与 ESLint 分工，避免规则冲突 |
| 类型检查 | `vue-tsc --noEmit` | 纳入 CI 门禁 |
| Git 钩子 | husky + lint-staged | 提交前跑 lint/format |
| 提交规范 | commitlint（Conventional Commits） | 沿用你「按模块单独 commit」习惯 |
| 单元测试 | Vitest + @vue/test-utils | 状态机、评分逻辑优先覆盖 |
| E2E | Playwright | |
| 任务编排 | Turborepo（或 `pnpm -r --filter`） | 增量构建与缓存 |
| CI | GitHub Actions | install → lint → typecheck → test → build |
| 安全 | `pnpm audit` + Dependabot | 文档 06 有合规要求 |
| 监控 | Sentry（前后端） | |
| 环境 | Vite `.env.[mode]` | dev / staging / prod |

---

## 7. 落地工作流（建议分批、每批可审查）

- **W1**：确认 HBuilderX ≥ 5.21、Node ≥ 24.11；manifest 开启 `vapor: true` 与 `styleIsolationVersion: "2"`。
- **W2**：接入 weapp-tailwindcss v5（`uniAppX()` preset），建立 `main.css`（`@import "tailwindcss" source(none);` + `@source`）。
- **W3**：**全量改造 —— 37 个文件由选项式 API 转为 `<script setup>` 组合式**（蒸汽模式硬性前提，工作量最大）。
- **W4**：样式层迁移为 Tailwind 原子类，移除复杂后代选择器（如 `.ml-btn.primary .ml-btn-text`）。
- **W5**：状态机与 API/Mock 层适配组合式（store 单例保持，页面改用 `setup`）。
- **W6**：数字人占位组件适配（避免复杂选择器，改用原子类 + 状态 class）。
- **W7**：质量门禁 —— ESLint 9 + Prettier + husky + commitlint + Vitest + CI。
- **W8**：真机验证 —— HBuilderX 跑微信小程序 + Android/iOS 蒸汽模式；**用 release 包测性能，勿用 debug 模式**。

---

## 8. 决策记录（已全部确认，方案定稿）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | Vapor 推进方式 | ✅ **开启蒸汽模式 + 全量转组合式 API + 迁移 Tailwind**（单仓，不新建 Web 项目） |
| 2 | 独立 Web 项目 | ✅ 暂不需要，专注小程序 + App 客户端 |
| 3 | 现有 37 文件样式 | ✅ 迁移为 Tailwind（weapp-tailwindcss v5） |
| 4 | Lint / 格式化 | ✅ ESLint 9 + Prettier |
| 5 | 落地范围 | ✅ 本轮只定方案；下一轮按 W1→W8 分步实施 |

### 环境事实
- **HBuilderX 5.26（最新版）** —— 满足全部蒸汽模式门槛（鸿蒙 5.0+ / iOS 5.11+ / Android 5.21+），也满足 weapp-tailwindcss 要求的 ≥ 5.11。
- 因 ≥ 5.25，js/ts 文件命名限制已解除，新代码可直接用 js/ts 编写。

### 实施前置条件（开工前自查）
1. Node ≥ 24.11（满足 weapp-tailwindcss 的 `^22.18.0 || >=24.11.0`）。
2. HBuilderX 5.26 中确认项目被识别为 **uni-app x**（圆形图标，即 manifest 含 `uni-app-x` 节点）。
3. 备份或确认当前 37 个文件已提交（现已在 7 个 commit 中，可随时回滚）。

### 主要风险
| 风险 | 说明 | 对策 |
|---|---|---|
| 组合式改造面大 | 37 个文件全部由选项式转 `<script setup>` | 分模块改造，每模块单独 commit；官方建议可用 `uni-agent` 辅助 |
| 蒸汽模式不支持选项式/mixin | 任一文件遗漏即编译失败 | W3 完成后全量编译验证 |
| 小程序/Web 端降级 VDOM | 蒸汽模式目前仅 App 端生效 | 接受；条件编译 `// #ifdef VUE3-VAPOR` 隔离差异 |
| Tailwind 的 gap/space 限制 | 原生端不支持，会导致布局失效 | 统一用 `mt-*` / `ml-*`；CI 可设 `uvueUnsupported: 'error'` 拦截 |
| 复杂选择器失效 | 如 `.ml-btn.primary .ml-btn-text` | 迁移为原子类（与蒸汽模式要求同向） |
