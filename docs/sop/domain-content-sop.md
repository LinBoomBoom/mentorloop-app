# 内容领域 SOP（题库 / 图谱 / 评分量表）

生成日期：2026-09-24
归属：SOP 系统 L2 领域层 · 领域：内容
上游：[README.md](./README.md) §4；相关：`contract-freeze-sop.md`

---

## 1. 目的与适用

内容资产直接决定面试质量与评分公信力，且**AI 产物必须经人工审核**（文档 05 §3 铁律）。本 SOP 规定内容的结构约束、审核与变更流程。

**适用**：新增/修改岗位能力图谱、题目卡、评分量表锚点、追问话术、收束题。

---

## 2. 内容资产与权威文件

| 资产         | 权威文件                                  | 结构                                                                                                                                          |
| ------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 岗位能力图谱 | `data/<position>-map.uts`                 | `AbilityDomain[]` → `SubAbility[]`（含 `observableBehavior`、`scoringAnchor`、`questionCluster`、`weight`）                                   |
| 题库         | `data/question-bank.uts`                  | `QuestionItem[]`（含 `abilityDomain`、`subAbility`、`knowledgePoint`、`misconceptions`、`expectedEvidence`、`followupPrompts`、`resumeRisk`） |
| 评分量表     | `engine/rubric.uts`                       | 六维度锚点 + 置信度分级                                                                                                                       |
| 岗位开关     | `data/position-options.uts`               | `available: boolean`（题库未就绪时置灰「敬请期待」）                                                                                          |
| 服务端镜像   | `server/src/data/*`、`server/src/rules/*` | 必须与前端一致                                                                                                                                |

---

## 3. 结构硬约束

- 每道题必须挂到图谱的 `abilityDomain` + `subAbility`，且该 `questionCluster` 在图谱中存在。
- 图谱权重须与评分量表权重对齐（六维度 25/25/20/15/10/5）。
- 每题必须填 `misconceptions` 与 `expectedEvidence`——它们是评分与追问的依据。
- `resumeRisk` 用于标记「简历高价值项目验证性追问」。
- 新增岗位：图谱 + 题库 + `position-options` 三处齐备后才可置 `available: true`。

---

## 4. 审核流程（强制留痕）

1. **产出**：AI / 内容运营起草。
2. **自检**：按 §5 清单逐项核对。
3. **人工审核**：产品负责人 + 内容运营确认（可用 `lark-approval` 走审批流留痕）。
4. **登记**：审核结论写入任务卡或审核记录，注明审核人与日期。
5. **生效**：合入 `data/` 与 `server/src/data/`。

> 图谱与题库当前标注「待产品与内容审核确认」，未确认前不得对外宣称内容已定稿。

---

## 5. 内容检查清单

- [ ] 每题挂载的 `abilityDomain` / `subAbility` 在图谱中存在。
- [ ] `questionCluster` 与图谱一致，题目已按簇归类。
- [ ] 图谱权重与评分量表对齐。
- [ ] 每题含 `misconceptions` 与 `expectedEvidence`。
- [ ] 无重复题、无与历史素材雷同（去重）。
- [ ] 无隐私/羞辱性/歧视性表述，无诱导性问题。
- [ ] 新增岗位三处齐备（图谱 + 题库 + `position-options`）。
- [ ] 前端 `data/` 与服务端 `server/src/data/` 已同步。
- [ ] 人工审核结论已留痕（审核人 + 日期）。

---

## 6. 变更纪律（评分/规则类）

- 改**评分量表**或**选题规则** → 必须重跑固定评测集，未通过不得合入（文档 05 铁律）。
  > ✅ **评测集 v1 已建立**（`tests/evals/`）。评分/选题规则变更须运行 `pnpm test` 并产出评测报告；阈值基线与人工抽检制度见 `docs/evals/2026-09-24-baseline-v1.md`（结构性断言 100% 方可合入 + CO+AI 抽检，抽检不通过不得合入）。
- 改图谱/题库 → 走 §4 审核流程；影响契约的（如 `QuestionItem` 字段）先走 `contract-freeze-sop.md`。
- 规则逻辑变更需同步 `engine/*` 与 `server/src/rules/*`。

---

## 7. 承载 skill

`mentorloop-content-review`；审批留痕用 `lark-approval`。
