# ml-stat-bar 统计条

> 规格以 `components/ml-stat-bar.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

三列统计条（growth/training/mine 三页复制粘贴样式的组件化收敛）：`bg-surface rounded-2xl border border-line shadow-card px-2 py-3.5 flex-row`。

## Props

三组 value/label/color + tappable：

| 名称       | 类型    | 默认    | 说明                            |
| ---------- | ------- | ------- | ------------------------------- |
| value1/2/3 | String  | `''`    | 统计值（`text-lg font-bold`）   |
| label1/2/3 | String  | `''`    | 标签（`text-xs text-ink-soft`） |
| color1/2/3 | String  | `''`    | 值颜色；空串回退 ink（#1A2433） |
| tappable   | Boolean | `false` | 可点击时才给按压反馈            |

## Events

| 事件     | 参数        | 说明                                      |
| -------- | ----------- | ----------------------------------------- |
| stat-tap | `i: number` | 点击列索引（0/1/2）；仅 tappable 时有意义 |

## 状态

| 状态   | 表现                                              |
| ------ | ------------------------------------------------- |
| 默认   | 三列均分（`flex-1`），列间 `border-l border-line` |
| 可点击 | `hover-class="pressed-card"`（tappable 才生效）   |
| 色缺省 | color 空串 → 回退 ink                             |

## 关键实现约束（MP 端硬约束）

- **props 走序列化，不收函数/对象数组**——故用 3 组平铺 props 而非 `items: StatEntry[]`；点击通过 `stat-tap` 事件回传索引。
- 对象字面量组装 `StatEntry` 时须 `as StatEntry` 断言（UTS 纪律）。
