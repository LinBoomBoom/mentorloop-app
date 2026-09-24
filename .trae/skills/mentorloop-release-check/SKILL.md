---
name: mentorloop-release-check
description: Run the MentorLoop G4 release gate and compliance checklist before shipping. Use when preparing a milestone release, app submission or version bump. 中文触发 发布准入 提审 打包 合规 里程碑. Do not use for mid-iteration commits.
---

# MentorLoop Release Check (G4)

Run this before any external delivery: milestone release, mini-program submission, or app packaging. A failing gate blocks the release. Read `docs/sop/release-sop.md` and `docs/sop/compliance-sop.md`.

## Preconditions — all must pass

1. G1 contract gate passed — no unfrozen contract change.
2. G2 quality gate passed — lint, format, test, uvue guard, server checks.
3. G3 review gate passed — code review and security review have no blockers.
4. Milestone exit criteria met (`docs/project-execution-plan.md` §3).
5. Compliance checklist complete (`docs/sop/compliance-sop.md`).
6. Fixed evaluation set rerun if models or scoring rules changed.
7. Performance verified on a release build, never a debug build.

## Compliance checklist

- Business entity and scope of operations.
- ICP filing, public security filing, app filing.
- Privacy policy and user agreement reachable via real links.
- SDK and personal-data collection inventory.
- Storage retention and deletion mechanism.
- Generative AI, deep synthesis, and algorithm filing assessment.
- Penetration test and incident response plan.
- Payment and tax plan.

## Product privacy red lines

- No raw recordings or audio persisted; resumes used for the current analysis only.
- Recordings not used for training by default.
- Self-service deletion for resume, recording, transcript, and account.
- AI must not impersonate a human; AI rewrites labelled as suggestions; fabricated data visibly marked.
- Scores cite evidence; low confidence is not dressed up as a precise score; the LLM never alters evidence or scores.

## Deliverable

Fill the release admission record at `docs/releases/YYYY-MM-DD-<version>.md`, including the precondition table, rollout and rollback plan, and the written QA/security conclusion.

## Fail

Any failing precondition means do not release — return to the matching phase. Missing compliance is high risk and must not ship. A written QA/DevOps conclusion is mandatory; verbal approval is not enough.
