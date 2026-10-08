# MentorLoop SOP 与 Skill 体系手册

> 手册版本：1.0.0 · 更新日期：2026-10-08
> 定位：把 MentorLoop 研发过程的「流程 + 门禁 + 角色 + 规范 + 治理」整理为一份**自足的总览文档**，任何 Agent 或新人从本文即可理解全貌；各规则的正本仍在对应 SOP 文件，本文引用不复述判据全文。
> 权威索引：[README.md](./README.md) §8 · 机检：`node scripts/check-sop-registry.mjs`（退出码 0 = 全绿）

---

## 一、体系目标与五层结构

本体系把「研发过程本身」当作一等产物治理：仓库同时承载**业务代码**与**研发管理资产**。管理资产分五层，职责不混：

| 层                | 名称       | 内容                                                        | 承载位置                                                         |
| ----------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **L0 治理层**     | 决策与角色 | 冻结决策、变更管理、角色职责、里程碑基线                    | `project-execution-plan.md` §9–10、`roles-sop.md`                |
| **L1 生命周期层** | 主线流程   | 定义 → 构建 → 验证 → 交付                                   | `README.md` §2–4                                                 |
| **L2 领域层**     | 领域规范   | 客户端 / 服务端 / 内容 / 设计系统 / 原生插件 / 合规         | 6 份 domain / compliance SOP                                     |
| **L3 执行层**     | 操作手册   | 单次任务的命令 + checklist + 产物路径                       | task-card / quality-gate / admission / release / pipeline SOP    |
| **L4 自动化层**   | Agent 承载 | 项目级 skill + 入口规则，把 L1–L3 变成 Agent 自动加载的约束 | `.trae/skills/mentorloop-*`（16 个）、`.trae/rules/sop-entry.md` |

一句话链条：

```
SOP（定规则） → Skill（把规则变成 AI 可执行的流程） → 机检脚本（把一致性变成可自动验证的判据）
```

四条贯穿全局的设计原则：

1. **单一事实来源**：SOP 只引用规范条款，规范条款只写在原处（如编码约束在 `README.md` §5、设计 token 在 `MASTER.md` §A1），杜绝双权威。
2. **门禁前置**：每阶段出口有硬门禁（G1–G4），失败动作明确（退回 / 打回 / 停止），不带病流转。
3. **产物可审计**：每环产物落盘（`docs/tasks|contracts|releases|evals/`），子代理无状态、上下文只靠产物传递，不口头交接。
4. **可被 Agent 承载 + 可机检**：L1–L3 全部有对应 skill；登记一致性、体量预算由 `check-sop-registry.mjs` 自动核验。

---

## 二、生命周期主线与四道门禁

### 2.1 主线（链式，不共商）

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

### 2.2 四道门禁

| Gate          | 位置   | 检查项                                                                          | 通过标准             | 失败动作     | 承载                                                             |
| ------------- | ------ | ------------------------------------------------------------------------------- | -------------------- | ------------ | ---------------------------------------------------------------- |
| **G1 契约门** | ① → ②  | 任务卡八要素齐全；`types/`·`api/` 变更双签；验收标准可测                        | 双签留痕、验收可判定 | 退回定义     | `mentorloop-task-card` + `contract-freeze-sop.md`                |
| **G2 质量门** | ② → ③  | `pnpm check`、`check-uvue-css.mjs`、server typecheck/test/build、新增逻辑有单测 | 全绿                 | 不得进入验证 | `mentorloop-quality-gate`                                        |
| **G3 准入门** | ③ → ④  | 代码审查无阻断、安全审查无高危、验收逐项核验、产品红线复核                      | 结论书面通过         | 打回构建     | `admission-sop.md` + `TRAE-code-review` / `TRAE-security-review` |
| **G4 发布门** | ④ 出口 | 里程碑出口标准、合规清单、评测集回归、release 包性能                            | 全部勾选             | 不发布       | `release-sop.md` + `compliance-sop.md`                           |

铁律：

- 模型或评分规则变更**必跑固定评测集**（`tests/evals/`，15 条用例；阈值基线见 `docs/evals/2026-09-24-baseline-v1.md`，结构性断言 100% 方可合入）。
- 发布**必须**有 QA/安全书面准入结论，不得口头放行。

---

## 三、角色体系（L0）

### 3.1 角色目录（10 角色）

| 代号      | 角色           | 核心职责                                                     | 主要产物                 | 主责门禁 |
| --------- | -------------- | ------------------------------------------------------------ | ------------------------ | -------- |
| **PO**    | 产品负责人     | 范围与优先级、验收裁决、里程碑出口、冻结决策变更             | 决策记录、里程碑评审结论 | G1 / G4  |
| **MP-PM** | 小程序产品经理 | 小程序端需求、微信平台特性、包体积与审核合规、登录与分享路径 | 小程序需求规格、审核材料 | G1       |
| **FA**    | 可行性分析师   | 技术可行性验证、官方文档核实、POC、版本兼容、风险登记        | 可行性结论、POC 报告     | G1 / G4  |
| **UX**    | UI/UX 设计师   | 信息架构、交互、视觉系统、无障碍、设计走查                   | 设计稿、设计评审结论     | G3       |
| **FE**    | 客户端工程师   | uvue / UTS / 状态机 / 感知层 / 原生插件                      | 客户端代码 + 单测        | G2       |
| **BE**    | 后端工程师     | Fastify 服务、契约、幂等、配额账本、支付                     | 服务端代码 + 单测        | G2       |
| **AI**    | AI 工程师      | 能力图谱、选题、追问、评分、报告、评测集                     | 引擎逻辑、评测报告       | G2 / G4  |
| **CO**    | 内容运营       | 题库 / 图谱 / 评分量表的审核与上新、去重与质量审查           | 审核记录                 | G1       |
| **QA**    | QA / DevOps    | 测试策略、门禁执行、验收准入、监控告警、发布准入             | 验收结论、发布准入单     | G3 / G4  |
| **LC**    | 合规 / 法务    | 备案、隐私政策与协议、算法评估、支付与税务                   | 合规台账                 | G4       |

### 3.2 RACI（按任务类型裁剪）

> A=最终负责，R=执行，C=需咨询，I=需知会。纯前端任务可省略 BE/AI/CO，纯内容任务可省略 FE/BE。

| 阶段   | PO    | MP-PM | FA  | UX  | FE    | BE    | AI    | CO  | QA      | LC  |
| ------ | ----- | ----- | --- | --- | ----- | ----- | ----- | --- | ------- | --- |
| ① 定义 | **A** | R     | R   | C   | C     | C     | C     | C   | I       | I   |
| ② 构建 | I     | C     | C   | R   | **R** | **R** | **R** | R   | I       | I   |
| ③ 验证 | C     | C     | C   | R   | R     | R     | C     | C   | **A**   | C   |
| ④ 交付 | C     | C     | I   | I   | R     | R     | I     | I   | **A/R** | R   |

### 3.3 硬纪律

- 小团队可兼任，但 **QA、题库审核（CO）、AI 评测责任不可省略**；兼任时仍须分别产出各角色的门禁产物。
- **FA 铁律**（本项目曾两次因原理推断误判框架能力）：涉及「框架/平台是否支持」必须先查官方文档；结论必须附证据来源；未验证的结论必须显式标注「未验证」；关键可行性以 POC 收口。
- 交接必须落在**产物**上（任务卡、冻结单、评审结论、审核记录），不得口头交接。

---

## 四、链式流水线（SOP-02）

### 4.1 链型（按风险裁剪，主要节流阀）

| 链型       | 适用            | 环节                                        | SOP 增量（粗估） |
| ---------- | --------------- | ------------------------------------------- | ---------------- |
| **微链**   | 单点修复、文档  | 实现 → G2                                   | ~1–2k            |
| **标准链** | 常规功能        | 任务卡(G1) → 实现 → G2 → G3                 | ~5–7k            |
| **完整链** | 契约变更 / 发布 | 任务卡(G1) → 契约冻结 → 实现 → G2 → G3 → G4 | ~8–12k           |

禁止对小改动过度拉链；链型判断偏重允许降级并说明理由。

### 4.2 角色挂链位（不共商，按位登场）

| 链位     | 角色         | 触发条件                  | 产物                     |
| -------- | ------------ | ------------------------- | ------------------------ |
| 建卡     | PO           | 标准链起                  | 任务卡（八要素，含角色） |
| 可行性   | FA           | 涉及框架能力 / 版本 / POC | 可行性结论               |
| 平台约束 | MP-PM        | 涉及小程序端              | 小程序需求规格           |
| 实现     | FE / BE / AI | 总是                      | 代码 + 单测              |
| 质量门   | QA           | 标准链起                  | 门禁记录（G2）           |
| 设计走查 | UX           | 涉及 UI 改动              | 设计评审结论             |
| 准入     | QA           | 标准链起                  | 验收结论（G3）           |
| 发布     | QA + LC      | 仅发布                    | 发布准入单（G4）         |

### 4.3 每环产物契约（链的燃料）

子代理**无状态**，上下文只靠产物传递。产物必须落盘，不得只留在对话里。

| 环   | 产物路径                                     | 下一环如何消费           |
| ---- | -------------------------------------------- | ------------------------ |
| 建卡 | `docs/tasks/YYYY-MM-DD-<slug>.md`            | 读「范围 / 验收 / 角色」 |
| 冻结 | `docs/contracts/YYYY-MM-DD-<slug>.freeze.md` | 读「字段 diff / 双签」   |
| 门禁 | `docs/tasks/YYYY-MM-DD-<slug>.gate.md`       | 读「结论 / 失败项」      |
| 准入 | `docs/tasks/YYYY-MM-DD-<slug>.accept.md`     | 读「验收核验 / 红线」    |
| 发布 | `docs/releases/YYYY-MM-DD-<version>.md`      | 读「前置条件核验」       |

### 4.4 默认瘦模式与节流 7 条（强制）

默认只加载**命中链位的 1–2 个 skill**；子代理默认不起，仅 G2 / G3 需独立视角或任务跨模块复杂时**只对该环**起。节流规则：

1. 只加载命中链位的 skill，绝不把全部 skill 都加载。
2. SOP 文档按需读章节，不整篇读；`README.md` 尽量少读。
3. 产物落盘，不在对话里重复粘贴内容。
4. 门禁输出收窄：只取退出码 / 失败行，不灌全量测试输出。
5. 链长裁剪：微链几乎零 SOP 开销。
6. 同环检查合并为一条命令。
7. 子代理单环化：只对需要独立视角的那一环起，提示词直接给产物路径。

### 4.5 断链处理

| 情况             | 处理                                 |
| ---------------- | ------------------------------------ |
| 产物缺失         | **不得流转**，回到该环重做           |
| G2 门禁失败      | 回退到「实现」环，修复后从第一项重跑 |
| G3 准入失败      | 打回「② 构建」                       |
| 链型判断偏重     | 允许降级链型，并说明理由             |
| 触及契约但未冻结 | 停下，插入「契约冻结」环             |

仅两类场景保留多角色共商：**架构级决策**、**范围争议**（PO / FA / UX 同时在场）。其余一律走链。

---

## 五、12 份 SOP 总览与核心内容

### SOP-01 角色体系与协作（`roles-sop.md`，v1.0.0）

角色目录、RACI、门禁职责、交接接口、FA 铁律、兼任规则（详见本文 §三）。更新触发：新增/移除角色 major；职责或门禁归属变更 minor。

### SOP-02 链式流水线（`pipeline-sop.md`，v1.0.0）

链型裁剪、挂链位、产物交接、瘦模式、节流、断链、共商边界（详见本文 §四）。更新触发：链型或环节增减 major；挂链位、产物契约、节流调整 minor。

### SOP-03 任务卡（`task-card-sop.md`，v1.0.0，G1 入口）

任何新任务、缺口、功能请求动代码前必须建卡；已有任务卡的日常修复与零风险文档改动免卡（commit 说明原因）。

**八要素（缺项不得进入迭代）**：

| #   | 要素     | 要求                                            |
| --- | -------- | ----------------------------------------------- |
| 1   | 目标     | 一句话说明要解决什么、为什么现在做              |
| 2   | 范围     | 明确做什么与**明确不做什么**（防范围蔓延）      |
| 3   | 依赖     | 前置任务、外部环境（HBuilderX/密钥/资质）、契约 |
| 4   | 验收标准 | **可判定**的通过条件（能写测试或能逐项勾选）    |
| 5   | 风险     | 已知风险 + 对策                                 |
| 6   | 产物路径 | 将新增/修改的文件路径                           |
| 7   | 角色     | 参与角色 + 主责，使用 `roles-sop.md` 代号       |
| 8   | 负责人   | 最终负责人（角色 + 执行 Agent）                 |

**G1 检查清单**：八要素齐全；范围写了不做什么；验收可判定（拒绝「体验良好」类主观描述）；角色代号匹配任务类型；涉及 `types/`/`api/` 已产出冻结单并双签；产物路径覆盖全部预期改动。
失败动作：任一项不通过 → 退回「① 定义」补齐，不得开工。

### SOP-04 契约冻结与双签（`contract-freeze-sop.md`，v1.0.0，G1）

客户端与后端**先冻结接口契约再并行**。

**触发条件（命中任一即需冻结）**：改 `types/*.uts`（interview / scoring / resume / auth / tracking）；改 `api/*.uts`（client / env / auth / interview / resume / report / membership / asr / tracking / speech）；改服务端出参结构（`server/src/types|routes|rules/*`）；新增 / 删除 / 重命名端点。
**不触发**：纯内部重构（字段与语义不变）、纯 UI 调整、纯文档。

**冻结对象（单一事实来源）**：客户端类型 `types/*.uts`；客户端调用 `api/*.uts`（文件头注释即端点契约）；服务端类型 `server/src/types/*.ts`（与 `types/*.uts` 字段一一对应）；服务端出参 `server/src/routes/*.ts`（统一响应 `{code, data, message}`）；规则镜像 `server/src/rules/*` ↔ `engine/*`。

**流程**：识别 → 起草冻结单（端点、字段 diff、影响面、兼容性）→ 双签（客户端 + 后端，任一未签不得开工）→ 记录到 `docs/contracts/` → 两端并行实现 → G2 核对两端字段一致。

**冻结后纪律**：再变更须重新走流程重签并在任务卡「风险」登记；影响评分/选题规则 → 必须重跑固定评测集；影响服务端逻辑 → 同步 `server/src/rules/*` 镜像。

### SOP-05 G2 质量门（`quality-gate-sop.md`，v1.1.0，构建 → 验证）

**检查项与命令**：

| #   | 检查项        | 命令                                         | 通过标准                             | 阻断 |
| --- | ------------- | -------------------------------------------- | ------------------------------------ | ---- |
| 1   | Lint          | `pnpm lint`                                  | 0 error、0 warning                   | 是   |
| 2   | 格式          | `pnpm format:check`                          | 通过                                 | 是   |
| 3   | 单元测试      | `pnpm test`                                  | 全绿                                 | 是   |
| 4   | uvue CSS 守卫 | `node scripts/check-uvue-css.mjs`            | 无 `gap` / `space-*` / 渐变          | 是   |
| 5   | 类型检查      | `pnpm typecheck`                             | 新增纯逻辑（engine/store/types）通过 | 否¹  |
| 6   | server 类型   | `pnpm --filter @mentorloop/server typecheck` | 通过                                 | 是   |
| 7   | server 测试   | `pnpm --filter @mentorloop/server test`      | 全绿                                 | 是   |
| 8   | server 构建   | `pnpm --filter @mentorloop/server build`     | 成功                                 | 是   |

¹ vue-tsc 依赖 HBuilderX 环境，CI `continue-on-error`；新增纯逻辑必须本地通过。

**覆盖要求**：新增/修改的纯逻辑有对应单测（前端 `tests/`、服务端 `server/src/*.spec.ts`）；修 Bug 先补能复现的测试；不为过门删测试。

**领域特化**：`.uvue`/`.uts` 遵守 README §5 硬约束；`types/`/`api/` 有双签冻结单；`engine/` 保持纯函数可被服务端镜像；`server/` 统一响应 + 写操作幂等；设计 token 三方一致。

**门禁分层裁剪（按改动文件路径，非链型）**：

| 改动范围                  | 必跑子集                                    | 可跳过       |
| ------------------------- | ------------------------------------------- | ------------ |
| 纯客户端 `.uvue` / `.uts` | lint / format / test / uvue 守卫            | 服务端三项   |
| 纯服务端 `server/`        | lint / format / server typecheck+test+build | uvue 守卫    |
| 纯 `docs/` / `*.md`       | format:check                                | 全部代码检查 |
| 契约 / 引擎 / 测试        | 全量                                        | 无           |

**预算哨兵**：全链墙钟 p95 ≤ 60s（冷缓存除外）；新检查一律软闸起步（提醒不拦截，观察 ≥2 周有真实拦下场景再升硬闸）；全量检查不上提交链；超预算须优化不得长期超标。

**失败动作**：阻断项失败 → 停止提交，修复后从第 1 项重跑；不得 `eslint-disable`、跳过测试、放宽规则过门，豁免须登记任务卡「风险」；修复涉及契约字段 → 回 G1 重新冻结。

### SOP-06 G3 验收准入（`admission-sop.md`，v1.0.0，验证出口）

G2 保证「代码是干净的」，G3 保证「**做对了**」。

| #   | 检查项       | 手段                   | 通过标准                           | 阻断 |
| --- | ------------ | ---------------------- | ---------------------------------- | ---- |
| 1   | 代码审查     | `TRAE-code-review`     | 无阻断级问题                       | 是   |
| 2   | 安全审查     | `TRAE-security-review` | 无高危、无本次变更引入的可利用风险 | 是   |
| 3   | 验收核验     | 对照任务卡 §4          | 逐项通过，不得主观放行             | 是   |
| 4   | 产品红线复核 | 人工/审查              | 见下                               | 是   |
| 5   | 契约一致性   | 对照冻结单             | 两端字段一一对应                   | 是   |

**产品红线**：面试房间不显示实时评分；追问深挖 ≤2 层、无羞辱/循环/隐私追问；评分必须引用证据、低置信度不伪装精确分；LLM 只做解释与示例、不篡改原始证据与分数；AI 改写标「建议稿」、疑似虚构数据醒目标记；AI 不伪装真人；无障碍不只靠颜色表状态。

失败动作：阻断项 → 打回「② 构建」修复后从 G2 重跑；验收不通过不得进入交付；不得以「时间紧」跳过安全审查或红线复核。

### SOP-07 G4 发布准入（`release-sop.md`，v1.0.0，交付出口）

任何对外交付（里程碑版本、小程序提审、App Beta 打包）前必须通过。

**前置条件（全部满足才可提审）**：① G1 通过（无未冻结契约变更）→ ② G2 通过 → ③ G3 通过 → ④ 里程碑出口标准逐项达标（`project-execution-plan.md` §3）→ ⑤ 合规清单逐项勾选 → ⑥ 模型/评分规则变更已跑固定评测集 → ⑦ 性能验证用 **release 包**（非 debug）。

**发布执行**：核验前置 → 填准入单 → 小范围灰度（观察北极星指标与崩溃率）→ 指标异常触发回滚 → 灰度稳定 → 全量。
失败动作：任一前置不通过 → 不发布；合规未完成属高风险，不得带病发布；发布必须 QA/DevOps 书面准入结论。

### SOP-08 服务端领域（`domain-server-sop.md`，v1.0.0）

技术栈：Node ≥22 + TypeScript + Fastify 5 + 内置 `node:sqlite`（零原生依赖）；与前端同一 pnpm workspace。分层依赖方向：`routes/ → services/ → rules/ · data/ → db`；`rules/` 是前端 `engine/` 镜像、`data/` 是前端 `data/` 镜像，变更需同步。

**硬性约定**：

- 统一响应：一律用 `util.ts` 构造器（`okData` / `ok` / `fail`），禁止手拼响应体。
- 鉴权：除 `auth` 与 `track` 外全部挂 `requireAuth`；失败返回业务 401，前端自动登出。
- 错误处理：`app.ts` 的 `setErrorHandler` 兜底，4xx → `fail(400, message)`，5xx 打日志、不透内部异常原文。
- 幂等：写操作必须幂等（唯一索引重放返回既有记录；支付回调用状态机 `UPDATE ... WHERE id=? AND status='CREATED'`；埋点唯一索引去重）。
- 配置：集中在 `config.ts` 的 `Env` + `loadEnv()`；新配置项同步 `.env.example`；默认值必须安全降级（`llmEnabled=false`、`payMode='mock'`、`asrProvider='stub'`——零配置可跑且不伪造结果）。
- 隐私：不落库录音原文/音频文件；简历文件暂存 `UPLOAD_DIR`；`schema.sql` 变更幂等可重复执行。

### SOP-09 内容领域（`domain-content-sop.md`，v1.0.0）

内容资产直接决定面试质量与评分公信力，**AI 产物必须经人工审核**。

**权威文件**：能力图谱 `data/<position>-map.uts`；题库 `data/question-bank.uts`；评分量表 `engine/rubric.uts`；岗位开关 `data/position-options.uts`；服务端镜像 `server/src/data|rules/*`。

**结构硬约束**：每题挂到图谱的 `abilityDomain` + `subAbility` 且 `questionCluster` 存在；图谱权重与量表对齐（六维度 25/25/20/15/10/5）；每题必填 `misconceptions` 与 `expectedEvidence`（评分与追问依据）；新增岗位三处齐备（图谱 + 题库 + position-options）才可置 `available: true`。

**审核流程（强制留痕）**：AI/CO 起草 → 自检 → 人工审核（PO + CO，可用 `lark-approval` 留痕）→ 登记审核人与日期 → 生效合入两侧 `data/`。

**变更纪律**：改评分量表或选题规则 → 必跑固定评测集，未通过不得合入；改图谱/题库 → 走审核流程，影响契约先走冻结；规则逻辑变更同步 `engine/*` 与 `server/src/rules/*`。

### SOP-10 设计系统领域（`domain-design-sop.md`，v1.0.0）

**Token 三方一致**：`main.css` 的 `@theme` 块（Tailwind 生成源，权威）、`styles/theme.uts`（UTS 侧运行时颜色）、`MASTER.md` §A1（设计决策记录）——三处必须同步，否则原子类与运行时颜色漂移。

**双表面**：深色沉浸面（首页/面试房间，`navy #0F2C4C → #0B2138`，正文对比度 ≥4.5:1）；浅色学习面（`bg-light #F7F9FC` + 白卡片 + 三级阴影）。品牌语义色：`smart #5B6CFF` / `reliable #1FB6A6` / `warn #E08A00` / `danger #DC2626`。

**图标**：页内用 Lucide 子集字体（`scripts/build-icons.py` 生成，勿手改；微信端 base64 内联）；tabBar 用生成 PNG（`scripts/gen-tabbar-icons.cjs`）。

**uvue 平台硬约束**：不支持内联 SVG；不支持 `gap-*`/`space-*`（`check-uvue-css.mjs` 拦截）；文字样式不继承（每个 `<text>` 显式设置）；禁透明度修饰符（`color-mix()` 不支持，用内联 `rgba()`）；触摸目标 ≥44×44（iOS）/ 48×48dp（Android）；按压反馈 opacity 0.7/0.85、80–150ms；安全区避让。

**无障碍**：浅色面正文对比度 ≥4.5:1；不只靠颜色表状态；动效尊重 `prefers-reduced-motion`；面试场景提供字幕/文字模式。

### SOP-11 原生插件领域（`domain-native-sop.md`，v1.0.0）

四个插件：`interviewer-audio`（录音/降噪/音频焦点/中断恢复）、`interviewer-realtime`（实时音频通道）、`interviewer-avatar`（数字人渲染桥）、`interviewer-device`（设备检测）。

**契约与降级**：UTS 不支持 `interface`，契约以类公开方法为准；降级必须显式（返回 `false`/空串/空数组，调用方保留既有降级路径）；**降级不得伪造**（ASR 不可用返回空转写，绝不编造文本污染证据链）；平台差异用条件编译 `// #ifdef APP-ANDROID` 隔离。

**性能硬约束**：音频帧/口型不进响应式状态（振幅摘要约 12 次/秒回调）；单活跃数字人实例，退出即 `release()`；资产预加载失败静默不阻塞面试；设备端不做大模型推理。

**真机验证**：编译/运行只能在 HBuilderX；性能与稳定性验证必须用 release 包，禁止以 debug 或模拟器流畅度验收；`utssdk` 改动须真机回归后收口（可用 `computer-use` + `screenshot` 取证）。

### SOP-12 上线合规（`compliance-sop.md`，v1.0.0）

合规是发布前置条件，周期长必须提前启动（从 M0 启动、M2 前完成、M3 上线前核验）。

**合规清单**：主体与经营范围 / ICP 备案·公安备案·App 备案 / 隐私政策与用户协议（真实可访问链接）/ SDK 与个人信息收集清单 / 存储期限与删除机制 / 生成式 AI·深度合成·算法备案评估 / 渗透测试与应急预案 / 支付与税务方案。

**隐私红线**：不落库录音原文/音频文件；录音默认不用于训练（如需单独可撤回授权）；提供自助删除入口（简历/录音/转写/账户）；AI 不伪装真人、改写标「建议稿」、虚构数据醒目标记；评分引用证据、低置信度不伪装精确分。

**已落地**：本地数据清除 `pages/mine/privacy.uvue`；服务端账号删除 `DELETE /me/account`（幂等，级联 9 表 + 简历文件）+ 注销入口。
**已知缺口**：协议/隐私 URL 待回填（依赖 ICP 备案）；删除响应时效承诺待 LC 明示；ICP/App 备案、算法评估未启动（预留 2–3 个月）。

---

## 六、16 个 Skill 目录（L4 自动化承载）

Skill 正本在 `.trae/skills/<slug>/SKILL.md`；frontmatter 含 `name` / `description` / `metadata.version` / `metadata.domain` / `metadata.last_updated`。权威登记见 [README.md §8.2](./README.md)。

| #   | Skill                                 | 版本  | 职责                                | 典型触发                                 |
| --- | ------------------------------------- | ----- | ----------------------------------- | ---------------------------------------- |
| 1   | `mentorloop-task-card`                | 1.0.0 | 任务卡八要素 + G1 入口校验          | 新任务 / 需求 / 缺口                     |
| 2   | `mentorloop-contract-freeze`          | 1.0.0 | 契约变更检测与双签记录              | 改 types / api / 服务端出参              |
| 3   | `mentorloop-system-spec`              | 1.0.0 | 客户端 uvue/UTS/Tailwind/隐私硬约束 | 客户端 pages / components / engine / api |
| 4   | `mentorloop-server-conventions`       | 1.0.0 | 服务端 Fastify 统一响应/幂等/配置   | server/ 改动                             |
| 5   | `mentorloop-content-review`           | 1.0.0 | 题库/图谱/量表人工审核准备          | 题库 / 能力图谱 / 评分量表               |
| 6   | `mentorloop-quality-gate`             | 1.0.0 | G2 质量门命令执行                   | 提交前                                   |
| 7   | `mentorloop-release-check`            | 1.0.0 | G4 发布准入与合规清单               | 发布 / 提审                              |
| 8   | `mentorloop-pipeline`                 | 1.0.0 | 链式流水线推进与链长裁剪            | 推进任务 / 走流程 / 下一步               |
| 9   | `mentorloop-role-ai-engineer`         | 1.0.0 | AI 引擎：选题/追问/评分/评测集      | 引擎设计 / 评分规则                      |
| 10  | `mentorloop-role-feasibility-analyst` | 1.0.0 | 框架能力/版本兼容/POC 可行性        | 是否支持 / 版本兼容 / POC                |
| 11  | `mentorloop-role-miniprogram-pm`      | 1.0.0 | 小程序端需求/包体积/审核/登录       | 小程序端需求 / 平台约束                  |
| 12  | `mentorloop-role-product-owner`       | 1.0.0 | 优先级/范围裁剪/冻结决策            | 优先级 / 范围裁剪 / 冻结决策             |
| 13  | `mentorloop-role-uiux-designer`       | 1.0.0 | UI/UX 信息架构/交互/视觉/无障碍     | UI/UX 设计走查                           |
| 14  | `mentorloop-avatar-design`            | 1.0.0 | 2.5D 数字人资产与状态集             | 数字人 / 虚拟形象                        |
| 15  | `mentorloop-lipsync-spec`             | 1.0.0 | 口型同步 viseme/音素/TTS 时序       | 口型 / 唇形 / TTS 时序                   |
| 16  | `mentorloop-interview-room-ux`        | 1.0.0 | 面试房间布局/状态色/字幕/动效       | 面试房间 / 实时字幕                      |

外部 skill（非本项目承载，按需调用）：`TRAE-code-review` / `TRAE-security-review`（G3 审查）、`TRAE-debugger`（服务端排障）、`lark-approval`（审批留痕）、`screenshot` / `computer-use`（真机取证）。

---

## 七、Skill 加载路由与多 Skill 裁决

### 7.1 入口路由（`.trae/rules/sop-entry.md`）

任何开发任务开始前，先按 `pipeline-sop.md` 判定链型，再按改动对象加载 skill：

| 改动对象                                 | Skill                                              |
| ---------------------------------------- | -------------------------------------------------- |
| 新任务 / 需求 / 缺口                     | `mentorloop-task-card`                             |
| `types/` · `api/` · 服务端出参           | `mentorloop-contract-freeze`                       |
| 客户端 pages / components / engine / api | `mentorloop-system-spec`                           |
| server/                                  | `mentorloop-server-conventions`                    |
| 题库 / 图谱 / 量表                       | `mentorloop-content-review`                        |
| 引擎设计 / 选题 / 追问 / 评分规则        | `mentorloop-role-ai-engineer`                      |
| UI/UX、数字人、口型、面试房间            | `mentorloop-role-uiux-designer`（+ 子 skill 按需） |
| 小程序端需求 / 平台约束                  | `mentorloop-role-miniprogram-pm`                   |
| 框架能力 / 版本兼容 / POC                | `mentorloop-role-feasibility-analyst`              |
| 优先级 / 范围裁剪 / 冻结决策             | `mentorloop-role-product-owner`                    |
| 提交前                                   | `mentorloop-quality-gate`                          |
| 发布 / 提审                              | `mentorloop-release-check`                         |

### 7.2 多 Skill 命中裁决（命中即停，上限 3）

单任务同时命中多个 skill 时按裁决表加载，**最多 3 个**，避免上下文税膨胀：

| 改动类型            | 必载                            | 条件加载（命中才载）                                                                                                        | 不载                     |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 客户端 UI 页面/组件 | `mentorloop-system-spec`        | 面试房间 → `interview-room-ux`；数字人资产 → `avatar-design`；口型 → `lipsync-spec`；新页面/交互设计 → `role-uiux-designer` | 其余设计 skill           |
| 服务端              | `mentorloop-server-conventions` | 契约变更 → `contract-freeze`                                                                                                | 客户端 skill             |
| 引擎/选题/评分      | `mentorloop-role-ai-engineer`   | 契约变更 → `contract-freeze`；内容审核 → `content-review`                                                                   | UI skill                 |
| 题库/图谱/量表      | `mentorloop-content-review`     | 契约变更 → `contract-freeze`                                                                                                | 引擎 skill（除非改规则） |
| 新任务入口          | `mentorloop-task-card`          | 契约/UI/服务端 → 对应 skill                                                                                                 | 其余                     |
| 提交前              | `mentorloop-quality-gate`       | —                                                                                                                           | 全部规划类 skill         |
| 发布                | `mentorloop-release-check`      | —                                                                                                                           | 其余                     |

**三条规则**：①「必载」始终加载，「条件加载」按触达范围决定；② 禁止同时加载三个设计子 skill（数字人整体改动走 `role-uiux-designer` 统筹，子 skill 按需二选一）；③ 超过 3 个时保留「必载」+「最窄触达」，其余改用 SOP 文档按需读章节。

---

## 八、版本化治理与机检（防体系劣化）

### 8.1 版本规则（skill 与 SOP 共用）

| 升级类型 | 判定标准                                      | 示例          |
| -------- | --------------------------------------------- | ------------- |
| `patch`  | 笔误、失效链接、示例微调，不改变清单/流程     | 1.0.0 → 1.0.1 |
| `minor`  | 清单增删行、新增章节、新增触发条件            | 1.0.0 → 1.1.0 |
| `major`  | 流程步骤变更、文件/目录结构变更、破坏已有约定 | 1.x → 2.0.0   |

**硬纪律**：任何 skill / SOP 内容变更，版本号必须动（哪怕只改一行）；**版本不动 = 变更无效**。

### 8.2 更新闭环（4 步）

1. **改内容**：编辑对应 SOP / SKILL.md 正文章节；
2. **升版本**：更新 frontmatter `版本` / `metadata.version` 与 `最后更新` / `last_updated`；
3. **同步索引**：更新 [README.md §8](./README.md) 对应行版本号（**漏此步 = 更新未完成**）；
4. **跑机检**：`node scripts/check-sop-registry.mjs` 确认全绿。

### 8.3 体量预算（控上下文税）

| 预算项                          | 上限               | 超限处置                                   |
| ------------------------------- | ------------------ | ------------------------------------------ |
| skill frontmatter `description` | 400 字节           | 下次触碰该 skill 时顺带回预算内            |
| SKILL.md 正文                   | 15360 字节（15KB） | 拆 `assets/` 模板或 `scripts/`，正文留指针 |

### 8.4 机检脚本（`scripts/check-sop-registry.mjs`）

**结构面（硬闸）**：skill 目录缺 SKILL.md；registry 缺行 / 重复登记 / 死链；skill 与 registry 版本失同步；name 与目录名不一致；metadata 缺 version / last_updated；SOP 缺版本头 frontmatter；SOP 与 registry 版本失同步。

**预算面（余量清单）**：description 缺失 / 超 400B；正文超 15KB。

**用法**：`node scripts/check-sop-registry.mjs`（可加 `--root <dir>` 扫外部目录）。退出码 0 = 全绿；1 = 至少一项发现。权威索引即 [README.md §8](./README.md)（SOP 表行格式 `[SOP-XX …](./xxx.md) | 版本 |`，Skill 表行格式 `[slug](../../.trae/skills/slug/SKILL.md) | 版本 |`——格式不对机检抓不到）。

---

## 九、问题记录与经验沉淀

### 9.1 问题记录模板

产出路径：`docs/issues/<记录人>/<场景>/<yyyymmdd>/ISS-<yyyymmdd>-<序号>.md`；模板见 [`docs/issues/_templates/issue.md`](../issues/_templates/issue.md)。

frontmatter 七字段：问题编号（`ISS-{yyyymmdd}-{两位序号}`，与文件名一致）、记录人、记录日期、问题场景、涉及 skill 或 SOP（含版本）、状态（新建/分析中/已处理/待验证/已关闭）、是否需决策。

正文五节：问题现象（客观描述 + 复现步骤）→ 问题分析（根因定位）→ 处理措施（若引发 skill/SOP 更新，注明「已随 {名称} v{版本} 更新」）→ 后续建议 → 关联（任务卡 / 决策编号）。

### 9.2 已沉淀的历史教训（6 条，2026-10-08 归档）

| 编号            | 教训                                                                        | 预防                                                       |
| --------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| ISS-20261008-01 | MySQL 保留字（`desc`/`explain`）作裸列名，本地 SQLite 全绿但云端 ERROR 1064 | 保留字列名加反引号；新列命名避开保留字                     |
| ISS-20261008-02 | ASI 陷阱：语句结尾无分号 + 下一行 `(await` 开头被解析为函数调用             | 服务端统一分号；`tests/asi-guard.test.mjs` 扫描拦截        |
| ISS-20261008-03 | `rows.map(async ...)` 缺 `Promise.all`，Promise 数组被序列化为 `{}`         | codemod 涉及 async 回调必须人工复核包裹                    |
| ISS-20261008-04 | `db.ts` 顶层 await 与 Nitro esbuild es2019 目标不兼容                       | better-sqlite3 一律同步，不用 async/await                  |
| ISS-20261008-05 | `insertUser` 三处调用缺 `await` 导致注册流程 401                            | 数据库写操作必须 await，代码审查关注点                     |
| ISS-20261008-06 | h3 生产环境吞堆栈，云端 500 无从定位                                        | 临时 try-catch 返回 message 定位后移除；配置服务端日志收集 |

---

## 十、产物模板集

八类产物路径约定（slug 与任务卡一致）：

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

模板正本：任务卡见 `task-card-sop.md` §3（`mentorloop-task-card/assets/` 有同款）；冻结单见 `contract-freeze-sop.md` §4；门禁记录见 `quality-gate-sop.md` §5；验收结论见 `admission-sop.md` §5；发布准入单见 `release-sop.md` §3；问题记录见 `docs/issues/_templates/issue.md`。

---

## 十一、新任务落地检查清单

接手新任务 / 搭建同构项目时按序执行，全部打勾即体系就绪：

**A. 登记与机检**

- [ ] 12 份 SOP frontmatter 五字段齐（编号/名称/适用范围/版本/最后更新）；
- [ ] 16 个 skill frontmatter 五字段齐（name/description/metadata.version/domain/last_updated）；
- [ ] `docs/sop/README.md` §8 含 SOP 表 + Skill 表（版本列）+ 版本规则；
- [ ] `node scripts/check-sop-registry.mjs` 退出码 0。

**B. 流程入口**

- [ ] `.trae/rules/sop-entry.md` 入口路由 + 多 skill 裁决表生效；
- [ ] 链型判定（微链/标准链/完整链）与断链处理可执行；
- [ ] 产物路径约定与模板齐备（§十 的 8 类）。

**C. 门禁**

- [ ] G1：任务卡八要素 + 契约冻结双签流程可执行；
- [ ] G2：8 项检查命令全绿 + 分层裁剪 + 预算哨兵；
- [ ] G3：代码/安全审查 + 验收核验 + 产品红线清单；
- [ ] G4：发布前置条件 + 评测集回归（`tests/evals/`）+ 合规清单。

**D. 沉淀**

- [ ] 问题记录模板就位，新问题按 `ISS-` 编号归档；
- [ ] 每份 SOP 末尾有「更新触发条件」表，skill/SOP 变更走 4 步更新闭环。

---

## 十二、与现有文档的关系

- **复用不重写**：`closure-development-plan.md`（任务台账）、`project-execution-plan.md`（里程碑/风险/决策）、根 `README.md` §5（编码约束）、`design-system/mentorloop/MASTER.md`（设计系统）、`MentorLoop_05`（多 Agent 协同）、`MentorLoop_06`（预算合规）。
- **本目录**：SOP 正本 12 份 + 本手册；`.trae/skills/` 16 个 skill；`.trae/rules/sop-entry.md` 入口规则；`tests/evals/` 固定评测集；`scripts/check-sop-registry.mjs` 机检。
- **单一事实来源**：SOP 只引用规范条款，规范条款只写在原处；本手册是导出视图，与正本冲突时以各 SOP / skill 正本为准。
