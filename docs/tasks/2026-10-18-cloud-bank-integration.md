# 任务卡：移动端出题接入云端内容库（废弃代码常量题库）

- 日期：2026-10-18
- 关联：**取代** `docs/tasks/2026-10-18-question-bank-expansion.md`（三批制题方案作废）
- 用户裁决（2026-10-18）：现有 61 题**彻底全删**；出题数据源改为云端内容库（与 Web/桌面端一致）

## 1. 目标

移动端模拟面试的题目来源从「代码常量 61 题」切换为**云端内容库 `mentorloop.interview_questions`（16453 题，四方向）**，实现与 Web 端数据源一致、单场不重复、跨场次不重样，并删除全部代码常量题库。

## 2. 取证结论（本卡设计的事实基础，均为只读实证）

| 事实                                                                                                                                                                                            | 来源                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 内容库与 MP 同 MySQL 实例，库名 `mentorloop`                                                                                                                                                    | `server/.env.example` L21-22                                                                 |
| 跨库只读直查通道已存在（`DESKTOP_DB_NAME`，回填即生效）                                                                                                                                         | `server/src/services/desktop-link.ts` L25-46                                                 |
| `interview_questions` 完整列：`id/track/type/q/a/keywords/weight/difficulty/tech/section_id/subtrack/skill/source/subtrack_detail/source_type/license/rewrite_level/status/reviewed_at/version` | `e:\LsqCoding\MentorLoop\deploy\cloud\baseline-mysql.sql` L77-104                            |
| 题库按方向（track）：backend 5281 / frontend 5224 / devops 3171 / ai 2777 = **16453**；难度非标准值 **0**                                                                                       | 本地副本 `MentorLoop/data/devmentor.db`（10-15 快照）跑 `scripts/audit-content-baseline.mjs` |
| 难度值域 `easy/medium/hard`（审计脚本强制），与 MP `junior/mid/senior` 可 1:1 映射                                                                                                              | `MentorLoop/scripts/audit-interview.mjs` L56                                                 |
| 四方向 module 名 = MP `PositionId`（frontend/backend/devops/ai）                                                                                                                                | `MentorLoop/app/data/techVocabulary.ts` L21                                                  |
| `tech` 已有受控词表 + 赛道白名单（含 `java/go` 等）                                                                                                                                             | 同上 L28-70                                                                                  |
| 30 个赛道 subtrack（fe-web/be-web/op-k8s/ai-app…），题量 200–2315                                                                                                                               | audit 脚本 3b 段                                                                             |
| `a` 列为参考答案（MEDIUMTEXT），可作评分证据基准                                                                                                                                                | baseline-mysql.sql L82                                                                       |

> 说明：本地副本为 10-15 快照，与云端行数一致（10-07 迁移校验 draft 936 + published 15517）；**上线前用桌面端 audit 脚本对云库再跑一次复核**。

## 3. 字段映射设计（`interview_questions` → `QuestionItem`）

| MP 字段          | 云端列           | 映射规则                                                              |
| ---------------- | ---------------- | --------------------------------------------------------------------- |
| id               | id               | 加前缀 `iq-` 防止与历史 id 冲突                                       |
| positionId       | track            | module 直配（fe-\*→frontend、be-\*→backend、op-\*→devops、ai-\*→ai）  |
| content          | q                | 直接                                                                  |
| expectedEvidence | a                | 参考答案作证据基准（超长截断/摘要，见风险）                           |
| knowledgePoint   | skill → keywords | skill 优先，空则取 keywords 首项                                      |
| difficulty       | difficulty       | easy→junior、medium→mid、hard→senior                                  |
| type             | type             | 枚举映射（hot/special… → concept/scenario/project/design/behavioral） |
| techStack        | tech             | 受控词表 id（与 2026-10-18 冻结值域兼容，**契约不推翻**）             |
| weight           | weight           | 选题优先级权重（现有 selector 未用，新增为排序因子）                  |
| subAbility       | subtrack         | 赛道 id（如 fe-web）                                                  |
| abilityDomain    | ——               | **缺口**：六维映射，见 §9 质询 1                                      |
| misconceptions   | ——               | 缺口 → 留空，由追问引擎动态生成                                       |
| followupPrompts  | ——               | 缺口 → 留空，全走引擎动态生成                                         |
| resumeRisk       | weight/keywords  | weight≥4 或命中关键词时置 true                                        |
| status/license   | status/license   | 只取 `published`；license 需合规确认（见风险）                        |

## 4. 范围

- 做（四批，每批独立可验收）：
  1. **批次 A · 出题层接入**：服务端新增内容库只读网关（复用 desktop gateway 模式）+ 适配层（`interview_questions` → `QuestionItem`）+ 选题器改为从云池抽题（保留六维覆盖/难度优先级策略）+ 会话创建时记录云题 id
  2. **批次 B · 跨场次去重**：新建 `user_asked_history`（uid × question_id），实现「每次面试题不一样」；单场内去重保持不变
  3. **批次 C · 评分与追问适配**：评分证据基准改用 `a`（参考答案对照）；追问全走引擎动态生成；六维映射按 §9 决策落地
  4. **批次 D · 清理与收口**：删除 `data/question-bank.uts` 全部 61 题 + `server/src/data/question-bank.ts` 镜像；`evals` 评测集按云池固定 ID 快照重构；四方向 `available: true`（devops/ai 解除置灰）；G3 真机走查（四方向各开一场）
- 不做：
  - 不改桌面端仓库任何文件（只读）
  - 不改面试房间 UI 与语音链路（沿用现有）
  - 不接 exam_sets 笔试（本卡只做面试题；笔试另立卡）
  - 不做题目内容的二次改写/重制（直接用云端已审核内容）

## 5. 依赖

- 前置：`DESKTOP_DB_NAME=mentorloop` 在云端版本配置回填（连接账号需对 mentorloop 库有 SELECT 权限）
- 外部环境：本地开发无云 MySQL → 需本地 SQLite 桩或 mock 内容库（见风险）
- 契约：`QuestionItem` 字段**不变**（复用 techStack）；但 `/interview/next` 出参语义变化（题来自云池）→ 记录契约变更说明，不重新冻结字段

## 6. 验收标准

- [ ] 云端 `DESKTOP_DB_NAME` 回填后，服务端能从 `mentorloop.interview_questions` 抽题（published 池）
- [ ] 四方向均可开一场模拟面试，题面来自云库（抽样核对 q 与 id）
- [ ] 单场 7 题（标准）无重复；连续两场题目交集 ≤ 阈值（跨场次去重生效）
- [ ] 61 题代码常量全删（`grep` 双端清零），`QuestionItem` 生产数据仅来自云池
- [ ] `evals` 评测集重构后全绿（固定 ID 快照）
- [ ] devops / ai 方向 `available: true`，四方向选择器均可用
- [ ] license 合规确认：published 池 license 值域与授权范围已核对，无侵权风险
- [ ] G2 全绿 + G3 四方向真机走查

## 7. 风险与对策

| 风险                                              | 等级 | 对策                                                                        |
| ------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| license/授权：历史素材可能含受限来源              | 高   | 上线前对 published 池 `license` 值域做专项核对；受限 license 排除在抽取池外 |
| `a` 列超长（参考答案 MEDIUMTEXT）不适合直接入报告 | 中   | 评分侧摘要化处理，截断阈值与摘要规则写入 spec                               |
| 六维能力域映射缺口                                | 高   | 见 §9 质询 1，需先定策略再开工批次 C                                        |
| 本地开发无法连云端库                              | 中   | 本地提供固定快照（SQLite 桩/JSON fixture）承载，云端走真库；测试不依赖网络  |
| 跨库查询延迟影响出题响应                          | 中   | 出题单次查询 + 索引 `idx_iq_track_subtrack`；必要时加内存缓存（TTL）        |
| 云池题偏「知识点问答」，与语音追问调性差异        | 中   | `a` 列作证据基准补齐；追问引擎动态生成维持深挖体验；G3 走查评估体验         |
| 删 61 题后评测集断裂                              | 中   | 批次 D 同步重构 evals；评测基线按云池固定 ID 冻结                           |

## 8. 产物路径

- 新增：内容库只读网关与适配层（`server/src/services/content-bank.ts` 等）、`user_asked_history` 迁移 SQL、evals 新基准
- 修改：`engine/question-selector.uts` + 镜像、`server/src/services/interview.ts`、`server/src/routes/interview.ts`、`api/interview.uts`、`data/position-options.uts`（双端 available）、`server/.env.example`（DESKTOP_DB_NAME 说明）
- 删除：`data/question-bank.uts` 全部题目、`server/src/data/question-bank.ts` 全部题目（保留空结构或整体移除）

## 9. 开工前质询

| #   | 质询                                                                                     | 结论                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 六维能力域（knowledge/engineering/analysis/communication/learning/motivation）从何而来？ | **待决策**：选项 A 保留六维框架 + 关键词分类器映射每题（改动最小，报告体系不动）；选项 B 改用云端 subtrack/tech 作报告维度（大改评分与报告）；选项 C 混合：六维为主轴、subtrack 作子标签 |
| 2   | 难度映射方向确认？                                                                       | 已查证：easy/medium/hard → junior/mid/senior（1:1）                                                                                                                                      |
| 3   | 61 题是否保留极小评测种子？                                                              | 已决策（用户 2026-10-18）：彻底全删；evals 按云池固定 ID 快照重构                                                                                                                        |
| 4   | techStack 契约是否需重冻结？                                                             | 已查证：云端 `tech` 受控词表与冻结值域兼容，字段不变，**不需重冻结**                                                                                                                     |
| 5   | 是否需要连控制台取数？                                                                   | 已解决：桌面端本地副本 `devmentor.db` 直查已获全量分布；上线前对云库复核一次                                                                                                             |
| 6   | 是否复用桌面端分类工具？                                                                 | 建议复用其词表与审计规则（`techVocabulary.ts` / `audit-interview.mjs`）作为适配层规则源，避免自造第二套分类                                                                              |
| 7   | license 抽取池范围？                                                                     | 已决策（用户 2026-10-18）：**全量可用**，`unknown` 视为自有内容；published 15517 题全入池，网关保留过滤参数供日后收紧                                                                    |
| 8   | 云题 `q` 为知识点标题（非问句）怎么办？                                                  | 已决策（设计稿 §5.5）：新增题面生成层，默认确定性模板包装，`LLM_ENABLED` 时 LLM 润色并回退模板                                                                                           |
| 9   | 云题六维怎么来？                                                                         | 已决策（用户 2026-10-18）：保留六维 + 新增 `dimension-classifier`（输入 keywords/subtrack/tech，规则表双端镜像 + 单测）                                                                  |
| 10  | 题目数据路径：跨库直查 vs 同步进 MP 库？                                                 | 已决策（用户 2026-10-18）：**同步进 MP 云库**（`mentorloop_mp.questions` 新表，同步时预计算六维/题面/tech 归一），出题直查本库、与桌面库解耦；表结构见设计稿 §12                         |

## 10. 批次 A 实施记录（2026-10-18）

状态：**代码完成 · 双端 G2 门禁全绿 · 待 G3 云端联调**（回填 `DESKTOP_DB_NAME` + 跑同步脚本）

### 10.1 落地产物

| 层       | 文件                                                                                 | 说明                                                                                  |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 建表     | `deploy/cloud/baseline-mp-mysql.sql` / `server/src/schema.sql`                       | 第 10 表 `questions`（源列 + 适配列）+ 索引 position×difficulty / ×domain / ×subtrack |
| 适配层   | `server/src/services/content-mapper.ts`                                              | 字段映射 / 难度映射 / tech 归一 / 关键词解析 / 证据截断(400) / purpose 派生           |
| 词表     | `server/src/data/tech-vocabulary.ts`                                                 | 中文展示名 → 词表 id（复用桌面 `techVocabulary.ts`，只读）                            |
| 六维规则 | `server/src/data/dimension-rules.ts` + `data/dimension-rules.uts`                    | 双端镜像规则表（关键词打分 + subtrack 兜底 + special 兜底）                           |
| 分类器   | `server/src/rules/dimension-classifier.ts` + `engine/dimension-classifier.uts`       | 双端镜像纯函数                                                                        |
| 题面生成 | `server/src/rules/question-phrasing.ts` + `engine/question-phrasing.uts`             | 双端镜像确定性模板（hot/special）                                                     |
| 仓储     | `server/src/services/content-bank.ts`                                                | 本库候选池随机预取 240 条（驱动自适应 `RAND()`/`RANDOM()`）/ 单题回查                 |
| 选题器   | `server/src/rules/question-selector.ts` / `engine/question-selector.uts`             | 候选池改为 `SelectorInput.candidates` 注入；过滤/覆盖/回退策略不变                    |
| 接线     | `server/src/services/interview.ts`                                                   | 出题取本库候选池；已答列表改由本库回查（收束题以 id 桩参与去重）                      |
| 同步     | `server/src/scripts/sync-content-questions.ts`                                       | 跨库只读 `mentorloop` → 幂等 upsert 本库 + 逐方向 count 校验（不一致非零退出）        |
| 本地桩   | `scripts/export-content-fixture.mjs` + `server/src/data/content-fixture.json`        | 桌面只读库采样 600 行（四方向 × 三档 × 50）；`db.ts` 文件库启动自举                   |
| 契约     | `docs/contracts/2026-10-18-question-techstack.freeze.md` §7                          | techStack 值域扩展登记（字段不变，仅扩值域）                                          |
| 环境说明 | `server/.env.example`                                                                | `DESKTOP_DB_NAME` 兼作内容库同步源说明                                                |
| 单测     | `server/src/content-mapper.spec.ts` + `tests/rules-consistency.spec.ts` 新增双端断言 | 映射逐列 / 分类器 / 题面 / fixture 驱动四方向出题                                     |

### 10.2 与设计稿的偏差（均为实证修正）

| 项                    | 设计稿                   | 实施                                 | 依据                                                                    |
| --------------------- | ------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| track → 岗位          | `fe-*`→frontend 前缀映射 | 直配（track 值域本就是四方向名）     | 只读实测 `track ∈ {frontend,backend,devops,ai}`                         |
| resumeRisk            | `weight>=4` 或关键词命中 | 统一 `false`                         | 实测 `weight ∈ {3,5}` 且 5≡special（1615 题），按稿会误标并劫持每场出题 |
| id 前缀               | 加 `iq-`（标注可选）     | 不加，保留源 id                      | 便于溯源；云 id 与历史 id 无冲突                                        |
| LLM 题面润色          | `LLM_ENABLED` 时润色     | 未接（确定性模板）                   | 批次 A 目标为离线可测出题；LLM 增强另议                                 |
| 分类器 engineering 词 | `CI` / `CD` 裸串         | 改 `CI/CD` / `持续集成` / `持续交付` | 裸 `ci` 会误匹配 `specificity` 等英文词，已实证误分类                   |
| 同步脚本位置          | `scripts/*.mjs`          | `server/src/scripts/*.ts`            | .mjs 无法导入 TS 适配层；复用 server 的 tsx                             |
| purpose               | 设计稿 §12 列清单未列    | 不入库，由六维 + 知识点确定性派生    | 避免预算外列；question-selector 消费需要该字段                          |

### 10.3 G2 门禁记录

| 检查                                   | 结果                                                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                            | ✅ 0 error / 0 warning                                                                                                                                                                                         |
| `pnpm format:check`                    | ✅ All matched files use Prettier code style                                                                                                                                                                   |
| `pnpm test`                            | ✅ 7 files / 102 tests                                                                                                                                                                                         |
| `node scripts/check-uvue-css.mjs`      | ✅ 31 个 .uvue，无受限原子类                                                                                                                                                                                   |
| `node scripts/check-design-tokens.mjs` | ✅ A–H 全绿                                                                                                                                                                                                    |
| `pnpm typecheck`                       | ⚠️ 非阻塞（既有项）：7 处报错全在本卡未触碰的文件（`tests/evals/eval-set.ts` / `eval.spec.ts` 缺 `EvalCase.resumeTechStacks`、`report-segment.spec.ts` 缺 `reportSegmentIntent`）；本卡新增/改动文件零类型错误 |
| server `typecheck` / `test` / `build`  | ✅ / ✅ 15 files / 102 tests / ✅                                                                                                                                                                              |

### 10.4 遗留（批次 B/C/D）

- ai 方向暂无专属收束题（第 8 题返回 null 结束面试）；批次 D 解除 ai 置灰前须补专属收束题（走 content-review）。
- 跨场次去重（批次 B）、评分证据改用 `a`（批次 C）、删代码常量题库 + evals 快照重构（批次 D）未动。

## 11. G3 云端联调执行记录（2026-10-18/19）

结论：**数据面已通（VPC 内同步 4/4 校验通过，新镜像上线）**；交互面（真机四方向走查）待用户侧执行。

### 11.1 探查结论（全部实证，非推测）

| 通道                         | 结论                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 本机直连云库                 | ❌ 内网 IP `10.34.102.205:3306`，外网地址未开启 → ETIMEDOUT（与 M1「外网入口保持关闭」一致）           |
| 控制台「云端调试」           | ⚠️ 仅 HTTP 请求调试器，**无容器终端/无自定义启动命令**；且其界面无法稳定自动化进入                     |
| `tcb db execute`             | ❌ 只打 CloudBase PG（`PG instance not found`），够不到云托管 TDSQL-C；该环境也无 CloudBase MySQL 实例 |
| 控制台「数据库管理」         | ⚠️ 跳腾讯云 DMS 需独立登录，不适合跨库 16k 行批量同步                                                  |
| **云托管服务自身（容器内）** | ✅ 唯一可行执行面：容器与库同 VPC，且服务 env 已有 `DESKTOP_DB_NAME=mentorloop` + `MYSQL_*`            |

### 11.2 实施（`f6f023f`）

- 同步脚本改为可 import 的 `runContentSync()`：**幂等建表/补索引**（按 information_schema 判断，MySQL 无 `CREATE INDEX IF NOT EXISTS`）+ 多行 VALUES 批量 upsert（100 行/语句）+ `ifEmpty` 语义 + 仅直接执行时才跑 CLI。
- `server.ts` 启动钩子：`MYSQL_HOST` 非空 且 `DESKTOP_DB_NAME` 非空 时，listen 成功后**后台**执行 `ifEmpty` 同步；失败只记日志，不阻塞/不影响服务。
  - 原计划用 `SYNC_CONTENT_ON_BOOT=true` 开关，但**控制台环境变量区只支持改已有值、不支持新增键** → 改用已有 `DESKTOP_DB_NAME` 作为门控（零新增变量）。
- 部署：`tcb cloudrun deploy -e prod-d6gaa83ds8accb61b -s mentorloop-mp-api --source server --port 8787 --min-num 1 --max-num 5 --open-access-types MINIAPP --wait --force`
  - 交互提示「是否启用灰度部署」需管道喂默认回车（`--force` 不会跳过该提示）。
  - CLI 首次部署会在 `server/` 生成 `cloudbaserc.json`（仅 envId + 服务名，无密钥）——已随本卡提交，后续可从 `server/` 直接 `tcb cloudrun deploy --wait --force` 复现部署。

### 11.3 结果

| 项                     | 证据                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 线上版本               | `mentorloop-mp-api-006`（镜像 `...-006-20261019000120`，由本卡代码云构建），FlowRatio 100、Status normal                            |
| 服务配置未被重置       | Cpu 1 / Mem 2 / Min 1 / Max 5 / Port 8787 保持；`EnvParams` 9 个键**全部保留**（实测 CLI 部署不清空 EnvParams，修正 M1 记录的推断） |
| VPC 内同步（容器日志） | `源库 published 行数：15517` → `适配成功：15517，跳过：0` → `upsert 完成：15517 行` → 建表/补 3 索引                                |
| 逐方向 count 校验      | frontend 5224/5224 OK、backend 4541/4541 OK、devops 2975/2975 OK、ai 2777/2777 OK → `同步完成并通过逐方向 count 校验`               |

### 11.4 安全处置（本卡顺带修掉一个真实漏洞）

- 线上 env 原为 `MOCK_SMS_CODE=123456`，而运行中的镜像（v004，构建于 10-10）**早于** `assertCloudSafety` 守卫 → 万能验证码登录任意手机号在线上实际生效。
- 处置：控制台改强随机值（初设 12 位字符串，真机走查发现**验证码输入框限 6 位**导致登录不可用，已改为 6 位数字，见 §11.5）；同时新镜像含守卫，若该值仍为 `123456` 将拒绝启动，故该改动是发版前置条件。
- 门控副作用已知：控制台保存环境变量会触发一次「重发既有镜像」的部署（产生了冗余版本 `mentorloop-mp-api-005`，流量 0）——无功能影响。

### 11.5 真机走查结果（backend 方向 · 2026-10-19）

- **登录验证码长度缺陷（走查第一步即暴露）**：初设的 12 位 `MOCK_SMS_CODE` 与小程序验证码输入框 `maxlength=6` 冲突 → **登录实际不可用**；已改为 6 位数字 `824193`。**当前登录验证码 = `824193`**（非 `123456`，故通过 `assertCloudSafety`）。附带 UX 观察：未勾选用户协议时点「登录」**无任何提示**（静默失败），建议补明确反馈（小项，未在本卡改）。
- 方式：`pnpm build:mp-weixin` → `cli.bat auto --project dist/build/mp-weixin --auto-port 9420` → automator 取页面路径/截图 + **桌面级 UI 自动化点击真实按钮**（`ml-button` 等组件对 automator 不可见，见记忆「virtualHost 组件对 automator 完全不可见」）。
- 链路：首页「开始模拟面试」→ **登录面板按设计强制弹出** → 手机号+验证码登录成功 → 准备页（后端 / 1-3年，设备检测三项通过）→「进入面试」→ 面试房间。
- 房间实证（截图 `e2e/mp/shots/w-status.png`）：顶部 `00:48` mm:ss 正计时 +「网络良好」；`Q1` +「倾听中」；标签「AI 面试官 · 系统生成」；题目正文为云题经题面模板生成：

  > 请说明「错误消息会跨进程透传给调用方，为什么必须脱敏？请举例说明哪些内容绝对不能放进 error message，并给出正确的写法。」的原理，并结合你的项目经历谈谈实际处理方式。

- **结论**：端到端证实出题链路已切到云端内容库（旧 61 题题库不会产生该模板形态）。
- 覆盖度：backend 端到端已通；frontend/devops 与 backend 共用同一链路（仅 position 过滤值不同），其数据存在性由同步的逐方向 count 校验覆盖；ai 待批次 D 解除置灰。
- 走查发现 1 条内容质量缺陷 → `docs/issues/team/server/20261019/ISS-20261019-01.md`；**已修复并关闭（2026-10-19）**：`phraseQuestion` 加问句型判定（问句型直通不二次包装，双端镜像）＋ 同步改「适配层版本门控」（`content_sync_meta` 表 + `ADAPTER_VERSION`，不一致即 `DELETE + 全量重建`，使映射类改动可自动生效）→ 云端重建 15517 行（日志实证「适配层版本变化（落库 (空) → 当前 v2）」）+ 四方向 count OK；真机复核新 Q1 为直通形态（无二次包装）。

### 11.6 待办（用户侧 / 后续卡）

| #   | 事项               | 说明                                                                                                                                                                                                      |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **密钥轮换**       | `tcb cloudrun detail` 输出曾把 `MYSQL_PASSWORD` / `JWT_SECRET` 明文打印到终端（M1 已登记同一问题）；轮换需同时改 MP 与桌面两个服务 env，JWT 轮换会使已登录 token 失效，应单独窗口做（用户裁决：登记待办） |
| 2   | **真机四方向走查** | 服务公网访问为禁（`SERVICE_FORBIDDEN`），仅小程序 callContainer 可调 → 需用户在小程序/DevTools 真机各开一场（frontend/backend/devops）；ai 受 `available:false` 限制，批次 D 解除后补                     |
| 3   | 真实短信接入       | 当前登录验证码为固定值（见 §11.4），上线前须接入腾讯云 SMS（已登记为既有卡）                                                                                                                              |
