# ml-chip 选择/操作 chip

> 规格以 `components/ml-chip.uvue` 实现为准反写（2026-10-17，ui-design-system-unification）。改动实现须同步本文件。

全站 chip 唯一入口（机检检查 H 守卫 pages/）。两种 variant：

- **select**：选项选择器。`h-11 px-3.5 rounded-chip`（44px 触摸目标）。消费方：prep / onboarding / prefs 岗位与经验选择、report 会话选择。
- **action**：行内操作 chip。`h-11 px-4 rounded-chip`。消费方：resume 采用/忽略/导出、training「开始」。

## Props

| 名称     | 类型    | 默认      | 说明                                                                      |
| -------- | ------- | --------- | ------------------------------------------------------------------------- |
| label    | String  | `''`      | 文案                                                                      |
| variant  | String  | `select`  | `select` / `action`                                                       |
| selected | Boolean | `false`   | select 选中态                                                             |
| disabled | Boolean | `false`   | select 置灰（opacity-60 灰字）；点击仍回传（消费端做引导）                |
| hint     | String  | `''`      | select 尾部弱说明（如「敬请期待」；选中态不显示）                         |
| mono     | Boolean | `false`   | select 文字用 `text-xs font-mono`（日期/编号等数据）                      |
| icon     | String  | `''`      | action 前导图标（ICON_GLYPH 名称）                                        |
| tone     | String  | `outline` | action 色调：`smart` 实底白字 / `outline` 描边 smart 字 / `soft` 描边灰字 |
| muted    | Boolean | `false`   | action 完成态：`bg-line` 灰字，吞点击不再响应                             |

## Events

| 事件 | 参数 | 说明                                                        |
| ---- | ---- | ----------------------------------------------------------- |
| tap  | —    | 点击（muted 时不触发；disabled 时仍触发，由消费端决定引导） |

## 状态

| 状态        | 表现                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| select 默认 | `bg-bg-muted` + `text-ink`                                               |
| select 选中 | `bg-surface border border-smart` + `text-smart font-medium` + check 图标 |
| select 禁用 | `bg-bg-muted opacity-60` + `text-ink-soft`，无按压反馈                   |
| action 按压 | `hover-class="pressed-card"`                                             |
| action 完成 | muted：`bg-line` + `text-ink-soft`，无按压反馈，点击 return              |

## 关键实现约束

- 布局间距（`mr-2 mb-2` 等）由消费方经 class fallthrough 传入（onboarding `ml-button class="mt-4"` 先例）。
- select 选中态统一为「白底 + smart 描边 + check」——prefs 旧实底 smart 选中已于 2026-10-17 归一。
- disabled 保留点击回传：不可用选项的点击由页面 toast 引导（如「题库建设中」），不得死路。
- training「开始」等行内视觉 chip 不绑定 @tap（点击由外层行承担，避免事件双触发）。
