# ml-segmented 分段切换

> 规格以 `components/ml-segmented.uvue` 实现为准反写（2026-10-17，ui-design-system-unification）。改动实现须同步本文件。

页内视图分段切换（Tab）唯一入口。规格自 report「本场报告/成长趋势」反写：muted 容器 + 选中实底 smart。

## 版式

- 容器：`flex-row rounded-control p-1 border border-line bg-bg-muted`
- 段项：`flex-1 h-9 rounded-chip flex-row items-center justify-center`，选中 `bg-smart`，文字 `text-xs font-medium`（选中白 / 未选 ink-soft）
- 按压：`hover-class="pressed-chip"`

## Props

| 名称   | 类型   | 默认 | 说明                                  |
| ------ | ------ | ---- | ------------------------------------- |
| label1 | String | `''` | 第 1 段文案                           |
| label2 | String | `''` | 第 2 段文案                           |
| active | Number | `0`  | 当前选中段索引（0 / 1）               |
| id1    | String | `''` | 第 1 段视图 id 透传（E2E 选择器契约） |
| id2    | String | `''` | 第 2 段视图 id 透传（E2E 选择器契约） |

## Events

| 事件   | 参数  | 说明            |
| ------ | ----- | --------------- |
| change | index | 段索引（0 / 1） |

## 关键实现约束

- MP 端 props 走序列化，不收数组/函数（ml-stat-bar 先例）：双段标量 props + change 索引回传。
- id 透传是硬契约：report 页 E2E 依赖 `#seg-report` / `#seg-growth` 选择器，重构不得丢失。
- **渲染纪律（2026-10-17 真机走查实证）**：段项数据源必须是 `string[]`——对象包装（如 `{label}`）会被 MP 序列化成 JSON 文本直接上屏。
- 段项 id 在 virtualHost 组件内部，automator `page.$` 不可穿透（E2E 需页面级锚点或深链等价驱动）。
