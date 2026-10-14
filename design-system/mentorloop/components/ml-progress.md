# ml-progress 进度条

> 规格以 `components/ml-progress.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

标签 + 百分比 + 细轨道。用于能力值、完成度等单值展示。

## Props

| 名称      | 类型    | 默认      | 说明                                 |
| --------- | ------- | --------- | ------------------------------------ |
| label     | String  | `''`      | 左侧标签；空串且不显值时头部行不渲染 |
| percent   | Number  | `0`       | 0–100，越界自动 clamp                |
| color     | String  | `#5B6CFF` | 条与百分比数字颜色（smart）          |
| showValue | Boolean | `true`    | 是否在右侧显示 `N%`                  |

## 版式

- 头部行 `flex-row justify-between mb-1.5`（`label` 为空且 `showValue=false` 时整行不渲染）。
- 轨道 `h-1.5 rounded-full bg-line overflow-hidden`；内条同高 `rounded-full`，宽度 = clamp 后百分比。

## 状态

| 状态   | 表现                                    |
| ------ | --------------------------------------- |
| 默认   | 标签 + 百分比 + 彩条                    |
| 越界值 | `percent < 0 → 0`，`> 100 → 100`        |
| 极简   | `label=''` + `showValue=false` → 仅轨道 |

## 关键实现约束

- 宽度用内联 style 计算字符串（`v + '%'`），不用 Tailwind 任意值类（MP 端不支持）。
