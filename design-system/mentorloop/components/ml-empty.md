# ml-empty 空状态

> 规格以 `components/ml-empty.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

列表/页面空态占位：圆形图标 + 标题 + 说明（可选）+ 操作区（可选）。

## Props

| 名称      | 类型   | 默认       | 说明                     |
| --------- | ------ | ---------- | ------------------------ |
| icon      | String | `sparkles` | ml-icon 图标名           |
| iconColor | String | `#5B6CFF`  | 图标颜色（smart）        |
| iconBg    | String | `#EEF1FF`  | 图标圆底色（chip-smart） |
| title     | String | `''`       | 标题（必给）             |
| desc      | String | `''`       | 说明；空串不渲染         |

## Slots

| 默认 slot | 操作区（如按钮），外包 `mt-5 w-full px-2`；无 slot 时不渲染容器 |

## 版式

- 容器 `py-8` 纵向居中；图标圆 `w-16 h-16 rounded-full`，内嵌 ml-icon size 28。
- 标题 `text-base font-semibold text-ink mt-4`；说明 `text-xs text-ink-soft mt-1.5 px-8 leading-5`。

## 状态

| 状态   | 表现                           |
| ------ | ------------------------------ |
| 默认   | 图标 + 标题 + 说明 + 操作      |
| 无说明 | `desc` 空串 → 说明行不渲染     |
| 无操作 | 未传默认 slot → 操作容器不渲染 |

## 关键实现约束

- slot 判空用 `slots.default != null`（UTS 下不可用 `$slots.default` 隐式判断）。
- 图标色/底色为字面色值参数，与 token 值保持一致（smart / chip-smart），改 token 须同步默认值。
