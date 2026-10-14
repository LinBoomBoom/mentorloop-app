# ml-button 按钮

> 规格以 `components/ml-button.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

主操作按钮。全站 CTA 唯一入口，颜色/圆角/尺寸对齐 MASTER §A1 token。

## Props

| 名称     | 类型    | 默认      | 说明                                                           |
| -------- | ------- | --------- | -------------------------------------------------------------- |
| text     | String  | `''`      | 按钮文案                                                       |
| type     | String  | `primary` | 变体：`primary` / `secondary` / `ghost` / `danger`             |
| size     | String  | `md`      | 尺寸：`sm` / `md` / `lg`                                       |
| block    | Boolean | `false`   | 是否撑满整行                                                   |
| disabled | Boolean | `false`   | 禁用态：加 `opacity-50`，点击直接 return（不冒泡、无按压反馈） |

## Events

| 事件 | 参数 | 说明                 |
| ---- | ---- | -------------------- |
| tap  | —    | 点击（禁用时不触发） |

## 变体样式

| type      | 背景             | 边框                  | 文字色               |
| --------- | ---------------- | --------------------- | -------------------- |
| primary   | `bg-smart`       | —                     | `text-white`         |
| secondary | `bg-surface`     | `border border-line`  | `text-ink`           |
| ghost     | `bg-transparent` | `border border-smart` | `text-smart`         |
| danger    | `bg-danger`      | —                     | `text-white`（继承） |

通用：`rounded-xl`（= radius-control 12px）。

## 尺寸

| size | 高度/内边距 | 字号        |
| ---- | ----------- | ----------- |
| sm   | `h-10 px-4` | `text-sm`   |
| md   | `h-12 px-5` | `text-base` |
| lg   | `h-14 px-6` | `text-base` |

## 状态

| 状态 | 表现                                                 |
| ---- | ---------------------------------------------------- |
| 默认 | 变体样式原样                                         |
| 按压 | `hover-class="pressed-card"`（`hover-start-time=0`） |
| 禁用 | `opacity-50`，无按压反馈，点击 return                |

## 关键实现约束

- `hover-start-time` 必须为 0，按压反馈即时生效。
- 禁用判定在 onClick 内直接 return，未用 pointer-events 类方案（MP 端兼容）。
