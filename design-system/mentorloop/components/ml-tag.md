# ml-tag 标签

> 规格以 `components/ml-tag.uvue` 实现为准反写（2026-10-14，ds-1 F5；2026-10-17 增 icon/iconColor）。改动实现须同步本文件。

静态标签：`h-6 px-2.5 rounded-chip`（radius-chip 6px），底色/文字色由 props 字面值传入。

## Props

| 名称      | 类型   | 默认      | 说明                                                |
| --------- | ------ | --------- | --------------------------------------------------- |
| label     | String | `''`      | 标签文案                                            |
| icon      | String | `''`      | 可选前导图标（ICON_GLYPH 名称）                     |
| iconColor | String | `''`      | 图标独立用色；空则与文字同色（深色面彩图标+白字用） |
| bg        | String | `#EEF1FF` | 背景色（chip-smart）                                |
| color     | String | `#5B6CFF` | 文字色（smart）                                     |

## 版式

- 容器 `flex-row items-center h-6 px-2.5 rounded-chip`，内联 style 设背景。
- 文字 `text-xs`，内联 style 设颜色；有图标时文字 `ml-0.5`。

## 状态

| 状态 | 表现               |
| ---- | ------------------ |
| 默认 | 标签样式，无交互态 |

## 关键实现约束

- 颜色为字面值 props（非变体枚举）：需要新配色时调用方传 token 对应的 hex 或 rgba 串，保持与 MASTER §A1 一致；不引入新语义色。
- 深色面状态标签（面试房间 AI 身份/训练任务名）：bg 传 rgba 半透明串 + iconColor 传加亮档 + color 传 surface 白。
