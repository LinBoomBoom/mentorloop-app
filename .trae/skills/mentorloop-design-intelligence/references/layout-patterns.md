# 布局模式库（layout patterns）

移动端布局模式 → 现有 `components/ml-*` 组件的映射。**强制绑定现有组件**：需要新组件时在选型单「遗留与不确定项」提出，由 `mentorloop-role-uiux-designer` 决策，本库不定义组件实现。

现有组件锚点（10 个）：`ml-button` · `ml-card` · `ml-empty` · `ml-icon` · `ml-login-sheet` · `ml-progress` · `ml-section-header` · `ml-stat-bar` · `ml-tag` · `ml-voice-visual`；另有全局 `@utility`：`ml-brand-band`、`pressed-row/chip/card`。

| #   | 模式                     | 结构（自上而下）                                                          | 组件锚点                                              | 适配风格方向                 |
| --- | ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| 1   | Hero / 品牌开场          | `ml-brand-band` 头部带 → 标题/副标题 → 主 CTA                             | `ml-brand-band`、`ml-icon`、`ml-button`               | 品牌辉光、深色沉浸           |
| 2   | 卡片列表                 | 页标题 → 分组标题 → 卡片流（每卡一个实体）→ 底部主 CTA                    | `ml-section-header`、`ml-card`、`ml-button`           | 专业克制、内容优先、极简效率 |
| 3   | 表单填写                 | 分组卡（每组 3-6 字段）→ 选项 chip 行 → 底部固定 CTA（避让安全区）        | `ml-card`、`ml-tag`、`ml-button`                      | 轻量表单                     |
| 4   | 空态 / 引导              | 居中大图标 → 一句说明 → 单个主 CTA                                        | `ml-empty`、`ml-icon`、`ml-button`                    | 引导陪伴                     |
| 5   | 报告结论优先             | 首屏结论大字/大数字 → 维度条形/进度 → 明细卡折叠                          | `ml-stat-bar`、`ml-progress`、`ml-card`、`ml-tag`     | 报告结论优先、数据面板       |
| 6   | Paywall / 权益对比       | 权益标题 → 对比卡（当前 vs 解锁）→ 权益点 chip 列表 → 底部 CTA + 弱化跳过 | `ml-card`、`ml-tag`、`ml-button`                      | 品牌辉光、专业克制           |
| 7   | Bottom sheet（底部弹层） | 标题 → 内容/操作行 → 确认/取消；参考 `ml-login-sheet` 既有交互模式        | `ml-login-sheet`（模式参照）、`ml-button`             | 通用（配合任一浅色/深色面）  |
| 8   | 进度 / 统计条            | 分组标题 → 进度条或分值条 → 辅助说明                                      | `ml-progress`、`ml-stat-bar`、`ml-section-header`     | 温和学习、数据面板           |
| 9   | 语音 / 录音状态          | 状态可视化主体 → 状态文字 → 主录音 CTA（`size-record-cta`）               | `ml-voice-visual`、`ml-icon`、`ml-button`             | 面试仪式感、深色沉浸         |
| 10  | 标签筛选行               | 横向滚动 chip 行（单/多选）→ 结果列表                                     | `ml-tag`（按压 `pressed-chip`）                       | 温和学习、极简效率           |
| 11  | tabBar 主导航            | 底部 3-5 个一级入口；下钻 ≤3 级；Web 模态 → bottom sheet                  | `pages.json` tabBar（图标来自 `static/tabbar/*.png`） | 通用                         |

## 使用规则

1. 每屏一个主任务；首屏 = 最高频任务；模块顺序跟随用户任务顺序（mobile sanity check，落地细节归 adapter）。
2. 组件锚点只做**布局映射**：尺寸、间距、状态的落地规格由 `mentorloop-mobile-design-adapter` 输出。
3. 五态纪律（空 / 加载 / 错误 / 降级 / 无权限）在选型阶段至少标注每屏的空态与错误态候选；完整矩阵由 adapter 落地。
4. 触控目标 ≥44×44（iOS）/ 48dp（Android）：小于该值的热区方案（外层容器扩大）在选型单备注，落地由 adapter 执行。
