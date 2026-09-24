---
name: mentorloop-avatar-design
description: Design the MentorLoop 2.5D interviewer avatar as a character and asset set, including the authoritative state set, expression library, asset specs and subpackaging. Use when designing or changing the digital human avatar. 中文触发 数字人 数字人设计 虚拟形象 面试官形象 资产规格 状态集. Do not use for room layout or interaction design.
---

# MentorLoop Avatar Design

The digital human is the product's core highlight, so avatar design quality carries disproportionate weight. Read `docs/sop/domain-design-sop.md` alongside this skill.

## Authoritative state set (6 states)

Single source of truth is `styles/theme.uts` (`AvatarState`). Do not invent a different set.

`idle` / `asking` / `listening` / `followup` / `thinking` / `summary`

These propagate to three places that must stay aligned:

- `utssdk/interviewer-avatar/index.uts` — `AvatarState` and `AvatarAssetSet`
- `data/avatar-assets.uts` — the asset inventory
- `components/interviewer-avatar.uvue` — state-driven rendering

Adding or renaming a state means updating all four files in one change. A state present in the room but missing from the asset set renders nothing and silently falls back.

## Character principles

- Professional but not intimidating; the interviewer should feel credible, not adversarial.
- Never impersonate a human. The AI interviewer label is mandatory.
- Voice cloning is out of scope by decision. Do not design around it.
- Self-built 2.5D; do not assume a third-party digital-human SaaS.

## Composition

Half-body, centred, facing the candidate. Reserve headroom for the caption band and the record button below. The home page treats the avatar as the absolute focal point; the interview room keeps it centred with captions.

## Expression and state mapping

Each state needs a visually distinct expression and posture, and the distinction must not rely on colour alone (see the accessibility rules). Provide micro-expressions beyond the coarse state so the avatar does not read as frozen.

## Asset specs

- State frames — one per state (6 total), 2.5D half-body, PNG with transparent background, 720x720 recommended.
- Lottie (optional) — lip, expression and posture state machine animation; takes priority over frames; consumed only by the native layer.
- Assets live in `data/avatar-assets.uts`; fill remote URLs or local static paths. All empty means the component degrades to the built-in CSS figure.

## Loading and packaging

- Digital-human assets are subpackaged so the first screen never waits on them.
- Preload on mount; failures are silent and must not block the interview.
- Single active avatar instance; release on room exit.

## Degradation

The CSS fallback must look intentional, never broken. A candidate who sees a placeholder should still understand "the interviewer is listening", not "something failed".

## Output

Produce an avatar spec using `assets/avatar-spec-template.md` (character brief plus asset spec table).

## Do not

Do not design room layout or interaction rhythm here (see `mentorloop-interview-room-ux`), and do not change the state set unilaterally.
