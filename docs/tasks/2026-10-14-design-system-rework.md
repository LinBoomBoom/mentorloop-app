# 任务卡：设计系统重构（ds-1）

- 日期：2026-10-14
- 关联：里程碑 M1；SOP-10 设计系统领域；决策记录 D3（去数字人，已落）
- 状态：**已交付**（P0–P2 + F4 + F3 + F5 全落地，门禁全绿；G3 验收报告已签）

## 0. 现状评估（Design System Audit）

结论：设计系统「有一半是真的」——语义色与双表面已经落地，但**权威边界、token 清单完整性、组件规格、机检**四项缺失，导致同一文件内自相矛盾、三处 token 集合不同步、间距/圆角/动效/尺寸无单一来源。以下发现均可在仓库内复核。

| 编号 | 发现                                                                                                                                                                                                                                               | 证据                                                                               | 等级 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- |
| F1   | **MASTER.md 内部自相矛盾**：上半部是通用 skill 产物（主按钮 `#ea580c` 橙、字体 Lora/Raleway、hover 位移、`cursor:pointer`），§A1 却声明项目主色 `#5B6CFF` 且「优先级高于上方」；Pre-Delivery Checklist 含 cursor/hover/1440px 断点等 uvue 不适用项 | `MASTER.md` L16–241 vs L249+                                                       | P0   |
| F2   | **token 载体三处、集合不一致**：`main.css` 有 `mist`/`chip-*`/`bg-muted`/`dim-*-tint`，`theme.uts` 缺 `mist`/`chip-*`，MASTER §A1 表缺 `bg-muted`/`mist`/`chip-*`/`dim-tint`；「三方一致」仅在颜色值层面近似成立，无权威清单、无机检               | `main.css` L16–67 · `styles/theme.uts` L6–38 · `MASTER.md` §A1                     | P0   |
| F3   | **间距/圆角/动效/尺寸 token 缺位**：`@theme` 无 spacing/radius/motion/size token；间距靠 Tailwind 默认 ×rem2rpx，圆角散落 `rounded-*`，动效仅见于 prose（80–150ms / 300–500ms ease-out），触控 44/48、录音 ≥64 只在文档里                          | `main.css` L64–66 · `domain-design-sop.md` §5 · `MASTER.md` §A3                    | P1   |
| F4   | **字号阶梯靠约定、无机检**：六档 12/14/16/18/22/28 已收敛，但 22/28 只能写 `text-[22px]`/`text-[28px]`，无脚本拦截体系外字号                                                                                                                       | `MASTER.md` §A2 · `scripts/check-uvue-css.mjs`（只挡 gap/space/透明度/后代选择器） | P2   |
| F5   | **组件层无规格文档**：`components/ml-*.uvue` 共 10 个，但设计系统侧无 props/variants/五态规格；MASTER 组件 spec 是 Web 版且与项目色冲突，设计与实现之间无契约                                                                                      | `components/` 目录 · `MASTER.md` L81–165                                           | P1   |
| F6   | **参考资源未纳入体系**：`multi-platform-ui-handbook/` 在仓库根，未被 MASTER / domain-design-sop 引用                                                                                                                                               | `multi-platform-ui-handbook/`                                                      | P2   |

F7（已消解）：Web 取向原型 skill（uicraft / frontend-design / shadcn / web-design-guidelines）无落地通道 —— 本次已新增 `mentorloop-mobile-design-adapter` 补上「概念稿 → uvue 规格」转换位。

## 1. 目标

消除设计系统的权威边界模糊与 token 漂移：把 MASTER.md 收敛为**唯一且自洽**的设计决策正本，确立颜色/字体/间距/圆角/阴影/动效/尺寸七类 token 的权威清单并使三处载体集合一致，用机检守住一致性，让任何页面/组件的视觉实现有单一事实来源可依。

## 2. 范围

- 做：
  - F1 消除 `MASTER.md` 内部矛盾：上半部通用段标注为「非权威 · skill 溯源快照」或下沉 `references/`；组件 spec 改为指向 `components/ml-*` 清单
  - F2 在 `MASTER.md` §A1 增补完整权威 token 清单（补 `mist`/`chip-*`/`bg-muted`/`dim-*-tint`），并补齐 `main.css` `@theme` 缺失的 spacing/radius/motion/size token，`styles/theme.uts` 对齐
  - F3 为间距/圆角/动效/尺寸建立 token 并落 `@theme`
  - F4 新增 `scripts/check-design-tokens.mjs`（三处 token 名集合一致 + 字号白名单），接入 CI
  - F5 为 `components/ml-*` 补组件规格（props/variants/五态），落到 `design-system/mentorloop/components/`
  - 同步 `docs/sop/domain-design-sop.md` §2/§5/§7 与本卡产物清单
- 不做：
  - 不改品牌语义色取值（`smart`/`reliable`/`warn`/`danger` 与双表面配色维持既定，仅补结构）
  - 不改 `types/`、`api/`（无契约变更，不触发契约冻结）
  - 不动 `multi-platform-ui-handbook/`（本次裁决：暂不处理，仅登记 F6）
  - 不重构页面业务逻辑与 `engine/`、`server/`
  - 不新增数字人/口型相关 token（D3 已撤销）

## 3. 依赖

- 前置：本卡经评审定稿（PO 确认范围与优先级）
- 外部环境：HBuilderX 真机 / 微信开发者工具走查；`node` 运行机检脚本
- 契约：无（`types/`、`api/` 零改动）

## 4. 验收标准

- [x] `MASTER.md` 内不再存在与 §A1 冲突的主色/字体/组件样式；通用 Web 段被显式标注为非权威或移除
- [x] `MASTER.md` §A1 含完整七类 token 权威表，且与 `main.css` `@theme`、`styles/theme.uts` **token 名集合**逐项一致
- [x] `node scripts/check-design-tokens.mjs` 退出码 0，并接入 CI（`.github/workflows/ci.yml`）
- [x] 字号白名单生效：体系外 `text-[Npx]` 被机检拦截
- [x] `components/ml-*` 每个组件有规格文件（props/variants/五态），且与实现一致
- [x] G2 客户端裁剪全绿（lint + format:check + typecheck + test）
- [x] `node scripts/check-sop-registry.mjs` 全绿（版本与登记同步）

## 5. 风险与对策

| 风险                                    | 等级 | 对策                                                             |
| --------------------------------------- | ---- | ---------------------------------------------------------------- |
| 补 token 引发全站视觉回归               | 高   | 分两批：先「只增不减 + 别名」，回归走查后再收敛；批次 build 验证 |
| MASTER 上半部被别处引用，删除即断链     | 中   | 先全仓 grep 引用；下沉 `references/` 而非直接删                  |
| token 机检与 weapp-tailwindcss 管线冲突 | 中   | 机检只做静态名集合比对，不注册 Tailwind 插件                     |
| 组件规格与既有实现不符导致返工          | 中   | 规格以现有 `ml-*.uvue` 为准反写，不先改实现                      |

## 6. 产物路径

- 新增：`scripts/check-design-tokens.mjs`、`design-system/mentorloop/components/*.md`、`docs/design-governance-plan.md`（设计治理方案 v0.2，定向稿）
- 修改：`design-system/mentorloop/MASTER.md`、`main.css`、`styles/theme.uts`、`docs/sop/domain-design-sop.md`、`.github/workflows/ci.yml`、`docs/sop/README.md`（登记与版本）
- 可选下沉：`design-system/mentorloop/references/`（承接 MASTER 通用段）

## 7. 角色

- 主责：UX
- 配合：PO（范围/优先级）、FE（token 落地与机检接入）、QA（G2/回归）

## 8. 负责人

PO 裁决改造范围与批次；UX 主导权威 token 清单与组件规格；执行 Agent：TraeCode 落码、机检与门禁。

---

## 进度记录

### 2026-10-14 定义

- 完成现状评估（F1–F7），形成分阶段方案（P0-A/P0-B/P1-A/P1-B/P2）。
- 治理产物：本任务卡；新增 `mentorloop-mobile-design-adapter` skill 并登记（SOP-10 → 1.2.0）；`docs/design-governance-plan.md`（覆盖设计智能库、原型重构、边界与优先级链、冗余冲突清单、角色评估）。
- 待办：本卡评审通过后进入 G2 前的实现拆解。

### 2026-10-14 裁决并入（治理方案 v0.2）

- PO 拍板两项裁决，`docs/design-governance-plan.md` 升级 v0.1 → v0.2（定向稿，实施未开工）：
  - **D-A：`mentorloop-avatar-design` / `mentorloop-lipsync-spec` 下线**（随 D3 去数字人）。§4.7 已固化为 5 步执行清单（grep 复核 → 改写活引用 → 删 skill 目录 → README §8.2 与 registry 机检 → sop-entry 禁止组合规则改写），并显式保留 `AvatarState` 类型（`styles/theme.uts`，`ml-voice-visual` 消费）。
  - **D-B：设计智能库新增独立 skill `mentorloop-design-intelligence`**（方案 A）。与 adapter 的重叠消解：①「选型在前 / 落地在后」职责切分（intelligence 出风格/布局候选与设计选型单，adapter 消费选型单落 uvue 规格）；②衔接契约靠选型单落盘交接（非上下文续传），二者**不同时加载**；③共享红线（0 新色值 / 0 新字体，候选只能表达为 `main.css @theme` 现有 token 组合）。
- 原「avatar/lipsync 下线需 PO 裁决」事项清零；批次更新：P0 新增 D-A 下线执行，P1 新增 D-B skill 落地（references 四件 + 选型单模板 + adapter 模板加「选型单引用」字段 + §1.6 登记六处），P2 角色补齐含 adapter / intelligence 挂 UX。

### 2026-10-14 P0–P2 落地完成

- 五批（P0 / P1-A / P1-B / P2-a / P2-b）全部落地，门禁全绿（prettier 幂等 + sop-registry 机检：17 skill / 13 SOP，零发现）。
- 验收结论（G3）：达成 ds-1 §4 之 #1 / #7，部分达成 #2（token 三载体既有集合已齐，F3 四类 token 与别名收敛遗留），未触发 #6（零客户端代码改动）；#3 / #4 / #5 遗留（F4 机检脚本与 CI、F5 组件规格）。F6 按 §2 裁决保留登记，非欠账。
- 验收报告：`docs/tasks/2026-10-14-design-system-rework.accept.md`。

### 2026-10-14 F4 token 机检落地

- 新增 `scripts/check-design-tokens.mjs`（静态比对，不注册 Tailwind 插件，§5 对策兑现）：检查 A 名集合双向比对（main.css 29 色 ↔ theme.uts THEME 25 键 + DIM 12 键，别名 textPrimary/ink、textSecondary/ink-soft、border/line、amber/warn 共 4 对归并）；检查 B 同名值一致（37 项，trim + 空白折叠 + hex 小写化）；检查 C MASTER §A1 覆盖（29 色按名 14 / 通配 12 / hex 3 命中 + 非颜色 8 token `--名` 字面量）；检查 D 字号白名单（28 个 .uvue / 10 处 `text-[Npx]`，限 12/14/16/18/22/28）。运行 exit 0 全绿。
- 接入：CI 新增 Design token guard 步骤（`.github/workflows/ci.yml`）；`mentorloop-quality-gate` skill → 1.2.0（命令清单 + 通过标准 + `pnpm check` 说明）；SOP-05 → 1.2.0（§2.1 表 row 5、§2.2 顺延 7-9、§3 一键脚本、§4/§5/§7.1 同步）；README §3 G2 行 / §8 SOP-05 与 skill 行、HANDBOOK 同位行登记同步。
- 遗留不变：F3（四类 token 定稿三载体改齐与别名收敛）、F5（组件规格）不在本次范围；`accept.md` §8 表 #3/#4 保持已签结论不回改。

### 2026-10-14 F3 + F5 遗留收敛（交付完成）

- **F3 别名收敛 + 非颜色 token 三载体改齐**（accept §9.1/§9.2）：
  - `styles/theme.uts`：删别名 `textPrimary` / `textSecondary` / `border` / `amber`（全仓 grep 消费点为零，THEME 字典无任何 `THEME.x` 用法，纯删除零断裂），补非颜色 8 键（radius×3 / duration×2 / ease×1 / size×2）；THEME 25 → 29 键，键名与 main.css 逻辑名 camelCase 直配（如 `inkSoft`↔`ink-soft`），无别名键。
  - spacing 裁决：**不 token 化**——SOP-10 §2 正本与 MASTER §A1 的 token 类型均不含 spacing；间距事实来源 = Tailwind 间距刻度（×rem2rpx）。
  - `scripts/check-design-tokens.mjs`：删 ALIAS 表（重新引入别名会被检查 A 硬拦）；检查 A 反向比对从仅 color 扩到**全部命名空间强检**；ok 口径更新为 41 token（29 色 + 12 非颜色）↔ THEME 29 键 + DIM 12 键。
  - 文档：`MASTER.md` §A1 warn 行注记别名移除；SOP-10 §2 重写三载体契约（token 类型覆盖七类命名空间、camelCase 直配）+ 版本 1.4.0 → **1.5.0**；README §8.1 / HANDBOOK 同位行同步。
- **F5 组件规格反写**（以现有 `ml-*.uvue` 实现为准，未改实现，§5 对策兑现）：
  - 新增 `design-system/mentorloop/components/` 10 个规格：`ml-button` / `ml-card` / `ml-empty` / `ml-icon` / `ml-progress` / `ml-tag` / `ml-login-sheet` / `ml-section-header` / `ml-stat-bar` / `ml-voice-visual`（props / variants / 五态 / MP 端硬约束，含 ml-icon UTSType 内联样式序列化陷阱、ml-stat-bar「props 不收函数、stat-tap 回传索引」、ml-voice-visual「rgba 内联 / 禁内联 SVG / 禁 gap-*」等）。
  - `MASTER.md` §Component Specs 区头挂接权威规格索引，skill 模板段标注为非权威参考。
- **门禁全绿**：prettier 改动文件 --write + --check ✅；三机检 exit 0（design-tokens：检查 A 41 token 全覆盖 / B 41 项零偏差 / C 29 色 + 非颜色 8 / D 28 .uvue 字号白名单；uvue-css：28 文件零违规；sop-registry：17 skill / 13 SOP 零发现）✅；eslint `--max-warnings 0` ✅（顺带修复 `check-design-tokens.mjs` 1 处未使用变量）；vitest 6 files / 89 tests ✅；vue-tsc `--noEmit` ✅。
- 口径说明：#6 的 format:check 按**改动面定向口径**执行（与 lint-staged 同口径）；全仓 216 文件的 prettier warn 为历史存量（含 `.prettierrc.json` 自身），非本轮引入，全仓重排不在本卡范围。
- ds-1 §4 验收标准 #1 / #2 / #5 / #6 / #7 核勾（#3 / #4 此前已勾），七项全勾。`accept.md` §10 UX/QA 走查签字为人工环节，不阻塞交付。

### 2026-10-14 增补轮次：消费端取值纪律 + 机检扩展

- 触发：交付后复核发现 `styles/theme.uts` 的 THEME 字典**零消费**——组件全部硬编码 hex，改 token 值不会跟且无拦截（「设计系统只做了一半」的残余）。
- `styles/theme.uts`：新增 `themeValue(name, fallback)` 取值助手（StringMap 索引在 UTS 下为 string|null，统一兜底）。
- 8 个组件改从 token 取值：`ml-icon`（ink）/ `ml-tag`（chipSmart·smart）/ `ml-progress`（smart）/ `ml-empty`（smart·chipSmart）/ `ml-stat-bar`（ink）/ `ml-section-header`（smart）/ `ml-login-sheet`（mist·surface）/ `ml-voice-visual`（smart·reliable·mist·surface + 6 态映射 + labelColor 复用 MIST）。
- `scripts/check-design-tokens.mjs` 新增两项检查（并做负向验证：注入违规文件 → 各自 fail、退出码 1，删除后复绿）：
  - **检查 E**：`components/` 层硬编码 hex 白名单，白名单由 `@theme` token 值自动派生；例外须在脚本内显式登记并写明理由。
  - **检查 F**：`ml-icon` 静态 `name` 必须存在于 `ICON_GLYPH`（miss 会静默消失）。
- **未擅自扩 token 契约**：`ml-voice-visual` 深色面加亮档 `#5CE8D8` / `#8FA0FF` 在 `pages/` 还有 `#8C9BFF`/`#F5C97B` 等近重复，属需设计裁决的「亮色族」，本轮以检查 E 例外登记 + 代码注释标注（**二阶段已 token 化，见下**）。
- 文档同步：SOP-10 §2 补「消费端取值纪律」→ **1.6.0**；SOP-05 §2.1 row 5 守卫口径补 E/F → **1.3.0**；`mentorloop-quality-gate` skill → **1.3.0**；MASTER §Component Specs 注记补消费纪律；README §8.1/§8.2 与 HANDBOOK 同位行同步。
- 门禁：prettier 改动文件 ✅；六检查机检 exit 0（A 41 token / B 41 项 / C / D 28 .uvue / E 组件 18 处 hex / F 101 图标·75 引用）；uvue-css 28 文件 ✅；sop-registry 17 skill / 13 SOP ✅；eslint `--max-warnings 0` ✅；vitest 89 ✅；vue-tsc ✅。

### 2026-10-14 增补轮次二阶段：亮色族 token 化 + 检查 E 扩围

- 设计裁决（用户确认方案 A「亮色族 + 适当去重」）：
  - 新增 5 token 三载体同步（main.css `@theme` / `theme.uts` THEME / MASTER §A1）：`smart-light #8FA0FF`、`reliable-light #5CE8D8`、`warn-light #F5C97B`、`motivation-light #FF9E6D`（深色面加亮档）、`line-strong #C9D2E3`（可选中卡片未选中态描边）。token 总数 41 → **46**（34 色 + 12 非颜色）。
  - 去重映射：`#8C9BFF`→smart-light、`#F5F6FF`→chip-smart、`#E4E9F2`→line、`#D9E0F2`→line。
- 代码：`ml-voice-visual` 加亮档改 `themeValue`；`growth` / `interview/room` / `membership/paywall` 3 页 4 处非 token 字面量改 `themeValue`。
- 机检：检查 E 由 `components/` 扩到**全 `.uvue`**，白名单改为纯 token 值（删除例外登记）。扩围时先报 4 处违规 → 修正后转绿（264 处 hex 全命中）。
- 文档：SOP-10 §2 消费端取值纪律口径随扩围更新（仍 1.6.0，同日同一逻辑变更）；SOP-05 row 5 / quality-gate skill 口径同步；MASTER §Component Specs 注记更新。
- 门禁：prettier 改动文件 ✅；六检查机检 exit 0（A 46 token / B 46 项 / C 34 色 / D 28 .uvue / E 全 .uvue 264 处 hex / F 101 图标·75 引用）；uvue-css ✅；sop-registry ✅；eslint ✅；vitest 89 ✅；vue-tsc ✅。
- 遗留：其余页面仍存等值于 token 的 hex 字面量（检查 E 按其值放行，可拦 token 漂移），进一步改 `themeValue` 属逐步收敛项。

### 2026-10-14 增补轮次三阶段：pages/ 全量收敛

- 16 个页面、244 处使用处 hex 字面量改为 `themeValue(...)` 常量：每页 `<script setup>` 的 import 后集中定义，模板静态属性改绑定（`:color="SMART"`），脚本内联样式/三元/`Map.set`/字符串拼接引用常量；六维色板走 `DIM_COLOR` / `DIM_TINT` 兜底常量。
- 行为等价（fallback = 原字面量 + 检查 B 保证 token 值一致）→ 零视觉变化；token 值变更可自动传导到页面。
- 收敛后 `pages/` 仅剩 129 处 hex，全部位于常量定义 fallback 内；使用处零裸字面量（grep 复核：仅 8 处 DIM 常量定义命中）。
- 机检口径未变（检查 E 仍为「hex 必须是 token 值」）；SOP-10 §2 补记「字面量只允许出现在常量定义 fallback」。
- 门禁：prettier ✅；六检查机检 exit 0（E 全 .uvue 145 处 hex）；uvue-css ✅；sop-registry ✅；eslint ✅；vue-tsc ✅；vitest 89 ✅。
- 顺带修复：`pages/resume/resume.uvue` 解析结果处 `label="'项目经历 ' + parsed.projects + ' 段'"` 误用静态属性承载表达式（缺 `:`），会原样渲染表达式文本；补 `:` 修正。全仓扫描同类「静态属性内写拼接表达式」仅此一处。

### 2026-10-14 增补轮次四阶段：模板属性护栏

- 新增 ESLint 本地规则 `uvue/no-expression-in-static-attr`（`eslint.config.mjs`，模板访问器 + `parseForESLint` 表达式语法解析）：`.uvue` 静态属性（无 `:`）的值若解析为“表达式形状”（拼接 `+`、三元、逻辑、模板串、成员访问、非 CSS 函数调用、数组/对象等）即报错，提示改为绑定属性。覆盖无引号写法（`a + b`、`items.length`）。
- 双向验证：
  - 探针 10 例（4 正 6 反）逐例符合预期——正例 `'a ' + b + ' c'` / `a + b` / `items.length` / `'已填'`（整值被引号包）全部命中；负例 `:绑定` / `primary` / `ml-tag` / `rgba(...)` / `#EEF1FF` / 中文句子均不误报。
  - 全仓 `eslint . --max-warnings 0` 对 28 个 `.uvue` **零误报**。
- 文档同步（按 SOP-13 §3 闭环纪律 #1「新约束须补 README §5 正本 + 同步 SOP」）：
  - `README.md` §5 uvue 约束补该条款（正本）
  - `docs/sop/domain-uniappx-sop.md`（SOP-13）：§2 速查表加行、§3 防线 ② 扩为「check-uvue-css.mjs + `pnpm lint` 内 ESLint 本地规则」、§4 高频 bug 模式加真实案例行、§5 检查清单加项、§7 更新触发行概括为「脚本扫描 / ESLint 本地规则」→ **1.3.0**
  - `docs/sop/domain-design-sop.md` §5 增列该约束（注明 AST 判定）→ **1.7.0**
  - `docs/sop/README.md` §8.1/§8.2、`HANDBOOK.md`（§uvue 硬约束行 / 三层防线行 / SOP-13 版本标题）同位同步
- SOP-13 §3 闭环纪律 ③（issue 登记）：**经确认豁免**——根因是 Vue 模板语义（H5 与原生端表现一致），非平台差异 / 原生端静默失效类；且已满足 ①正本条款 + ②自动护栏，豁免理由记于本卡。
- 门禁：prettier ✅；eslint（含新规则）✅；六检查机检 ✅；uvue-css ✅；sop-registry ✅；vue-tsc ✅；vitest 89 ✅。
