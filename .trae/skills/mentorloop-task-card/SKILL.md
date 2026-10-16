---
name: mentorloop-task-card
description: Create and validate a MentorLoop task card with the eight required fields before starting work. Use when a new task, gap or feature request is accepted. 中文触发 任务卡 新任务 需求 缺口 八要素 角色. Do not use for routine fixes that already have a card.
metadata:
  version: '1.1.0'
  domain: mentorloop-app
  last_updated: '2026-10-15'
---

# MentorLoop Task Card

Produce a task card before touching code for any new task, gap, or feature request, then validate it against gate G1. A card that fails G1 does not enter the build phase.

Read `docs/sop/task-card-sop.md` for the full procedure.

## Steps

1. Derive a slug from the task title (kebab-case, ascii).
2. Copy `assets/task-card-template.md` and fill all eight fields. Do not leave any field empty.
3. Run the pre-build interrogation and append it as card §9 (see below).
4. Write the card to `docs/tasks/YYYY-MM-DD-<slug>.md`.
5. Validate against the G1 checklist below.
6. If the task touches `types/` or `api/`, flag that a contract freeze is required before build.

## Eight required fields

1. Goal — one sentence on what and why now.
2. Scope — what is in scope, and explicitly what is out of scope.
3. Dependencies — prerequisites, external environment (HBuilderX, keys, licenses), contract changes.
4. Acceptance criteria — checkable conditions, not subjective wording.
5. Risks — known risks and mitigations.
6. Artifact paths — files to add or modify.
7. Roles — participating roles plus the lead, using the codes from `docs/sop/roles-sop.md`.
8. Owner — final owner, role plus executing agent.

## Pre-build interrogation (appended as card §9)

Before validating G1, append an interrogation section to the card and close every open item:

- Ask one question at a time, and give a recommended answer for each.
- If the answer is discoverable in files, code, docs, issues or logs, inspect those first instead of asking.
- Track assumptions, dependencies, risks and unresolved decisions; close each as verified (with a reference), decided, or deferred (with a date).
- Interrogate the assumptions that would hurt most if wrong — not domain basics.
- This is an appended section, NOT a ninth field: the eight required fields stay eight.

## G1 checklist

- All eight fields present.
- Pre-build interrogation (§9) closed: no open items, and nothing deferred without a date.
- Scope states what is NOT being done.
- Acceptance criteria are checkable (testable or tickable).
- Roles use `docs/sop/roles-sop.md` codes, and the lead matches the task type.
- Contract freeze completed if `types/` or `api/` changes.
- Artifact paths cover every expected file change.

Fail any item, and send the task back to definition instead of starting work.
