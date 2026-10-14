# ml-section-header 区块标题

> 规格以 `components/ml-section-header.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

页面区块标题：左侧竖条 + 标题（可选说明），右侧可选操作入口。

## Props

| 名称       | 类型   | 默认      | 说明                                           |
| ---------- | ------ | --------- | ---------------------------------------------- |
| title      | String | `''`      | 标题（必给）                                   |
| caption    | String | `''`      | 说明行；空串不渲染                             |
| actionText | String | `''`      | 右侧操作文案；空串则操作入口不渲染             |
| icon       | String | `default` | 保留占位：竖条恒显示（版式统一性），不按值分支 |

## Events

| 事件   | 参数 | 说明             |
| ------ | ---- | ---------------- |
| action | —    | 点击右侧操作入口 |

## 版式

- 容器 `flex-row items-end justify-between mb-3`。
- 竖条 `w-1 h-4 rounded-full bg-smart mr-2`；标题 `text-base font-semibold text-ink`；说明 `text-xs text-ink-soft mt-0.5`。
- 操作入口 `h-11 px-2 -mr-2`（扩大点击区），`hover-class="pressed-row"`，文案 `text-xs text-smart` + chevron-right 图标 13px。

## 状态

| 状态   | 表现                           |
| ------ | ------------------------------ |
| 默认   | 竖条 + 标题                    |
| 带说明 | caption 非空 → 第二行说明      |
| 带操作 | actionText 非空 → 右侧可点入口 |

## 关键实现约束

- 操作入口高度 `h-11`（44px 满足触控目标），负右边距对齐卡片边缘。
