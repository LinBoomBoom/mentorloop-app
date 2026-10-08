---
编号: SOP-05
名称: G2 质量门
适用范围: docs/sop/quality-gate-sop.md G2 检查项、命令、领域特化与门禁记录模板
版本: 1.1.0
最后更新: 2026-10-08
---

# G2 质量门 SOP（构建 → 验证）

生成日期：2026-09-24
归属：SOP 系统 L3 执行层 · 生命周期阶段 ② 构建出口
上游：`task-card-sop.md`（G1）；下游：[README.md](./README.md) §3（G3 准入门）

---

## 1. 目的与适用

任何代码改动在提交 / 进入「③ 验证」之前，必须通过 G2 质量门。**G2 不通过，不得进入验证阶段。**

- **适用**：客户端（`.uvue` / `.uts`）、服务端（`server/`）、脚本、数据与内容文件的代码化改动。
- **不适用**：纯文档改动（`docs/`、`*.md`）——但仍需 `pnpm format:check`。

---

## 2. 检查项与命令

### 2.1 根工程（客户端 + 工程门禁）

| #   | 检查项        | 命令                              | 通过标准                                            | 阻断 |
| --- | ------------- | --------------------------------- | --------------------------------------------------- | ---- |
| 1   | Lint          | `pnpm lint`                       | 0 error、0 warning（`--max-warnings 0`）            | 是   |
| 2   | 格式          | `pnpm format:check`               | 通过                                                | 是   |
| 3   | 单元测试      | `pnpm test`                       | 全绿                                                | 是   |
| 4   | uvue CSS 守卫 | `node scripts/check-uvue-css.mjs` | OK（无 `gap` / `space-*` / 渐变）                   | 是   |
| 5   | 类型检查      | `pnpm typecheck`                  | 新增**纯逻辑**（`engine/`、`store/`、`types/`）通过 | 否¹  |

¹ 根 `typecheck`（vue-tsc）依赖 HBuilderX 环境，CI 当前 `continue-on-error`；但新增纯逻辑必须本地通过。

> 快捷串联：`pnpm check`（= lint + typecheck + test）。仍**需单独跑** `format:check` 与 uvue 守卫。

### 2.2 服务端子包（`server/`）

| #   | 检查项   | 命令                                         | 通过标准 | 阻断 |
| --- | -------- | -------------------------------------------- | -------- | ---- |
| 6   | 类型检查 | `pnpm --filter @mentorloop/server typecheck` | 通过     | 是   |
| 7   | 单元测试 | `pnpm --filter @mentorloop/server test`      | 全绿     | 是   |
| 8   | 构建     | `pnpm --filter @mentorloop/server build`     | 成功     | 是   |

### 2.3 覆盖要求（人工判定）

- [ ] 新增/修改的**纯逻辑**有对应单测（前端放 `tests/`，服务端放 `server/src/*.spec.ts`）。
- [ ] 修 Bug 时先补一个能复现的测试。
- [ ] 不为了过门而删除或跳过既有测试。

---

## 3. 一键门禁脚本

```bash
pnpm lint && pnpm format:check && pnpm test && node scripts/check-uvue-css.mjs && pnpm --filter @mentorloop/server typecheck && pnpm --filter @mentorloop/server test && pnpm --filter @mentorloop/server build
```

---

## 4. 领域特化检查（按改动范围追加）

| 改动范围          | 追加检查                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `.uvue` / `.uts`  | 已遵守 README §5：`type` 不用 `interface`、空值用 `null`、文字用 `<text>`、无透明度修饰符（`color-mix`） |
| `types/` / `api/` | 已产出契约冻结单并双签（G1），且两端字段一致                                                             |
| `engine/`         | 逻辑保持纯函数（无 `uni.*`、无网络），可被服务端 `rules/` 镜像                                           |
| `server/`         | 统一响应 `{code,data,message}`；写操作幂等                                                               |
| 设计 token        | `main.css` `@theme`、`styles/theme.uts`、`MASTER.md` §A1 三方一致                                        |

---

## 5. 门禁记录模板

产出路径约定：`docs/tasks/YYYY-MM-DD-<slug>.gate.md`（与任务卡同 slug）

```markdown
# G2 门禁记录：<任务标题>

- 日期：YYYY-MM-DD
- 任务卡：docs/tasks/YYYY-MM-DD-<slug>.md
- 结论：通过 / 不通过

| 检查项    | 命令                            | 结果    |
| --------- | ------------------------------- | ------- |
| Lint      | pnpm lint                       | ✅ / ❌ |
| 格式      | pnpm format:check               | ✅ / ❌ |
| 单测      | pnpm test                       | ✅ / ❌ |
| uvue 守卫 | node scripts/check-uvue-css.mjs | ✅ / ❌ |
| 服务端    | typecheck / test / build        | ✅ / ❌ |

## 失败项与处理

<若失败，记录命令输出摘要与修复动作>
```

---

## 6. 失败动作

- 任一项**阻断**检查失败 → **停止提交**，修复后从第 1 项重跑（避免修复引入新问题）。
- 不得通过 `eslint-disable`、跳过测试、放宽规则来「过门」；确需豁免须在任务卡「风险」中登记并说明理由。
- 修复涉及 `types/` / `api/` 字段变化 → 回到 G1 重新冻结契约。

---

## 7. 门禁分层与预算哨兵

### 7.1 按改动范围裁剪（避免小改动全量跑）

| 改动范围                  | 必跑子集                                    | 可跳过       |
| ------------------------- | ------------------------------------------- | ------------ |
| 纯客户端 `.uvue` / `.uts` | lint / format / test / uvue 守卫            | 服务端三项   |
| 纯服务端 `server/`        | lint / format / server typecheck+test+build | uvue 守卫    |
| 纯 `docs/` / `*.md`       | format:check                                | 全部代码检查 |
| 契约 / 引擎 / 测试        | 全量（两端都可能受影响）                    | 无           |

> 裁剪依据是「改动文件路径」，不是任务卡链型。微链任务也可能跨端，此时仍跑全量。

### 7.2 门禁预算哨兵

1. **预算**：G2 全链墙钟时间 **p95 ≤ 60s**（冷缓存首次除外）。
2. **新检查软闸起步**：往 G2 挂任何新检查，必须先以「提醒不拦截」模式入链，观察 **≥2 周**、有真实拦下场景后再评估升硬闸；直接挂硬闸不予合入。
3. **全量检查不上提交链**：G2 只收本次改动相关子集；全量扫描归每日批处理或 G4 发布门。
4. **超预算处置**：若 p95 > 60s，须定位耗时项并优化（增量化 / 缓存 / 移出提交链），不得长期超标。

---

## 8. 更新触发条件

| 触发事件                           | 更新内容            | 版本  |
| ---------------------------------- | ------------------- | ----- |
| G2 检查项 / 命令增删或阻断状态变化 | §2 表 + §3 一键脚本 | minor |
| 领域特化检查范围调整               | §4                  | minor |
| 门禁记录模板字段变化               | §5                  | minor |
| 失败动作调整                       | §6                  | minor |
| 门禁分层裁剪或预算哨兵规则调整     | §7                  | minor |
