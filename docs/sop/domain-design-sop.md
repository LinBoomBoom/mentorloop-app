---
编号: SOP-10
名称: 设计系统领域
适用范围: docs/sop/domain-design-sop.md token 三方一致、双表面、图标、uvue 硬约束与无障碍、设计 skill 边界与优先级
版本: 1.7.0
最后更新: 2026-10-14
---

# 设计系统领域 SOP

生成日期：2026-09-24
归属：SOP 系统 L2 领域层 · 领域：设计系统
上游：[README.md](./README.md) §4；相关：`quality-gate-sop.md`

---

## 1. 目的与适用

保证视觉与交互在 uvue 平台约束下**跨端一致、可无障碍使用**。所有页面/组件的视觉改动适用。

---

## 2. Token 单一事实来源（三方一致）

| 载体                                     | 用途                                      |
| ---------------------------------------- | ----------------------------------------- |
| `main.css` 的 `@theme` 块                | Tailwind 原子类生成源（权威）             |
| `styles/theme.uts`                       | UTS 侧引用（状态机/原生层颜色、语音状态） |
| `design-system/mentorloop/MASTER.md` §A1 | 设计决策记录                              |

**token 类型覆盖七类命名空间：颜色 / 字体 / 阴影 / 圆角 / 动效（duration、ease）/ 尺寸**；间距不设 token（事实来源为 Tailwind 间距刻度）。新增/修改任一 token 时，三处必须同步，否则原子类与运行时颜色会漂移。`styles/theme.uts` 键名为 `main.css` 逻辑名的 camelCase 直配（如 `inkSoft`↔`ink-soft`），无别名键——别名 `textPrimary`/`textSecondary`/`border`/`amber` 已于 2026-10-14 收敛移除，main.css 权威名唯一。

**消费端取值纪律（2026-10-14 补，同日随亮色族收敛扩围）**：取色一律走 Tailwind token 原子类（`bg-smart` 等）或 `styles/theme.uts` 的 `themeValue('smart', '#5B6CFF')`，**禁止引入 token 之外的 hex**。检查 E 对**全工程 `.uvue`** 强制：任何硬编码 hex 必须是 `@theme` token 值（白名单自动派生，无例外登记）。页面与组件统一在各自 `<script setup>` 顶部定义 `themeValue(...)` 常量，模板以绑定属性（`:color="SMART"`）消费——**字面量只允许出现在常量定义的 fallback 位置**（2026-10-14 全量收敛完成）。图标名由检查 F 守卫（`ml-icon` 静态 `name` 必须存在于 `ICON_GLYPH`，miss 会静默消失）。

---

## 3. 双表面体系（MASTER.md §A1）

- **深色沉浸面**（首页 / 面试房间）：`navy #0F2C4C` → `navy-deep #0B2138`；深色面正文对比度 ≥4.5:1；`mist #AEB9CC` 仅用于大字号/非关键说明。
- **浅色学习面**（训练/简历/成长/我的/报告）：`bg-light #F7F9FC` 底 + `surface` 白卡片 + 三级阴影。
- 品牌语义色：`smart #5B6CFF`（主操作）/ `reliable #1FB6A6`（正向）/ `warn #E08A00`（提示）/ `danger #DC2626`。

---

## 4. 图标方案

- **in-page 图标**：Lucide 子集字体，`styles/icons.css`（**由 `scripts/build-icons.py` 生成，勿手改**）。
  - 非微信端：引用 `static/fonts/lucide-subset.ttf`；微信端：base64 内联（wxss 不支持包内字体路径），由条件编译隔离。
- **tabBar 图标**：`static/tabbar/*.png`（由 `scripts/gen-tabbar-icons.cjs` 生成），在 `pages.json` 配 `iconPath`/`selectedIconPath`。
- 新增图标：改 `build-icons.py` 的子集清单后重新生成，不要手改产物。

---

## 5. uvue 平台硬约束（继承 system-spec）

- 不支持内联 `<svg>` → 用 Lucide 图标字体或 PNG。
- 不支持 `gap-*` / `space-*` → 用 `mt-*` / `ml-*`（由 `check-uvue-css.mjs` 拦截）。
- 文字样式不继承 → 每个 `<text>` 显式设字号/颜色/字重。
- 禁用透明度修饰符（`bg-white/5` → `color-mix()` 原生不支持）→ 用内联 `rgba()`。
- 模板**静态属性不得承载表达式**：`label="'项目经历 ' + n + ' 段'"` 缺 `:` 会被当字面串原样渲染（2026-10-14 实际发生并修复过）→ 必须 `:label="'项目经历 ' + n + ' 段'"`。由 ESLint 本地规则 `uvue/no-expression-in-static-attr` 拦截——按表达式语法解析（AST）判定，非字符串匹配，故 `a + b`、`x.y`、`x ? a : b` 等无引号写法同样命中；纯字面量/标识符、连字符值（`ml-tag`）、CSS 值函数（`rgba(...)`）不误报。
- 触摸目标 ≥44×44（iOS）/ 48×48dp（Android）；小于此值时用外层容器扩大热区。
- 按压反馈 opacity 三档（`pressed-row` 0.7 / `pressed-chip` 0.8 / `pressed-card` 0.85，main.css 全局 `@utility`），80–150ms；不做 hover-only 交互，不做引起布局位移的 transform。
- 安全区：自定义导航页顶部避让状态栏，底部 CTA 避让 home indicator。

> 平台规范符合性的完整防线（编译期 + 静态扫描 + 评审清单）、高频 bug 模式与构建产物纪律见 [SOP-13 uni-app x 平台规范](./domain-uniappx-sop.md)。

---

## 6. 无障碍

- 对比度：浅色面正文 ≥4.5:1。
- **不只靠颜色表状态**（形状/标签/图标辅助）。
- 动效尊重 `prefers-reduced-motion`（`main.css` 已全局处理）。
- 面试场景提供字幕/文字模式。

---

## 7. 检查清单

- [ ] 新增 token 已在 `main.css`、`styles/theme.uts`、`MASTER.md` 三处同步。
- [ ] 深色面正文对比度 ≥4.5:1。
- [ ] 未使用 `gap-*` / `space-*` / 透明度修饰符 / 复杂后代选择器。
- [ ] 文字均在 `<text>` 上设样式。
- [ ] 触摸目标达标；状态不只靠颜色表达。
- [ ] 图标来自 Lucide 子集或生成的 PNG，未手改生成产物。

---

## 8. 设计 skill 边界与优先级链（正本）

> 2026-10-14 设计治理裁决定稿；与 `.trae/rules/sop-entry.md` 路由保持一致，冲突时以本节为准。

### 8.1 边界表

| Skill                              | 只管                                      | 不管                                    | 权威范围                     | 产物               |
| ---------------------------------- | ----------------------------------------- | --------------------------------------- | ---------------------------- | ------------------ |
| `mentorloop-system-spec`           | 客户端 uvue/UTS/Tailwind/隐私硬约束       | 视觉风格、IA                            | **硬约束正本**               | 约束条款           |
| `mentorloop-role-uiux-designer`    | IA、交互、视觉系统、无障碍、走查          | 平台实现细节                            | 视觉/经验**决策**            | 设计规格、走查结论 |
| `mentorloop-mobile-design-adapter` | Web/多端概念稿 → uvue 规格（消费选型单）  | 定义 token、定义品牌、发明新风格        | 概念**落地通道**             | 移动端转换规格     |
| `uni-app-x`                        | 平台结构/组件/API/ucss/调试/性能          | 项目设计约束                            | 平台**知识**                 | 平台知识库         |
| `mentorloop-design-intelligence`   | 风格/配色策略/排版方案/布局模式候选与选型 | 落地规格、代码、IA/交互决策、token 定义 | 选型（**咨询**，须 UX 确认） | 设计选型单         |
| `mentorloop-role-miniprogram-pm`   | 微信平台/包体积/审核/登录                 | 视觉、后端                              | 小程序**约束**               | 需求/审核材料      |

### 8.2 冲突裁决顺序（恒成立）

1. **硬约束冲突** → 一律以 `mentorloop-system-spec` / `README.md` §5 为准。
2. **token 值** → `main.css @theme` 为准，`MASTER.md §A1` 记录，`styles/theme.uts` 同步；三处名集合必须一致（§2）。
3. **视觉 / IA 决策** → `mentorloop-role-uiux-designer`。
4. **Web 概念落地** → `mentorloop-mobile-design-adapter`。
5. **灵感 / 风格候选** → `mentorloop-design-intelligence` 只出选型单，**不得直接当规范**；须过其 `brand-lock-filter` 并经 `mentorloop-role-uiux-designer` 确认后才可进入 3/4 的输入，**永远不得覆盖 1/2**。
6. **第三方设计资料（uicraft / frontend-design / shadcn / MUI / Ant 等）** → 只作视觉与结构参考，**项目 skill 恒优先**；其色板/字体不得进入实现。
7. **数字人体系（avatar / lipsync）** → 已裁决下线（D-A，2026-10-14），议题归档；面试房间的语音状态可视化归 `mentorloop-interview-room-ux`。

### 8.3 装配规则（≤3 上限下）

- 纯落地：`system-spec` + `mobile-design-adapter`（+ 平台知识时 `uni-app-x`）。
- 新页面设计：`system-spec` + `role-uiux-designer`（+ 概念稿则 `mobile-design-adapter`）。
- 风格选型：`role-uiux-designer` + `mentorloop-design-intelligence`。
- `intelligence` 与 `adapter` **不同时加载**：选型任务载前者，落地任务载后者，以「设计选型单」落盘衔接（产物交接，非上下文续传），装配仍 ≤3。
- `interview-room-ux` 独立承载面试房间 UX（avatar/lipsync 已下线，D-A）。

---

## 9. 承载 skill

`mentorloop-system-spec`（硬约束）；风格 / 配色 / 字体选型与设计灵感走 `mentorloop-design-intelligence`（唯一产物「设计选型单」，经 `mentorloop-role-uiux-designer` 确认后作为 `mentorloop-mobile-design-adapter` 输入，二者不同时加载，见 §8）；Web/多端概念稿落地为 uvue 移动端规格走 `mentorloop-mobile-design-adapter`；设计评审可用 `uicraft` / `web-design-guidelines`（注意其面向 Web，uvue 需人工适配，转换路径见 `mentorloop-mobile-design-adapter`）。

---

## 10. 更新触发条件

| 触发事件                         | 更新内容 | 版本  |
| -------------------------------- | -------- | ----- |
| token 权威载体或三方一致规则变更 | §2       | minor |
| 双表面语义色调整                 | §3       | minor |
| 图标方案变更                     | §4       | minor |
| uvue 硬约束或无障碍规则调整      | §5 / §6  | minor |
| 设计 skill 边界或裁决顺序变更    | §8       | minor |
