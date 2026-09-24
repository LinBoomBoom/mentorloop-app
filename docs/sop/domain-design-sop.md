# 设计系统领域 SOP

生成日期：2026-09-24
归属：SOP 系统 L2 领域层 · 领域：设计系统
上游：[README.md](./README.md) §4；相关：`quality-gate-sop.md`

---

## 1. 目的与适用

保证视觉与交互在 uvue 平台约束下**跨端一致、可无障碍使用**。所有页面/组件的视觉改动适用。

---

## 2. Token 单一事实来源（三方一致）

| 载体                                     | 用途                                        |
| ---------------------------------------- | ------------------------------------------- |
| `main.css` 的 `@theme` 块                | Tailwind 原子类生成源（权威）               |
| `styles/theme.uts`                       | UTS 侧引用（状态机/原生层颜色、数字人状态） |
| `design-system/mentorloop/MASTER.md` §A1 | 设计决策记录                                |

**新增/修改颜色或间距 token 时，三处必须同步**，否则原子类与运行时颜色会漂移。

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
- 触摸目标 ≥44×44（iOS）/ 48×48dp（Android）；小于此值时用外层容器扩大热区。
- 按压反馈 opacity 0.7/0.85，80–150ms；不做 hover-only 交互，不做引起布局位移的 transform。
- 安全区：自定义导航页顶部避让状态栏，底部 CTA 避让 home indicator。

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

## 8. 承载 skill

`mentorloop-system-spec`（硬约束）；设计评审可用 `uicraft` / `web-design-guidelines`（注意其面向 Web，uvue 需人工适配）。
