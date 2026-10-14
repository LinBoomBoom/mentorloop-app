# 设计治理方案（Design Governance Plan）v0.2

- 状态：**已实施**（2026-10-14 两项裁决并入并同日完成 P0–P2 全部五批落地，门禁全绿；验收结论见 `docs/tasks/2026-10-14-design-system-rework.accept.md`）
- 关联：SOP-10 设计系统领域 · SOP-01 角色体系 · 任务卡 ds-1
- 证据来源：三项只读审计（技能层 / SOP 与设计文档层 / 角色层），结论均带「文件 + 行号 + 原文摘录」
- 变更：v0.1 → v0.2 并入两项裁决（决策记录见 §0.1）

---

## 0. 结论摘要

| #   | 议题             | 结论                                                                                                                                                                                                                     |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 设计智能库能力   | 项目现有 skill **全部是「约束/治理型」，零设计灵感库**；**已裁决（D-B）走方案 A：新增独立 skill `mentorloop-design-intelligence`**（L1 灵感 + L2 选型），L3 落地仍归 `mentorloop-mobile-design-adapter`；重叠消解见 §1.3 |
| 2   | 原型设计内容重构 | 冲突根因三条：MASTER 上半通用模板自相矛盾、D3 去数字人后的系统性残留、同一约束多处重复且漂移；重构为「单一正本 + 单一转换通道 + 单一灵感库」                                                                             |
| 3   | 边界与优先级链   | 拟定正本见 §3（已含 intelligence / adapter 双 skill 链与路由落点）；冲突裁决顺序：**硬约束 → token 值 → 视觉/IA → 概念落地 → 灵感参考**，项目 skill 恒优先于第三方                                                       |
| 4   | 冗余/冲突清单    | 13 项冲突、9 项 D3 过时残留、17 处死引用、6 组冗余重叠、4 类 token 集合差异；保留清单 12 项                                                                                                                              |
| 5   | SOP 角色完整性   | 骨架完整（10 角色 + RACI + 门禁），但有 5 类缺口：**安全角色缺位、LC 无承载 skill、运营/财务无角色、移动端转换未挂角色、需求受理/用户研究未描述**                                                                        |
| 6   | 遗留裁决         | **2026-10-14 已拍板**：(a) avatar/lipsync 随 D3 下线（§6 P0 执行）；(b) 设计智能库走独立 skill（§6 P1 实施）。原「待 PO 裁决」事项清零                                                                                   |

### 0.1 决策记录（2026-10-14，PO 拍板）

| 编号 | 决策                                                                 | 落点                                                                           |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D-A  | `mentorloop-avatar-design`、`mentorloop-lipsync-spec` **随 D3 下线** | §4.7 执行清单 → §6 P0；同步 README §8.2、roles-sop §8、sop-entry、HANDBOOK     |
| D-B  | 设计智能库**新增独立 skill**（原方案 A）                             | §1.3 重叠消解方案 → §6 P1；与 adapter 以「设计选型单」产物衔接，二者不同时加载 |

---

## 1. 设计智能库能力方案

### 1.1 现状差距

现有设计与平台类 skill 均为「约束/流程/角色」型，不含任何风格、配色、字体、图表、落地页模式库：

- `mentorloop-system-spec`——硬约束；`mentorloop-role-uiux-designer`——IA/视觉原则；`mentorloop-mobile-design-adapter`——转换流程；`uni-app-x`——平台知识。
- 对照 `ui-ux-pro-max`（nextlevelbuilder，v2.2.1）的「可检索设计数据库 + 推荐引擎」形态，本项目**缺「设计选型」这一层**：能在「别做错」上守住，但不能在「选风格/定调性」上给出候选。

### 1.2 目标形态（三层，灵感层不得越过约束层）

| 层            | 职责                                                      | 承载                                                                                            |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| L1 灵感参考层 | 风格方向、布局模式、情绪/场景建议（**只出候选，不落码**） | 新增 skill `mentorloop-design-intelligence` 的 `references/`（style-presets / layout-patterns） |
| L2 选型层     | 输入「产品类型 / 场景 / 情绪」→ 输出「设计选型单」        | 同上（selection-procedure + brand-lock-filter）                                                 |
| L3 落地层     | 选型结果 → uvue 规格（token 只从三载体取）                | 现有 `mentorloop-mobile-design-adapter` 主体 + `mentorloop-system-spec`（职责不变）             |

### 1.3 承载方式（已裁决 D-B：方案 A——新增独立 skill）

原三方案中 **A 胜出**（B 需 adapter 兼职灵感库致职责膨胀；C 引入 `ui-ux-pro-max` 会重演 F1：其默认色板 `#ea580c`/`#2563eb`、字体 Lora/Raleway 正是 MASTER 冲突源）。与 `mentorloop-mobile-design-adapter` 的职责重叠按下述方案消解。

#### 1.3.1 职责切分（选型在前，落地在后）

| 维度   | `mentorloop-design-intelligence`（新增）                  | `mentorloop-mobile-design-adapter`（现有）    |
| ------ | --------------------------------------------------------- | --------------------------------------------- |
| 阶段   | 设计前期：**定方向**                                      | 设计后期：**落规格**                          |
| 输入   | 产品域 / 场景 / 情绪关键词                                | 概念稿 +（可选）设计选型单                    |
| 输出   | 设计选型单（风格方向 + token 映射 + 排版方案 + 布局模式） | uvue 移动端设计规格                           |
| 禁止   | 产 uvue 规格 / 代码；定义新 token；定 IA / 交互           | 发明新风格 / 新色 / 新字族；跳过 token 三载体 |
| 权威性 | 选型是**咨询**：须经 `role-uiux-designer` 确认才生效      | 落地是**执行**：受硬约束与 token 正本约束     |

#### 1.3.2 衔接契约（防多 skill 切换导致设计漂移）

1. intelligence 的**唯一产物**是选型单（`assets/style-selection-template.md`），落盘到任务目录。
2. adapter 的 `assets/mobile-spec-template.md` 增加「**选型单引用**」字段：落地时回填所用选型单路径；未引用选型单的落地不算错，但须在「遗留不确定项」标注「无灵感层参与」。
3. 选型单经 `mentorloop-role-uiux-designer` 确认后才作为 adapter 输入——视觉决策权始终在 UX，intelligence 只供候选。
4. **二者不同时加载**：选型任务载 intelligence，落地任务载 adapter，靠选型单落盘衔接（产物交接，非上下文续传），装配仍 ≤3。

#### 1.3.3 共享红线（两 skill 同守）

**0 个新色值、0 个新字体**；一切候选表达为 `main.css @theme` 现有 token 的组合；确需新 token → 走 token 变更流程（三载体一次改齐），不得由灵感库直接引入。

### 1.4 库内容规格

落位：`.trae/skills/mentorloop-design-intelligence/`（`references/` 四件 + `assets/style-selection-template.md`）。

| 文件                                 | 内容                                                                                                           | 品牌锁定                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `style-presets.md`                   | 10–14 个风格方向（例：专业克制 / 深色沉浸 / 温和学习 / 极简效率 / 报告结论优先…）                              | 每个方向**只引用项目 token**，不新增色值  |
| `layout-patterns.md`                 | 移动端布局模式（hero、列表、表单、空态、报告结论优先、paywall、bottom sheet…）映射到 `components/ml-*`         | 强制绑定现有组件                          |
| `selection-procedure.md`             | 输入 → 风格方向 → 配色策略（映射 token）→ 字体（系统栈）→ 密度/圆角/动效强度 → 产出「设计选型单」              | 输出必须过过滤器                          |
| `brand-lock-filter.md`               | 红线：任何第三方色/字体/风格建议先映射到 `main.css @theme`；**禁新增品牌外色与字体、禁 hover/断点等 Web 范式** | —                                         |
| `assets/style-selection-template.md` | 设计选型单模板（风格方向、token 映射、排版方案、布局模式、过滤记录）                                           | intelligence 的唯一产物；adapter 回填引用 |

### 1.5 冲突防护

库中 **0 个新色值、0 个新字体**；所有建议先过 `brand-lock-filter` 再进 L3。这是防止「灵感层污染约束层」（F1 成因）的关键闸门。

### 1.6 登记与路由落点（P1 执行清单）

1. `.trae/skills/mentorloop-design-intelligence/SKILL.md`（满足机检：name = 目录名、description ≤400B、正文 ≤15360B）。
2. `docs/sop/README.md`：§8.2 注册行；§4 设计系统承载追加。
3. `.trae/rules/sop-entry.md`：新增路由行「风格 / 配色 / 字体选型、设计灵感 → `mentorloop-design-intelligence`」；客户端 UI 行条件加载追加。
4. `docs/sop/roles-sop.md` §8：UX 行挂载（与 `mobile-design-adapter` 一并，见 §5.2-5）。
5. `docs/sop/domain-design-sop.md` §8：承载 skill 追加。
6. `mentorloop-mobile-design-adapter` 的 `assets/mobile-spec-template.md`：增加「选型单引用」字段（§1.3.2 契约 2）。

---

## 2. 原型设计内容重构方案

### 2.1 冲突根因（三条，均有证据）

1. **MASTER 上半通用模板与 §A1 互斥**：`MASTER.md:22` Primary `#2563EB` / `:26` Accent `#EA580C` / `:43-44` Lora+Raleway vs `:251-258` smart `#5B6CFF` / amber `#E08A00` / 中文字体栈；`:247` 虽声明「§A 优先」，但同文件两套规范仍在。
2. **D3 去数字人后的系统性残留**：`avatar-design`/`lipsync-spec` 两个 skill、`interview-room-ux` 的 avatar 主角表述、`domain-native-sop.md:29` 的「数字人渲染桥」、`HANDBOOK.md:312`「四个插件」等，与 `MASTER.md:279` D3 记录及 `utssdk/` 实况（无 avatar 插件）冲突。
3. **同一约束多处重复且漂移**：uvue 硬约束 / 触控 44·48 / 对比度 / token 三方一致 在 5–7 处重复；其中 README §5（自称正本）反而**缺**触控尺寸、按压 opacity、对比度三条。

### 2.2 重构目标结构

```
正本层（唯一事实来源）
  README §5（编码/平台硬约束） · main.css @theme（token 生成源）
  MASTER.md §A1–A4（设计决策） · README §8（登记索引）
        │
转换层（唯一落地通道）
  mentorloop-mobile-design-adapter → mentorloop-system-spec
        │
灵感层（只出候选）
  mentorloop-design-intelligence（§1，D-B）
        │
登记层（SOP + skill + 版本）
  docs/sop/README.md §8 · domain-design-sop §8
```

### 2.3 重构动作

1. MASTER.md 上半（`:16–241`）标注「非权威 · skill 溯源快照」或下沉 `references/`（**先 grep 引用再下沉，勿直接删**）。
2. 清理 D3 残留（§4.2 / §4.3）。
3. token 三载体名集合对齐（§4.5）。
4. 落地「边界与优先级链」（§3）为正本。

---

## 3. 设计 skill 边界与优先级链（拟定正本）

> 评审通过后并入 `docs/sop/domain-design-sop.md` 新增章节，并同步 `sop-entry.md`。

### 3.1 边界表

| Skill                                         | 只管                                      | 不管                                    | 权威范围                     | 产物               |
| --------------------------------------------- | ----------------------------------------- | --------------------------------------- | ---------------------------- | ------------------ |
| `mentorloop-system-spec`                      | 客户端 uvue/UTS/Tailwind/隐私硬约束       | 视觉风格、IA                            | **硬约束正本**               | 约束条款           |
| `mentorloop-role-uiux-designer`               | IA、交互、视觉系统、无障碍、走查          | 平台实现细节                            | 视觉/经验**决策**            | 设计规格、走查结论 |
| `mentorloop-mobile-design-adapter`            | Web/多端概念稿 → uvue 规格（消费选型单）  | 定义 token、定义品牌、发明新风格        | 概念**落地通道**             | 移动端转换规格     |
| `uni-app-x`                                   | 平台结构/组件/API/ucss/调试/性能          | 项目设计约束                            | 平台**知识**                 | 平台知识库         |
| `mentorloop-design-intelligence`（新增，D-B） | 风格/配色策略/排版方案/布局模式候选与选型 | 落地规格、代码、IA/交互决策、token 定义 | 选型（**咨询**，须 UX 确认） | 设计选型单         |
| `mentorloop-role-miniprogram-pm`              | 微信平台/包体积/审核/登录                 | 视觉、后端                              | 小程序**约束**               | 需求/审核材料      |

### 3.2 冲突裁决顺序（恒成立）

1. **硬约束冲突** → 一律以 `mentorloop-system-spec` / `README.md` §5 为准。
2. **token 值** → `main.css @theme` 为准，`MASTER.md §A1` 记录，`styles/theme.uts` 同步；三处名集合必须一致。
3. **视觉 / IA 决策** → `mentorloop-role-uiux-designer`。
4. **Web 概念落地** → `mentorloop-mobile-design-adapter`。
5. **灵感 / 风格候选** → `mentorloop-design-intelligence` 只出选型单，**不得直接当规范**；须过 `brand-lock-filter` 并经 `mentorloop-role-uiux-designer` 确认后才可进入 3/4 的输入，**永远不得覆盖 1/2**。
6. **第三方 skill（ui-ux-pro-max / shadcn / MUI / Ant 等）** → 只作视觉与结构参考，**项目 skill 恒优先**；其色板/字体不得进入实现。
7. **数字人体系（avatar / lipsync）** → **已裁决（D-A）**：两个 skill 下线，议题归档；面试房间的语音状态可视化归 `mentorloop-interview-room-ux`。

### 3.3 装配规则（≤3 上限下）

- 纯落地：`system-spec` + `mobile-design-adapter`（+ 平台知识时 `uni-app-x`）。
- 新页面设计：`system-spec` + `role-uiux-designer`（+ 概念稿则 `mobile-design-adapter`）。
- 风格选型：`role-uiux-designer` + `mentorloop-design-intelligence`。
- `intelligence` 与 `adapter` **不同时加载**：选型任务载前者，落地任务载后者，以「选型单」落盘衔接（§1.3.2），装配仍 ≤3。
- `interview-room-ux` 独立承载面试房间 UX（avatar/lipsync 已裁决下线，D-A）。

---

## 4. 冗余 / 错误 / 冲突 / 死引用清单

### 4.1 冲突清单（数值/规则互斥）

| 编号 | 冲突点            | 侧 A（错/旧）                                          | 侧 B（对/权威）                                         |
| ---- | ----------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| C1   | 项目主色          | `MASTER.md:22` `#2563EB`                               | `:256` smart `#5B6CFF`；`main.css:22`                   |
| C2   | Accent/CTA        | `MASTER.md:26` `#EA580C`                               | `:258` amber `#E08A00`；`main.css:24` `--color-warn`    |
| C3   | 主按钮样式        | `MASTER.md:85-93` 橙底 + cursor                        | `ml-button.uvue:3/43` `rounded-xl`/`bg-smart`           |
| C4   | hover 位移        | `MASTER.md:97/127` `translateY`                        | `:221` 禁 Layout-shifting hover；`:298` 禁位移          |
| C5   | 圆角              | `MASTER.md:89/118/159` 8/12/16 硬编码                  | 实现 `rounded-xl`/`rounded-2xl`，@theme 无 radius token |
| C6   | 动效时长          | `MASTER.md:177/223` 200-250/150-300ms                  | `:298` 80-150ms；`ml-card.uvue:7` 80ms                  |
| C7   | 按压档数          | `MASTER.md:298`+`domain-design-sop.md:59` 两档         | `:277`+`main.css:86-94` 三档                            |
| C8   | 响应式断点        | `MASTER.md:239` 375/768/1024/1440                      | uvue 单移动尺寸，`:120` rpx                             |
| C9   | cursor/hover 范式 | `MASTER.md:92/220/234` cursor                          | `:298` 禁 hover-only；`:hover-class`                    |
| C10  | utssdk 插件数     | `domain-native-sop.md:23/29` 四个（含 avatar）         | `README.md:52/144` 三个；目录实况                       |
| C11  | 字体              | `MASTER.md:43-44` Lora/Raleway                         | `:283-285` 放弃；`main.css:61` 系统栈                   |
| C12  | 通用元数据        | `MASTER.md:11` `Translator App`                        | 与项目无关（AI 面试）                                   |
| C13  | HANDBOOK 漂移     | `HANDBOOK.md:19/347` 17 个 skill；`:298` SOP-10 v1.0.0 | `README.md §8.2` 18 个；SOP-10 v1.2.0                   |

### 4.2 D3 过时残留清单

| 文件                                            | 行                      | 过时内容                                                       |
| ----------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `docs/sop/domain-native-sop.md`                 | 19/23/29/53/54/74       | 数字人渲染桥、四插件、口型、单活跃数字人实例                   |
| `docs/sop/HANDBOOK.md`                          | 312/316/366/367/390/403 | 四插件、数字人实例、avatar/lipsync 路由                        |
| `README.md`                                     | §8.2 153-154、§4 67     | 仍把 avatar/lipsync 登记为在用（与本文 §6 D3 自述矛盾）        |
| `docs/sop/roles-sop.md`                         | 108                     | UX 承载 skill 含 avatar/lipsync                                |
| `docs/sop/domain-design-sop.md`                 | 28                      | theme.uts 用途注「数字人状态」                                 |
| `styles/theme.uts`                              | 1/40                    | 注释「数字人状态」「文档 02/04」（`AvatarState` 类型本身保留） |
| `docs/MentorLoop_03_UI_UX设计方案.md`           | 37/42/62                | 面试房间中部「数字人角色」                                     |
| `docs/MentorLoop_04_uniappx技术架构与可行性.md` | 5/19/61/63/80           | `interviewer-avatar`、数字人渲染/分包/口型同步                 |
| `design-system/mentorloop/MASTER.md`            | 10-12                   | Generated/Category/Dials 模板元数据                            |

### 4.3 死引用清单（指向已删除文件）

| 位置                                                      | 行          | 引用对象                                                                                     |
| --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `mentorloop-avatar-design/SKILL.md`                       | 22/23/24/47 | `utssdk/interviewer-avatar/`、`data/avatar-assets.uts`、`components/interviewer-avatar.uvue` |
| `mentorloop-avatar-design/assets/avatar-spec-template.md` | 52/53       | 同上                                                                                         |
| `mentorloop-lipsync-spec/SKILL.md`                        | 29/34       | `syncLip` in `utssdk/interviewer-avatar`、avatar 组件                                        |
| `mentorloop-lipsync-spec/assets/lipsync-spec-template.md` | 32          | `utssdk/interviewer-avatar/index.uts`                                                        |
| `mentorloop-interview-room-ux/SKILL.md`                   | 19/58       | avatar 主角、单活跃 avatar 实例                                                              |
| `mentorloop-role-uiux-designer/SKILL.md`                  | 65/66       | 挂载 avatar-design / lipsync-spec                                                            |
| `mentorloop-role-miniprogram-pm/SKILL.md`                 | 22          | 「digital-human assets are subpackaged」                                                     |
| `.trae/rules/sop-entry.md`                                | 16/34/46    | 数字人/口型条件加载与禁止组合                                                                |

### 4.4 冗余 / 重叠清单

| 组  | 重叠内容                                                                                         | 建议                             |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| R1  | `mentorloop-pipeline` ↔ `sop-entry.md` 链型/节流                                                 | 择一为正本                       |
| R2  | `system-spec` ↔ `uni-app-x` UTS/uvue/Tailwind 硬约束                                             | uni-app-x 精简，指向 system-spec |
| R3  | `system-spec` ↔ `role-uiux-designer` / `mobile-design-adapter`（token 三源、隐私红线、平台约束） | 只留需求链路，删复述             |
| R4  | `quality-gate` ↔ `server-conventions` 检查项                                                     | 收敛为检查命令清单               |
| R5  | 「评测集重跑」在 content-review / ai-engineer / release-check / contract-freeze 四处             | 单一正本 + 引用                  |
| R6  | `release-check` 复述 G1/G2                                                                       | 改为依赖引用                     |

### 4.5 token 三载体集合差异

| 情况                      | token                                                 | 出处                                          |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| main.css 有、theme.uts 无 | `mist`、`chip-*`、`--font-sans`、`--shadow-*`         | `main.css:36/39-42/61/64-66`                  |
| MASTER §A1 有、实现无     | `Ring`；名称 `amber`（实现为 `warn`）                 | `MASTER.md:264/258`                           |
| 实现有、§A1 表无          | `mist`、`bg-muted`、`chip-*`、`dim-*-tint`、`surface` | `main.css:29/30/36/39-42/53-58`               |
| 命名漂移                  | `ink↔textPrimary`、`line↔border`、`warn↔amber`        | `main.css:31/34/24` ↔ `theme.uts:15/16/17/11` |
| 三类皆无                  | spacing / radius / motion / size token                | `main.css @theme:16-67`                       |

### 4.6 建议保留（优秀 skill，边界清晰）

`mentorloop-task-card`、`mentorloop-contract-freeze`、`mentorloop-server-conventions`、`mentorloop-content-review`、`mentorloop-quality-gate`、`mentorloop-release-check`、`mentorloop-role-ai-engineer`、`mentorloop-role-feasibility-analyst`、`mentorloop-role-product-owner`、`mentorloop-system-spec`、`uni-app-x`、`mentorloop-mobile-design-adapter`（12 项；P1 落地 `mentorloop-design-intelligence` 后为 13 项）。

### 4.7 处置建议

- **下线（D-A，2026-10-14 已拍板）**：`mentorloop-avatar-design`、`mentorloop-lipsync-spec`。执行顺序：① 全仓 grep 复核引用（§4.2/§4.3 为底稿，执行时二次确认）→ ② 逐处改写活引用 → ③ 删除两个 skill 目录 → ④ README §8.2 删两行并重跑 registry 机检 → ⑤ `sop-entry.md`「禁止组合」规则改写。注意：`AvatarState` 类型**保留**（`styles/theme.uts`，`components/ml-voice-visual.uvue` 消费）。
- **改写**：§4.2/§4.3 所列活文件引用——`interview-room-ux`（avatar → 语音状态可视化）、`role-uiux-designer:61-67`、`role-miniprogram-pm:22`、`sop-entry.md:16/34/46`、README §8.2/§4、`roles-sop:108`、`domain-native-sop`、`HANDBOOK`、`domain-design-sop:28`、docs 03/04、`MASTER.md:10-12`、`theme.uts` 注释。
- **新增（D-B，P1）**：`mentorloop-design-intelligence`（§1）。
- **下沉/标注**：`MASTER.md:16-241`。
- **合并**：R1–R6。
- **补齐**：§4.5 的 token 集合与命名。

---

## 5. SOP 角色完整性与职能评估

### 5.1 现有 10 角色

| 代号  | 全称           | 覆盖阶段（RACI） | 承载 skill                                                                   | 描述完整                                                   |
| ----- | -------------- | ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| PO    | 产品负责人     | ① 定义 A         | `role-product-owner` 等                                                      | 缺用户研究/PRD/需求受理                                    |
| MP-PM | 小程序产品经理 | ① R              | `role-miniprogram-pm`                                                        | 完整                                                       |
| FA    | 可行性分析师   | ① R              | `role-feasibility-analyst`                                                   | 完整                                                       |
| UX    | UI/UX 设计师   | ②③ R             | `role-uiux-designer` + `interview-room-ux`（avatar/lipsync 已裁决下线，D-A） | **缺 `mobile-design-adapter`、`design-intelligence` 挂载** |
| FE    | 客户端工程师   | ②③④ R            | `system-spec`（非 role skill）                                               | 无角色级 skill                                             |
| BE    | 后端工程师     | ②③④ R            | `server-conventions`（非 role skill）                                        | 无角色级 skill                                             |
| AI    | AI 工程师      | ② R              | `role-ai-engineer`、`content-review`                                         | 完整                                                       |
| CO    | 内容运营       | ①② R             | `content-review`                                                             | 未含客服/增长                                              |
| QA    | QA/DevOps      | ③④ A             | `quality-gate`、`release-check`                                              | 缺「安全」                                                 |
| LC    | 合规/法务      | ④ R              | **无**                                                                       | G4 无签署落点                                              |

### 5.2 角色缺口

1. **安全角色缺位**：`roles-sop.md` 无安全角色；QA（L35）/LC（L36）描述均不含安全，而 `compliance-sop.md:35` 写「QA/安全」、G3 依赖外部 `TRAE-security-review`。
2. **LC 无承载 skill、无 G4 落点**：`roles-sop.md §8` 无 LC 行，`release-sop.md §3` 签字区无 LC 字段。
3. **运营（增长/客服）无角色**：CO 仅内容审核；doc 05 §4 的增长/客服无承接。
4. **财务无角色**：`compliance-sop.md:36` 写「产品 + 财务」，无财务角色。
5. **移动端转换未挂角色**：`mobile-design-adapter` 已在体系内（README §4/§8.2），但 `roles-sop.md:108` 未登记到 UX；D-B 新增的 `mentorloop-design-intelligence` 须一并挂 UX（§1.6）。
6. **需求受理/用户研究/可用性测试未描述**：PO 缺用户研究/PRD；UX 缺可用性测试（doc 05 §1 有）。

### 5.3 重叠 / 边界不清

- AI ↔ CO ↔ PO 在「评分量表/评测」三方牵涉，主责 A 未明示。
- G3 主责 QA、配合 UX，但 `admission-sop.md §5` 签字表**无 UX 签字段**。
- G4 主责 QA + LC，但 `release-sop.md §5` 仅有「QA/安全」签，无 LC 签。
- 安全责任在 QA / LC / 外部 skill 间漂移。
- 报告质量抽检（事实性/公平性）归属 AI 还是 CO 不明。

### 5.4 描述不完整

- LC：§8 表缺行，产物仅「合规台账」且 §8.3 无路径。
- QA：缺「真机测试/安全」职责与对应产物（取证/安全结论）。
- PO：`role-product-owner/SKILL.md` **无 Outputs 章节**（其余 role skill 均有）。
- FE/BE/QA：无角色级 skill，「角色职责」与「领域规范」混同。

### 5.5 结论

骨架完整、细节有缺口。**最需补 3 项**：

1. 明确「安全」归属（并入 QA 并固化产物，或新增独立角色）。
2. 为 LC 补承载 skill + G4 签署行。
3. 补齐运营域，把 `mobile-design-adapter` 与 `design-intelligence` 挂到 UX。

---

## 6. 实施顺序（建议批次）

| 批次 | 内容                                                                                                                                                                                   | 前置                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| P0   | 清理 D3 残留（§4.2）+ avatar/lipsync 下线执行（D-A，§4.7）+ MASTER 收敛 + token 补齐（§4.1/4.5）✅ 已落地（2026-10-14）；另按裁决顺手清理活代码残留（manifest description + 5 处注释） | 已拍板（D-A/D-B），无前置 |
| P1   | 边界与优先级链入 `domain-design-sop` + `sop-entry`（§3，含 intelligence / adapter 双路由） ✅ 已落地（2026-10-14）                                                                     | P0 定稿                   |
| P1   | 新建 `mentorloop-design-intelligence`（D-B，§1：references 四件 + 选型单模板 + adapter 模板加字段 + §1.6 登记六处） ✅ 已落地（2026-10-14）                                            | §3 生效                   |
| P2   | 角色补齐（§5，含 adapter / intelligence 挂 UX） ✅ 已落地（2026-10-14）                                                                                                                | PO 就角色增设拍板         |
| P2   | 冗余合并 R1–R6（§4.4） ✅ 已落地（2026-10-14）                                                                                                                                         | P1 定稿                   |

每批遵循任务卡 + 门禁（G1→G4）；SOP/skill 变更须同步 `README §8` 版本。
