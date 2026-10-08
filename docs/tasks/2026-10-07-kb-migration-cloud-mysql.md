# 任务卡：桌面端知识库迁移到微信云开发（云托管 Serverless MySQL）

- 日期：2026-10-07
- 关联：里程碑 M1（后端上云）前置 · 设计稿 `MentorLoop/docs/miniapp-cloud-backend-design.md` §4/§6.5

## 1. 目标

把桌面端 SQLite 中 9 张内容表（题库/考卷/学习中心知识库）按设计稿 §6.5 导出为分片内容包并提供 MySQL 导入脚本与基准 DDL，使知识库可一次性迁入云托管 Serverless MySQL，云端成为唯一内容源。

## 2. 范围

- 做：
  - 基准 DDL（内容表 9 张 + 同步基础设施表 content_changes/sync_state/meta + §4.5 用户表骨架，云端空库建表用）
  - `content-export.mjs`：SQLite → 分片 JSON 内容包（≤500 行/片，带行数与 sha256 校验）
  - `content-import-mysql.mjs`：内容包 → MySQL，幂等可重跑，行数/抽样校验，写入 `meta.content_version=1`
  - 设计稿评审发现的问题清单（只报告，不改设计稿正文）
- 不做：
  - 用户数据搬迁（§6.5 第 5 条：经同步协议自然上行）
  - DB 层 better-sqlite3 → mysql2 的 57 个 handler 改造（M1 主体，另立任务）
  - manifest/delta/snapshot/push 内容同步 API（M2）
  - 小程序端代码改动、云托管容器部署

## 3. 依赖

- 前置：云开发已开通；云托管 Serverless MySQL 实例与连接凭据（执行导入时需要，脚本先交付）
- 外部环境：桌面端 `data/devmentor.db`（只读）；Node ≥ 20；mysql2（新增 devDependency）
- 契约：不改 `types/` 或 `api/`，**不触发契约冻结**

## 4. 验收标准

- [ ] `baseline-mysql.sql` 覆盖设计稿 §4.4~4.6 全部表，MySQL 8.0 语法可直接执行（utf8mb4、保留字反引号、FK/索引齐全）
- [ ] `node scripts/content-export.mjs` 实跑成功：9 表全量导出为分片 JSON + manifest（行数与实际 DB 一致：modules 4 / chapters 411 / sections 1810 / interview_questions 16453 / exam_sets 57 / exam_choices 824 / exam_written 65 / skill_section_map 83 / referrals 10）
- [ ] `node scripts/content-import-mysql.mjs --dry-run` 通过：校验 manifest 行数与逐分片 sha256
- [ ] 导入脚本幂等：重复执行不产生重复行（ON DUPLICATE KEY UPDATE），结束后逐表 count 校验不一致即非零退出
- [ ] 源库只读连接（readonly: true）；MySQL 凭据仅从环境变量读取，不落盘不打印
- [ ] 桌面端 `npm test`（vitest）无回归

## 5. 风险与对策

| 风险                                            | 等级 | 对策                                                                     |
| ----------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| 内容含 draft 行（题 936 / 节 101）              | 低   | 全量入库，对外可见性由 API 层 status 门禁保证，导入不裁剪                |
| 16.4k 题一次性导入内存/超时                     | 中   | 500 行分片 + 分批事务写 MySQL，流式读分片                                |
| MySQL 保留字 `key`（auth_codes/login_attempts） | 低   | DDL 全部反引号引用；保持列名不变以兼容现有 handler SQL                   |
| JSON 列存入非法 JSON                            | 低   | 导出时 JSON.parse 校验，非法即报错退出                                   |
| 本机无 MySQL 无法实测 DDL                       | 中   | DDL 按官方语法逐条核对；导入脚本提供 dry-run；首次上云按 runbook 执行    |
| 凭据泄漏                                        | 高   | 仅环境变量；脚本不回显；文档提示 `.env` 真实 key 上云前轮换（设计稿 §8） |

## 6. 产物路径

- 新增（均在桌面端仓库 E:\LsqCoding\MentorLoop）：
  - `deploy/cloud/baseline-mysql.sql`
  - `scripts/content-export.mjs`
  - `scripts/content-import-mysql.mjs`
- 修改：
  - `package.json`（devDependencies + mysql2；新增 `content:export` / `content:import` script）

## 7. 角色

- 主责：BE
- 配合：QA（G2 门禁）、CO（导入后内容抽验）、PO（范围裁决）

## 8. 负责人

BE · Trae Agent（GLM-5.3-Flash），PO 终审
