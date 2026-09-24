# MentorLoop SOP 系统（主文档）

生成日期：2026-09-24
定位：把「项目系统规范 + Agent skill 映射 + 里程碑/合规」变成**可重复执行的流程与门禁**，让任何 Agent 或人都按同一条链路交付。
原则：单一事实来源 · 门禁前置 · 产物可审计 · 可被 Agent 承载 · 与里程碑对齐。

> 本目录是 `project-execution-plan.md` 与 `closure-development-plan.md` 的**流程补充**，不重复里程碑、预算与任务台账。

---

## 1. 分层架构

| 层                  | 内容                                                        | 承载位置                                                |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| **L0 治理层**       | 冻结决策、变更管理、角色职责、里程碑基线                    | `project-execution-plan.md` §9–10、`roles-sop.md`       |
| **L1 生命周期 SOP** | 定义 → 构建 → 验证 → 交付                                   | 本文档 §3–4                                             |
| **L2 领域 SOP**     | 客户端 / 服务端 / 内容 / 设计系统 / 原生插件 / 支付合规     | 本文档 §5                                               |
| **L3 执行 SOP**     | 单次任务的操作手册（命令 + checklist + 产物路径）           | `task-card-sop.md`、`quality-gate-sop.md`               |
| **L4 自动化承载**   | 项目级 skill + 入口规则，把 L1–L3 变成 Agent 自动加载的约束 | `.trae/skills/mentorloop-*`、`.trae/rules/sop-entry.md` |

---

## 2. 生命周期主线

```
① 定义            ② 构建           ③ 验证           ④ 交付
任务卡·八要素  →  实现·TDD     →   代码审查      →  发布·灰度
契约冻结·双签     模块化 commit     安全审查         复盘·风险登记
计划拆解          质量门禁          验收准入·QA结论   度量回填
      │G1              │G2              │G3               │G4
   契约双签         门禁全绿          准入通过          发布准入
```

| 阶段   | 子步骤                           | 输入        | 产物                         | 责任            |
| ------ | -------------------------------- | ----------- | ---------------------------- | --------------- |
| ① 定义 | 受理任务卡 → 契约冻结 → 计划拆解 | 需求 / 缺口 | 任务卡、契约冻结单、实施计划 | PO + MP-PM + FA |
| ② 构建 | 实现（TDD + 模块化 commit）      | 实施计划    | 代码 + 单测 + commit         | FE / BE / AI    |
| ③ 验证 | 代码/安全审查 → 验收             | 构建产物    | 审查结论、验收结论           | QA + UX         |
| ④ 交付 | 发布 → 复盘                      | 验收结论    | 发布准入单、复盘报告         | QA + LC         |

> **流转方式**：链式（顺序 + 产物 + 门禁），**不共商**。链长按风险裁剪为**微链 / 标准链 / 完整链**，见 [pipeline-sop.md](./pipeline-sop.md)；默认**瘦模式**，非必要不起子代理。

---

## 3. 门禁体系

| Gate          | 位置   | 检查项                                                                          | 通过标准             | 失败动作     | 承载                                                             |
| ------------- | ------ | ------------------------------------------------------------------------------- | -------------------- | ------------ | ---------------------------------------------------------------- |
| **G1 契约门** | ① → ②  | 任务卡八要素齐全；`types/`·`api/` 变更双签；验收标准可测                        | 双签留痕、验收可判定 | 退回定义     | `mentorloop-task-card`                                           |
| **G2 质量门** | ② → ③  | `pnpm check`、`check-uvue-css.mjs`、server typecheck/test/build、新增逻辑有单测 | 全绿                 | 不得进入验证 | `mentorloop-quality-gate`                                        |
| **G3 准入门** | ③ → ④  | 代码审查无阻断、安全审查无高危、验收逐项核验、产品红线复核                      | 结论书面通过         | 打回构建     | `admission-sop.md` + `TRAE-code-review` / `TRAE-security-review` |
| **G4 发布门** | ④ 出口 | 里程碑出口标准、合规清单（文档 06 §5）、评测集回归、release 包性能              | 全部勾选             | 不发布       | `release-sop.md` + QA/DevOps 结论                                |

> 铁律：模型或评分规则变更**必跑固定评测集**；发布**必须**有 QA/安全书面准入结论。
>
> ✅ **评测集 v1 已建立**：`tests/evals/`（15 条用例，覆盖选题 / 追问 / 评分三层，`pnpm test` 执行）。G4 的「评测集回归」项现可执行；**阈值基线与人工抽检制度已建立**（基线 15/15 全绿、结构性断言 100% 方可合入、CO+AI 按层抽检），见 `docs/evals/2026-09-24-baseline-v1.md`。

---

## 4. 领域 SOP 矩阵

| 领域                   | 关键约束（引用）                    | 专属门禁                    | 承载                                                                                                                 |
| ---------------------- | ----------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 客户端 uvue/UTS        | README §5 硬约束                    | `check-uvue-css` + 类型约束 | `mentorloop-system-spec`                                                                                             |
| 服务端 Fastify         | 统一响应、幂等键、契约镜像 `rules/` | server typecheck/test/build | `domain-server-sop.md` + `mentorloop-server-conventions`                                                             |
| 内容（题库/图谱/量表） | AI 产物须人工审核                   | 审核留痕                    | `domain-content-sop.md` + `mentorloop-content-review`                                                                |
| 设计系统               | token 三方一致、双表面、无障碍      | 设计评审 checklist          | `domain-design-sop.md` + `mentorloop-role-uiux-designer`（+ `avatar-design` / `lipsync-spec` / `interview-room-ux`） |
| 原生插件               | 降级不得伪造；音频帧不进响应式      | 真机验证 + 取证             | `domain-native-sop.md` + `screenshot`                                                                                |
| 支付与合规             | 回调验签、服务端账本权威、合规清单  | 渗透测试 + 合规核验         | `compliance-sop.md` + `mentorloop-release-check`                                                                     |

---

## 5. 角色与 RACI

角色目录（10 个角色）、完整 RACI、门禁职责与交接接口见 [roles-sop.md](./roles-sop.md)。

| 阶段   | PO    | MP-PM | FA  | UX  | FE    | BE    | AI    | CO  | QA      | LC  |
| ------ | ----- | ----- | --- | --- | ----- | ----- | ----- | --- | ------- | --- |
| ① 定义 | **A** | R     | R   | C   | C     | C     | C     | C   | I       | I   |
| ② 构建 | I     | C     | C   | R   | **R** | **R** | **R** | R   | I       | I   |
| ③ 验证 | C     | C     | C   | R   | R     | R     | C     | C   | **A**   | C   |
| ④ 交付 | C     | C     | I   | I   | R     | R     | I     | I   | **A/R** | R   |

> PO=产品负责人，MP-PM=小程序产品经理，FA=可行性分析师，UX=UI/UX 设计师，FE=客户端工程师，BE=后端工程师，AI=AI 工程师，CO=内容运营，QA=QA/DevOps，LC=合规/法务。
> 小团队可兼任，但 **QA、题库审核（CO）、AI 评测责任不可省略**（文档 05）。

---

## 6. 度量与改进

- **产品北极星**（已有）：完成模拟面试数、面试完成率、报告查看率、报告后 7 日训练完成率、14 日复测率、付费转化、单场毛利。
- **SOP 自身指标**（新增）：门禁一次通过率、返工率、契约冻结后变更次数、缺陷逃逸率、SOP 遵循率。
- 每周五例会回填，偏差写入风险登记册。

---

## 7. 落地路线

| 批次       | 内容                                                   | 状态                    |
| ---------- | ------------------------------------------------------ | ----------------------- |
| **批次 1** | `mentorloop-system-spec` + 任务卡 SOP + G2 质量门 SOP  | ✅ 已落地（2026-09-24） |
| **批次 2** | 契约冻结 SOP（G1）+ 服务端/内容领域 SOP                | ✅ 已落地（2026-09-24） |
| **批次 3** | 发布准入 SOP（G4）+ 合规 SOP                           | ✅ 已落地（2026-09-24） |
| **批次 4** | 缺口补齐：G3 准入 SOP + 设计系统 / 原生插件领域 SOP    | ✅ 已落地（2026-09-24） |
| **批次 5** | 角色体系：10 角色目录 + RACI + 门禁职责 + 3 角色 skill | ✅ 已落地（2026-09-24） |
| **批次 6** | 链式流水线：链型裁剪 + 角色挂链位 + 瘦模式 + 节流规则  | ✅ 已落地（2026-09-24） |

---

## 8. SOP 文档与产物模板

| SOP 文档                 | 覆盖                                          |
| ------------------------ | --------------------------------------------- |
| `roles-sop.md`           | 角色体系：目录 / RACI / 门禁职责 / 交接接口   |
| `pipeline-sop.md`        | 链式流水线：链型裁剪 / 挂链位 / 瘦模式 / 节流 |
| `task-card-sop.md`       | 任务卡八要素 + G1 入口                        |
| `quality-gate-sop.md`    | G2 质量门                                     |
| `contract-freeze-sop.md` | G1 契约冻结与双签                             |
| `domain-server-sop.md`   | 服务端领域约定                                |
| `domain-content-sop.md`  | 内容领域审核与变更                            |
| `domain-design-sop.md`   | 设计系统：token / 双表面 / 图标 / 无障碍      |
| `domain-native-sop.md`   | 原生插件：契约降级 / 性能 / 真机验证          |
| `admission-sop.md`       | G3 准入门：审查 + 验收 + 红线复核             |
| `release-sop.md`         | G4 发布准入                                   |
| `compliance-sop.md`      | 上线合规清单                                  |

| 产物               | 产出路径                                      |
| ------------------ | --------------------------------------------- |
| 任务卡（八要素）   | `docs/tasks/YYYY-MM-DD-<slug>.md`             |
| 门禁记录（G2）     | `docs/tasks/YYYY-MM-DD-<slug>.gate.md`        |
| 验收结论（G3）     | `docs/tasks/YYYY-MM-DD-<slug>.accept.md`      |
| 设计评审结论（UX） | `docs/tasks/YYYY-MM-DD-<slug>.design.md`      |
| 契约冻结单         | `docs/contracts/YYYY-MM-DD-<slug>.freeze.md`  |
| 发布准入单         | `docs/releases/YYYY-MM-DD-<version>.md`       |
| 评测报告（AI）     | `docs/evals/YYYY-MM-DD-<范围>.md`             |
| 复盘报告           | `docs/releases/YYYY-MM-DD-<version>.retro.md` |

---

## 9. 与现有文档的关系

- **复用不重写**：`closure-development-plan.md`（任务台账）、`project-execution-plan.md`（里程碑/风险/决策）、`README.md` §5（编码约束）、`design-system/mentorloop/MASTER.md`（设计系统）。
- **新增**：本目录 SOP 文档、`.trae/skills/mentorloop-*` 项目级 skill、`.trae/rules/sop-entry.md` 入口规则、`tests/evals/` 固定评测集。
- **单一事实来源**：SOP 只**引用**规范条款，规范条款只写在原处。
