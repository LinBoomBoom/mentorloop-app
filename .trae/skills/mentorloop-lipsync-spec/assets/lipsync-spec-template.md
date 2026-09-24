# 口型同步规格：<范围>

- 日期：YYYY-MM-DD
- 角色：UX（规格）+ FE（实现）
- 契约性质：设计↔工程接口；涉及原生层时先走契约冻结

## 1. viseme 集

| viseme | 说明 | 参考口型 |
| ------ | ---- | -------- |
|        |      |          |

## 2. 音素 → viseme 映射

| 音素 / 韵母 | viseme | 优先级 |
| ----------- | ------ | ------ |
|             |        |        |

## 3. 切换频率与容忍

- 切换上限：10–15 次/秒
- 允许滞后：
- 禁止超前：口型不得早于声音

## 4. TTS 时序

- 驱动方式：房间通过 `speaking` 属性（TTS start/end）
- 禁止：逐帧口型数据进入响应式状态

## 5. syncLip 契约

- 位置：`utssdk/interviewer-avatar/index.uts`
- 跨端：静默空操作；原生层覆写

## 6. 降级

- 无 viseme 资产时：CSS 张合动画（keyframes），仍可读为「说话中」

## 7. 冻结记录

- 契约冻结单：`docs/contracts/YYYY-MM-DD-<slug>.freeze.md`
- 双签：UX / FE
