# 选型流程（selection procedure）

输入「产品域 / 场景 / 情绪」→ 输出「设计选型单」（`assets/style-selection-template.md`，落盘任务目录）。全程只出候选，不落规格与代码。

## 步骤

### 1. 输入采集

- 产品域：页面/功能属于哪个业务（训练 / 面试 / 报告 / 资料 / 设置…）。
- 场景：用户在该屏做什么（浏览 / 填写 / 决策 / 等待结果…）。
- 情绪关键词：≥2 个（如「专注」「低压力」「可信」）；与用户当前状态核对（面试前紧张 ≠ 学习时放松）。

### 2. 风格方向

从 `style-presets.md`（12 方向）选：主方向 1 个 + 辅方向 ≤1 个；每个方向写一句「为何适配本场景」。方向冲突 → 记入选型单「遗留与不确定项」，交 `mentorloop-role-uiux-designer` 裁决。

### 3. 配色策略

按主方向填 token 映射表，五类角色各归其位：

- 表面：深色面（`navy` / `navy-deep` / `ml-brand-band`）或浅色面（`bg-light` / `bg-muted` / `surface` / `line`）。
- 主操作：`smart`（一屏至多 1 个主 CTA）。
- 语义强调：正向 `reliable` / 提示 `warn` / 危险 `danger`（配 `chip-*` 浅底，浅色面使用）。
- 文字层级：`ink` / `ink-soft`（浅色面）；`surface` / `mist`（深色面，`mist` 仅大字号/非关键）。
- 数据/维度：六维场景才用 `dim-*` + `-tint`，不要当通用装饰色。

深浅混用只允许一种过渡：`ml-brand-band` 头部带 → 浅色正文，或深色面整屏；禁止浅色面上叠深色卡片（对比度不可控）。

### 4. 字体

固定 `--font-sans` 中文优先系统栈，**不引入任何新字体**。选型只定层级：标题/正文/辅助的字号与字重组合，以及深色面上的 `mist` 使用限制。

### 5. 密度 / 圆角 / 动效

- 圆角档：`rounded-chip`（标签）/ `rounded-control`（按钮输入）/ `rounded-card`（卡片），每屏主档一种，局部允许 chip 例外。
- 阴影档：`shadow-sm`（行/轻卡）/ `shadow-card`（内容卡）/ `shadow-float`（弹层/浮层），层级不跳档。
- 动效强度：按压 `duration-press`(120ms) + `pressed-row/chip/card` 三档；氛围淡入 `duration-ambient`(400ms)。面试仪式/引导页可用 ambient，警示页只用 press。
- 触控：主 CTA 考虑 `size-touch`(88rpx) / `size-record-cta`(128rpx)。

### 6. 布局模式

从 `layout-patterns.md` 为每屏选布局模式 + `ml-*` 组件锚点；标注每屏空态/错误态候选。IA（信息架构、页面层级、导航结构）**不属于选型范围**——已有 IA 直接沿用，IA 决策归 `mentorloop-role-uiux-designer`。

### 7. 品牌锁过滤

全项过 `brand-lock-filter.md`，把结果（每项「通过 / 处置方式」）写入选型单 §6 过滤记录。任何一项不通过：映射到现有 token 或剔除该候选，**不得带病输出**。

### 8. 产出

- 复制 `assets/style-selection-template.md` 到任务目录，按以上步骤填写。
- 确认状态默认「待确认」；选型单经 `mentorloop-role-uiux-designer` 确认后才可作为 `mentorloop-mobile-design-adapter` 的输入。
- 通知后续任务的承接方式：落地任务加载 adapter（**不加载本 skill**），在 mobile-spec 头部「选型单引用」回填本单路径。

## 禁止

- 产出 uvue 规格 / 布局代码 / 交互流程定义。
- 定义新 token；确需新 token → 停止，走 token 变更流程（三载体一次改齐，`docs/sop/domain-design-sop.md` §2）。
- 越过 UX 确认直接宣称「设计已定」。
