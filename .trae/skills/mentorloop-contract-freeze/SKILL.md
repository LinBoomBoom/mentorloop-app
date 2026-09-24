---
name: mentorloop-contract-freeze
description: Detect and record MentorLoop contract changes in types or api before implementation. Use when a task changes types, api or server response shapes. 中文触发 契约冻结 接口契约 双签 字段变更 端点. Do not use for refactors that keep the contract unchanged.
---

# MentorLoop Contract Freeze (G1)

Client and server freeze the interface contract before working in parallel. Freeze first, then build. Read `docs/sop/contract-freeze-sop.md` for the full procedure.

## Triggers

Freeze is required when a change touches any of:

- `types/*.uts` (interview, scoring, resume, auth, tracking)
- `api/*.uts` (client, env, auth, interview, resume, report, membership, asr, tracking, speech)
- Server response shapes: `server/src/types/*.ts`, `server/src/routes/*.ts`, `server/src/rules/*`
- Adding, removing, or renaming an endpoint

No freeze is needed for internal refactors that keep fields and semantics unchanged, pure UI changes, or docs.

## Steps

1. Identify from the task card whether the contract is touched.
2. Draft a freeze record listing endpoints, field diffs, and impact.
3. Get both a client sign-off and a server sign-off. Either missing means do not start.
4. Write the record to `docs/contracts/YYYY-MM-DD-<slug>.freeze.md`.
5. Implement on both sides against the frozen record.
6. In G2, verify the two sides' fields match.

## After freezing

- Changing a frozen contract again requires re-freezing and a note in the task card risks.
- If the change affects scoring or question selection, rerun the fixed evaluation set.
- If it affects server logic, mirror it in `server/src/rules/*` to keep both sides aligned.

## Fail

Unsigned freeze means stop and return to definition. Field mismatch caught by G2 means re-freeze.
