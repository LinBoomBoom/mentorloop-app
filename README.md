# MentorLoop · 学面一体智能导师

uni-app x 单代码库（微信小程序 / Android / iOS / 鸿蒙 / Web），**蒸汽模式（Vapor）** + **Tailwind CSS 4 原子化**。

---

## 1. 技术栈

| 类别   | 选型                                                     | 版本                                       |
| ------ | -------------------------------------------------------- | ------------------------------------------ |
| 框架   | uni-app x（uvue + UTS）                                  | 蒸汽模式 `manifest.uni-app-x.vapor = true` |
| Vue    | 组合式 `<script setup lang="uts">`（蒸汽模式强制）       | 由 HBuilderX 编译器内置提供                |
| CSS    | Tailwind CSS 4 + weapp-tailwindcss v5 `uniAppX()` preset | `^4.3` / `^5.3.3`                          |
| 构建   | Vite（`@dcloudio/vite-plugin-uni`）+ HBuilderX 编译打包  | Node `^22.18 \|\| >=24.11`                 |
| 包管理 | pnpm                                                     | `11.x`                                     |
| Lint   | ESLint 9 flat config + eslint-plugin-vue                 |                                            |
| 格式化 | Prettier                                                 |                                            |
| 测试   | Vitest（纯逻辑）+ Playwright（E2E）                      |                                            |
| 提交   | husky + lint-staged + commitlint                         |                                            |

> **关于 Vue 版本**：npm 上 `vue` 的最新稳定版是 **3.5.43**，3.6 目前只有 alpha/beta/rc。
> uni-app x 的 Vue（含蒸汽模式实现）由 DCloud 编译器内置，**与 npm 上的 `vue` 版本解耦**，
> 仓库里的 `vue` 依赖仅供 vue-tsc / Vitest 等本地工具链解析使用。

### 蒸汽模式支持矩阵（HBuilderX 门槛）

| 平台           | 最低 HBuilderX                     |
| -------------- | ---------------------------------- |
| 鸿蒙 HarmonyOS | 5.0+                               |
| iOS            | 5.11+                              |
| Android        | 5.21+                              |
| 小程序 / Web   | 当前降级 VDOM 运行，官方称后续升级 |

---

## 2. 目录结构

```text
Mentorloop-app/
├── App.uvue            # 应用入口（uni-app x 约定后缀是 .uvue，不是 .vue）
├── main.uts            # 应用初始化入口（不是 main.js）
├── main.css            # Tailwind 4 入口：@import "tailwindcss" + @source + @theme
├── manifest.json       # uni-app-x.vapor = true
├── pages.json
├── vite.config.ts      # uni() + WeappTailwindcss(uniAppX(...))
├── index.html          # H5 模板
├── components/         # ml-button / ml-card / ml-tag / ml-nav-bar / interviewer-avatar（.uvue）
├── pages/              # 9 个页面（.uvue）
├── store/              # interview-session.uts（状态机） / user-profile.uts
├── types/              # interview / scoring / resume（UTS 类型，必须用 type）
├── api/                # client / interview / resume / report + mock/
├── utssdk/             # 原生插件接口占位（audio / realtime / avatar / device）
├── scripts/            # check-uvue-css.mjs（受限原子类守卫）
└── tests/              # Vitest 纯逻辑测试
```

---

## 3. 快速开始

```bash
# 1) 环境
node -v        # >= 24.11（或 22.18+）
pnpm -v        # >= 10

# 2) 安装依赖
pnpm install

# 3) 用 HBuilderX 打开本目录运行
#    运行 > 运行到小程序模拟器 > 微信开发者工具
#    运行 > 运行到手机或模拟器 > Android / iOS
#    编译产物在 unpackage/

# 4) 命令行构建（需 HBuilderX 已安装对应编译器插件）
pnpm build:mp-weixin
pnpm build:app-android
pnpm build:app-ios
pnpm build:h5
```

> **注意**：小程序与原生 App 的编译/打包只能在 HBuilderX 中进行，VS Code 仅用于写代码。
> 性能验证请用 **release 包**，不要用 debug 模式（debug 包性能不代表真实表现）。

---

## 4. 质量门禁

```bash
pnpm lint           # ESLint 9（含 .uvue / .uts 规则）
pnpm format:check   # Prettier
pnpm test           # Vitest 单测（状态机）
pnpm typecheck      # vue-tsc
node scripts/check-uvue-css.mjs   # 拦截 gap / space-x-* 等原生端不支持的原子类
pnpm check          # 以上 lint + typecheck + test 串联
```

提交前由 husky 自动执行：`lint-staged` → `check-uvue-css`。提交信息遵循 Conventional Commits。

CI（`.github/workflows/ci.yml`）：install → lint → format → uvue CSS guard → test → typecheck → audit。

---

## 5. 必须遵守的编码约束

### UTS（`*.uts` 与 `<script setup lang="uts">`）

- **不支持 `interface`** 声明对象类型 → 必须用 `type X = { ... }` 命名。
- **不支持 `undefined`** → 空值用 `null`。
- 对象字面量必须 `as NamedType` 才能与类型关联。
- 不支持匿名对象字面量作参数/返回类型 → 先命名（如 `SessionRef`、`AnswerAck`）。
- 强类型：变量、参数、返回值都要有类型。

### uvue（页面 / 组件）

- 必须 `<script setup lang="uts">` 组合式；**不支持选项式 API、不支持 mixin**（蒸汽模式硬性要求）。
- `view` 默认 `flex-direction: column`，横向布局要显式写 `flex-row`。
- **样式不继承**：文字必须用 `<text>` 包裹，并在 `<text>` 上写 `text-*` / `font-*`。
- **原生端不支持** `gap` / `gap-x-*` / `gap-y-*` / `space-x-*` / `space-y-*` → 用 `mt-*` / `ml-*`。
- 避免复杂后代选择器（`.a .b`），全部用扁平原子类（与蒸汽模式要求同向）。
- 单位用 rpx（已开启 `rem2rpx`，直接写 Tailwind 的 rem 间距即可自动换算）。

### Tailwind

- 生成由 weapp-tailwindcss 接管，**不要**再注册 `tailwindcss()` / `@tailwindcss/postcss` / `@tailwindcss/vite`。
- 新增页面后确认 `main.css` 的 `@source` 已覆盖（当前：`App.uvue`、`pages/**`、`components/**`）。
- 设计 token 写在 `main.css` 的 `@theme` 块（单一事实来源，与 `styles/theme.uts` 同步）。
- **不要用** `bg-white/5` 这类透明度修饰符（Tailwind 4 会输出 `color-mix()`，原生端不支持）→ 用内联 `rgba()`。

---

## 6. 当前状态与待补项

- ✅ 工程基座、蒸汽模式开关、Tailwind 接入、15 个 `.uvue`（5 组件 + 9 页面 + App）、状态机、Mock API、质量门禁。
- ⚠️ 本仓库未在本地编译/真机验证（无 HBuilderX 构建环境）。请在 HBuilderX 打开运行核对。
- ⚠️ `utssdk/` 下 4 个插件为接口占位（方法签名 + 降级实现），录音/ASR/TTS/数字人渲染需补原生层。
- ⚠️ tabBar 当前纯文字，需在 `static/` 补 5 组 PNG 并在 `pages.json` 配置 `iconPath`。
- ⚠️ `@dcloudio/vite-plugin-uni` 版本需与 HBuilderX 自带编译器版本对齐；若报版本不匹配，请按 HBuilderX 版本调整该依赖后重装。
