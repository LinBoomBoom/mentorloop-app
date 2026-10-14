# ml-icon 图标

> 规格以 `components/ml-icon.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

全站唯一图标组件。基于 lucide 字体（PUA 码位），`ICON_GLYPH: StringMap` 查表约 70 个图标，分组：导航/基础、面试/语音、训练/成长、岗位/简历、状态/安全。

## Props

| 名称  | 类型   | 默认      | 说明                                   |
| ----- | ------ | --------- | -------------------------------------- |
| name  | String | 必给      | 图标名（ICON_GLYPH 键）                |
| size  | Number | `16`      | 边长 px（fontSize 与 lineHeight 同值） |
| color | String | `#1A2433` | 图标颜色（ink）                        |

## 状态

| 状态 | 表现                                     |
| ---- | ---------------------------------------- |
| 命中 | 渲染对应 PUA 字形                        |
| miss | glyph 查表 miss 返回空串（不崩、不可见） |

## 关键实现约束（MP 端硬约束）

- **内联样式必须用普通对象字面量**（`{ fontFamily, fontSize, lineHeight, color }`），**禁用 UTSType 实例**：MP 端 `normalizeStyle` 无法枚举 UTSType 字段，会序列化成空串导致图标变黑。
- `<style>` 块提供 `.font-icon { font-family: 'lucide' }`；字体文件在 `design-system/mentorloop/fonts-reference/`。
- 新增图标 = ICON_GLYPH 加一行键值，规格不逐一列码位。
