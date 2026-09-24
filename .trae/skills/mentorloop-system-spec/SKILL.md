---
name: mentorloop-system-spec
description: Apply MentorLoop client hard constraints for uvue, UTS, Tailwind and privacy red lines before editing. Use when writing or reviewing pages, components, engine or api. 中文触发 客户端 页面 组件 uvue UTS Tailwind 硬约束 隐私红线. Do not use for backend-only work.
---

# MentorLoop System Spec

Apply these repo-specific constraints before writing or reviewing any client code. They override generic habits. Authoritative sources are `README.md` §5, `design-system/mentorloop/MASTER.md`, and `docs/sop/README.md`.

## Module boundaries

- `engine/` must stay pure logic — no UI, no network, no `uni.*`. It must remain portable to `server/src/rules/` (the mirror).
- `api/` is the frozen contract layer; file header comments are the contract. Changing it requires a contract freeze (both sides sign).
- `store/interview-session.uts` is a singleton state machine, independent of UI and backend.
- `utssdk/` isolates platform differences. Degraded implementations must not fabricate results (e.g. never invent ASR transcript text).
- `api/env.uts` is the single mock/real-backend switch. Do not hardcode base URLs elsewhere.

## UTS constraints

- Declare object types with `type`, never `interface`.
- Use `null` for empty values, never `undefined`.
- Object literals must be cast: `{ ... } as NamedType`.
- Do not use anonymous object literals as parameter or return types; name them first.

## uvue constraints

- Every page and component uses `<script setup lang="uts">`. Option API and mixins are unsupported (vapor mode).
- Text must be wrapped in `<text>`; styles do not inherit, so put `text-*` / `font-*` on the `<text>` itself.
- `view` defaults to `flex-direction: column`; add `flex-row` for horizontal layout.
- Never use `gap-*`, `space-x-*`, or `space-y-*` — unsupported on native. Use `mt-*` / `ml-*`.
- Never use transparency modifiers like `bg-white/5` — Tailwind 4 emits `color-mix()`, unsupported on native. Use inline `rgba()`.
- Avoid complex descendant selectors (`.a .b`); use flat atomic classes.
- Units are rpx; `rem2rpx` is on, so Tailwind rem spacing converts automatically.

## Tailwind

- CSS generation is owned by `weapp-tailwindcss`. Do not register `tailwindcss()`, `@tailwindcss/postcss`, or `@tailwindcss/vite`.
- Design tokens have one source of truth: the `@theme` block in `main.css`, mirrored in `styles/theme.uts` and `MASTER.md` §A1. Keep all three aligned.
- After adding a page, confirm `main.css` `@source` still covers it.

## Privacy and product red lines

- Do not persist raw recordings or audio files. Text answers and resume files only.
- Scores must cite evidence; low confidence must not be dressed up as a precise score.
- LLM may explain and generate examples but must never alter original evidence or scores.
- AI must not impersonate a human interviewer; AI rewrites are labelled as suggestions; fabricated data is visibly marked.
- Never display a live score inside the interview room.

## Before finishing

Run the G2 quality gate (see the `mentorloop-quality-gate` skill). If the change touches `types/` or `api/`, produce a contract freeze first (see `docs/sop/README.md` §3, G1).
