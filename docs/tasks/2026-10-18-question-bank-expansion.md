# 任务卡：题库补齐——devops / AI 工程方向建库 + backend 多栈支持（techStack）

> ⚠️ **已终止（2026-10-18）**：本卡的三批制题方案（为 MP 新造结构化题）已被用户裁决废弃。
> 移动端出题改为接入云端内容库（16453 题，四方向），见 **`docs/tasks/2026-10-18-cloud-bank-integration.md`**。
> 本卡保留作为「局部造题」思路的历史记录；其中 **techStack 契约冻结仍有效并复用**（`docs/contracts/2026-10-18-question-techstack.freeze.md`），devops 24 题随批次 D 一并删除。

- 日期：2026-10-18
- 关联：方向体系 v2（2026-10-11 C1）遗留——devops/ai 置灰「敬请期待」；backend 题库仅覆盖 Java 技术栈

## 1. 目标

解除 devops / AI 工程两个方向的置灰（各 ≥24 题达标入库），并为 backend 增加技术栈维度（QuestionItem.techStack 可选字段 + 选题器按简历栈匹配），使非 Java 后端候选人不再被抽到 JVM/线程池等 Java 特定题。

## 2. 范围

- 做（一张卡三批，每批独立可验收）：
  1. **批次 A · 契约与 devops 建库**：契约冻结（`QuestionItem.techStack: string`，''=通用，首批值域 ''/'java'/'go'，开放小写 token 枚举）；双端类型与存量 36 题逐题标注（Java 特定题标 'java'，语言无关标 ''）；选题器过滤策略（有简历栈→通用+匹配栈，无简历→全量=现状兼容）；新增 `data/devops-map.uts`（六维×子能力）；devops 24 题草稿→**用户人工审核**→入库双端→`available: true`
  2. **批次 B · AI 工程建库**：新增 `data/ai-map.uts`；ai 24 题草稿→人工审核→入库双端→`available: true`
  3. **批次 C · backend 补栈**：新增通用后端题与 Go 题（≥8 题），使简历含 go 的用户可抽题池 ≥12；全量回归 + 收口门禁
- 不做：
  - 桌面端 16453 题 MySQL 题库（不动）
  - frontend 题量扩充（维持 12 题；存量仅做 techStack 标注）
  - 题目入库 MySQL / content-export 链路（MP 端题库为双端代码常量，不走 DB）
  - 真实短信、E2E 深链适配等其他遗留项（各自独立卡）

## 3. 依赖

- 前置：无
- 契约：**QuestionItem 增 techStack 字段 → 契约冻结已生效**（`docs/contracts/2026-10-18-question-techstack.freeze.md`，用户 2026-10-18 双端签字确认）
- 外部环境：题目内容人工审核环节（用户）为每批入库的前置——**devops 草稿已送审**（`docs/drafts/2026-10-18-devops-content-draft.md`），待审核结论

## 4. 验收标准

- [x] 契约冻结文档落盘：techStack 字段定义、值域、选题过滤策略、双端签字（2026-10-18 用户确认生效）
- [x] 双端类型同步含 techStack；`tests/rules-consistency.spec.ts` 通过（92→98 用例，含题库逐字比对）
- [x] 存量 37 题（backend 24 + frontend 13，修正初判 36）逐题标注完成：k01–k05 标 'java'，其余 34 题标 ''（含 2 收束题；frontend 首批值域不含框架 token，全部通用）
- [x] **devops** 24 题 + 收束题入库双端：六维全覆盖、junior 8 / mid 10 / senior 6、subAbility 与 devops-map 一致（批次 B 完成后此条对应 ai）
- [x] `data/devops-map.uts` 落盘，权重合计 1.00（25/25/20/15/10/5）；（批次 B：ai-map）
- [x] 选题器双端：无简历栈→全量可抽（现状不变，spec 断言 q-k04 行为零变化）；有简历栈→通用+匹配栈（spec 断言 go 排除 java 题）；空池三层回退（spec 断言链路不中断）；rules-consistency / interview-engine / evals 98 用例通过
- [x] available 翻转（代码层）：双端 position-options devops=true（一致性 spec 抓到 server 端漏翻已修复）；prep/onboarding/prefs 走查随 G3
- [x] 内容审核留痕：devops 草稿 docs/drafts/2026-10-18-devops-content-draft.md，审核人=用户（2026-10-18「全部通过」）
- [x] 批次 A G2 全绿：lint 0 / format 0 / test 98（含 evals 评测集重跑）/ 机检 A–H / uvue-css / build DONE / server tsc 0 + test 83 + build 0
- [ ] （批次 B）ai 方向同流程
- [ ] （批次 C）简历栈数据源接通（userStore 持久化 → 会话创建传参）+ Go 专属题可选增强（存量通用题 19 道已满足非 Java 用户可抽 ≥12）+ G3 走查收口

## 4b. 批次 A 审核与交付留痕

- 冻结文档：用户 2026-10-18 回复「确认冻结文档」→ 双端签字生效
- devops 题库草稿：docs/drafts/2026-10-18-devops-content-draft.md；用户 2026-10-18 回复「全部通过」→ 入库
- 实现范围修正记录：①存量正题实为 37（初判 36，frontend 13 题）；②backend 仅 5 道题标 'java'，其余 19 道本就通用 → 批次 C 的 Go 制题量从「必须 ≥8」降为「可选增强」；③简历栈数据源接入移至批次 C（批次 A 传参链路已贯通、数据源为空=行为与现状一致，零回归风险）
- 实现踩坑记录：replace_all 标注时 5 道 java 题内出现双 techStack（已逐题修复）、2 个收束题常量为 2 空格缩进未被 4 空格锚点覆盖（已补）；server askedQuestions 最小桩对象漏 techStack 被 tsc 抓到（已补）

## 5. 风险与对策

| 风险                                           | 等级 | 对策                                                                                                       |
| ---------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| 题目内容质量（AI 起草可能有专业错误/泄题风险） | 高   | 人工审核为入库硬前置；expectedEvidence 绝不入澄清句（沿用 rephrase 泄题防线）；misconceptions 须为真实误区 |
| 双端副本漂移                                   | 中   | consistency spec 逐字比对 + 每批 G2 跑                                                                     |
| 选题器过滤改动回归                             | 中   | 无简历用户行为必须零变化（spec 断言）；evals 蓝图同步更新                                                  |
| techStack 标注争议（题是否真绑定栈）           | 低   | 标注原则写进冻结文档：题面/证据/追问任一含语言特定概念即标该栈                                             |
| 制题量大（48+ 新题）节奏拖长                   | 中   | 三批各自独立可验收可发布，不互相阻塞                                                                       |

## 6. 产物路径

- 新增：`docs/contracts/2026-10-18-question-techstack.freeze.md`、`data/devops-map.uts`、`data/ai-map.uts`
- 修改：`types/interview.uts`、`server/src/types/interview.ts`、`data/question-bank.uts`、`server/src/data/question-bank.ts`、`data/position-options.uts`（双端）、引擎选题器双端（`engine/question-selector.uts` / `server/src/rules/question-selector.ts`）、简历技术栈→选题器传参链路（`store/user-profile.uts` 或会话参数）、`tests/rules-consistency.spec.ts`、evals 蓝图
- 文档：本卡批次小节追加审核留痕

## 7. 角色

- 主责：AI（引擎选题策略 + 制题起草）
- 配合：内容审核（用户，入库硬前置）、FE（双端同步与契约落地）、QA（G2/G3）

## 8. 负责人

AI / 执行 Agent（内容审核裁决权在用户）

## 9. 开工前质询（未决项清单）

| #   | 质询                                 | 结论                                                                                                                                         |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 范围切法？                           | 已决策（用户 2026-10-18）：一张卡三批全做                                                                                                    |
| 2   | backend 补栈方案：加字段 vs 通用题？ | 已决策：加 techStack 字段（走契约冻结）                                                                                                      |
| 3   | 就绪门槛？                           | 已决策：24 题/方向，六维全覆盖，三档难度各 ≥4                                                                                                |
| 4   | devops/ai 是否在类型体系内？         | 已查证：双端 `PositionId` 均已含 `'devops'\|'ai'`（types/interview.uts:10、server types/interview.ts:6），无需动类型联合，仅翻 available     |
| 5   | 现状题量基线？                       | 已查证：question-bank 双端 36 题（backend 24 全 Java / frontend 12）+ 收束题 2；backend-map/frontend-map 已存在，devops/ai map 缺            |
| 6   | techStack 匹配的数据来源？           | 已查证：resume 解析已有 techStack 数组（resume 页在用）；传参链路（简历栈→选题器）为批次 A 实现项，冻结文档定策略：无简历=全量（现状零变化） |
| 7   | 值域会不会膨胀（react/vue 等）？     | 已决策：开放小写 token 枚举，首批只用 ''/'java'/'go'；frontend 存量按内容标注，特定框架题待 frontend 扩充卡再处理                            |
| 8   | 题目内容谁把关？                     | 已决策：AI 起草 → 用户人工审核 → 入库（content-review SOP）；审核留痕记本卡                                                                  |
