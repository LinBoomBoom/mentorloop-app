# 任务卡：C1 方向体系对齐桌面端（前端/后端/运维/AI 工程）

- 编号：c1-position-taxonomy
- 日期：2026-10-11
- 关联：docs/tasks/2026-10-11-mp-reports-dedupe-ui-polish.md C1 缺口（P0）；ISS-20261011-03 同日
- PO 裁决（用户指令原文）：「C1 方向体系按照『前端 / 后端 / 运维 / AI 工程』，因为数据库是同一套数据源」→ 以桌面端为准

## 1. 目标

MP 端岗位方向体系与桌面端收敛为同一套（frontend/backend/devops/ai），消除双端方向表独立演进导致的"仅前端重合"矛盾，保证同一数据源（题库/能力图谱）双端可互认。

## 2. 范围

- 在范围内：
  - `PositionId` 联合类型改为 `'frontend' | 'backend' | 'devops' | 'ai'`（过契约冻结）
  - 双端 position-options / question-bank / 能力图谱引用 / 展示名映射 / 默认值同步迁移
  - 旧缓存 positionId 归一化（java-backend/golang-backend/pm → backend）
- 明确不在范围内：
  - 方向表服务端单源 + 接口下发（归 C5 另立卡）
  - 经验档位收敛三档（C2）、报告 schema 对齐（C3）、选项接口化（C5）
  - backend 方向非 Java 技术栈（Go/Python）题库内容补齐（内容任务，届时走 mentorloop-content-review）
  - devops / ai 题库建设（保持"敬请期待"置灰）

## 3. 依赖

- 桌面端方向事实：`frontend/backend/devops/ai`（MentorLoop/app/pages/interview/sim.vue L19-24，见 C1 缺口表）
- 契约冻结：docs/contracts/2026-10-11-position-taxonomy.freeze.md（本卡完成双签）
- 无外部环境依赖；无新增第三方 API

## 4. 验收标准

- [ ] 全仓 grep `java-backend|golang-backend` 在代码文件中清零（docs 历史记录除外）
- [ ] prep 页方向选择器显示：前端✓ / 后端✓ / 运维（敬请期待） / AI 工程（敬请期待）
- [ ] 选「后端」开始快练，选题器正常出题（原 Java 题库以 backend id 命中）；选「前端」出前端题；收束题按方向正确取用
- [ ] 旧版本缓存（positionId='java-backend'）启动恢复后归一化为 backend，无类型/展示异常
- [ ] 双端 position-options 与 question-bank 逐字同步（客户端 .uts 与服务端 .ts 值域一致）
- [ ] G2 全绿（root lint/typecheck/vitest 含 evals + server lint/tsc/vitest + format + uvue-css + build 产物抽查）

## 5. 风险

- backend 题库当前仅覆盖 Java 技术栈：选「后端」的用户会抽到 Java 题——与桌面端"Java 是 backend 技术栈之一"语义一致，内容补齐另立卡；任务卡如实记录现状
- 云端 sessions 表历史记录 positionId 旧值：产品未上线无生产数据；客户端快照恢复路径已有 validPos 兜底 fallback backend，服务端 /interview/next 的 positionId 由客户端归一化后传入，无服务端兼容代码需求
- 大批量 replace_all 漏替换：完成后全仓 grep 验证残留（既定教训）

## 6. 产物路径

- types/interview.uts
- data/position-options.uts、data/question-bank.uts、data/java-backend-map.uts（改名 backend-map.uts）
- engine/question-selector.uts
- store/user-profile.uts
- pages/interview/room.uvue、pages/training/room.uvue
- tests/interview-engine.spec.ts、tests/evals/eval-set.ts
- server/src/data/position-options.ts、server/src/data/question-bank.ts、server/src/data/domain-ids.ts
- server/src/interview.spec.ts、server/src/me.spec.ts、server/src/report.spec.ts
- docs/contracts/2026-10-11-position-taxonomy.freeze.md（新增）

## 7. 角色

- AI 工程师（lead）：选题器/题库 id 体系迁移
- 产品负责人：方向体系裁决（已给出）
- 服务端工程师：镜像副本同步
- 客户端工程师：类型/页面/存储迁移

## 8. 负责人

- 产品负责人裁决 + AI 工程师牵头；执行 agent：TraeCode

## 实施记录

- 2026-10-11 完成。改动 19 文件：双端 types（PositionId 联合）、position-options、question-bank（26 题值迁移）、java-backend-map.uts 改名 backend-map.uts（JAVA_BACKEND_MAP → BACKEND_MAP）、question-selector import、user-profile（展示映射 + 默认 backend + restore 旧值归一化）、双 room 页 validPos/蓝图默认值、e2e smoke、5 个 spec/eval 文件、domain-ids 注释
- 验收核验：全仓 grep 旧值清零（仅 user-profile 归一化映射键保留，预期）；G2 全绿——root lint/format/tsc + vitest 64/64（evals 15 项通过）+ server lint/tsc/vitest 60/60；build:mp-weixin 产物级验证：devops/AI 工程 新值进 position-options.js / room.js / user-profile.js，java-backend 仅存于迁移映射键
- 契约冻结：docs/contracts/2026-10-11-position-taxonomy.freeze.md 双签完成，接口形状零变更（仅取值域）
