# CSS（ucss 样式子集）

基于官方知识库 `css/README.md`、`compiler/README.md` 提炼。App 端样式遵循 ucss 规则，是 CSS 的子集，与 Web 有显著差异。

## App 端布局约束（最高优先级）

- **仅支持 flex 布局和绝对定位**（不支持 float、grid、普通文档流等 Web 布局）。
- **flex 方向默认为纵向（column）**，与 Web 默认 row 不同。
- 排版文本用 text 组件，块级容器用 view 组件，并按 flex 规则布局。

## 选择器限制

- **仅支持 class 选择器**；不支持标签选择器（tag）、`#id`、属性选择器 `[attr]`。
- 样式**不继承**（字体、颜色等不会自动继承到子元素，需逐级设置）。
- 深度选择器（`::v-deep`）仅 Web 平台生效。
- `scoped` 仅 Web 平台生效。
- CSS 中 `v-bind()` 仅 Web 4.13+ 支持。

## 优先级规则（与 Web 不同）

- 内联 style 优先级高于 class。
- **class 优先级按组件 `class` 属性中书写的顺序**：后写的优先级高（与 Web 按定义顺序不同）。
- 同一元素多个 class 时，写在 class 属性后面的生效。

## 条件编译

- uni-app x 支持完善的条件编译处理平台差异（与 uni-app vue3 编译器一致）。
- 平台标识：`APP-PLUS`、`APP-ANDROID`、`APP-IOS`、`H5`（Web）、`MP-WEIXIN`、`MP-...` 等。
- 写法：
  ```html
  <!-- #ifdef APP-ANDROID -->
  <view class="android-only" />
  <!-- #endif -->
  ```
  ```ts
  // #ifdef APP-IOS
  console.log('ios only')
  // #endif
  ```
- uni-app x 在 uni-app 基础上**新增 APP-ANDROID、APP-IOS 条件编译**。

## 预编译与编译支持

- 支持 less、sass、scss 等 CSS 预编译。
- 编译器在 Vite 基础上扩展开发，大部分特性（条件编译、环境变量）与 uni-app vue3 编译器一致。

## 样式书写示例

```vue
<template>
  <view class="container">
    <text class="title">标题</text>
    <view class="row" style="margin-top: 10px">
      <text class="cell">A</text>
      <text class="cell">B</text>
    </view>
  </view>
</template>

<style>
.container {
  flex: 1;
  flex-direction: column;
}
.row {
  flex-direction: row;
}
.title {
  color: #333;
  font-size: 32rpx;
}
</style>
```
