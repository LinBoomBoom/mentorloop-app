---
name: mentorloop-interview-room-ux
description: Design the MentorLoop interview room experience, covering layout, state colour and motion, live captions, interruption rhythm, multimodal feedback and performance budget. Use when designing or reviewing the interview room. 中文触发 面试房间 房间布局 实时字幕 状态色 动效 打断 多模态. Do not use for avatar asset design.
---

# MentorLoop Interview Room UX

The interview room is where the digital human actually performs. It uses the dark immersive surface. Read `docs/sop/domain-design-sop.md` alongside this skill.

## Layout

Three bands, top to bottom:

- Top — exit control and countdown.
- Middle — the avatar with live captions. Caption state colour tracks the avatar state.
- Bottom — the primary record button (at least 64px) plus a text-answer entry.

Also show an explicit AI interviewer label. Never present the interviewer as a human.

## State colour and motion

State colours come from `styles/theme.uts`; do not invent new ones.

- `asking` / `followup` — smart (indigo)
- `listening` — reliable (teal)
- `thinking` — mist (muted)
- `idle` — neutral

State must be readable without colour alone: pair colour with a label, icon, or waveform. Motion is 300-500ms ease-out and respects reduced motion.

## Live captions

Show only stabilised text; avoid flicker from partial results. Captions must keep up with speech closely enough to feel live, and must remain readable on the dark surface at 4.5:1 or better.

## Interruption rhythm

Define exactly when the avatar stops speaking and when it starts listening. A candidate who interrupts should not be talked over. The transition must be visible in both the caption band and the state indicator.

## Multimodal feedback

Five channels must cooperate rather than compete: voice, captions, expression, waveform, and state colour. When two channels say the same thing, keep one quiet. Provide a text mode and captions for accessibility.

## Anxiety management

- Never show a live score in the room.
- Interview end requires a second confirmation.
- Abnormal exit auto-saves; no answer is silently lost.
- Skipping keeps the answer as evidence.

## Performance budget

- Sync UI summaries 10-15 times per second; never per frame.
- Lip and audio frames stay out of reactive state.
- One active avatar instance; release on exit.

## Five states

Every room state needs a design: empty, loading, error, degraded (no assets or no mic), and permission-denied. Degraded must offer a path forward (for example text mode) rather than a dead end.

## Output

Produce a room interaction spec using `assets/room-ux-spec-template.md`.

## Do not

Do not design avatar assets here (see `mentorloop-avatar-design`), and do not introduce a live score.
