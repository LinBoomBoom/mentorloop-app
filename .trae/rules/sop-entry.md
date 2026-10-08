---
alwaysApply: true
---

# MentorLoop SOP 入口

任何开发任务开始前，先按 `docs/sop/pipeline-sop.md` 判定链型（微链 / 标准链 / 完整链），并按链位加载对应 skill：

- 新任务 / 需求 / 缺口 → `mentorloop-task-card`（八要素，含角色）
- 改 `types/` · `api/` · 服务端出参 → `mentorloop-contract-freeze`
- 客户端 `pages/` · `components/` · `engine/` · `api/` → `mentorloop-system-spec`
- 服务端 `server/` → `mentorloop-server-conventions`
- 题库 / 能力图谱 / 评分量表 → `mentorloop-content-review`
- 引擎设计 / 选题 / 追问 / 评分规则 → `mentorloop-role-ai-engineer`
- UI/UX、数字人、口型、面试房间 → `mentorloop-role-uiux-designer`（+ `mentorloop-avatar-design` / `mentorloop-lipsync-spec` / `mentorloop-interview-room-ux`）
- 小程序端需求 / 平台约束 → `mentorloop-role-miniprogram-pm`
- 框架能力 / 版本兼容 / POC 判断 → `mentorloop-role-feasibility-analyst`
- 优先级 / 范围裁剪 / 冻结决策 → `mentorloop-role-product-owner`
- 提交前 → `mentorloop-quality-gate`
- 发布 / 提审 → `mentorloop-release-check`

角色目录与 RACI 见 `docs/sop/roles-sop.md`；规范总览见 `docs/sop/README.md`。

---

## 多 skill 命中裁决（命中即停，上限 3）

单任务同时命中多个 skill 时，按以下规则加载，**最多 3 个**，避免上下文税膨胀：

| 改动类型            | 必载                            | 条件加载（命中才载）                                                                                                                                                    | 不载                     |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 客户端 UI 页面/组件 | `mentorloop-system-spec`        | 面试房间 → `mentorloop-interview-room-ux`；数字人资产 → `mentorloop-avatar-design`；口型 → `mentorloop-lipsync-spec`；新页面/交互设计 → `mentorloop-role-uiux-designer` | 其余设计 skill           |
| 服务端              | `mentorloop-server-conventions` | 契约变更 → `mentorloop-contract-freeze`                                                                                                                                 | 客户端 skill             |
| 引擎/选题/评分      | `mentorloop-role-ai-engineer`   | 契约变更 → `mentorloop-contract-freeze`；内容审核 → `mentorloop-content-review`                                                                                         | UI skill                 |
| 题库/图谱/量表      | `mentorloop-content-review`     | 契约变更 → `mentorloop-contract-freeze`                                                                                                                                 | 引擎 skill（除非改规则） |
| 新任务入口          | `mentorloop-task-card`          | 契约变更 → `mentorloop-contract-freeze`；UI → system-spec；服务端 → server-conventions                                                                                  | 其余                     |
| 提交前              | `mentorloop-quality-gate`       | —                                                                                                                                                                       | 全部规划类 skill         |
| 发布                | `mentorloop-release-check`      | —                                                                                                                                                                       | 其余                     |

**规则**：

1. 「必载」始终加载；「条件加载」按触达范围决定，未触达不载。
2. 同一任务**禁止**同时加载 `interview-room-ux` + `avatar-design` + `lipsync-spec` 三个设计子 skill（数字人整体改动走 `mentorloop-role-uiux-designer` 统筹，子 skill 按需二选一）。
3. 若必载 + 条件加载超过 3 个，优先保留「必载」+「最窄触达」的 skill，其余改用 SOP 文档按需读章节。
