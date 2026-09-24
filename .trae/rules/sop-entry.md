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
