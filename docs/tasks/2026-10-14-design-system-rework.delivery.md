# 交付总结报告：设计系统重构（ds-1）

- 日期：2026-10-14
- 任务卡：`docs/tasks/2026-10-14-design-system-rework.md`
- 验收报告：`docs/tasks/2026-10-14-design-system-rework.accept.md`（G3，已签，不回改）
- 治理方案：`docs/design-governance-plan.md`（v0.2）
- 结论：**P0–P2 五批 + F4 token 机检 + F3 遗留收敛 + F5 组件规格全部交付；ds-1 §4 七项验收标准全勾；门禁全绿。**

## 1. 交付总览

| 批次      | 内容                                                                                                                                                                     | 状态 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| P0        | D-A 下线执行（avatar/lipsync skill 删除 + 活引用改写 + registry 机检）；F1 MASTER 自相矛盾消除；F2 token 三载体补齐（mist / chip-\* / bg-muted / dim-\*-tint / bgMuted） | ✅   |
| P1-A/P1-B | D-B 设计智能库落地（`mentorloop-design-intelligence` skill：references 四件 + 选型单模板）；`mentorloop-mobile-design-adapter` 模板加「选型单引用」字段 + 登记           | ✅   |
| P2-a/P2-b | 角色补齐（adapter / intelligence 挂 UX）；登记六处同步                                                                                                                   | ✅   |
| F4        | token 机检 `scripts/check-design-tokens.mjs`（四检查）+ CI 接入 + quality-gate 1.2.0 / SOP-05 1.2.0 登记                                                                 | ✅   |
| F3        | 别名收敛（textPrimary / textSecondary / border / amber 移除）+ 非颜色 8 token 三载体改齐                                                                                 | ✅   |
| F5        | 组件规格 10 份反写至 `design-system/mentorloop/components/`                                                                                                              | ✅   |

G3 验收（P0–P2 时点）结论见 accept.md；本报告覆盖其后的 F4 / F3 / F5 收尾轮次。

## 2. 设计系统终态

### 2.1 权威边界（F1 消解）

- `MASTER.md` 单一自洽：§Global Rules → §A1–A4（项目适配决策，权威）在上，skill 溯源段显式标注非权威。
- §Component Specs 区头挂接[权威组件规格索引](../design-system/mentorloop/components/)，skill 原始模板（Web 版示例 css）标注「不适用 MentorLoop」。
- Pre-Delivery Checklist 已按 uvue 约束裁剪（去 cursor / hover 位移 / 1440px 断点等）。

### 2.2 token 三载体一致（F2 + F3 收敛终态）

三载体：`main.css @theme`（Tailwind 4 生成源，权威）↔ `styles/theme.uts`（UTS 侧：状态机 / 原生层 / 语音态）↔ `MASTER.md §A1`（人读权威表）。

| 载体       | 集合                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| main.css   | **46 token** = 34 色（17 主色 + 5 亮色族/描边 + 6 dim + 6 dim-tint）+ 12 非颜色 |
| theme.uts  | THEME 34 键（22 色 + fontSans + shadow×3 + 非颜色 8）+ DIM_COLOR 6 + DIM_TINT 6 |
| MASTER §A1 | 34 色语义表 + 非颜色 8 token 字面量                                             |

**非颜色 12**：fontSans（字体）、shadow×3、radius×3（chip 999px / control 12px / card 16px）、duration×2（press 120ms / ambient 400ms）、ease×1（standard ease-out）、size×2（touch 88rpx / record-cta 128rpx）。

**键名纪律（camelCase 直配）**：theme.uts 键 = main.css 逻辑名去 `--` 的 camelCase（`inkSoft`↔`ink-soft`），**无别名键**。别名 `textPrimary` / `textSecondary` / `border` / `amber` 已于 2026-10-14 收敛移除（消费点 grep 为零，纯删除零断裂）；机检 ALIAS 表同步删除，此后重新引入别名将被检查 A 硬拦。

### 2.3 spacing 不 token 化（裁决说明）

F3 原表述为「间距/圆角/动效/尺寸 token 定稿并三载体一次改齐」，落地口径收敛为：

- **spacing 不设 token**。依据：SOP-10 §2 正本（v1.5.0）与 MASTER §A1 定稿的 token 类型均不含 spacing；ds-1 §0 F3 证据即「间距靠 Tailwind 默认 ×rem2rpx」——间距事实来源 = Tailwind 间距刻度，全站已统一走该刻度，无第二来源需要收敛。
- 圆角 / 动效 / 尺寸三类照定稿落 token（上表非颜色 8 键）。
- 该口径已写入 SOP-10 §2（「token 类型覆盖七类命名空间：颜色 / 字体 / 阴影 / 圆角 / 动效（duration、ease）/ 尺寸；间距不设 token」）。

### 2.4 组件规格（F5）

10 份规格以现有 `ml-*.uvue` 实现为准反写（**未改任何实现**，§5 对策兑现），路径 `design-system/mentorloop/components/`：

| 规格                                                                             | 要点                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [ml-button](../design-system/mentorloop/components/ml-button.md)                 | 4 变体 × 3 尺寸；禁用 opacity-50 + 点击 return                            |
| [ml-card](../design-system/mentorloop/components/ml-card.md)                     | raised / pressable / padded 三开关                                        |
| [ml-empty](../design-system/mentorloop/components/ml-empty.md)                   | desc 空不渲染；action slot 判空 `slots.default != null`                   |
| [ml-icon](../design-system/mentorloop/components/ml-icon.md)                     | ~70 图标 PUA 查表；**内联样式禁 UTSType 实例**（MP 序列化空串致图标变黑） |
| [ml-progress](../design-system/mentorloop/components/ml-progress.md)             | percent clamp 0–100；极简模式仅轨道                                       |
| [ml-tag](../design-system/mentorloop/components/ml-tag.md)                       | 字面色 props，不引入新语义色                                              |
| [ml-login-sheet](../design-system/mentorloop/components/ml-login-sheet.md)       | 登录门控半屏层 7 态（含倒计时 / loading / 校验拦截）                      |
| [ml-section-header](../design-system/mentorloop/components/ml-section-header.md) | 竖条恒显；actionText 空则操作入口不渲染                                   |
| [ml-stat-bar](../design-system/mentorloop/components/ml-stat-bar.md)             | **MP 端 props 走序列化不收函数**，stat-tap 回传索引                       |
| [ml-voice-visual](../design-system/mentorloop/components/ml-voice-visual.md)     | 6 态语义表 + 4 动效；rgba 内联 / 禁内联 SVG / 禁 gap-\*                   |

### 2.5 机检与门禁（F4 + 增补轮次）

`scripts/check-design-tokens.mjs` 六检查（CI 步骤 `Design token guard` 已接入）：

- **检查 A**：名集合双向比对，main.css ↔ theme.uts 全命名空间强检（别名零容忍）。
- **检查 B**：同名值一致（trim + 空白折叠 + hex 小写化）。
- **检查 C**：MASTER §A1 覆盖（色名 / 通配 / hex 三态命中 + 非颜色 token 字面量）。
- **检查 D**：字号白名单 12/14/16/18/22/28，扫描全部 `.uvue`。
- **检查 E**（增补轮次）：硬编码 hex 白名单（**全 `.uvue`**）——白名单 = `@theme` token 值自动派生，无例外；亮色族 token 化后覆盖 `pages/`（收敛后剩 145 处 hex，全部为常量定义内的 fallback）。
- **检查 F**（增补轮次）：`ml-icon` 静态 `name` 必须存在于 `ICON_GLYPH`（miss 会静默消失）。

检查 E/F 已做负向验证（临时注入违规文件 → 各自 fail、退出码 1；删除后复绿）；检查 E 另有真实正向验证（扩围到 `pages/` 时先报 4 处违规，修正后转绿）。

### 2.6 SOP 登记

- SOP-10（domain-design-sop）→ **1.5.0**：§2 三载体契约重写（七类命名空间、camelCase 直配、别名移除注记、spacing 不设 token）；**增补轮次 → 1.6.0**（§2 补「消费端取值纪律」，同日随亮色族收敛把检查 E 口径扩到全 `.uvue`）。
- SOP-05（quality-gate-sop）→ 1.2.0 → **1.3.0**（§2.1 表 row 5 守卫口径补 E/F）；`mentorloop-quality-gate` skill → 1.2.0 → **1.3.0**。
- README §8.1 / §8.2 / HANDBOOK 同位行同步；sop-registry 机检全绿（17 skill / 13 SOP）。

### 2.7 消费端取值纪律 + 亮色族收敛（增补轮次）

第一阶段：`styles/theme.uts` 的 THEME 字典此前**零消费**——组件全部硬编码 hex，改 token 值不会跟，且无拦截。

- 新增 `themeValue(name, fallback)`（`styles/theme.uts`），组件改为 `themeValue('smart', '#5B6CFF')` 取色。
- 8 个组件改齐：ml-icon（ink）、ml-tag（chipSmart/smart）、ml-progress（smart）、ml-empty（smart/chipSmart）、ml-stat-bar（ink）、ml-section-header（smart）、ml-login-sheet（mist/surface）、ml-voice-visual（smart/reliable/mist/surface + 6 态映射）。

第二阶段（亮色族设计裁决后收敛）：

- **新增 5 个 token**（三载体同步，46 token = 34 色 + 12 非颜色）：`smart-light #8FA0FF` / `reliable-light #5CE8D8` / `warn-light #F5C97B` / `motivation-light #FF9E6D`（深色面加亮档）+ `line-strong #C9D2E3`（可选中卡片未选中态描边）。
- **去重映射**（吸收原散落 `pages/` 的重复值）：`#8C9BFF`→`smart-light`、`#F5F6FF`→`chip-smart`、`#E4E9F2`→`line`、`#D9E0F2`→`line`。
- 影响面：`ml-voice-visual` + `growth` / `interview/room` / `membership/paywall` 4 个页面改为 `themeValue` 取值。
- 检查 E 由 `components/` 扩到**全 `.uvue`**，白名单改为纯 token 值（删除例外登记）。
- 视觉变化仅为去重带来的轻微差异（paywall 未选中描边与选中底、growth 时间轴灰点），无结构性改动。

第三阶段（`pages/` 全量收敛）：

- 16 个页面、**244 处**使用处 hex 字面量改为 `themeValue(...)` 常量：每页在 `<script setup>` 的 import 之后集中定义，模板静态属性改绑定属性（`color="#FFFFFF"` → `:color="SURFACE"`），脚本内联样式/三元/`Map.set`/字符串拼接一律引用常量。
- 六维色板走 `DIM_COLOR` / `DIM_TINT` 的 `!= null` 兜底常量（模板无对应键）。
- 收敛后 `pages/` 仅剩 **129 处** hex，全部位于常量定义的 fallback 实参内；使用处零裸字面量（已 grep 复核）。
- 行为完全等价：常量 fallback = 原字面量，且检查 B 保证 token 值一致 → 零视觉变化；同时 token 值变更可经 `themeValue` 自动传导到页面。

## 3. 验收标准对照（ds-1 §4，七项全勾）

| #   | 标准                                        | 证据                                             |
| --- | ------------------------------------------- | ------------------------------------------------ |
| 1   | MASTER 内无与 §A1 冲突的主色/字体/组件样式  | G3 已判达成；本轮 §Component Specs 区头补索引    |
| 2   | §A1 七类 token 权威表与三载体名集合逐项一致 | F3 收敛后机检检查 A：41 token 全覆盖、零别名     |
| 3   | check-design-tokens 退出码 0 + CI 接入      | F4 轮交付（CI `Design token guard`）             |
| 4   | 字号白名单拦截体系外 text-[Npx]             | F4 轮交付（检查 D）                              |
| 5   | ml-\* 每组件有规格文件且与实现一致          | 本轮 10 份反写 + MASTER 索引                     |
| 6   | G2 客户端裁剪全绿                           | 本轮 lint / format:check / typecheck / test 全过 |
| 7   | sop-registry 全绿                           | 17 skill / 13 SOP 零发现                         |

## 4. 变更清单（F4 + F3 + F5 轮次）

新增：

- `scripts/check-design-tokens.mjs`
- `design-system/mentorloop/components/ml-{button,card,empty,icon,progress,tag,login-sheet,section-header,stat-bar,voice-visual}.md`（10 份）

修改：

- `styles/theme.uts`（别名删除 + 非颜色 8 键）
- `scripts/check-design-tokens.mjs`（ALIAS 表删除 + 检查 A 全命名空间强检）
- `design-system/mentorloop/MASTER.md`（§A1 warn 注记 + §Component Specs 索引）
- `docs/sop/domain-design-sop.md`（§2 契约重写，1.4.0 → 1.5.0）
- `docs/sop/HANDBOOK.md`、`docs/sop/README.md`（版本登记）
- `.github/workflows/ci.yml`（F4 轮：Design token guard）
- `docs/tasks/2026-10-14-design-system-rework.md`（状态行 + 七项核勾 + 进度记录）

增补轮次（消费端取值纪律 + 机检扩展）一阶段：

- `styles/theme.uts`（新增 `themeValue` 取值助手）
- `components/ml-{icon,tag,progress,empty,stat-bar,section-header,login-sheet,voice-visual}.uvue`（8 个组件改从 token 取值）
- `scripts/check-design-tokens.mjs`（新增检查 E 组件 hex 白名单、检查 F 图标名存在性）
- `design-system/mentorloop/MASTER.md`（§Component Specs 注记补消费纪律）
- `docs/sop/domain-design-sop.md`（§2 补消费端取值纪律 → 1.6.0）、`docs/sop/quality-gate-sop.md`（row 5 口径 → 1.3.0）、`.trae/skills/mentorloop-quality-gate/SKILL.md`（1.3.0）、`docs/sop/README.md` / `HANDBOOK.md`（登记同步）

增补轮次二阶段（亮色族 token 化 + 检查 E 扩围）：

- `main.css`（`@theme` 新增 smart-light / reliable-light / warn-light / motivation-light / line-strong）
- `styles/theme.uts`（THEME 新增同 5 键 camelCase）
- `design-system/mentorloop/MASTER.md`（§A1 增补 5 token 行 + 检查 E 口径注记）
- `components/ml-voice-visual.uvue`（加亮档改 `themeValue`）
- `pages/growth/growth.uvue`、`pages/interview/room.uvue`、`pages/membership/paywall.uvue`（4 处非 token 字面量改 `themeValue`）
- `scripts/check-design-tokens.mjs`（检查 E 扩到全 `.uvue`，删除例外登记）

增补轮次三阶段（`pages/` 全量收敛）：

- `pages/**/*.uvue` 共 16 个文件（index / training / training-room / login / report / paywall / resume / growth / mine / about / prefs / privacy / security / interview-room / interview-prep / interview-summary）：244 处使用处 hex 改为 `themeValue` 常量 + 模板绑定

增补轮次四阶段（模板属性护栏）：

- `eslint.config.mjs`（新增本地规则 `uvue/no-expression-in-static-attr`：按表达式语法解析静态属性值，命中拼接/三元/成员访问/调用等表达式形状即报错）
- `pages/resume/resume.uvue`（修复解析结果处缺 `:` 的 `label` 绑定）
- 文档（按 SOP-13 §3 闭环纪律同步）：
  - `README.md` §5（uvue 约束补该条款，**正本**）
  - `docs/sop/domain-uniappx-sop.md`（SOP-13 §2 速查表 / §3 防线 ② / §4 bug 模式 / §5 清单 / §7 触发行 → **1.3.0**）
  - `docs/sop/domain-design-sop.md`（§5 → **1.7.0**）、`docs/sop/README.md` §8.1/§8.2、`HANDBOOK.md`（登记与正文同步）

## 5. 门禁记录（2026-10-14 本轮）

| 命令                                      | 结果                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prettier --write`（改动文件）+ `--check` | ✅ 全过                                                                                                                   |
| `node scripts/check-design-tokens.mjs`    | ✅ 检查 A 46 token 全覆盖 / B 46 项零偏差 / C / D / E 全 `.uvue` 145 处 hex（均为常量 fallback）/ F 101 图标·75 引用 全过 |
| `node scripts/check-uvue-css.mjs`         | ✅ 28 个 .uvue 零违规                                                                                                     |
| `node scripts/check-sop-registry.mjs`     | ✅ 17 skill / 13 SOP 零发现                                                                                               |
| `eslint . --max-warnings 0`               | ✅（顺带修复脚本 1 处未使用变量）                                                                                         |
| `vitest run`                              | ✅ 6 files / 89 tests                                                                                                     |
| `vue-tsc --noEmit`                        | ✅                                                                                                                        |

口径说明：#6 的 format:check 按**改动面定向口径**执行（与 lint-staged 同口径）。全仓 `prettier --check .` 现报 216 文件 warn，均为历史存量（含 `.prettierrc.json` 自身），非本轮引入；全仓重排涉及 216 文件与 .uts/.uvue 非标准扩展 parser 风险，超出本卡范围，建议另立 ISSUE 决策（见 §6）。

## 6. 遗留与移交

| 事项                                                | 性质       | 处置                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accept.md §10 UX/QA 走查签字                        | 人工环节   | 不阻塞交付；待 UX/QA 完成走查后在 accept 签字                                                                                                                                                                                                                                                                                                                     |
| F6 `multi-platform-ui-handbook/` 未纳入体系         | 已裁决保留 | ds-1 §2「仅登记 F6」，非欠账                                                                                                                                                                                                                                                                                                                                      |
| 全仓 216 文件 prettier 历史存量                     | 新识别     | 建议另立 ISSUE（涉及 .uts/.uvue parser 策略，勿直接全量 --write）                                                                                                                                                                                                                                                                                                 |
| 亮色族（`#5CE8D8`/`#8FA0FF`/`#F5C97B`/`#8C9BFF`…）  | 已收敛     | 已 token 化（smart-light / reliable-light / warn-light / motivation-light）+ 去重映射，检查 E 覆盖全 `.uvue`                                                                                                                                                                                                                                                      |
| 页面层（`pages/`）hex 字面量                        | 已完成     | 16 页 244 处使用处字面量改 `themeValue` 常量；仅剩常量定义内 fallback，使用处零裸字面量                                                                                                                                                                                                                                                                           |
| 字体文件 `fonts-reference/` 真机走查（lucide 渲染） | 随 UX 走查 | 归入 accept §10 人工环节                                                                                                                                                                                                                                                                                                                                          |
| `resume.uvue` 模板静态属性误写成表达式              | 已修复     | 解析结果处 `label="'项目经历 ' + parsed.projects + ' 段'"` 缺 `:`，会原样把表达式文本当标签渲染；补 `:` 后正常（全仓扫同类拼接写法仅此一处）                                                                                                                                                                                                                      |
| 静态属性误写表达式缺护栏                            | 已加固     | 新增 ESLint 本地规则 `uvue/no-expression-in-static-attr`（`eslint.config.mjs`）：用 `parseForESLint` 按表达式语法（AST）判定，覆盖无引号写法（`a + b`、`x.y`、`x ? a : b`）；`rgba(...)`/连字符值/纯字面量不误报。全仓 0 误报，探针 10 例（4 正 6 反）逐例符合预期。文档按 SOP-13 §3 闭环纪律补齐：README §5 正本 + SOP-13（1.3.0）+ SOP-10 §5（1.7.0）+ HANDBOOK |

## 7. 交付物索引

- 任务卡（七项全勾）：`docs/tasks/2026-10-14-design-system-rework.md`
- 验收报告（G3 已签）：`docs/tasks/2026-10-14-design-system-rework.accept.md`
- 设计权威正本：`design-system/mentorloop/MASTER.md`
- 组件规格目录：`design-system/mentorloop/components/`
- token 机检：`scripts/check-design-tokens.mjs`（CI `Design token guard`）
- 领域 SOP：`docs/sop/domain-design-sop.md`（v1.5.0）
