# G2 门禁记录：桌面端知识库迁移到云托管 MySQL

- 日期：2026-10-07
- 任务卡：[2026-10-07-kb-migration-cloud-mysql.md](./2026-10-07-kb-migration-cloud-mysql.md)
- 仓库：E:\LsqCoding\MentorLoop（本次改动不涉及小程序客户端，根项目门禁不触发）

## 变更物

- 新增 `deploy/cloud/baseline-mysql.sql`（37 表基准 DDL，§4.4~4.6 全覆盖）
- 新增 `scripts/content-export.mjs`（SQLite → 分片内容包，只读源库）
- 新增 `scripts/content-import-mysql.mjs`（内容包 → MySQL，幂等 + 行数/sha256 校验 + meta.content_version）
- 新增 `tests/content-migration.test.mjs`（4 项：DDL↔列清单一致性、保留字反引号、SQL 生成、值映射）
- 修改 `package.json` / `package-lock.json`（devDep mysql2；npm scripts content:export / content:import）

## 门禁执行（vitest，node 环境）

| 项                                  | 结果                                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增单测 content-migration.test.mjs | ✅ 4/4 通过                                                                                                                                                       |
| 全量 `npm test`                     | 534+ 通过，9 失败                                                                                                                                                 |
| 失败归因（stash 改动后复跑对照）    | **9 个失败为存量**（admin-route 1 / charter-audit 1 / exam-split 1 / server-imports 2 / vip-features 4），无改动时同样 9 失败，与本任务无关，未删除未跳过任何测试 |
| 数据验证                            | export 实跑 19717 行/45 片，行数与 DB 一致；import --dry-run sha256+行数全过                                                                                      |
| 契约                                | 未改 types/ 或 api/，无需冻结                                                                                                                                     |
| 隐私/安全                           | 源库 readonly；凭据仅环境变量；未打印敏感值                                                                                                                       |

## 结论

**PASS（带存量失败登记）**：本次变更零回归；9 个存量失败建议另立任务卡修复（exam-sets 行数断言已过时：期望 19 实际 57）。

## 遗留

- ~~真实 MySQL 导入执行需云托管凭据~~ **已执行完成（2026-10-07）**：
  - 云托管实例 `cynosdbmysql-gjsimu6g`（Serverless MySQL **5.7**，TDSQL-C），库 `mentorloop`，DDL 37 表全建
  - DDL 已按 5.7 修正：`CREATE TABLE IF NOT EXISTS`（可重跑）+ 去除 JSON 列表达式默认值（5.7 不支持）+ `INSERT IGNORE`
  - 导入 9 表 19717 行（18.5s，分片 sha256 + 逐表 count 校验全过），`meta.content_version=1`、`seed_version=1.0.4`
  - 抽验：interview_questions 首/中/尾 3 行 q/a/keywords/tech/subtrack_detail hash 一致；sections 首/尾全字段一致；exam_choices.options JSON 往返一致；draft 936 / published 15517 与本地一致
- **安全提醒**：MySQL 外网访问（`sh-cynosdbmysql-grp-fpchb9wc.sql.tencentcdb.com:29842`）为迁移临时开启，迁移完成后应在云托管控制台关闭；root 凭据仅存本地 `.env.cloud`（git 已忽略）
- 导入包 `data/content-pack-m1/`（约 19MB）为生成物，已上云，可删除，不建议入库
