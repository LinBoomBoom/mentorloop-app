# 页面与 uvue

基于官方知识库 `vue/README.md`、`collocation/pagesjson.md`、`collocation/app.md` 提炼。

## uvue 文件规范

- 页面/组件文件后缀为 `*.uvue`。
- 三个根节点：`<template>`、`<script>`、`<style>`。
- `<script>` 的 `lang` 仅支持 `uts`。
- vue 的 API 无需 import 自动引入（如 `ref`、`computed`、`onLoad` 等）。
- **App 端不支持 JSX/TSX**。

## 组合式 API 与选项式 API

- 两者可混合使用，但**推荐组合式 API**。
- **蒸汽模式（Vapor）仅支持组合式 API**（选项式在蒸汽模式下不可用）。
- 选项式 `data` 中需用 `as` 显式声明类型。
- 页面生命周期函数（组合式）：`onLoad`、`onReady`、`onShow`、`onHide`、`onUnload`，以及 `onPullDownRefresh`、`onReachBottom` 等页面级事件。

## 样式规则要点

- **样式不继承**（无字体、颜色等继承到子元素）。
- 深度选择器（如 `::v-deep`）仅 Web 平台生效。
- `scoped` 仅 Web 平台生效。
- CSS 中 `v-bind()` 仅 Web 4.13+ 支持。
- 详细 CSS 子集规则见 `css-styles.md`。

## 页面生命周期（要点）

- 应用生命周期只在 `App.uvue` 中监听（见 `project-structure.md`）。
- 页面生命周期在页面中监听。
- 组件生命周期（如 `created`）见组件文档。

## 与页面相关的 uni API 注意事项

`uni.xxx` API 运行在全局逻辑层，不与代码所在页面文件绑定。访问页面的 API（如 `uni.getElementById`、`uni.setNavigationBarTitle`、`uni.pageScrollTo` 等）操作的是**页面栈栈顶**（不含 dialogPage）。

边界情况：

- 新页面 `onShow` 触发之前调用，会找到上一个页面；
- 定时器里调用时，若期间打开了新页面，会去新页面找。

严谨做法：把页面相关 API 挂在 UniPage 对象上：

```ts
getCurrentInstance()?.proxy?.$page.getElementById('abc')
```

小程序没有 UniPage，使用 `uni.getElementById` 等全局 API 时均需注意栈顶页面问题。部分 API 支持第二个参数指定页面（如 `uni.createVideoContext(videoId, component?)`）。

## 模板与数据绑定

- 模板语法遵循 Vue SFC 规范（`{{ }}` 插值、`:prop` 绑定、`@event` 监听）。
- 事件监听、v-for、v-if 等遵循 Vue 规范；注意 CSS 布局约束见 `css-styles.md`。

## 页面配置

- 页面必须在 `pages.json` 注册；可在 pages 节点为单个页面配置 style（导航栏、下拉刷新等）。
- 页面间跳转使用 `uni.navigateTo`（等路由 API）。
