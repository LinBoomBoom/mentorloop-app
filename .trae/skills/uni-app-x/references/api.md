# API

基于官方知识库 `api/README.md` 提炼。

## API 分类

uni-app x 的 uts 代码中可用的 API：

| 类别               | 说明                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| uts 内置对象 API   | `global` 等内置对象（见 `uts/buildin-object-api/`）                                              |
| 平台专有对象       | `UTSAndroid`、`UTSiOS`、`UTSHarmony`                                                             |
| 全局 API           | 前面不需要加 `uni.`，如 `getApp`                                                                 |
| `uni.xxx` 内置 API | 常用跨平台 API（见知识库 `api/` 目录）                                                           |
| `uniCloud.xxx`     | uniCloud 云服务 API                                                                              |
| dom API            | DOM 相关 API                                                                                     |
| vue API            | Vue 的 API                                                                                       |
| 平台原生 API       | Android 所有原生 API、iOS 所有原生 API、harmony 所有原生 API、Web 浏览器所有 API、小程序所有 API |

**uni-app x 不限制任何平台原生 API 的调用**。常用跨平台能力已封装在 uni API 中，但所有平台 API 均可在 uni-app x 中调用（调用方式见 `uts-language.md`）。

## 使用建议

- 能跨平台用 `uni.getSystemInfoSync` 等 uni API，就不用各自平台的 API（跨平台、文档简单）。
- 正规开发时原生能力应封装为 uni_modules 形式的 uts 插件，方便共享与跨平台（iOS JS 驱动模式下页面不能直接调 swift API）。

## Promise

- uni 的异步 API 均支持 callback。
- **只有部分 API 支持 promise**：支持 promise 的 API，其文档返回值描述中会包含 `Promise`。

## uni.* API 与页面的关系（重要）

- `uni.xxx` API 运行在**全局逻辑层**，不与代码所在页面文件绑定。
- 需要访问/操作页面的 API（`uni.getElementById`、`uni.setNavigationBarTitle`、`uni.setNavigationBarColor`、`uni.showNavigationBarLoading`、`uni.startPullDownRefresh`、`uni.pageScrollTo` 等）操作的是**页面栈栈顶**（不包括 dialogPage）。
- 边界情况：
  1. 新页面 `onShow` 触发前调用 → 找到的是上一个页面；
  2. 定时器中调用，期间打开新页面 → 之后会从新页面找。
- 严谨做法：页面相关 API 挂在 UniPage 对象上：

  ```ts
  getCurrentInstance()?.proxy?.$page.getElementById('abc')
  ```

- 部分 API 支持第二个参数指定页面，如 `uni.createVideoContext(videoId, component?)`，不传时默认栈顶页面。
- 小程序没有 UniPage，仅提供全局 API，使用上述 API 时需注意栈顶页面问题。

## 生命周期

- 应用生命周期（onLaunch/onShow/onHide/onExit/onError）：见 `project-structure.md`（仅 App.uvue 可监听）。
- 页面生命周期（onLoad/onReady/onShow/onHide/onUnload 等）：见 `page-uvue.md`。
- 组件生命周期（created 等）：见组件文档。
- `uni.onXxx()` / `uni.offXxx()`（如 `uni.onPushMessage`）属于事件监听 API，不属于生命周期。
