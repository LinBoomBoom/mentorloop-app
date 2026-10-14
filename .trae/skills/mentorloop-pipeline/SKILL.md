---
name: mentorloop-pipeline
description: Drive a MentorLoop task through the chained pipeline with risk-based chain length and artifact handoff. Use when advancing a task, walking the process, or asking for the next step. 中文触发 推进任务 走流程 下一步 链式 流水线 链长. Do not use for architectural decisions or scope disputes.
metadata:
  version: '1.1.0'
  domain: mentorloop-app
  last_updated: '2026-10-14'
---

# MentorLoop Pipeline

Advance a task through the SOP as a chain: one link, one artifact, then hand off. No multi-role deliberation. Read `docs/sop/pipeline-sop.md` for the full procedure.

## Chain length

The chain type (micro / standard / full) is determined by `docs/sop/pipeline-sop.md` and routed at task start by `.trae/rules/sop-entry.md` — do not re-derive it here. Never over-chain a small change.

## Role per link

PO builds the card; FA inserts only when framework capability, version, or a POC is involved; MP-PM inserts for mini-program scope; FE/BE/AI implement; QA runs G2 and drafts the G3 acceptance; UX walks through when UI changes; QA plus LC own G4 for releases.

## Context economy (throttling)

`.trae/rules/sop-entry.md` owns the skill-loading cap and hit arbitration; `docs/sop/pipeline-sop.md` owns chain length. In addition:

- Read SOP docs by section, not whole; keep `README.md` reads rare.
- Write artifacts to disk; do not paste their content into the conversation.
- Narrow gate output to exit code or failing lines; do not dump full test output.
- Merge same-link checks into one command.
- Do not spawn subagents by default. Spawn one only when G2 or G3 needs an independent view or the task spans modules, and then scope it to one link, handing it artifact paths directly.

## Artifacts are the fuel

Subagents are stateless, so context travels only through files.

- Task card — `docs/tasks/YYYY-MM-DD-<slug>.md`
- Freeze record — `docs/contracts/YYYY-MM-DD-<slug>.freeze.md`
- Gate record — `docs/tasks/YYYY-MM-DD-<slug>.gate.md`
- Acceptance record — `docs/tasks/YYYY-MM-DD-<slug>.accept.md`
- Release record — `docs/releases/YYYY-MM-DD-<version>.md`

## Break handling

- Missing artifact — do not advance; redo that link.
- G2 failure — return to implement and rerun from the first check.
- G3 failure — send back to build.
- Contract touched without a freeze — stop and insert the freeze link.

## Switch to deliberation only when

The decision is architectural, or scope is disputed. Then PO, FA and UX must be present together. Everything else runs as a chain.
