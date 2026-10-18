# 契约冻结：QuestionItem.techStack 字段与选题过滤策略

- 日期：2026-10-18
- 任务卡：docs/tasks/2026-10-18-question-bank-expansion.md（批次 A）
- 链位：完整链 · 契约冻结环（G1）
- 状态：**待双端签字**（签字后批次 A 方可实现）

## 1. 变更对象与字段 diff

`QuestionItem`（题目卡）新增可选技术栈字段，**双端同步**：

| 端     | 文件                            | 变更                                                                                                                         |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 客户端 | `types/interview.uts`           | `QuestionItem` 末尾（`resumeRisk` 之后）新增 `techStack: string // 技术栈标签；''=通用题，非空=绑定特定栈（如 'java'/'go'）` |
| 服务端 | `server/src/types/interview.ts` | 同上，字段名/类型/位置一致                                                                                                   |

- 不改 `PositionId`（'devops'/'ai' 已在双端类型联合内）。
- 不改任何既有字段的名称、类型、语义；本字段为纯增量，缺省行为由值 `''` 表达（UTS 无默认值机制，存量数据逐题显式标注）。

## 2. techStack 值域与语义

- 类型：`string`，**开放小写 token 枚举**；首批合法值：`''`（通用）、`'java'`、`'go'`。
- 新增值（如 `'python'`、`'react'`）须在本文件附录登记后方可使用。
- 判定原则：题面、misconceptions、expectedEvidence、followupPrompts **任一处含特定语言/运行时专有概念**（如 JVM、线程池、goroutine、GC 调优）即标该栈；四者全部语言无关才可标 `''`。
- `techStack` 与 `positionId` 正交：`positionId` 决定岗位方向过滤，`techStack` 决定方向内栈匹配。

## 3. 选题过滤策略（双端 question-selector 一致实现）

候选集 = 现状过滤（positionId + 经验档位难度白名单）之后，追加技术栈过滤：

| 用户简历技术栈（来自 resume 解析 `techStack` 数组） | 可抽题目                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 无简历 / 简历无技术栈                               | **全量候选**（现状行为，零变化）                                                                 |
| 有栈（如 `['go', 'docker']`）                       | `techStack === ''` 的题 ∪ `techStack ∈ 简历栈` 的题；`techStack='java'` 且简历无 java → **排除** |

- 追问（followup）与收束题同样受此过滤约束。
- 匹配大小写不敏感（简历栈 token 统一小写后比对）。
- **无简历用户行为必须零变化**（回归断言进 spec）。

## 4. 影响面

1. 双端 `QuestionItem` 类型 + `question-bank` 数据：存量 36 题（backend 24 + frontend 12）逐题标注；新增 devops/ai 题全部 `''`（运维与 AI 工程题按现行内容为语言无关；若后续出语言特定题按值域登记）。
2. 双端 `question-selector`：追加栈过滤逻辑（上文 §3）。
3. 简历技术栈 → 选题器传参链路：解析结果进 `userStore`，会话创建时随 blueprint 传至引擎（具体落点：`store/user-profile.uts` 会话参数 + `server/src/services/interview.ts` 会话创建参数，两端字段名 `resumeTechStacks: string[]`）。
4. `tests/rules-consistency.spec.ts`：双端 question-bank 逐字比对继续生效（含新字段）。
5. **评测集纪律（domain-content-sop §6）**：选题规则变更，合并前重跑固定评测集（`pnpm test` 内 evals spec），基线 `docs/evals/2026-09-24-baseline-v1.md` 阈值不回退。
6. 会话创建 API 出参/入参新增 `resumeTechStacks`：仅服务端内部消费，不进客户端持久化契约。

## 5. 传播与回退

- 双端实现须对照本文件逐条落地；G2 校验双端字段一致。
- 冻结后再变更 techStack 语义/值域 → 重新冻结并在任务卡 risks 登记。
- 回退方案：字段保留、过滤逻辑关闸（selector 内跳过栈过滤）即可恢复现状，无数据迁移。

## 6. 签字

| 端           | 签字人                              | 日期       | 结论        |
| ------------ | ----------------------------------- | ---------- | ----------- |
| 客户端（FE） | 用户（PO 兼内容运营，单人主体项目） | 2026-10-18 | ✅ 确认生效 |
| 服务端（BE） | 用户（PO 兼内容运营，单人主体项目） | 2026-10-18 | ✅ 确认生效 |

> 签字方式：用户回复确认本冻结文档即为双端签字生效（PO 兼内容运营，单人主体项目）。
> **已生效（2026-10-18）**：用户回复「确认冻结文档」，双端签字完成，批次 A 可进入实现。

## 7. 附录：值域扩展登记（2026-10-18 批次 A · 内容库接入）

背景：出题数据源切换为云端内容库（`mentorloop.interview_questions`）后，`tech` 为受控词表内的**中文展示名**。
按 §2「新增值须在本文件附录登记后方可使用」，登记如下（字段名/类型/语义**不变**，仅扩值域）：

- 映射源：桌面端 `app/data/techVocabulary.ts`（唯一权威词表，只读复用），
  服务端镜像 `server/src/data/tech-vocabulary.ts`（`(module, 中文名) → id`）。
- 值域 = 词表 `id`（小写短码）集合，按方向隔离：同一中文名在不同 module 可映射不同 id
  （如「网络」frontend/backend/devops 均为 `network`；「安全」frontend/devops 均为 `security`）。
- 无对照 / 空值 → `''`（通用题），在适配层留痕。原 `'java'`/`'go'` 仍在值域内（`Java`→`java`、`Go`→`go`）。
- 全量登记（方向 : id 列表）：
  - frontend：`web, css, javascript, typescript, react, vue, engineering, performance, security, network, flutter, rn, ios, android, electron, tauri, uniapp, harmony, miniprogram, node, echarts, d3, webgl, canvas, vizbase, general, arch, testing`
  - backend：`java, go, python, gin, fastapi, system, micro, mq, mysql, postgresql, redis, nosql, network, spark, hive, kafka, flink, dw, sched, es, dbtheory, general, autotest, testtheory, perftest`
  - devops：`linux, network, sre, docker, cicd, k8s, cloud, compute, storage, govern, security, general, db, cache, observability, iac`
  - ai：`prompt, rag, agent, train, infra, eval, data, edge, cv, nlp, rec, engine, serving, compress, general`
- 选题过滤策略（§3）零变更：`''` 恒可抽；简历栈为空不过滤；非空则须命中文档登记值域内的 token。
- 回退：值域扩展不改变字段契约；如需收紧，改适配层映射表即可，无数据结构变更。
