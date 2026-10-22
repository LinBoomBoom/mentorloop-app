# 任务卡：专项训练接入线上真实题库

- 日期：2026-10-22
- 关联：缺口「专项训练仍使用本地静态题库」；决策「题目统一来自服务端 questions 内容库」

## 1. 目标

把专项训练从客户端本地静态题库切换到服务端 `questions` 内容库，并清理页面 / 引擎 / 规则层对静态题库的运行时依赖，保证线上用户看到的每一道训练题都来自真实题库。

## 2. 范围

- 做：
  - 新增服务端只读端点 `POST /training/questions`，从 `questions` 内容库按岗位 / 经验等级 / 能力域抽题。
  - 训练房间改为进入时一次拉取本场题目，按序作答；拉题失败不扣训练额度。
  - 客户端 `api/mock` 不再用本地静态题库伪造题目（mock 下明确报错）。
  - 评分建议题改为基于「本场实际题目」，不再从静态题库按维度反查。
  - 收束题从题库文件抽到独立常量文件（仍为引擎固定模板，不进内容库）。
  - 服务端报告回查题目改用内容库 `findQuestionById`，收束题走常量兜底。
  - 静态题库文件保留为测试夹具，并标注「禁止业务引用」。
- 不做：
  - 不改内容库同步脚本与适配映射规则。
  - 不改评分算法 / 权重 / 评测集口径。
  - 不改 `api/env.uts` 的 App/H5 `mock` 默认值（mock 下功能明确不可用，需切 `dev`/`prod`）。
  - 不删除测试夹具（`data/question-bank.uts`、`server/src/data/question-bank.ts`）。

## 3. 依赖

- 前置：服务端内容库已就绪（本地 `content-fixture.json` 自举 / 云端 `questions` 表同步）。
- 外部环境：小程序静默登录成功（端点需 `requireAuth`）。
- 契约：改动 `api/` 与服务端出参，已触发契约冻结：`docs/contracts/2026-10-22-training-online-question-bank.freeze.md`。

## 4. 验收标准

- [ ] `pages/`、`engine/`、`api/`、`server/src/{routes,services,rules}` 不再引用 `data/question-bank`（仅测试文件允许）。
- [ ] 小程序训练房间的题目 id 来自内容库（非 `q-k01` / `f-k01` 等本地静态 id）。
- [ ] 训练房间拉题失败或无题时提示明确，且不扣减当日训练额度。
- [ ] mock 模式调用正式面试出题 / 训练出题时返回明确错误，不返回本地静态题。
- [ ] 服务端 `pnpm test`、客户端 `pnpm test`、`pnpm build:mp-weixin`、设计 token 机检全部通过。

## 5. 风险与对策

| 风险                                           | 等级 | 对策                                                                    |
| ---------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 某岗位某能力域题目不足，训练抽不满题量         | 中   | 选题器保持「定向域出完 → 放宽全量」兜底；返回实际题量，进度点随实收题量 |
| App/H5 默认 mock，改动后无法演示面试与训练     | 中   | 明确报错并提示切换 `API_ENV=dev/prod`；在任务卡与文档中登记             |
| 报告中的收束题不在内容库，回查为空导致报告缺题 | 中   | 回查先用内容库，未命中再按 id 查收束题常量                              |
| 评分建议去除静态题库后维度覆盖不足             | 中   | 改为使用本场实际题目的知识点；无命中时保留「维度典型题」兜底            |
| 训练额度在拉题前扣减，失败即损耗额度           | 高   | 门控在进入时校验，额度扣减延后到题目拉取成功后                          |

## 6. 产物路径

- 新增：
  - `server/src/routes/training.ts`
  - `server/src/services/training.ts`
  - `server/src/data/wrapup.ts`
  - `server/src/training.spec.ts`
  - `api/training.uts`
  - `data/wrapup.uts`
- 修改：
  - `pages/training/room.uvue`
  - `api/mock/interview.mock.uts`
  - `engine/scorer.uts`、`engine/question-selector.uts`
  - `server/src/rules/scorer.ts`、`server/src/rules/question-selector.ts`
  - `server/src/services/report.ts`、`server/src/routes/index.ts`
  - `data/question-bank.uts`、`server/src/data/question-bank.ts`
  - `env.d.ts`、`tests/interview-engine.spec.ts`、`tests/rules-consistency.spec.ts`
- 文档：
  - `docs/contracts/2026-10-22-training-online-question-bank.freeze.md`
  - 本任务卡

## 7. 角色

- 主责：FE
- 配合：BE（端点 / 内容库）、AI（选题与评分建议口径）、QA（G2 验证）

## 8. 负责人

FE + 执行 Agent（本任务由同一 Agent 同步实施客户端与服务端）

## 9. 开工前质询（未决项清单，2026-10-15 起）

| #   | 质询                              | 结论                                                                                                    |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | 训练是否复用正式面试会话端点？    | 已决策：不复用。新增只读 `/training/questions`，避免污染 `sessions` / `answers` / 面试额度              |
| 2   | 内容库单维度题目是否够抽 3–5 题？ | 已查证：`content-fixture.json` 600 题、每岗位 150 题；`selectNext` 定向域出完会放宽全量（规则 0b 注释） |
| 3   | mock 模式如何处理？               | 已决策：不再使用静态题库，明确报错并提示切 `dev/prod`；不伪造题目                                       |
| 4   | 报告回查题目用静态库还是内容库？  | 已决策：内容库 `findQuestionById`，收束题走独立常量兜底                                                 |
| 5   | 评分建议题是否继续读静态题库？    | 已决策：改用本场 `questions` 的知识点，保留「维度典型题」兜底                                           |
| 6   | 收束题是否写入内容库？            | 已决策：不写入。收束题是引擎固定模板，抽到 `data/wrapup.uts` / `server/src/data/wrapup.ts`              |
| 7   | 训练额度何时扣减？                | 已决策：进入时门控，拉题成功后扣减，失败不扣                                                            |
