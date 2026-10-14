---
name: mentorloop-design-intelligence
description: Design inspiration and selection layer: propose style direction, colour strategy, typography and layout pattern candidates, output as a style selection sheet. Use before landing a concept or when choosing a visual direction. 中文触发 风格选型 配色 字体 设计灵感 选型单. Do not use for writing uvue specs or code.
metadata:
  version: '1.0.0'
  domain: mentorloop-app
  last_updated: '2026-10-14'
---

# MentorLoop Design Intelligence

Inspiration and selection layer (L1/L2) of the design system. It proposes candidates — style direction, colour strategy, typography, layout patterns — and condenses them into one deliverable: the **style selection sheet** (`assets/style-selection-template.md`). It never lands specs or code: landing belongs to `mentorloop-mobile-design-adapter`, hard constraints to `mentorloop-system-spec`. Read `docs/sop/domain-design-sop.md` §8 (skill boundaries and priority chain) alongside this skill.

## When to load

- A new page or feature needs a visual direction fixed before design starts.
- The request asks for style / colour / typography / layout-pattern candidates (风格选型、配色、设计灵感).
- A concept draft exists but its visual mood is undecided.

**Never load together with `mentorloop-mobile-design-adapter`**: selection tasks load this skill, landing tasks load the adapter; the selection sheet saved to disk is the handoff (`docs/sop/domain-design-sop.md` §8.3).

## Procedure

Follow `references/selection-procedure.md`: inputs (product domain, scenario, mood keywords) → style direction (`references/style-presets.md`) → colour strategy → typography → density / radius / motion intensity → brand-lock filter (`references/brand-lock-filter.md`) → style selection sheet. Layout candidates come from `references/layout-patterns.md`.

## References

| File                                 | Content                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `references/style-presets.md`        | 12 style directions; every candidate is a combination of existing `main.css @theme` tokens |
| `references/layout-patterns.md`      | mobile layout patterns mapped to existing `components/ml-*` components                     |
| `references/selection-procedure.md`  | step-by-step selection pipeline and output rules                                           |
| `references/brand-lock-filter.md`    | red lines: 0 new colours, 0 new fonts, no Web-only paradigms                               |
| `assets/style-selection-template.md` | the style selection sheet — this skill's only deliverable                                  |

## Output

One style selection sheet per task, saved into the task directory. Selection is **advice**: it becomes a design input only after `mentorloop-role-uiux-designer` confirms it — record the confirmation status in the sheet. `mentorloop-mobile-design-adapter` consumes the confirmed sheet as an optional input and references its path in the spec header.

## Non-negotiables

- **0 new colour values, 0 new fonts.** Every candidate is expressed with existing `main.css @theme` tokens only. A genuinely new token must go through the token change process (three carriers updated in one change, `docs/sop/domain-design-sop.md` §2) — never introduce it via the selection sheet.
- No hover / cursor / breakpoint paradigms; all targets are uni-app x mobile surfaces (press feedback via `pressed-*`, 80-150ms).
- Never override hard constraints (`mentorloop-system-spec`, `README.md` §5) or token values (`main.css @theme`).
- The selection sheet is not a spec and not a standard: no uvue layout code, no IA or interaction decisions.

## Do not

Do not produce uvue specs, code, IA/interaction decisions, or define tokens. Third-party design material (uicraft / frontend-design / shadcn / MUI / Ant) is structural and visual reference only — project skills always win, and its palettes and fonts never enter the implementation.
