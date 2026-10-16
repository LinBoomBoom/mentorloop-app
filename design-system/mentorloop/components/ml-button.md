# ml-button 按钮

> 规格以 `components/ml-button.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

主操作按钮。全站 CTA 唯一入口，颜色/圆角/尺寸对齐 MASTER §A1 token。

## Props

| 名称     | 类型    | 默认      | 说明                                                                      |
| -------- | ------- | --------- | ------------------------------------------------------------------------- |
| text     | String  | `''`      | 按钮文案                                                                  |
| type     | String  | `primary` | 变体：`primary` / `secondary` / `ghost` / `danger`                        |
| size     | String  | `md`      | 尺寸：`sm` / `md` / `lg`                                                  |
| block    | Boolean | `false`   | 是否撑满整行                                                              |
| disabled | Boolean | `false`   | 禁用态：按变体给显式禁用样式（见「状态」），点击直接 return（无按压反馈） |

## Events

| 事件 | 参数 | 说明                 |
| ---- | ---- | -------------------- |
| tap  | —    | 点击（禁用时不触发） |

## 变体样式

| type      | 背景             | 边框                        | 文字色               |
| --------- | ---------------- | --------------------------- | -------------------- |
| primary   | `bg-smart`       | —                           | `text-white`         |
| secondary | `bg-surface`     | `border border-line-strong` | `text-ink`           |
| ghost     | `bg-transparent` | `border border-smart`       | `text-smart`         |
| danger    | `bg-danger`      | —                           | `text-white`（继承） |

通用：`rounded-control`（= radius-control 8px，ui-1 收紧后取值）。

> 描边用 `line-strong`（`#c9d2e3`）而非 `line`（`#e3e8f0`）：后者在白色卡片/弹层上 1px 几乎不可见（2026-10-16 真机反馈 → 按钮被看成纯文本）。

## 尺寸

| size | 高度/内边距 | 字号        |
| ---- | ----------- | ----------- |
| sm   | `h-10 px-4` | `text-sm`   |
| md   | `h-12 px-5` | `text-base` |
| lg   | `h-14 px-6` | `text-base` |

## 状态

| 状态 | 表现                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 默认 | 变体样式原样                                                                                                                                                                     |
| 按压 | `hover-class="pressed-card"`（`hover-start-time=0`）                                                                                                                             |
| 禁用 | primary / danger：原底色 + `opacity-50`；secondary：`bg-bg-muted border-line-strong` + `text-ink-soft`；ghost：`border-line-strong` + `text-ink-soft`。均无按压反馈，点击 return |

> 禁用态曾只用 `opacity-50`：白色底的 secondary 半透明后与卡片同色 → 看上去像纯文本（2026-10-16 真机反馈）。浅底变体改为显式灰底灰字。

## 关键实现约束

- `hover-start-time` 必须为 0，按压反馈即时生效。
- 禁用判定在 onClick 内直接 return，未用 pointer-events 类方案（MP 端兼容）。
