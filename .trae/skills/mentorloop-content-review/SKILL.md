---
name: mentorloop-content-review
description: Prepare and validate MentorLoop ability maps, question banks and scoring rubrics for human review. Use when adding or changing questions, ability maps or scoring anchors. 中文触发 题库 能力图谱 评分量表 评分锚点 内容审核. Do not use for runtime code changes.
---

# MentorLoop Content Review

Content assets decide interview quality and scoring credibility, and AI output must be reviewed by a human. Read `docs/sop/domain-content-sop.md` for the full procedure.

## Assets and authoritative files

- Ability map — `data/<position>-map.uts` (`AbilityDomain[]` with `SubAbility[]`, each carrying `observableBehavior`, `scoringAnchor`, `questionCluster`, `weight`)
- Question bank — `data/question-bank.uts` (`QuestionItem[]`)
- Scoring rubric — `engine/rubric.uts`
- Position switch — `data/position-options.uts` (`available`)
- Server mirror — `server/src/data/*`, `server/src/rules/*`

## Structural rules

- Every question attaches to an `abilityDomain` and `subAbility` that exist in the map, and its `questionCluster` must exist too.
- Ability map weights must align with the rubric weights (six dimensions 25/25/20/15/10/5).
- Every question fills `misconceptions` and `expectedEvidence` — these drive scoring and follow-ups.
- `resumeRisk` marks questions used to verify high-value resume projects.
- A new position needs map plus question bank plus `position-options` before `available: true`.

## Review flow

1. Draft the content.
2. Self-check against the checklist below.
3. Human review by product owner plus content ops; record approval (Lark approval is acceptable).
4. Log the reviewer and date.
5. Merge into `data/` and `server/src/data/`.

## Checklist

- Attached domain and sub-ability exist in the map.
- `questionCluster` matches the map; questions grouped correctly.
- Map weights align with the rubric.
- Every question has `misconceptions` and `expectedEvidence`.
- No duplicate questions and no overlap with historical material.
- No privacy-invasive, shaming, or discriminatory wording; no leading questions.
- New position has all three places filled.
- Frontend `data/` and server `src/data/` are in sync.
- Human review logged with reviewer and date.

## Change discipline

Changing the rubric or question selection requires rerunning the fixed evaluation set before merging. Contract-affecting changes (for example `QuestionItem` fields) go through `mentorloop-contract-freeze` first.
