# ml-voice-visual 语音状态可视化

> 规格以 `components/ml-voice-visual.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

AI 语音状态可视化（D3：替代数字人）：状态光环（外/内两圈）+ 中央 AI 徽标 + 声波条。状态语义单一事实来源 = `styles/theme.uts` 的 `AvatarState`（6 态）/ `AVATAR_STATE_LABEL`。

## Props

| 名称      | 类型    | 默认    | 说明                                                                        |
| --------- | ------- | ------- | --------------------------------------------------------------------------- |
| state     | String  | `idle`  | 6 态：`idle` / `asking` / `followup` / `listening` / `summary` / `thinking` |
| speaking  | Boolean | `false` | TTS 播报中（驱动声波加速/脉冲加速）                                         |
| showLabel | Boolean | `true`  | 是否显示状态文案（房间另有徽标时可关）                                      |
| ring      | Number  | `200`   | 光环直径 px；首页 hero 用 176，房间舞台用 208                               |

## 状态语义表

| state     | 主色    | 标签色  | 中央图标     | 光环动效                    | 声波 |
| --------- | ------- | ------- | ------------ | --------------------------- | ---- |
| idle      | #5B6CFF | #8FA0FF | bot          | ring-breathe                | 静止 |
| asking    | #5B6CFF | #8FA0FF | mic-vocal    | ring-pulse（speaking→fast） | 起伏 |
| followup  | #5B6CFF | #8FA0FF | mic-vocal    | ring-pulse（speaking→fast） | 起伏 |
| listening | #1FB6A6 | #5CE8D8 | mic-vocal    | ring-breathe                | 起伏 |
| summary   | #1FB6A6 | #5CE8D8 | check-circle | ring-breathe                | 静止 |
| thinking  | #AEB9CC | #AEB9CC | brain        | 无                          | 静止 |

未知 state 回退 idle 色/文案「待机」。标签色为深色面加亮档（保证 4.5:1）。

## 动效（CSS keyframes，合成器线程）

| 名称            | 时长 | 说明                            |
| --------------- | ---- | ------------------------------- |
| ring-pulse      | 2.8s | 外圈扩散淡出                    |
| ring-pulse-fast | 1.5s | speaking 时的加速脉冲           |
| ring-breathe    | 2.8s | 呼吸缩放（0.9↔0.55 透明度）     |
| bar-wave        | 0.9s | 声波 scaleY 起伏（ease-in-out） |

内圈 `animationDelay: 0.6s`；声波 7 条错落高度 `[10,18,26,14,22,12,16]`，延迟 `i * 0.11s`，动画只改 `scaleY`。

## 关键实现约束（MP 端硬约束）

- **内联样式用普通对象字面量**（`{ [key: string]: string }`），禁 StringMap/Map 作内联样式。
- **透明度一律 rgba 内联**（自写 `rgba(hex, alpha)` 工具）：原生端不支持 `color-mix` / Tailwind 透明度修饰符。
- **不使用内联 SVG、不使用 gap-\***（MP 端兼容）。
- 中央徽标直径 = `ring * 0.4`，内环 = `ring * 0.82`，图标 = `round(ring * 0.23)`，白色字形。
