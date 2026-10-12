# 组件

基于官方知识库 `component/README.md` 提炼。

## 组件分类

| 分类           | 说明                                                          |
| -------------- | ------------------------------------------------------------- |
| 内置组件       | 框架内置，直接使用（view、text、image、scroll-view、list 等） |
| ext 组件       | 官方扩展组件（需安装，如 uni-ui-x 等）                        |
| 前端 uvue 组件 | 用 uvue 编写的自定义组件                                      |
| 原生 uts 组件  | 用 uts 写的原生组件（`uni_modules` 中，编译为原生语言）       |

## easycom 自动注册

- easycom 是**组件自动导入注册**机制：按约定路径自动注册组件，无需手动 import。
- 组件名与属性**全部小写、连字符连接**（如 `my-component`）。
- uni-app x 中组件调用注意 **vue 与 uvue 后缀优先级：优先 uvue**（同名组件 `a.vue` 与 `a.uvue` 同时存在时用 `.uvue`）。
- 相比 main.uts 里全局注册组件，easycom 按需应用更节省资源，更常用。

## 组件调用方式

- **内置组件**：`$refs` + `.` 操作符直接调用方法/属性：

  ```ts
  this.$refs.scrollView.scrollTo(...)  // 或组合式中的 ref
  ```

- **非 easycom 组件**（如未满足 easycom 约定时）：用 `$callMethod` 调用组件方法。
- 在 `main.uts` 中可通过 `app.component('page-head', PageHead)` 全局注册组件（每个页面可直接使用）。

## 内置组件布局提示

- 组件标签与 Web 不同，需遵循 ucss 布局规则（见 `css-styles.md`）：App 端仅 flex 布局与绝对定位、默认纵向 flex。
- 列表类场景优先考虑高性能内置列表组件（如 list、scroll-view），避免长列表用 view 堆叠导致性能问题（见 `performance.md`）。

## 示例

```vue
<template>
  <view class="container">
    <text>{{ msg }}</text>
    <button @click="onClick">click</button>
  </view>
</template>
```

组件属性绑定用 `:prop`，事件用 `@event`。组件方法调用需在渲染完成后（onReady 之后）进行。
