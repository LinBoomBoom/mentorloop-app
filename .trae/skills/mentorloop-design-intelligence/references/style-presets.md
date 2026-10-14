# 风格方向库（style presets）

12 个风格方向，供选型时挑主方向（1 个）+ 辅方向（≤1 个）。**每个方向只由 `main.css @theme` 现有 token 组合而成**——本库不新增任何色值、字体或组件；新 token 须走 token 变更流程（三载体一次改齐，见 `docs/sop/domain-design-sop.md` §2）。

## 可用 token 速查（摘自 `main.css @theme`，禁止表外值）

| 类别      | Token                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 深色面    | `navy` / `navy-deep`；头部品牌带 `ml-brand-band`（靛紫辉光渐变 @utility）                                                                      |
| 品牌语义  | `smart`（主操作）/ `reliable`（正向）/ `warn`（提示）/ `danger`（危险）                                                                        |
| 浅色面    | `bg-light` / `bg-muted` / `surface` / `line`                                                                                                   |
| 文字      | `ink` / `ink-soft` / `mist`（仅深色面大字号/非关键说明）                                                                                       |
| chip 浅底 | `chip-smart` / `chip-reliable` / `chip-warn` / `chip-danger`                                                                                   |
| 六维色板  | `dim-{knowledge,engineering,analysis,communication,learning,motivation}` + 对应 `-tint` 浅底                                                   |
| 字体      | `--font-sans` 中文优先系统栈（唯一字体，不加载 webfont）                                                                                       |
| 阴影      | `shadow-sm` / `shadow-card` / `shadow-float`（navy 色调三级）                                                                                  |
| 圆角      | `radius-chip`(999px) / `radius-control`(12px) / `radius-card`(16px) → `rounded-chip/control/card`                                              |
| 动效      | `--ease-standard`；`duration-press`(120ms) / `duration-ambient`(400ms)；按压档 `pressed-row`(0.7) / `pressed-chip`(0.8) / `pressed-card`(0.85) |
| 尺寸      | `size-touch`(88rpx) / `size-record-cta`(128rpx)（CSS 变量）                                                                                    |

## 12 个风格方向

### 1. 深色沉浸（Dark Immersion）

- 情绪：专注、临场、沉浸。适用：首页、面试房间。
- 表面：`navy → navy-deep` 深色渐变（或 `ml-brand-band` 头部带）。
- 主操作：`smart`；正向状态：`reliable`；CTA 尺寸：`size-record-cta`（录音主按钮）。
- 文字：关键信息用 `surface` 白，说明用 `mist`（仅大字号/非关键）；正文对比度 ≥4.5:1。
- 圆角/阴影/动效：`radius-control` / `shadow-float` / `duration-ambient` 呼吸淡入。
- 禁配：禁止在深色面上使用 `bg-light` 系浅底 chip（用 `chip-*` 需先确认可读性，默认不用）。

### 2. 专业克制（Professional Restraint）

- 情绪：可信、正式、克制。适用：报告页、正式输出、合规说明。
- 表面：`bg-light` 底 + `surface` 卡 + `line` 分隔。
- 主操作：`smart`（低频使用，页面至多 1 个主 CTA）；强调可用 `chip-smart`。
- 文字：`ink` 标题 / `ink-soft` 正文 / `mist` 不用于浅色面正文。
- 圆角/阴影/动效：`radius-card` / `shadow-sm` / `duration-press`。

### 3. 温和学习（Warm Learning）

- 情绪：友好、鼓励、低压力。适用：训练、练习、反馈。
- 表面：`bg-light` 底 + `chip-*` 语义浅底 + `dim-*-tint` 维度 tint。
- 主操作：`smart`；正向反馈：`reliable` + `chip-reliable`。
- 文字：`ink` / `ink-soft`。
- 圆角/阴影/动效：`radius-card` / `pressed-chip` / `duration-ambient` 淡入。
- 锚点组件：`ml-tag`、`ml-progress`。

### 4. 极简效率（Minimal Efficiency）

- 情绪：快速、无干扰、工具感。适用：列表管理、设置、高频小操作。
- 表面：`bg-light` + `surface`，弱化装饰（不用渐变带与浮层阴影）。
- 主操作：`smart` 小尺寸按钮；行级操作用按压反馈代替图标堆叠。
- 文字：`ink-soft` 辅助信息为主，`ink` 只标关键项。
- 圆角/阴影/动效：`radius-control` / `shadow-sm` / `pressed-row` / `duration-press`。

### 5. 报告结论优先（Conclusion-first Report）

- 情绪：一眼得到结论。适用：成长报告、测评结果。
- 表面：`surface` 大卡承载结论；首屏大数字（`ink` 大字 + `smart` 强调）。
- 数据表达：六维色板 `dim-*` 区分维度，`dim-*-tint` 做条形/环形底，`ml-stat-bar` / `ml-progress`。
- 标签：结论标签用 `chip-*`。
- 圆角/阴影/动效：`radius-card` / `shadow-card` / 结论出现用 `duration-ambient`。

### 6. 数据面板（Data Panel）

- 情绪：整齐、可比较。适用：统计页、记录汇总。
- 表面：`surface` 卡片 + `bg-muted` 分区底。
- 数据表达：`dim-*` 色板 + `ml-progress`；趋势正向 `reliable` / 异常 `warn`。
- 文字：数字 `ink` 加粗，维度名 `ink-soft`。
- 圆角/阴影/动效：`radius-card` / `shadow-sm` / `duration-press`。

### 7. 引导陪伴（Guided Companion）

- 情绪：被指引、不迷茫。适用：新手引导、空态、首用流程。
- 表面：`bg-light` 大留白。
- 主操作：`smart` 单个主 CTA；说明文字 `ink-soft`。
- 锚点组件：`ml-empty` + `ml-icon`。
- 圆角/阴影/动效：`radius-control` / `duration-ambient` 逐步淡入。

### 8. 警示醒目（Alert-first）

- 情绪：明确、不恐慌、可行动。适用：错误页、权限拒绝、风控提示。
- 表面：`surface` 白卡承载警示内容；页底仍是 `bg-light`。
- 语义：`danger` 错误 + `chip-danger` 底；`warn` 提示 + `chip-warn` 底；文字状态必须配形状/标签/图标（无障碍）。
- 动效：克制，仅 `duration-press`；不做注意力抢夺动画。
- 必须给出下一步（重试 / 去设置 / 联系支持）。

### 9. 品牌辉光（Brand Glow）

- 情绪：品牌记忆、仪式开场。适用：登录/开屏、营销位、成就时刻。
- 表面：`ml-brand-band` 头部带或 `navy` 深色面。
- 主操作：`smart`；点缀辉光用 `shadow-float` 的 navy 色调阴影放大层次。
- 文字：深色面上 `surface` 主文字 + `mist` 大字号辅助。
- 圆角/动效：`radius-card` / `duration-ambient` 渐入。

### 10. 内容优先（Content-first）

- 情绪：安静阅读。适用：知识库、题干、解析长文。
- 表面：`bg-light` + `surface` 长文卡；`line` 细分隔。
- 文字：正文 `ink`、注释 `ink-soft`；行高优先于装饰。
- 锚点组件：`ml-section-header`、`ml-tag`（知识点标签）。
- 圆角/阴影/动效：`radius-card` / `shadow-sm` / 无滚动动画。

### 11. 面试仪式感（Interview Ceremony）

- 情绪：庄重但安全（AI 非真人）。适用：面试准备页、结束页、面试房间周边。
- 表面：`navy` 深色面。
- 状态可视化：`ml-voice-visual`（语音状态），状态色 `smart` / `reliable`。
- 文字：`mist` 大字号提示；关键确认用 `surface`。
- CTA：`size-record-cta` / `size-touch`；动效 `duration-ambient` 呼吸。
- 红线：无实时评分展示、AI 不冒充真人（`mentorloop-system-spec`）。

### 12. 轻量表单（Light Form）

- 情绪：轻松填写、进度可见。适用：简历、资料、设置表单。
- 表面：`surface` 分组卡 + `bg-muted` 间隔。
- 选项：`ml-tag` chip 单/多选，选中 `chip-smart` + `smart` 文字，按压 `pressed-chip`。
- 主操作：底部固定 `smart` CTA，避让安全区。
- 圆角/动效：`radius-control` / `duration-press`。

## 使用规则

1. 每次选型：主方向 1 个 + 辅方向 ≤1 个；混合时以主方向的表面体系为准，辅方向只借局部组件/动效。
2. 方向之间冲突时（如「深色沉浸」×「轻量表单」），在选型单「遗留与不确定项」记录，交 `mentorloop-role-uiux-designer` 裁决。
3. 所有方向均不得出现表外色值/字体；发现第三方风格参考时，先过 `brand-lock-filter.md`。
