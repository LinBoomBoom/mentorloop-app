# 项目结构

uni-app x 项目的核心文件与配置，基于官方知识库提炼。

## 核心文件

| 文件                      | 作用                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `manifest.json`           | 项目配置文件：应用名称、版本、图标、权限、模块等                              |
| `main.uts`                | 入口文件（uni-app x 不支持 `main.js/ts`；蒸汽模式下可直接写 js/ts）           |
| `App.uvue`                | 主组件：应用生命周期、globalData、全局方法、全局样式（不是页面，无 template） |
| `pages.json`              | 页面注册与全局配置：globalStyle、tabBar、easycom 等                           |
| `uni.scss` / `theme.json` | 全局样式变量 / 应用主题（defaultAppTheme: light/dark/auto）                   |
| `pages/`                  | 页面目录（`.uvue` 文件）                                                      |
| `uni_modules/`            | 插件包目录（含 `utssdk/` 下的 uts 插件）                                      |
| `static/`                 | 静态资源目录（图片、字体、音视频）                                            |

## manifest.json 关键点

- **`uni-app-x` 节点必须存在**，是项目是否 uni-app x 的核心标识：
  - 缺少该节点 → HBuilderX 识别为 uni-app js 引擎版项目（方形项目图标）。
  - 含有该节点 → 识别为 uni-app x 项目（圆形项目图标）。
- `appid` 由 DCloud 云端分配，用于云服务，勿自行修改。
- uni-app x 默认没有 splash 启动界面（打包后启动速度非常快，可自做 uvue 页面当 splash；HBuilderX 3.99+ 支持配置 splash）。
- 无内置模块选择，采用**摇树机制**自动选择内置模块。
- `uni-app-x` 节点可配置：`flex-direction`（uvue 页面默认 flex 方向，默认 "column"）、`vapor`（是否启用蒸汽模式，默认 false）、`styleIsolationVersion`、`vapor-render-target`。
- 隐私合规：uni-app x 原生驱动执行速度快，无需原生的隐私弹框配置，自行弹框即可（hello-uni-app-x 中有基于 dialogPage 的示例，用 `uni.getPrivacySetting`；同意按钮用 button 的 `open-type=agreePrivacyAuthorization`）。用户同意前不要采集隐私数据。
- App 图标（distribute.icons）与启动界面（distribute.splashScreens）建议在 HBuilderX 可视化界面操作，云打包后生效。图标必须 png（iOS appstore 1024x1024）。

## main.uts 与代码时序

```ts
import App from './App'
import { createSSRApp } from 'vue'

export function createApp() {
  const app = createSSRApp(App)
  // 可在此全局注册组件、使用 i18n/pinia 等插件
  return { app }
}
```

应用启动时代码按如下时序加载：

1. `main.uts` 的 `createApp()` 外代码 + 任何页面/组件 script 中 `export default {}` 外的代码
2. `createApp()` 中的代码
3. `App.uvue` 的 `onLaunch`
4. 首页的 `onLoad`
5. 首页的 `onReady`

**警告**：以上时序 1/2/3 中的代码：

- 都会影响启动速度（type 定义不影响，使用时才加载）；
- 执行太早，很多功能与 API 无法使用（尤其界面相关），需 try/catch；
- 顶层创建的变量在应用存活期间常驻内存，不随页面关闭回收。

## App.uvue

- 所有页面在 `App.uvue` 下切换，是应用入口；但本身不是页面，**不能编写 `<template>`**。
- 应用生命周期仅可在 `App.uvue` 中监听（页面监听无效）：`onLaunch`、`onShow`、`onHide`、`onExit`（Android 3.9+/Harmony 4.72+）、`onError`。
- `onLaunch(options)` 可通过 `options.appScheme` / `options.appLink` 获取 scheme / 通用链接启动参数（需在 manifest 配置 scheme/applink，打包后生效）。
- `App.uvue` 从 HBuilderX 5.0 起支持组合式（此前仅选项式）。
- 页面直达（deeplink）：配置 scheme 或 applink 后，在 `onShow` 获取 `appScheme`/`appLink` 参数，再用 `uni.navigatorTo` 跳转。

## pages.json 关键点

- **所有页面必须在此注册**；`pages` 数组第一项是首页。
- `globalStyle`：`navigationBarBackgroundColor`、`navigationBarTextStyle`（black/white）、`enablePullDownRefresh`、`pageOrientation` 等。
- 尺寸约定：tabBar 高度 50px（不含安全区）；导航栏高度 44px（不含状态栏）。
- `easycom`：组件自动导入注册规则（见 `components.md`）。
- 支持条件编译平台标识（见 `css-styles.md` / `compiler` 说明）。

## 静态资源处理（重要）

- **图片、字体、音视频等静态资源一律放 `static/` 目录**（或 `uni_modules` 下的 `static/`），该目录整体 copy 到编译产物，路径稳定。
- `web-view` 加载的本地 html 及配套资源放 `hybrid/` 目录。
- 页面内 `import` 的静态资源、`<image src="./1.png">` 等会被编译到 `assets` 目录且文件名加 hash（不推荐，无法用 file manager API 访问）。
- **变量路径的静态资源编译器无法识别，打包后会丢失**。
- css/js 等代码文件不是静态资源，**不要放 static 目录**：会重复打包增加包体积，且开发期间导致 2 次热更新。
- 及时清理 static 下的废文件（整体 copy，废文件也会进包）。

## 编译产物

- App 端先编译为平台原生语言（如 Kotlin），再经平台编译器打包。
- 编译缓存持久化在项目 `unpackage/` 目录；代码未变时优先用缓存；升级 HBuilderX 后重新编译。
- 建议把 `unpackage/` 加入安全软件信任目录，提升编译性能。
