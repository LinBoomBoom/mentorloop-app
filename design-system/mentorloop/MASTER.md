# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** MentorLoop
**Generated:** 2026-09-24 00:45:09
**Category:** Translator App
**Design Dials:** Variance 3/10 (Centered / Minimal) | Motion 4/10 (Standard) | Density 5/10 (Standard)

---

## Global Rules

### Color Palette

| Role             | Hex       | CSS Variable               |
| ---------------- | --------- | -------------------------- |
| Primary          | `#2563EB` | `--color-primary`          |
| On Primary       | `#FFFFFF` | `--color-on-primary`       |
| Secondary        | `#0891B2` | `--color-secondary`        |
| On Secondary     | `#000000` | `--color-on-secondary`     |
| Accent/CTA       | `#EA580C` | `--color-accent`           |
| On Accent/CTA    | `#000000` | `--color-on-accent`        |
| Background       | `#F8FAFC` | `--color-background`       |
| Foreground       | `#0F172A` | `--color-foreground`       |
| Card             | `#FFFFFF` | `--color-card`             |
| Card Foreground  | `#0F172A` | `--color-card-foreground`  |
| Muted            | `#F1F5FD` | `--color-muted`            |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border           | `#E4ECFC` | `--color-border`           |
| Destructive      | `#DC2626` | `--color-destructive`      |
| On Destructive   | `#FFFFFF` | `--color-on-destructive`   |
| Ring             | `#2563EB` | `--color-ring`             |

**Color Notes:** Global blue + teal + accent orange

### Typography

- **Heading Font:** Lora
- **Body Font:** Raleway
- **Mood:** calm, wellness, health, relaxing, natural, organic
- **Google Fonts:** [Lora + Raleway](https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap)

**CSS Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

_Density: 5/10 — Standard_

| Token         | Value             | Usage                     |
| ------------- | ----------------- | ------------------------- |
| `--space-xs`  | `4px` / `0.25rem` | Tight gaps                |
| `--space-sm`  | `8px` / `0.5rem`  | Icon gaps, inline spacing |
| `--space-md`  | `16px` / `1rem`   | Standard padding          |
| `--space-lg`  | `24px` / `1.5rem` | Section padding           |
| `--space-xl`  | `32px` / `2rem`   | Large gaps                |
| `--space-2xl` | `48px` / `3rem`   | Section margins           |
| `--space-3xl` | `64px` / `4rem`   | Hero padding              |

### Shadow Depths

| Level         | Value                          | Usage                       |
| ------------- | ------------------------------ | --------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`   | Subtle lift                 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)`    | Cards, buttons              |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)`  | Modals, dropdowns           |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #ea580c;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #2563eb;
  border: 2px solid #2563eb;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 3px #2563eb20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Product Demo + Features

- **Conversion Strategy:** Use an interactive demo only when it explains value better than static media. Provide captions, transcript, visible play/pause controls, and a non-video fallback; do not autoplay under reduced motion. Pause media when offscreen or hidden and keep the final product state available as static content.
- **CTA Placement:** Video center + CTA right/bottom
- **Section Order:** Hero > Product video/mockup (center) > Feature breakdown per section > Comparison (optional) > CTA

---

## Motion

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', {
  opacity: 0,
  scale: 0.92,
  y: 16,
  duration: 0.4,
  stagger: { each: 0.06, from: 'start', grid: 'auto' },
  ease: 'back.out(1.4)'
})
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger; Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Complex shadows
- ❌ 3D effects

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

# MentorLoop 项目适配决策（uvue / uni-app x）

> 以下决策由 skill 输出结合项目现状落定，优先级高于上方通用条款。

## A1. 色彩：保留既定品牌，只吸收 skill 的语义角色结构

skill 推荐 `#2563EB` 蓝；项目既定品牌为「深海军蓝 + 靛紫 + 青绿 + 暖琥珀」，用户已有认知，
**不替换主色**，改为角色映射，并补齐 skill 要求的语义层（on-* / ring / destructive / muted）：

| Skill 角色  | 项目 Token      | Hex       | 用途                       |
| ----------- | --------------- | --------- | -------------------------- |
| Primary     | `smart` 靛紫    | `#5B6CFF` | 品牌主操作、选中、链接     |
| Secondary   | `reliable` 青绿 | `#1FB6A6` | 成功、倾听状态、正向数据   |
| Accent/CTA  | `amber` 暖琥珀  | `#E08A00` | 提示、关键引导（克制使用） |
| Background  | `bg-light`      | `#F7F9FC` | 浅色学习页全局底           |
| Foreground  | `ink`           | `#1A2433` | 主文字                     |
| Muted Fg    | `ink-soft`      | `#5B6472` | 次级文字                   |
| Border      | `line`          | `#E3E8F0` | 分隔线/描边                |
| Destructive | `danger`        | `#DC2626` | 错误、危险操作             |
| Ring        | 同 smart        | `#5B6CFF` | 焦点环/光晕                |

**双表面体系**：

- 深色沉浸面（首页 / 面试房间）：`navy #0F2C4C` → `navy-deep #0B2138`，光晕用 smart/reliable 低透明度
- 浅色学习面（训练/简历/成长/我的/报告）：bg-light 底 + surface 白卡片 + 三级阴影体系

深色面正文对比度 ≥4.5:1；`mist #AEB9CC` 仅用于大字号/非关键说明。

## A2. 字体：中文优先系统字体，不加载 Lora，Raleway 仅作可选数字字体

- skill 的 Lora/Raleway 是拉丁字体，不含中文字形；小程序加载中文字体体积不可接受。
- UI 字体栈：`-apple-system, PingFang SC, HarmonyOS Sans SC, system-ui, sans-serif`
- Lora 衬线**放弃**（与 Swiss/专业工具方向冲突，且 uvue 中文衬线表现不稳定）。
- Raleway 的「几何、平静」气质保留为**可选**：数字/分数等拉丁字符如需品牌化再以 unicode-range 子集加载，
  默认不加载，保护首屏。
- 字号阶梯：12（caption）/14（body）/16（emphasis）/18（subtitle）/22/28（title）；行高 1.5。

## A3. uvue 平台硬约束（实现时必须遵守）

1. 不支持内联 `<svg>`；图标方案：**Lucide iconfont**（本地 TTF，in-page 图标）+ 生成 PNG（原生 tabBar iconPath）
   —— icons 数据库两次查询均未命中，图标家族选择属于 fallback 建议，非数据库匹配结果。
2. 不支持 `gap-*`：间距用显式 `mt-* / ml-*`。
3. 文字样式不继承：每个 `<text>` 显式设置字号/颜色/字重。
4. 触摸目标 ≥44×44（iOS）/48×48dp（Android），视觉元素小于此值时用外层容器扩大热区。
5. 按压反馈：opacity 0.7 / 0.85，80–150ms；不做 hover-only 交互，不做引起布局位移的 transform。
6. 安全区：自定义导航页（首页/房间/登录）顶部避让状态栏，底部 CTA 避让 home indicator。
7. 动效：呼吸/淡入 300–500ms，缓动 ease-out；全部尊重 `prefers-reduced-motion`（main.css 已全局处理）。

## A4. 各页面设计方向

| 页面      | 表面 | 设计要点                                                                                                                                                                             |
| --------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 首页      | 深色 | 数字人绝对主角：呼吸光环、状态点、语气泡、单一主 CTA + 两个快练入口                                                                                                                  |
| 面试房间  | 深色 | 上：退出+倒计时；中：数字人+实时字幕（状态色随 asking/listening/followup 切换）；下：录音主按钮（≥64px）+ 文字作答入口；明确「AI 面试官」标识（AI Interaction 规范：不得伪装成真人） |
| 专项训练  | 浅色 | 推荐任务卡（能力域标签+难度+理由）、通用快练宫格、列表入场 stagger                                                                                                                   |
| 简历优化  | 浅色 | 上传卡→解析结果状态标签组→改写建议（before/after 层级）；空状态引导                                                                                                                  |
| 我的成长  | 浅色 | 场次统计、六维能力条、趋势图（不只靠颜色：形状/标签辅助）                                                                                                                            |
| 我的      | 浅色 | 会员卡、分组设置列表、登录/退出，危险操作二次确认                                                                                                                                    |
| 报告/总结 | 浅色 | 结论优先（总评+一句话总结），证据→分数→建议递进                                                                                                                                      |
