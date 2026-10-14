# ml-tag 标签

> 规格以 `components/ml-tag.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

胶囊标签：`h-6 px-2.5 rounded-full`，底色/文字色由 props 字面值传入。

## Props

| 名称  | 类型   | 默认      | 说明                 |
| ----- | ------ | --------- | -------------------- |
| label | String | `''`      | 标签文案             |
| bg    | String | `#EEF1FF` | 背景色（chip-smart） |
| color | String | `#5B6CFF` | 文字色（smart）      |

## 版式

- 容器 `flex-row items-center h-6 px-2.5 rounded-full`，内联 style 设背景。
- 文字 `text-xs`，内联 style 设颜色。

## 状态

| 状态 | 表现               |
| ---- | ------------------ |
| 默认 | 胶囊样式，无交互态 |

## 关键实现约束

- 颜色为字面值 props（非变体枚举）：需要新配色时调用方传 token 对应的 hex，保持与 MASTER §A1 一致；不引入新语义色。
