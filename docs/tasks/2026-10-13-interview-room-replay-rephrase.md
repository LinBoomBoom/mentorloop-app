# 任务卡：面试房间「再说一遍 / 换一种说法」

- 日期：2026-10-13
- 关联：里程碑 M1；文档 03 §4「数字人提问后，允许用户点击『再说一遍』『换一种说法』」；评审项 M5
- 优先级：P0（面试房间核心交互，M1 出口组成部分）

## 1. 目标

在面试房间补齐「听不懂可重听 / 换个说法」的求助交互，让用户不必因为没听清题目而放弃作答，同时保证换说法不泄题、不改变考察目标。

## 2. 范围

- 做：
  - 「再说一遍」：重播当前展示文本（题面 / 追问 / 已生成的澄清句）的 TTS
  - 「换一种说法」：基于题目既有字段生成**确定性澄清句**并播报，原题保持可见
  - 新增引擎纯函数 `engine/rephrase.uts`，并按项目铁律镜像 `server/src/rules/rephrase.ts`
  - 双端一致性断言 + 引擎单测
  - 埋点 `interview_replay_question` / `interview_rephrase_question`
  - 房间 UI：题面下方增加两个操作入口（触控目标 ≥44px）
- 不做：
  - 不改 `types/`、`api/`（**不触发契约冻结**）
  - 不引入 LLM 自然改写（列为 P1，见 §5 风险）
  - 不改选题 / 追问 / 评分规则
  - 不做多音色、语速调节（另属无障碍批次）

## 3. 依赖

- 前置：`pages/interview/room.uvue` 的 TTS 句柄（`speak()` / `ttsHandle`）与 `QuestionItem` 字段（`knowledgePoint` / `purpose` / `expectedEvidence`）
- 外部环境：HBuilderX 真机播放 TTS 验证（模拟器音频不可作验收依据）
- 契约：**无**（`types/`、`api/` 零改动）

## 4. 验收标准

- [ ] 房间题面下方出现「再说一遍」「换一种说法」两个入口；录音中或暂停时不显示
- [ ] 「再说一遍」重播当前展示文本；TTS 不可用时给出文字提示而非静默失败
- [ ] 「换一种说法」在题面下**追加**澄清行并播报，不替换原题
- [ ] 澄清句仅由 `knowledgePoint` / `purpose` 生成，**绝不出现 `expectedEvidence` 内容**（防泄题），且不改变难度与知识点
- [ ] 连点「再说一遍 / 换一种说法」时先 `stop()` 旧 TTS，避免语音叠加
- [ ] `engine/rephrase.uts` 与 `server/src/rules/rephrase.ts` 双端输出一致，`tests/rules-consistency.spec.ts` 新增断言通过
- [ ] 埋点 `interview_replay_question` / `interview_rephrase_question` 上报
- [ ] G2 全绿（lint + typecheck + test + format + build:mp-weixin）；评测集结构断言 15/15 通过

## 5. 风险与对策

| 风险                                   | 等级 | 对策                                                                 |
| -------------------------------------- | ---- | -------------------------------------------------------------------- |
| 确定性模板改写读感生硬，用户觉得没帮助 | 中   | 澄清句只补充考察意图、不改题目；P1 用 LLM 自然改写（届时需契约冻结） |
| 澄清句泄露 `expectedEvidence`（泄题）  | 高   | 引擎函数只读 `knowledgePoint`/`purpose`，单测断言输出不含证据字段    |
| 引擎改动作随双端镜像要求               | 中   | 同任务内提交 `server/src/rules/rephrase.ts` + parity 断言            |
| 连点导致 TTS 叠加                      | 低   | 触发前 `ttsHandle.stop()`                                            |
| 与「文字作答」入口挤在同一区域造成拥挤 | 低   | 独立一行，仅在非录音/非暂停时显示；沿用深色面既有样式                |

## 6. 产物路径

- 新增：`engine/rephrase.uts`、`server/src/rules/rephrase.ts`
- 修改：`pages/interview/room.uvue`、`tests/rules-consistency.spec.ts`、`tests/interview-engine.spec.ts`

## 7. 角色

- 主责：AI（换说法话术规则与禁则、双端镜像）
- 配合：FE（房间交互落地）、UX（交互与文案走查）、QA（G2 / G3）

## 8. 负责人

PO 走 G1 验收范围与优先级；执行 Agent：TraeCode 落码与门禁。

---

## 进度记录

### 2026-10-13 建卡（待 G1）

- 方案取向：P0 走「客户端重播 + 引擎确定性澄清句」，不引 LLM、不动契约，最快落地且守住防泄题红线。
- 待办：G1 通过后进入实现；`types/`、`api/` 无改动，无需契约冻结。

### 2026-10-13 G1 通过并实现（交互形态：追加澄清行 + 保留原题）

- 新增 `engine/rephrase.uts` 与镜像 `server/src/rules/rephrase.ts`（纯函数，只读 knowledgePoint/purpose）。
- `pages/interview/room.uvue`：题面下方新增「再说一遍 / 换一种说法 / 文字作答」操作行（≥44px，录音/暂停时隐藏）；澄清句追加展示、原题保留；触发前 `stop()` 旧 TTS；埋点 `interview_replay_question`、`interview_rephrase_question`。
- 测试：`tests/interview-engine.spec.ts` 增 5 例（含泄题防护），`tests/rules-consistency.spec.ts` 增双端一致 + 题库全量防泄题断言。
- 门禁：G2 全绿（lint / typecheck / format / uvue-css / test 89 / build:mp-weixin / server typecheck + test 83）。
- 遗留：真机 TTS 播放验收待 HBuilderX 环境；`types/`、`api/` 零改动，未触发契约冻结。
