# 验收结论：设计治理方案 P0–P2 落地总结报告

- 日期：2026-10-14
- 性质：ds-1 验收结论（G3）· SOP-10 设计系统领域 · SOP-06 G3 验收准入
- 关联：任务卡 `docs/tasks/2026-10-14-design-system-rework.md`（ds-1）· 治理方案 `docs/design-governance-plan.md`（v0.2，实施主纲）· 裁决 D-A / D-B（治理方案 §0.1）
- 角色：PO 裁决（D-A/D-B 与批次）· UX 主责（设计走查）· 执行 Agent：TraeCode
- **总结论：治理五批（P0 / P1×2 / P2×2）全部落地，门禁全绿**（prettier 幂等 + `check-sop-registry.mjs` 17 skill / 13 SOP 零发现）。ds-1 §4 全量验收标准：达成 2 条、部分达成 1 条、未触发 1 条、**遗留 3 条**（F3 / F4 / F5，另 F6 按裁决保留登记）。

---

## 1. 背景与治理范围

### 1.1 审计规模

治理方案 v0.2 基于三项只读审计（技能层 / SOP 与设计文档层 / 角色层），全部结论带「文件 + 行号 + 原文摘录」：

| 清单                     | 规模                                   | 出处          | 处置批次                         |
| ------------------------ | -------------------------------------- | ------------- | -------------------------------- |
| 数值 / 规则互斥冲突      | C1–C13（13 项）                        | 治理方案 §4.1 | P0（MASTER/token）+ P1（边界链） |
| D3 去数字人过时残留      | 9 个文件                               | §4.2          | P0 清理                          |
| 死引用（指向已删除文件） | 17 处 / 8 个位置                       | §4.3          | P0 改写（含 skill 目录删除）     |
| 冗余 / 重叠              | R1–R6（6 组）                          | §4.4          | P2-b 合并                        |
| token 三载体集合差异     | 4 类差异 + 四类 token 全缺             | §4.5          | P0 对齐既有集合；F3 遗留         |
| 角色缺口                 | 5 类（安全/LC/运营财务/设计挂靠/描述） | §5.2          | P2-a 补齐                        |

### 1.2 两项裁决（PO 拍板，2026-10-14）

| 编号 | 决策                                                                    | 落点                          |
| ---- | ----------------------------------------------------------------------- | ----------------------------- |
| D-A  | `mentorloop-avatar-design` / `mentorloop-lipsync-spec` **随 D3 下线**   | P0 执行（治理方案 §4.7 五步） |
| D-B  | 设计智能库**新增独立 skill** `mentorloop-design-intelligence`（方案 A） | P1 实施（治理方案 §1）        |

### 1.3 目标结构（四层，灵感层不得越过约束层）

正本层（README §5 编码硬约束 · main.css @theme token 生成源 · MASTER §A1–A4 设计决策 · README §8 登记索引）→ 转换层（mobile-design-adapter → system-spec，唯一落地通道）→ 灵感层（design-intelligence 只出选型单）→ 登记层（README §8 + domain-design-sop §8）。

## 2. 批次总览

治理方案 §6 批次表五行全部标 ✅（2026-10-14）：

| 批次 | 内容                                                                                                                                                | 状态      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| P0   | 清理 D3 残留（§4.2）+ avatar/lipsync 下线执行（D-A，§4.7）+ MASTER 收敛 + token 补齐（§4.1/4.5）+ 活代码残留清理（manifest description + 5 处注释） | ✅ 已落地 |
| P1   | 边界与优先级链入 `domain-design-sop` §8 + `sop-entry` 双路由（§3）                                                                                  | ✅ 已落地 |
| P1   | 新建 `mentorloop-design-intelligence`（D-B：references 四件 + 选型单模板 + adapter 模板加字段 + §1.6 登记六处）                                     | ✅ 已落地 |
| P2   | 角色补齐（§5，含 adapter / intelligence 挂 UX）                                                                                                     | ✅ 已落地 |
| P2   | 冗余合并 R1–R6（§4.4）                                                                                                                              | ✅ 已落地 |

## 3. P0 落地详情

| #   | 动作                           | 结果与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | D-A 下线五步执行（§4.7）       | ① 全仓 grep 复核 → ② 逐处改写活引用（interview-room-ux 改语音状态可视化、role-uiux-designer、role-miniprogram-pm、sop-entry、README §8.2/§4、roles-sop、domain-native-sop、HANDBOOK、docs 03/04、MASTER :10-12 元数据、theme.uts 注释）→ ③ 删除 `avatar-design` / `lipsync-spec` 两个 skill 目录（`.trae/skills/` 现存 17 目录可复核）→ ④ README §8.2 删两行 + registry 机检 → ⑤ sop-entry 禁止组合改写为下线裁决记录。`AvatarState` 类型保留（`styles/theme.uts:56`，`ml-voice-visual` 消费） |
| 2   | MASTER 收敛（治理方案 §2.3-1） | 上半通用模板**不删不沉**，`MASTER.md:7-9` 增「⚠️ 非权威 · skill 溯源快照（2026-10-14 设计治理裁决）」标注：不作为实现权威，以 §A1–§A4 为准（消除 C1/C2/C3/C4/C8/C9/C11/C12 的权威冲突，保留溯源价值）                                                                                                                                                                                                                                                                                          |
| 3   | token 三载体补齐（§4.5）       | `styles/theme.uts:19-28` 增「2026-10-14 token 补齐（P0，任务卡 ds-1）」块：mist / chipSmart~chipDanger / fontSans / shadowSm~shadowFloat；MASTER §A1 增 mist / bg-muted / surface / chip-\* / dim-\*（:276-280）；C1/C2/C11 主色、强调色、字体权威取值统一以 main.css @theme 为准                                                                                                                                                                                                              |
| 4   | 命名漂移标注（§4.5）           | `styles/theme.uts:29-33` 增别名块（ink=textPrimary、inkSoft=textSecondary、line=border、amber=warn），标注「同值并存，后续收敛统一命名」（遗留，见 §9）                                                                                                                                                                                                                                                                                                                                        |
| 5   | 活代码残留清理                 | `manifest.json` description 数字人措辞 + 5 处活代码注释清理                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## 4. P1 落地详情

### 4.1 边界与优先级链正本（治理方案 §3 → domain-design-sop §8）

- `docs/sop/domain-design-sop.md:86` 新增「§8 设计 skill 边界与优先级链（正本）」：
  - §8.1 边界表（:90）：六个 skill 的「只管 / 不管 / 权威范围 / 产物」，含 design-intelligence 行（选型 = 咨询，须 UX 确认）；
  - §8.2 冲突裁决顺序（:101）：7 条恒成立——硬约束 → token 值 → 视觉/IA → 概念落地 → 灵感参考（不得覆盖前两者）→ 第三方 skill（项目恒优先）→ 数字人体系（D-A 归档）；
  - §8.3 装配规则（:111）：≤3 上限下的四类装配 + intelligence / adapter 不同时加载（:115 风格选型装配）。
- `.trae/rules/sop-entry.md` 双路由落地：:17 概念稿落地路由（mobile-design-adapter）、:18 选型路由（design-intelligence）；:35 客户端 UI 行条件加载追加二者；:47 下线裁决记录 + 「intelligence（选型）与 adapter（落地）不同时加载，以设计选型单落盘衔接」。

### 4.2 `mentorloop-design-intelligence`（D-B）与衔接契约

- skill 五件套：`SKILL.md`（机检达标）+ `references/` 四件（style-presets / layout-patterns / selection-procedure / brand-lock-filter）+ `assets/style-selection-template.md`（唯一产物 = 设计选型单）。
- 共享红线（SKILL.md :44）：0 新色值、0 新字体；候选只表达为 main.css @theme 现有 token 组合；永不覆盖硬约束与 token 值。
- adapter 衔接：`assets/mobile-spec-template.md` 增加「选型单引用」字段；adapter SKILL.md :45 明确「uvue/Tailwind 硬约束、隐私红线与 token 治理来自 system-spec，此处不复述」。

### 4.3 登记六处（治理方案 §1.6）

① SKILL.md 机检达标 ② README §8.2 注册行 + §4 承载追加 ③ sop-entry 路由行 + 条件加载 ④ roles-sop §8 UX 行挂载 ⑤ domain-design-sop §8 ⑥ adapter 模板「选型单引用」字段——六处全部落地。

## 5. P2 落地详情

### 5.1 P2-a 角色补齐（治理方案 §5「最需补 3 项」全部闭环）

| 缺口（§5.2）                 | 落地                                                                                                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 安全角色缺位                 | 归属 **QA（安全准入）**：`admission-sop.md` §5 签字表改三方——审查 Agent / UX（设计走查）/ QA（含安全准入）；roles-sop QA 描述补安全；HANDBOOK SOP-06 节增签字表注（:264）                                                                                        |
| LC 无承载 skill / 无 G4 落点 | `release-sop.md` §3 新增 LC 合规签署节、§5 改双签（QA/DevOps 书面准入 + LC 合规签署，不得口头放行）；`compliance-sop.md` 分工 QA（安全）/ LC（财务核验）；合规台账落盘 `docs/compliance/compliance-ledger.md`（README §8.3 加行 + HANDBOOK 产物路径表八类→九类） |
| 运营 / 财务无角色            | CO 描述补「增长实验与客服反馈归集」；财务核验归 LC（合规台账承载）                                                                                                                                                                                               |
| 移动端转换 / 灵感层未挂角色  | roles-sop §8 UX 行 = `role-uiux-designer` + `interview-room-ux` + `mobile-design-adapter` + `design-intelligence` + `domain-design-sop.md`                                                                                                                       |
| 需求受理 / 评测主责描述缺    | `role-product-owner/SKILL.md` 补节（现含 Requirements intake / Scope cutting / Frozen decisions / Outputs 等，§5.4 缺口闭环）；roles-sop §7 新增两条治理裁决：**安全与财务归属** / **评测与抽检主责**（AI 主责执行评测，CO 人工分层抽检，PO 裁决量表业务合理性） |

### 5.2 P2-b 冗余合并 R1–R6（各组落点与证据）

| 组                                  | 正本                                                            | 复述方（改为引用）                                                                       | 证据                   |
| ----------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| R1 链型 / 节流                      | `sop-entry.md`（装载上限、命中裁决）+ `pipeline-sop.md`（链长） | `mentorloop-pipeline` :16/:24「不重推导」                                                | pipeline SKILL.md      |
| R2 UTS / uvue / Tailwind 硬约束     | `mentorloop-system-spec` + README §5                            | `uni-app-x` :31「不复述；冲突一律以项目正本为准」                                        | uni-app-x SKILL.md     |
| R3 token 三源 / 隐私红线 / 平台约束 | `mentorloop-system-spec`                                        | `mobile-design-adapter` :45、`role-uiux-designer` :55「do not restate」                  | 两 SKILL.md            |
| R4 G2 检查项                        | `mentorloop-quality-gate`（命令清单单点）                       | `release-check` :17「quality-gate owns the command list; do not re-run it here」         | release-check SKILL.md |
| R5 评测集重跑                       | `domain-content-sop.md` §6（单一权威纪律）                      | contract-freeze :37、ai-engineer :32、content-review :52、release-check :21 四处均改引用 | 四 SKILL.md            |
| R6 G1 / G2 复述                     | 门禁定义（contract-freeze / quality-gate）                      | `release-check` :16-17 改依赖引用                                                        | release-check SKILL.md |

## 6. 登记与版本终态

- **规模**：skill 19 → **17**（删 avatar-design / lipsync-spec，增 design-intelligence）；SOP **13 份**。
- **SOP 正本四行**（README §8.1 / HANDBOOK 对应节同步）：
  - SOP-01 角色体系与协作 → `1.2.0`（覆盖列加「/ 安全与财务归属」）
  - SOP-06 G3 验收准入 → `1.1.0`
  - SOP-07 G4 发布准入 → `1.1.0`（覆盖列加「/ LC 合规签署」）
  - SOP-12 上线合规 → `1.1.0`
- **skill 十行 bump**（README §8.2 + HANDBOOK §六 同步）：contract-freeze / content-review / quality-gate / release-check / ai-engineer / product-owner / uni-app-x → `1.1.0`；pipeline → `1.1.0`（职责表述同步改「链式流水线推进与上下文节流」）；uiux-designer `1.0.1` → `1.1.0`；mobile-design-adapter `1.1.0` → `1.2.0`。
- **HANDBOOK 同步 18 处**：SOP-01/06/07/12 标题行版本、SOP-06 签字表注、SOP-07 LC 合规签署措辞、产物路径表「八类→九类」+ 合规台账行、§六 10 行 skill 版本。
- **README §8.3** 追加合规台账路径行。

## 7. 门禁与机检结果

| 门禁     | 命令 / 方式                                                                                                                                  | 结果                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 格式     | `node node_modules/prettier/bin/prettier.cjs --write` 后 `--check`（docs/sop 全部改动文件 + 治理方案）                                       | ✅ 幂等全绿                                 |
| 登记机检 | `node scripts/check-sop-registry.mjs`                                                                                                        | ✅ 17 skill / 13 SOP，结构面 + 预算面零发现 |
| 抽查     | README §8.1/§8.2/§8.3、HANDBOOK 关键行、roles-sop 裁决、release-sop 签署、sop-entry 路由、domain-design-sop §8、skills 目录逐项 grep/LS 复核 | ✅ 全部在位                                 |

（环境注：pnpm 沙箱不可直调脚本，一律 node 直调。）

## 8. 对照 ds-1 §4 验收标准

| #   | ds-1 §4 验收标准                                                          | 状态       | 说明                                                                                                                                                        |
| --- | ------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MASTER 内不存在与 §A1 冲突的主色/字体/组件样式；通用 Web 段显式标注非权威 | ✅         | `MASTER.md:7-9` 非权威标注；§A1–A4 为唯一实现权威                                                                                                           |
| 2   | §A1 含完整七类 token 权威表，且三载体名集合逐项一致                       | ◐ 部分达成 | 颜色/字体/阴影类已齐（theme.uts :19-28 补齐块 + MASTER §A1 :276-280）；**spacing / radius / motion / size 四类仍缺位（F3）**；theme.uts :29-33 别名块待收敛 |
| 3   | `node scripts/check-design-tokens.mjs` 退出码 0，并接入 CI                | ❌ 未落地  | `scripts/` 现仅 uni-cli / check-uvue-css / check-sop-registry 三个 .mjs                                                                                     |
| 4   | 字号白名单生效（体系外 `text-[Npx]` 被拦截）                              | ❌ 未落地  | 随 #3 同脚本实现（ds-1 F4）                                                                                                                                 |
| 5   | `components/ml-*` 每个组件有规格文件（props/variants/五态）               | ❌ 未落地  | ds-1 F5                                                                                                                                                     |
| 6   | G2 客户端裁剪全绿（lint + format + typecheck + test）                     | — 未触发   | 本轮 P0–P2 零客户端代码改动（改动面 = docs / skills / 登记），登记面由 #7 机检覆盖                                                                          |
| 7   | `node scripts/check-sop-registry.mjs` 全绿                                | ✅         | 17 skill / 13 SOP 零发现                                                                                                                                    |

任务卡 §0 发现映射：F1 → #1 ✅；F2 → #2 既有集合部分 ✅；F3 → #2 缺位部分遗留；F4 → #3/#4 遗留；F5 → #5 遗留；F7 已消解（adapter 转换位落地）；**F6**（`multi-platform-ui-handbook/` 未纳入体系）→ ds-1 §2 明确「不做，仅登记」，按裁决保留，非欠账。

## 9. 遗留与后续建议

1. **新任务卡承接 F3 / F4 / F5**（延续 ds-1 拆下一批）：
   - spacing / radius / motion / size token 定稿并三载体一次改齐（沿用 ds-1 §5 对策：只增不减 + 别名，回归走查后再收敛）；
   - `scripts/check-design-tokens.mjs`：三载体名集合静态比对 + 字号白名单（12/14/16/18/22/28），退出码 0；
   - 接入 CI（`.github/workflows/ci.yml`）；
   - 组件规格以现有 `ml-*.uvue` 反写至 `design-system/mentorloop/components/`。
2. **命名漂移收敛**：theme.uts :29-33 别名块（ink / inkSoft / line / amber）随 F4 机检统一命名后移除。
3. **治理方案状态行**：已随本报告把 `docs/design-governance-plan.md` 头部状态由「定向稿 · 实施未开工」更新为「已实施」（消除与 §6 五行 ✅ 的矛盾）。
4. **F6 低优先级评估**：`multi-platform-ui-handbook/` 可在设计选型场景评估纳入 intelligence 参考源（ds-1 裁决暂不处理）。
5. **合规台账启用**：首次 G4 双签真实运行时在 `docs/compliance/compliance-ledger.md` 落首条。
6. **纪律保持**：registry 机检随提交前 quality-gate 常态运行（现状已具备，保持即可）。

## 10. 签字（SOP-06 / admission-sop §5 三方）

| 角色       | 签字项                                                                        | 状态          |
| ---------- | ----------------------------------------------------------------------------- | ------------- |
| 审查 Agent | 事实核查（本报告全部「文件 + 行号」证据当日 grep / Read / LS 复核）+ 门禁复核 | ✅ 2026-10-14 |
| UX         | 设计走查（MASTER 收敛 / token 补齐 / intelligence 选型链 / adapter 衔接）     | 待签          |
| QA         | 安全准入（登记面与机检复核）                                                  | 待签          |
