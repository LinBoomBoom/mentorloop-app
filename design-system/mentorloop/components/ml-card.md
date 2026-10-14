# ml-card 卡片

> 规格以 `components/ml-card.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

内容容器。全站卡片基础样式：`bg-surface rounded-2xl border border-line p-4`（rounded-2xl = radius-card 16px）。

## Props

| 名称      | 类型    | 默认    | 说明                                   |
| --------- | ------- | ------- | -------------------------------------- |
| raised    | Boolean | `true`  | 是否带投影 `shadow-card`               |
| pressable | Boolean | `false` | 是否可点击（开启按压反馈）             |
| padded    | Boolean | `true`  | 内边距；`false` 时改 `p-0`（自排内容） |

## Events

| 事件 | 参数 | 说明                     |
| ---- | ---- | ------------------------ |
| tap  | —    | 点击（pressable 时使用） |

## Slots

| 默认 slot | 卡片内容 |

## 状态

| 状态 | 表现                                             |
| ---- | ------------------------------------------------ |
| 默认 | 基础样式 + raised 投影                           |
| 按压 | `pressable=true` 时 `hover-class="pressed-card"` |

## 关键实现约束

- 内嵌列表/自定义内边距场景用 `:padded="false"` 回收内边距，避免双重 padding。
