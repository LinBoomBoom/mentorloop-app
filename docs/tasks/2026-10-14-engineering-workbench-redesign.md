# 任务卡：工程化训练台重设计 · 核心三屏（ui-1）

- 日期：2026-10-14
- 关联：里程碑 M1；SOP-10 设计系统领域；SOP-02 标准链；承接 ds-1（设计系统重构）与 `docs/design-governance-plan.md` §1.1（「零设计灵感库，只能在『别做错』上守住，不能在『选风格』上给候选」）
- 状态：**已实现**（token + 组件 + 三屏全部落地，G2 门禁全绿）；UX 真机走查（§7 UX 主责）与 G3 验收为人工环节，待执行

## 0. 问题与结论（PO + UX 联合诊断）

用户对当前 UI 不满意。诊断结论：**问题不是「不好看」，而是视觉人格与业务主张错位**。产品主张是「证据化、可解释、可复测的能力闭环」，用户是 0–3 年技术求职者；而现有视觉语汇来自通用 AI 助手模板（深蓝渐变 + 模糊光晕 + 呼吸气泡 + 柔和胶囊 + 鸡汤文案），读起来是「面向所有人的 AI 陪伴 App」，不是「技术人的面试训练台」。业务语言（证据链、能力域、置信度、风险红旗）没有翻译成视觉语言。

可复核的现状问题：

| 编号 | 发现                                                                                                                                  | 证据                                                                                                         | 等级 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- |
| U1   | 首屏被装饰挤占：250px hero + 三块 blur 光晕，最高频任务只在底部一个按钮                                                               | `pages/index/index.uvue` L4–12 / L41–55                                                                      | P0   |
| U2   | 深色面低对比：卡片底靠 `rgba(255,255,255,0.06~0.1)`，12px 正文大量用 `mist`，违反 MASTER §A1 自定规则「mist 仅用于大字号/非关键说明」 | `pages/index/index.uvue` L25 / L48 / L71                                                                     | P0   |
| U3   | AI 隐喻与「面试」不符：房间正中是呼吸光环 + bot 图标 + 声波条，像语音助手                                                             | `components/ml-voice-visual.uvue` L84–90 · `pages/interview/room.uvue` L51–60                                | P0   |
| U4   | 评分表达弱且违反隐私红线：模型里 `confidence`（0–1）UI 完全没用，只显示 A/B/C/D 字母                                                  | `types/scoring.uts` L16 · `engine/rubric.uts` L93–103（`confidenceBand` / `displayLevel` 已有但零消费）      | P0   |
| U5   | 证据不是「证据链」：证据只是一段 12px 灰字，没有「你的原话 ↔ 锚点期望」对照                                                           | `pages/report/report.uvue` L137–149                                                                          | P1   |
| U6   | 文案调性偏心理按摩，与文档 03 §2「沉稳、专业、克制」冲突                                                                              | `pages/index/index.uvue` L360–366                                                                            | P1   |
| U7   | 同一 A=4…D=1 与 level→色/底 映射在四处重复实现                                                                                        | `index.uvue` L254–276 · `growth.uvue` L292–383 · `training.uvue` L250–260 · `report.uvue` L285–312、L441–451 | P2   |

### 0.1 决策记录（2026-10-14，PO 拍板，AskUserQuestion 四项）

| 编号 | 决策                                                                                | 落点    |
| ---- | ----------------------------------------------------------------------------------- | ------- |
| D-i1 | 视觉方向定 **工程化训练台**（深色码感 + 等宽数字 + 去光晕 + 结构化证据）            | §2 / §6 |
| D-i2 | 本轮范围 **核心三屏先行**：首页 + 面试房间 + 报告                                   | §2 做   |
| D-i3 | 评分改为 **等级 + 置信度区间**（消费已有 `confidence` 字段，复用 `confidenceBand`） | §2 / §6 |
| D-i4 | **允许新增等宽字体 token + 收紧圆角档**（三载体一次改齐）                           | §2 / §6 |

## 1. 目标

在**零契约变更**前提下，把首页 / 面试房间 / 报告三屏从「通用 AI 助手人格」重构为「工程化训练台」：首屏承载决定性的开始任务、面试房间以题目为主视觉、报告以证据对照与等级+置信度为主角；同时补齐等宽数字与收紧圆角的设计 token，使「技术用户可信感」有单一事实来源可依。

## 2. 范围

- **做**：
  - **Token（三载体一次改齐，D-i4）**：`main.css @theme` 新增 `--font-mono`（系统等宽栈，**不打包字体文件**）；收紧 `--radius-chip: 6px` / `--radius-control: 8px` / `--radius-card: 12px`；`styles/theme.uts` 同步 `fontMono` 与新圆角值；`design-system/mentorloop/MASTER.md` §A1 同步登记。
  - **组件**：`ml-card` / `ml-tag` / `ml-button` 改消费语义圆角 token（`rounded-card` / `rounded-chip` / `rounded-control`），使收紧圆角可传导。
  - **首页（U1/U2/U6）**：移除三块 blur 光晕与轮播鸡汤气泡；`ml-voice-visual` 由 250px hero 降为卡内紧凑状态指示（ring 88，保留 D3「语音状态可视化」语义）；新增「本次模拟面试」参数卡（岗位/经验/能力域），首屏即可读；数据条与等级改等宽数字。
  - **面试房间（U3）**：移除 blur 光晕与 208px 光环舞台；题目卡升为主体（题号 + 状态点 + 题面 + 操作行）；`ml-voice-visual` 降为 ring 96 的辅助状态；AI 面试官标识保留（合规：不得伪装真人），文案改「AI 面试官 · 系统生成」；计时改等宽。
  - **报告（U4/U5）**：总体判断卡去装饰圆；能力维度显示**等级 + 置信度区间**（`confidenceBand`，低置信度附「证据不足，仅供参考」）；证据区改**对照结构**（你的回答摘录 ↔ 待补证据 / 参考答法）；训练计划改等宽时长。
  - **实现纪律**：三屏的圆角统一走语义 token；数字/编号/时长走 `font-mono`；文案去鸡汤，改参数化事实；深色面 mist 仅用于辅助行，正文用 white/`ink` 系。
  - **第二批（浅色页统一，2026-10-14 追加）**：把其余页面与组件统一到同一套视觉语汇 —— ① 裸 `rounded-2xl|xl|lg` 全量替换为语义 token（卡片 `rounded-card` / 控件与图标底 `rounded-control` / chip 与胶囊按钮 `rounded-chip`）；② 删除全部装饰性光斑与 `blur-*` 层（含 `training/room` 的 `.blur-circle`）；③ 纯数字/日期显示补 `font-mono`。覆盖页面：`training`、`training/room`、`resume`、`growth`、`mine`(+`prefs`/`security`/`privacy`/`about`)、`membership/paywall`、`login`、`interview/prep`、`interview/summary`；组件：`ml-stat-bar`、`ml-login-sheet`。
  - **第三批（U7 去重，2026-10-14 追加）**：把「等级 → 序数 / 平均等级 / 百分比刻度 / 语义色 / tint / 深色面加亮色」与「六维 → 图标」的重复实现收敛到单一来源 `styles/score-display.uts`（客户端呈现层，不改评分规则本身；取色一律经 `themeValue`）。消费方 4 页改 import：`index`、`growth`、`training`、`report`。
  - **第四批（U6 文案调性，2026-10-14 追加）**：全站扫描「情绪安抚 / 鼓励评价 / 结果承诺」类文案并修正违规项；把文案标准写成正本条款 `MASTER.md` §A5（必须 / 禁止 / 边界判定三类），使后续评审可依可查，而非一次性清理。
- **不做**（范围裁剪，PO 责任）：
  - 不改 `types/`、`api/`、`server/`（`confidence` 已在契约内，**不触发契约冻结**）。
  - 不新增页面、不改 `pages.json` IA 与 tabBar 层级（IA 收敛项登记为后续任务）。
  - 不改品牌语义色取值（`smart`/`reliable`/`warn`/`danger` 与双表面配色维持既定）。
  - 不打包 JetBrains Mono 字体文件（MP 包体积风险，见 §5）；不新增图标（`ICON_GLYPH` 冻结，check F 守卫）。
  - 不动 `engine/`、`server/src/rules/` 镜像逻辑。
  - 不改其余页面的**业务逻辑与文案内容**（第二批仅做视觉语汇统一：圆角 token、去装饰光斑、等宽数字）。

## 3. 依赖

- 前置：本卡经 PO 评审（四项决策已拍板，见 §0.1）。
- 外部环境：HBuilderX 真机 / 微信开发者工具走查；`node` 运行机检脚本。
- 契约：**无**（`types/`、`api/` 零改动；`confidence` 客户端 `types/scoring.uts` L16 与服务端 `server/src/types/scoring.ts` L11 早已对齐）。

## 4. 验收标准

- [x] `node scripts/check-design-tokens.mjs` 退出码 0（含新增 `--font-mono`）且 `--radius-*` 三载体值一致。
- [x] `node scripts/check-uvue-css.mjs`、`node scripts/check-sop-registry.mjs` 退出码 0。
- [x] `pnpm lint`（`--max-warnings 0`）、`pnpm typecheck`、`pnpm test` 全绿（89 tests）。
- [x] 首页首屏无 blur 光晕层、无轮播文案气泡；`ml-voice-visual` 直径 ≤88；存在「本次模拟面试」参数卡。
- [x] 面试房间无 208px 光环舞台；当前题目位于页面中部的题目卡内，字号 ≥ `text-lg`（18px）。
- [x] 报告每个能力维度同时显示 **等级 + 置信度档位**；低置信度（<0.5）显示「证据不足，仅供参考」。
- [x] 报告证据区呈现「你的回答摘录 ↔ 待补证据 / 参考答法」对照结构。
- [x] 三屏数字/编号/时长使用 `font-mono`；三屏正文 ≥4.5:1 对比度（深色面用 white 系而非 mist）。
- [x] 三屏圆角取自语义 token（`rounded-card` / `rounded-control` / `rounded-chip`），无裸 `rounded-2xl`/`rounded-full`（机检 grep 复核）。
- [x] **第二批**：全仓 `.uvue` 无裸 `rounded-2xl|xl|lg|md|sm`、无 `blur-*`、无装饰性 `opacity-10|15|20`（grep 零命中）；`rounded-full` 仅出现在圆点/头像/光环/进度条等真圆形。
- [x] **第二批**：三机检 + lint + typecheck + 89 tests + 改动面 prettier 全绿。
- [x] **第三批（U7）**：`{ A: 4, B: 3, C: 2, D: 1 }` 与等级阈值（3.5/2.5/1.5）、level→色/底/百分比映射在全工程仅存于 `styles/score-display.uts` 一处（grep 复核：4 页本地实现全部删除）。
- [x] **第三批**：`styles/score-display.uts` 取色全部经 `themeValue`（无 token 外 hex）；三机检 + lint + typecheck + 89 tests + 改动面 prettier 全绿。
- [x] **第四批（U6）**：全站 `.uvue` 扫描无「鼓励/评价/安抚」类词与情绪感叹号（grep 复核）；文案标准落 `MASTER.md` §A5 正本。
- [x] **第四批**：修正 3 处 —— growth 副标题、training/room 完成提示、paywall 承诺式口号；`pnpm build:mp-weixin` 之外的三机检 + lint + typecheck + 89 tests + 改动面 prettier 全绿。

## 5. 风险与对策

| 风险                                                                | 等级 | 对策                                                                                                         |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| 收紧圆角 + 组件改消费语义 token 影响非目标页（训练/成长/简历/我的） | 中   | 仅改半径、不改布局；改动收敛在 `ml-card`/`ml-tag` 两个组件 + 三屏；走查其余页确认无布局位移                  |
| `--font-mono` 在原生端字体解析失败                                  | 中   | 用系统等宽栈（`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`），失败静默回退系统字体，不影响可读 |
| 深色面正文对比度回退                                                | 中   | 正文一律 `text-white`，`mist` 仅用于辅助行（≤1 行/模块）                                                     |
| 移除首页 hero 与 D3「语音状态可视化」冲突                           | 中   | 不删除 `ml-voice-visual`，仅缩小并移入参数卡，D3 语义保留                                                    |
| 误改 `types/`/`api/` 触发契约冻结                                   | 低   | 只读消费 `DimensionScore.confidence`，零类型改动                                                             |

## 6. 产物路径

- 新增：`docs/tasks/2026-10-14-engineering-workbench-redesign.md`（本卡）、`styles/score-display.uts`（第三批 U7：等级/维度呈现映射单一来源）
- 修改：
  - `main.css`（`@theme` 增 `--font-mono`、收紧 `--radius-*`）
  - `styles/theme.uts`（`fontMono` + 圆角值同步）
  - `design-system/mentorloop/MASTER.md`（§A1 登记 `--font-mono` 与新圆角档；§A4 设计要点更新；§A5 新增「文案调性」正本）
  - `components/ml-card.uvue`、`components/ml-tag.uvue`、`components/ml-button.uvue`（消费语义圆角）
  - `pages/index/index.uvue`、`pages/interview/room.uvue`、`pages/report/report.uvue`
  - 第二批/第三批/第四批改动面（视觉语汇统一 + U7 去重 + U6 文案，详见进度记录）
- 不改：`types/`、`api/`、`server/`、`engine/`、`scripts/`（机检脚本口径无需变动）

## 7. 角色

- 主责：UX（视觉/IA 决策与走查）
- 配合：PO（范围/优先级/决策记录）、FE（token 与页面落地）、QA（G2/G3）
- 复用：AI（无改动，仅消费其既有 `confidence` 产物）

## 8. 负责人

PO 裁决范围与四项决策（已拍板）；UX 主导三屏视觉规格；执行 Agent：TraeCode 落码、机检与门禁。

---

## 进度记录

### 2026-10-14 定义

- PO + UX 联合诊断（U1–U7），四项决策拍板（D-i1–D-i4），范围裁剪为核心三屏 + token 收敛。
- 链型判定：**标准链**（任务卡 G1 → 实现 → G2 → G3）；无契约冻结（`types/`/`api/` 零改动）。
- 待办：token 三载体改齐 → 组件 → 三屏落地 → G2。

### 2026-10-14 实现完成（G2 全绿）

- **Token（三载体一次改齐）**：`main.css @theme` 新增 `--font-mono`（系统等宽栈，零包体）；`--radius-chip/control/card` 由 999/12/16 收紧为 6/8/12；`styles/theme.uts` 同步 `fontMono` 与新圆角值；`MASTER.md` §A1 登记 + §A4 首页/房间/报告设计要点改写。
- **组件**：`ml-card` → `rounded-card`、`ml-tag` → `rounded-chip`、`ml-button` → `rounded-control`，使收紧圆角可传导。
- **首页**：删三块 blur 光晕与 5 条轮播鸡汤；`ml-voice-visual` 由 250px hero 降为卡内 ring 88；新增「本次模拟面试」参数卡（岗位/经验/能力域）+ 等宽数据条；最近报告卡新增置信度行。
- **面试房间**：删 blur 光晕与 208px 光环舞台（中间区域还原为题目卡主体：等宽题号 + 状态点 + 题面 text-lg + 换说法追加行 + 操作行）；`ml-voice-visual` 降为 ring 96 辅助位；AI 标识改「AI 面试官 · 系统生成」；计时改等宽；新增 `askedCount` 题号。
- **报告**：总体判断卡去装饰圆，新增「综合置信度」；维度卡显示「高/中/低置信 + 等级」并在低置信度提示「证据不足，仅供参考」；证据区改 diff 对照（你的回答摘录 ↔ 待补证据 / 参考答法，左侧语义色强调边）；训练计划时长/优先级改等宽。
- **复用而非新增**：置信度直接消费模型既有 `DimensionScore.confidence`，阈值单一来源 `engine/rubric.uts` 的 `confidenceBand`（无契约变更、无新增逻辑）。
- **门禁**：三机检 exit 0（design-tokens：A 47 token 双向 / B 47 项零偏差 / C 34 色 + 8 非颜色 / D 28 .uvue / E 146 处 hex / F 101 图标·73 引用；uvue-css 28 文件零违规；sop-registry 17 skill / 13 SOP）；`pnpm lint` ✅；`pnpm typecheck` ✅；`pnpm test` 6 files / 89 tests ✅；改动文件 prettier ✅。
- **遗留（登记）**：IA 收敛（报告 vs 成长层级、tabBar 顺位）未做。视觉语汇统一由第二批闭环、U7 由第三批闭环、U6 由第四批闭环。

### 2026-10-14 第二批完成（浅色页统一，G2 全绿）

- **圆角统一**：全仓 `.uvue` 裸 `rounded-2xl|xl|lg` 清零，改为语义 token —— 卡片 `rounded-card`（12px）/ 图标底与控件 `rounded-control`（8px）/ chip 与胶囊按钮 `rounded-chip`（6px）。`rounded-full` 仅保留在真圆形（圆点、头像、光环、进度条、勾选圆）。
- **去装饰**：删除全部装饰性光斑（`absolute ... rounded-full bg-* opacity-15|20`，共 9 处，分布于 training / growth / resume / mine / about / security / paywall 的品牌头与深色卡）与 `training/room` 的 `blur-circle` 光晕层（含其 `<style>` 块）。
- **等宽数字**：`ml-stat-bar` 统计值、`growth` 趋势图分数与场次日期、`paywall` 价格与原价补 `font-mono`。
- **覆盖清单**：页面 `training`、`training/room`、`resume`、`growth`、`mine`、`mine/prefs`、`mine/security`、`mine/privacy`、`mine/about`、`membership/paywall`、`login`、`interview/prep`、`interview/summary`；组件 `ml-stat-bar`、`ml-login-sheet`。
- **门禁**：`check-design-tokens` / `check-uvue-css` / `check-sop-registry` exit 0；`pnpm lint`（`--max-warnings 0`）✅；`pnpm typecheck` ✅；`pnpm test` 6 files / 89 tests ✅；改动面 prettier ✅（`pages/mine/webview.uvue`、`components/ml-empty|ml-icon|ml-progress|ml-section-header|ml-voice-visual` 的 prettier warn 为历史存量，本轮未触碰，未纳入改动面）。
- **顺带发现（不在本卡范围，未修）**：`pages/resume/resume.uvue` 解析态图标绑定 `:name="parsing ? 'loader-circle' : 'cloud-upload'"`，其中 `loader-circle` **不在 `ICON_GLYPH`**，会静默渲染空字形；因 check F 只校验静态 `name`，机检不拦。修复需改 `scripts/build-icons.py` 子集并重新生成图标字体产物，登记为独立任务。

### 2026-10-14 第三批完成（U7 去重，G2 全绿）

- **新增单一来源** `styles/score-display.uts`：`LEVEL_ORDER` / `levelOrder` / `levelFromAverage` / `averageLevel` / `levelPercent` / `levelColor` / `levelTint` / `levelColorOnDark` / `DIM_ICON` / `dimIcon`。只承载呈现映射，**不含评分规则**（规则正本仍在 `engine/rubric.uts`；置信度档位 `confidenceBand` 仍从引擎取）；取色全部经 `themeValue`，零 token 外 hex。
- **被消除的重复**（4 页 → 1 处）：
  - `{ A: 4, B: 3, C: 2, D: 1 }` 序数映射 6 处（index×2 / growth×3 / report×1）；
  - 平均等级阈值 3.5/2.5/1.5 4 处（index×2 / growth / report）；
  - level → 浅色面语义色 3 处（training / growth / report）；→ tint 3 处；→ 深色面加亮色 2 处（index / report）；
  - 等级百分比刻度 2 套不一致实现（report `92/75/58/40` 字符串版 + growth `90/75/60/45` 数值版）→ 统一为 `92/75/58/40`；
  - 六维图标 map 2 处（training `DIM_ICONS` / growth `dimIcon`，内容完全一致）→ `DIM_ICON`。
- **行为等价说明**：色值映射逐项等价（视觉零变化）；唯一数值差异为 growth 进度条与趋势柱高改走统一刻度，A/C/D 由 90/60/45 变为 92/58/40（±2 个百分点的条长差，可接受且为去重的必要代价）。
- **门禁**：`check-design-tokens` / `check-uvue-css` / `check-sop-registry` exit 0；`pnpm lint`（`--max-warnings 0`）✅；`pnpm typecheck` ✅；`pnpm test` 6 files / 89 tests ✅；改动面 prettier ✅。
- **编译验证**：`pnpm build:mp-weixin` 通过（退出码 0，产物 `dist/build/mp-weixin`）。首次构建暴露 `levelOrder` 未导出（vue-tsc 与 ESLint 均未覆盖 UTS 跨文件导出解析，只有 uni-app x 编译器能拦），已补齐并复建通过 —— 说明**新增 `.uts` 模块必须过构建验证**，已作为经验写入本卡。
- **遗留**：U6（文案）由第四批闭环；IA 收敛仍未做。

### 2026-10-14 第四批完成（U6 文案调性，门禁全绿）

- **扫描口径**：全站 `.uvue` 按「情绪安抚 / 鼓励评价 / 结果承诺 / 情绪感叹号」四类关键词扫描（深呼吸、加油、自信、别紧张、看得见、做得好、练到上岗、`！` 等），并逐条复核全部 `showToast` / `showModal` 文案（共 ~89 条）。
- **修正 3 处**：
  - `growth` 品牌带副标题「六维能力画像 · 看得见的进步」→「六维能力画像 · 逐场对比」（评价 → 事实）。
  - `training/room` 完成提示「训练完成，做得好！」→「训练完成，已记录本次表现」（鼓励 + 感叹号 → 事实）。
  - `paywall` 头部副标题「学面一体，练到上岗」→「按次购买或连续包月」（结果承诺 → 套餐结构事实，与 `data/membership.uts` 的 SKU 一致）。
- **正本条款**：`MASTER.md` 新增 **§A5 文案调性**（必须 4 条 / 禁止 4 条 / 边界判定 3 条），使文案要求可评审、可追责，不再依赖单次清理。边界判定明确保留：时间化问候、商业化促销文案（定价与促销既定表述）、合规必需提示。
- **复核结论**：其余页面文案（空态、错误态、权限与隐私说明、训练反馈）经查均已是事实型与行动导向（如「缺少量化指标，补上数字（QPS、耗时、占比）」「低置信度：证据不足，仅供参考」），无需改动。
- **门禁**：`check-design-tokens` / `check-uvue-css` / `check-sop-registry` exit 0；`pnpm lint`（`--max-warnings 0`）✅；`pnpm typecheck` ✅；`pnpm test` 6 files / 89 tests ✅；改动面 prettier ✅。（纯文案改动不触发 `.uts` 模块解析，未重跑 `build:mp-weixin`。）
