---
name: mentorloop-lipsync-spec
description: Define the MentorLoop lip sync spec as a design-to-engineering contract, covering the viseme set, phoneme mapping, switch rate, TTS timing and fallback. Use when implementing or changing avatar lip sync or TTS timing. 中文触发 口型 口型同步 唇形 viseme 音素 TTS 时序. Do not use for general avatar styling.
---

# MentorLoop Lip Sync Spec

Lip sync is the hardest part of "doing the digital human well", and it is a design-to-engineering contract, not a purely visual choice. The spec table this skill produces can be frozen through `docs/sop/contract-freeze-sop.md`.

## Viseme set

Define a compact viseme set (roughly 8-12 shapes) that covers the common Mandarin mouth shapes plus a closed/neutral rest shape. Keep it small enough to hand-author assets and large enough to read as speech.

## Phoneme to viseme mapping

Produce an explicit mapping table: phoneme or pinyin final, target viseme, and priority when several map to the same shape. This table is the contract; ambiguity here becomes visible jitter on device.

## Switch rate and tolerance

- Cap mouth shape switching to roughly 10-15 changes per second, consistent with the UI summary budget in doc 04.
- A slight lag behind audio is acceptable and reads as natural. Leading the audio is not — never show a mouth shape before its sound.

## TTS timing

- The room drives lip sync through the `speaking` flag on the avatar component, set on TTS start and end.
- The room must not expose per-frame mouth data to reactive state.

## syncLip contract

`syncLip(phoneme)` in `utssdk/interviewer-avatar/index.uts` is the native hook. The cross-platform implementation is a silent no-op; the native layer overrides it. Do not move phoneme handling into the component.

## Performance constraint

Lip and audio frames must never enter reactive state. The component layer drives mouth animation with CSS keyframes on the compositor thread; JS only toggles the animation on and off.

## Fallback

With no viseme assets, fall back to a CSS open/close mouth animation driven by `speaking`. The fallback must remain readable as "speaking" rather than looking broken.

## Output

Produce a lip sync spec using `assets/lipsync-spec-template.md`. If it crosses into the native layer or changes the avatar contract, freeze it first.

## Do not

Do not push per-frame mouth data through reactive state, and do not let the mouth lead the audio.
