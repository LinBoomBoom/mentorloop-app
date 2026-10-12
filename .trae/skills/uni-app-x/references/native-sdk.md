# 原生 SDK（混合开发）

基于官方知识库 `native/README.md` 提炼。uni-app x 原生 SDK 是给 iOS/Android/HarmonyOS 原生工程师的混合开发工具包。

## 适用场景

原生开发者可以：

1. **渐进式使用**：把某些页面用 uni-app x 开发，嵌入既有原生工程；
2. **使用自己的原生工程集成环境**来打包和发版。

蒸汽（Vapor）模式的 SDK 需 HBuilderX 5.25+。

## 特点

- uni-app x 提供的不只是渲染 view，而是**完整应用**（页面管理、组件、API），更像集成小程序 SDK，但启动速度远快于小程序。
- uts 编译产物就是原生语言，与原生工程**无缝互操作**（如同一个语言不同函数的调用，不是桥接通信），可整体断点 Debug。
- 内置丰富的跨平台 API 与插件市场生态，多数业务仅需 1 人写 uni-app x 代码即可。

## 三个概念与使用流程

| 概念                   | 说明                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| 原生工程               | 开发者既存的原生工程                                                              |
| uni-app x 原生 SDK     | 官方下载，分 Android/iOS/HarmonyOS 版                                             |
| uni-app x 应用原生资源 | HBuilderX 中通过发行菜单或 cli 导出的应用原生资源（kt/swift/ets/js 及图片字体等） |

使用流程：

1. HBuilderX 新建 uni-app x 项目并开发；
2. HBuilderX 中导出应用原生资源；
3. 原生工程引入 uni-app x 原生 SDK，合并入导出的应用原生资源，整体编译运行。

集成文档：`native/use/android.md`、`native/use/ios.md`、`native/use/harmony.md`（官方知识库）。

## 原生混编联调

- 把原生工程和 uni-app x 工程一起拖入 HBuilderX，整体联编为一个原生工程。
- 可让 uts 与原生代码（如 kotlin/arkTS）混编，甚至断点联调。

## 包体积影响

- 蒸汽模式：iOS 和鸿蒙包体积增加数 M；Android 因带 V8，每个 CPU 增加十几 M（如在 manifest 选择不压缩 so 库，Android 包体积增加 4、50M）。
- VDOM 模式：安装包体积增加数 M。

## 相关配置

- 原生能力（scheme/applink/关联域等）在 `manifest.json` 可视化界面配置，打包后生效（见 `project-structure.md`）。
- 引入三方 SDK 等需自定义基座或正式打包验证（见 `run-debug.md`）。
