---
name: mentorloop-quality-gate
description: Run the MentorLoop G2 quality gate commands and report pass or fail before committing. Use when finishing client or server code changes. 中文触发 质量门 门禁 提交前 自检 跑测试. Do not use for planning or documentation-only edits.
---

# MentorLoop Quality Gate (G2)

Run this gate before committing or moving to the verify phase. A failing gate blocks progress; fix and rerun from the first check.

Read `docs/sop/quality-gate-sop.md` for the full procedure and the gate record template.

## Root project (client + toolchain)

Run each and report the result:

```bash
pnpm lint
pnpm format:check
pnpm test
node scripts/check-uvue-css.mjs
pnpm typecheck
```

- `pnpm lint` must be 0 errors and 0 warnings.
- `pnpm format:check`, `pnpm test`, and the uvue CSS guard must pass.
- `pnpm typecheck` is not blocking in CI (vue-tsc needs HBuilderX), but new pure logic in `engine/`, `store/`, `types/` must pass locally.

`pnpm check` runs lint + typecheck + test, but it does not run `format:check` or the uvue guard — run those separately.

## Server subpackage

```bash
pnpm --filter @mentorloop/server typecheck
pnpm --filter @mentorloop/server test
pnpm --filter @mentorloop/server build
```

All three must pass.

## Coverage judgement

- New or changed pure logic has tests (frontend in `tests/`, server in `server/src/*.spec.ts`).
- Bug fixes add a failing-then-passing test.
- Do not delete or skip existing tests to pass the gate.

## Domain additions

- `.uvue` / `.uts` changes follow the `mentorloop-system-spec` skill.
- `types/` / `api/` changes have a signed contract freeze.
- `server/` writes use the unified `{code,data,message}` response and are idempotent.
- Design tokens stay aligned across `main.css` `@theme`, `styles/theme.uts`, and `MASTER.md` §A1.

## Failure handling

Stop the commit, fix, and rerun from the first check. Never use `eslint-disable`, skip tests, or relax rules to pass. If a change touches `types/` or `api/` fields, return to G1 and re-freeze the contract.
