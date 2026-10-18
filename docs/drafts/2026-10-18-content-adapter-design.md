# 设计稿：移动端内容库适配层（批次 A 前置）

- 日期：2026-10-18
- 任务卡：`docs/tasks/2026-10-18-cloud-bank-integration.md`（批次 A）
- 状态：**已实现（批次 A，2026-10-18）** —— 落地记录与偏差见任务卡 §10（含 1 项已裁定阻塞项，见 §9）

## 1. 目标

把云端 `mentorloop.interview_questions`（16453 题）适配为 MP 出题引擎可消费的 `QuestionItem`，同时保留现有六维评分/报告体系与追问引擎，且**不修改桌面端仓库**。

## 2. 架构（裁决 2026-10-18：题目**同步进 MP 云库**，非跨库直查）

```
【同步】scripts/sync-content-questions.mjs（可在云端复用云服务执行）
  ├─ 源：SELECT ... FROM mentorloop.interview_questions（桌面库，同实例，只读）
  ├─ 适配层 server/src/services/content-mapper.ts（预计算：字段映射 + 六维分类 + 题面生成 + tech 归一）
  └─ 目标：MP 云库 mentorloop_mp.questions（新增表，见 §12；幂等 upsert）

【出题】选题器 engine/question-selector（候选池来自 MP 本库）
  └─ 仓储 server/src/services/content-bank.ts（新增）：SELECT ... FROM questions（本库，无跨库）
       └─ 本地开发/测试：同结构 SQLite 表 + fixture 灌入（§6）
```

- **解耦**：出题完全走 MP 本库；与桌面库的耦合收敛到「同步脚本」一处
- **预计算**：六维、题面、tech token 在同步时算好落库 → 出题零开销
- 同步可复用用户已建的 MP 云服务执行（云端容器内网可达同实例）

## 3. 数据流（单场标准面试 7 题）

1. 建会话：记 `positionId`（=module）、`experienceLevel`
2. 每次出题：`questions` 仓储按 `position_id` + `difficulty` 查候选（本库索引）→ 选题器按「六维覆盖优先 → 难度优先级 → techStack 过滤（复用冻结逻辑）」挑选 → 返回 `QuestionItem`
3. 已答记录：沿用 `session_asked`（单场内去重）；跨场次去重见批次 B
4. 收束：**收束题不进题库**，由引擎侧固定模板提供（§5.6）

## 4. 实证取值域（只读取证，非推测）

| 列               | 实测                                                                                                   | 说明                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `type`           | `hot` 14779 / `special` 1674                                                                           | 仅两值；special 数 = hard 数（同 1674） |
| `license`        | `unknown` 12440 / `cc-by-sa` 1712 / `proprietary` 936 / `apache-2.0` 590 / `mit` 406 / `cc-by-4.0` 369 | **75.6% unknown**                       |
| `source_type`    | `unknown` 11818 / `official-docs` 4635                                                                 | 溯源缺口大                              |
| `difficulty`     | `easy`6182 / `medium`8597 / `hard`1674（非标准值 0）                                                   | 1:1 → junior/mid/senior                 |
| `tech`           | 中文展示名（"网络"/"Agent"/"Kubernetes"）                                                              | 非词表 id                               |
| `keywords`       | JSON 数组字符串：`["DNS","解析","递归","迭代"]`                                                        | 分类器主输入                            |
| `skill`          | 样本全 `null`                                                                                          | 不可用                                  |
| `q` 形态         | 知识点标题（"DNS 解析过程"、"K8s 中 Pod 的探针"）                                                      | **非完整问句**                          |
| `a` 形态         | 参考答案，非空                                                                                         | 评分证据基准                            |
| published 池空值 | q/a/keywords/tech/subtrack **均 0 空**                                                                 | 完整性优秀                              |
| id               | `bq37`/`aq44`/`oq16`（已带方向前缀）                                                                   | 唯一，可直接用                          |

## 5. 字段映射规则

### 5.1 直映

| QuestionItem   | 来源          | 规则                                                                     |
| -------------- | ------------- | ------------------------------------------------------------------------ |
| id             | `id`          | 直接用（已唯一）；加 `iq-` 前缀可选                                      |
| positionId     | `track`       | 前缀 → module：`fe-*`→frontend、`be-*`→backend、`op-*`→devops、`ai-*`→ai |
| knowledgePoint | `keywords[0]` | 解析 JSON 数组首项                                                       |
| difficulty     | `difficulty`  | easy→junior / medium→mid / hard→senior                                   |
| subAbility     | `subtrack`    | 赛道 id（fe-web / op-k8s / ai-app…）                                     |
| weight         | `weight`      | 选题排序因子（新增）                                                     |

### 5.2 techStack（**触及冻结值域**）

库内 `tech` 是中文名；冻结契约值域为小写 token（''/java/go）。
**方案**：新增映射表 `tech → token`，规则源**复用桌面端 `techVocabulary.ts`**（name→id 对照，如 "Kubernetes"→k8s、"Java"→java、"网络"→network）。

- 默认落 `''`（通用）当无对照；无法对照的记 `''` 并在日志留痕
- 结论：**契约不推翻**，仅把值域实现为「词表 id 集合」而非硬编码三项

### 5.3 type（仅 hot/special）

映射：`hot` → `scenario`（常规场景题）；`special` → `design`（深挖/设计题）。

> 依据：special 集合与 hard 集合数值一致，语义上对应高价值深挖题。

### 5.4 abilityDomain（六维，用户裁决：保留六维 + 分类器）

新增 `engine/dimension-classifier.uts` + 服务端镜像，输入 `keywords[] + subtrack + tech + type`，输出六维之一：

- 规则表（关键词→维度）优先，命中多者取胜；无命中按 `subtrack` 归属表兜底；仍无 → `knowledge`
- 规则表初始由桌面端词表 + 六维语义人工整理（约 100–150 条关键词），落 `data/dimension-rules.uts`（双端）
- 分类结果写入 `subAbility` 之外的独立字段或复用 `abilityDomain`（六维覆盖策略不变）

> 该分类器是**新增纯逻辑**，按门禁要求须带单测，且**双端镜像一致**（复用 rules-consistency 断言）。

### 5.5 题面生成（q 为标题，需包装为问句）

新增 `engine/question-phrasing.uts`（双端镜像），把标题式 `q` 生成为面试问句：

- 基础模板（确定性、可测）：按 `type` 选模板
  - hot：`请说明「{q}」的原理，并结合你的项目经历谈谈实际处理方式。`
  - special：`请结合具体案例，说明你在「{q}」上的设计与取舍。`
- 可选增强：`LLM_ENABLED=true` 时由 LLM 改写为更自然的问句（失败回退模板，**绝不阻塞出题**）

> 设计原则：默认零 LLM（可测、零成本、离线可用），LLM 仅增强。

### 5.6 缺口字段

| 字段             | 处理                                                |
| ---------------- | --------------------------------------------------- |
| misconceptions   | 留空（由追问引擎动态生成）                          |
| followupPrompts  | 留空（全走引擎动态生成）                            |
| expectedEvidence | 取 `a`，**摘要化**（超阈值截断，见 §7）             |
| resumeRisk       | `weight>=4` 或 keywords 命中简历关键词 → true       |
| 收束题           | 不进云池；引擎侧固定模板（保留 3 个岗位化收束模板） |

## 6. 本地桩（fixture）

本地无云 MySQL（`MYSQL_HOST` 空 → SQLite），跨库查询不可行。方案：

- 从 `devmentor.db` 导出**每方向有界样本**（如每 track 40 题，覆盖三档难度）为 `server/src/data/content-fixture.json`
- 导出脚本放 **MP 仓库**（`scripts/export-content-fixture.mjs`），读桌面端只读库 → 写 fixture；**不修改桌面端仓库**
- 用途：本地开发、单测、evals（云池固定 ID 快照的落地形态）
- 纪律：fixture 是采样快照，**生产不消费**；其存在使出题链路在离线可测

## 7. 性能与评分

- 查询：单次出题 1 条 SELECT，命中 `idx_iq_track_subtrack` / `idx_iq_status`；候选集 `LIMIT` 预取（如 200 条）后在内存筛选
- 缓存：按 `(track, difficulty)` 缓存候选 id 列表，TTL 10 分钟（可选，先做无缓存版本，压测后再定）
- `a` 摘要化：`expectedEvidence` 上限（如 400 字）截断，规则写入 spec；报告侧不展示全文，避免超长

## 8. 接口与契约影响

- `QuestionItem` **字段不变**（techStack 值域实现方式调整，不新增字段）
- `/interview/next` 出参语义变化：题来自云池 → 在契约文档补「变更说明」，**不重冻结字段**
- 新增环境变量说明（`.env.example`）：复用 `DESKTOP_DB_NAME`，补注「同时承载内容库只读查询」

## 9. 阻塞项 —— 已裁决（2026-10-18）

**license 合规**：published 池中 `unknown` 占 75.6%（12440 题）、`proprietary` 936 题、`source_type` unknown 占 71.8%。

**裁决（用户 2026-10-18）：全量可用 —— `unknown` 视为自有整理/自研内容（版权自有）。**
落地规则：

- 抽取池 = `status='published'` **全量 15517 题**（不做 license 过滤）
- 仍保留 `license` 列读取，用于将来合规审计与白名单开关（网关内留过滤参数，默认不过滤）
- 设计稿保留原始三选项记录，供后续复核（若日后收紧授权范围，改过滤参数即可，无数据结构变更）

## 10. 测试策略

- 适配层单测：字段映射逐列断言（含 tech 对照、难度映射、六维分类命中）
- 分类器单测：规则命中/兜底/双端一致
- 题面生成单测：模板确定性（同输入同输出）
- fixture 驱动的出题链路测：四方向各出满一场，断言无重复、六维覆盖、难度分布符合档位
- evals：评测集改为「fixture 固定 ID 快照」的确定性断言
- 云端联调：部署后抽样核对云题 id 与题面（G3 走查）

## 11. 待核项（开工后补）

- `weight` 实际分布（是否 1–5）与是否作为 resumeRisk 判据
- 桌面端既有分类规则可否直接借用（减少新建规则表工作量）
- 同步频率（一次性 / 按需 / 定期）与触发方式（云服务定时任务 or 手动执行）

## 12. MP 侧题目表设计（`mentorloop_mp.questions`）

同步落库形态 = **源列（保留追溯） + 适配预计算列（出题直接消费）**：

| 列                | 类型           | 来源 / 说明                                             |
| ----------------- | -------------- | ------------------------------------------------------- |
| `id`              | VARCHAR(64) PK | 源 id（`bq37`/`aq44`/`oq16`…）                          |
| `position_id`     | VARCHAR(16)    | 适配：track 前缀 → module（frontend/backend/devops/ai） |
| `track`           | VARCHAR(64)    | 源 track（保留，供赛道筛选）                            |
| `subtrack`        | VARCHAR(64)    | 源 subtrack（作 `subAbility`）                          |
| `difficulty`      | VARCHAR(16)    | 适配：easy/medium/hard → junior/mid/senior              |
| `ability_domain`  | VARCHAR(32)    | **预计算**：六维（分类器输出）                          |
| `content`         | TEXT           | **预计算**：题面生成后的问句（非原始标题）              |
| `content_raw`     | TEXT           | 源 `q`（保留原标题，供追溯与复核）                      |
| `evidence`        | TEXT           | 源 `a`，摘要化截断（§7）                                |
| `knowledge_point` | VARCHAR(255)   | 源 `keywords[0]`                                        |
| `keywords`        | TEXT           | 源 `keywords`（JSON 串，供分类追溯）                    |
| `tech_token`      | VARCHAR(64)    | **预计算**：中文名 → 词表 id（无对照落 `''`）           |
| `weight`          | INT            | 源 `weight`                                             |
| `q_type`          | VARCHAR(32)    | 源 `type`（hot/special）                                |
| `license`         | VARCHAR(64)    | 源（默认不过滤，保留合规审计）                          |
| `synced_at`       | BIGINT         | 同步时间戳（供增量与排障）                              |

- **索引**：`(position_id, difficulty)`、`(position_id, ability_domain)`、`status`
- **同步策略**：只取源 `status='published'`；幂等 upsert（`ON DUPLICATE KEY UPDATE`，复用 MP `db-driver` 的 SQLite→MySQL 方言翻译）；同步后逐方向 count 校验，不一致即非零退出
- **建表**：`deploy/cloud/baseline-mp-mysql.sql` 增表段（10 表）；本地 SQLite 由 `createDb` 自举同结构（`server/src/schema.sql` 同步加表）
