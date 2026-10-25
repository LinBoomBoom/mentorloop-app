---
name: mentorloop-mobile-design-adapter
description: Convert Web or multi-platform concept drafts into uvue-native mobile design specs. Use when translating Figma, HTML or React prototypes into uni-app x screens. 中文触发 移动端转换 概念稿落地 原型转设计 rpx 安全区. Do not use for server-only or engine-only work.
metadata:
  version: '1.3.0'
  domain: mentorloop-app
  last_updated: '2026-10-25'
---

# MentorLoop Mobile Design Adapter

Bridge between Web-oriented design skills (uicraft / frontend-design / shadcn / web-design-guidelines) and this project's native constraints. Use it whenever a design arrives as a desktop layout, an HTML/React prototype, or a Web component-library pattern and must land as a uvue screen. Read `docs/sop/domain-design-sop.md` and `mentorloop-system-spec` alongside this skill.

The handbook at `multi-platform-ui-handbook/multi-platform-ui-handbook.html` is a **reference only**, never an implementation source. Its chapters on mobile, adaptive and the design system inform the conversion; its Web/desktop chapters and React component-library advice do not apply here.

## Conversion steps

1. **Keep the information architecture, change the interaction channel.** Re-run the mobile sanity checks first (one task per module, first screen = highest-frequency task, module order follows the user's task order). Never scale a desktop layout down.
2. **Thumb-first weight.** Core actions in the easy zone (bottom); destructive or low-frequency actions in the hard zone (top). Prefer bottom tabBar and bottom sheets. **The tabBar is native and three evenly spaced items — never float a FAB above it**; a centre action needs the uni-ui x `uni-tab-bar` architecture change and a separate task.
3. **Platform chrome before pixels.** WeChat MP reserves the top-right capsule (~97×32 px): give the top bar `paddingRight: 200rpx` and keep interactive elements out of it. App has no capsule. Native tabBar cannot be glass on either platform.
4. **Viewport to rpx.** Design at 375 (iOS pt) or 360 (Android dp) width; `rem2rpx` is on, so 750rpx equals device width. Do not port desktop pixel values.
5. **Safe area.** Top clears the status bar / notch; bottom CTA clears the home indicator. Content may bleed past the safe area for immersion, but clickable elements stay inside it.
6. **Touch targets.** At least 44x44 (iOS) / 48x48dp (Android); when the visual is smaller, enlarge the hit area with a wrapper.
7. **Hover becomes press.** Use the three global classes `pressed-row` / `pressed-card` / `pressed-chip` (opacity 0.7 / 0.85 / 0.8, 80-150ms). No hover-only affordance, no layout-shifting transform.
8. **Navigation.** Bottom tabBar holds 3-5 first-level entries; drill-down is at most 3 levels. A Web modal or dropdown becomes a bottom sheet; a desktop side nav becomes a tab or a drill-down. Do not repeat a tabBar entry as an in-page shortcut.
9. **Primitive translation.** Apply the table below before writing any style.
10. **Five states.** Every screen and module designs empty, loading, error, degraded and permission-denied. Degraded and permission-denied must offer a next step, never a dead end.
11. **Tokens only from the authoritative carriers** — token governance lives in `docs/sop/domain-design-sop.md`. Never hardcode a brand hex in a page.
12. **State without colour alone.** Pair colour with shape, label or icon.
13. **Empty is allowed.** Do not fill a gap with a decorative chart, trend card or fake entry. Only design features the system currently supports; mark anything超前 as「超前 · 未实现」.
14. **Glass scope.** App may use `backdrop-filter`; MP simulates with 94–97% white + hairline + soft shadow. Never promise glass on the native tabBar.

## Web to uvue primitive map

| Web / prototype              | uvue target                                            |
| ---------------------------- | ------------------------------------------------------ |
| `gap-*`, `space-x/y-*`       | `mt-*` / `ml-*` (unsupported on native)                |
| `bg-white/5` transparency    | inline `rgba()` (Tailwind 4 emits `color-mix()`)       |
| inline `<svg>`               | Lucide subset iconfont or generated PNG                |
| text style on a container    | `text-*` / `font-*` on the `<text>` itself             |
| horizontal flex default      | add `flex-row` (`view` defaults to column)             |
| descendant selectors `.a .b` | flat atomic classes only                               |
| desktop breakpoints          | rpx + explicit `mt-*` / `ml-*`, no `@media` on native  |
| hover / hover-card           | press state via `pressed-*`, plus a visible tap target |

## Non-negotiables

- uvue/Tailwind hard constraints, privacy red lines, and token governance come from `mentorloop-system-spec` and `docs/sop/domain-design-sop.md`; do not restate or bend them here.
- A screen or module that does not resolve its five states is not finished.
- Design deliverables are HTML files. Do not export PNG / JPG design images unless the user explicitly asks.

## Output

Produce the spec with `assets/mobile-spec-template.md`: a screen-by-screen conversion table plus the five-state coverage matrix. If a confirmed style selection sheet exists (produced by `mentorloop-design-intelligence`, which is never loaded at the same time as this skill), reference its path in the spec header (选型单引用) and treat it as the visual-direction input; if none exists, mark "无灵感层参与" in the open-questions section — that is allowed, but must be stated. The spec feeds the design walkthrough (`mentorloop-role-uiux-designer`) and G3 admission, and is not a mandatory pipeline link by itself.

## Do not

Do not hand a Web/React component-library implementation (shadcn / MUI / Ant Design / Radix code) to the client as code — visual and structural reference only. Do not port a desktop layout one-to-one, and do not introduce tokens outside the authoritative carriers.
