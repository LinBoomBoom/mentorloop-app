# 性能优化

基于官方知识库 `collocation/manifest.md`、`collocation/main.md`、`compiler/README.md`、`vue/README.md` 提炼。

## 蒸汽模式（Vapor）——高性能渲染

- 蒸汽模式是 uni-app x 的高性能渲染模式，在 `manifest.json` 的 `uni-app-x.vapor` 节点启用（`"vapor": true`）。

- 兼容性：Android(Vapor) 5.21+、iOS(Vapor) 5.11+、HarmonyOS(Vapor) 5.0+（Web 4.0+）。

- **仅支持组合式 API**（选项式 API 不可用）。

- `vapor-render-target`：'bytecode' | 'nativecode'（默认 bytecode）。

- 蒸汽模式原生 SDK 需 HBuilderX 5.25+。

- 性能评测优于其他跨平台框架（见官方 `app-vapor.md`）。

## 启动性能（代码时序）

应用启动时序（详见 `project-structure.md`）：

1. `main.uts` 顶层 + 页面/组件 script 的 `export default {}` 外代码
2. `createApp()` 内代码
3. `App.uvue` onLaunch
4. 首页 onLoad → onReady

**优化原则**：

- 谨慎在时序 1/2/3 中编写代码：影响启动速度、执行太早大量 API 不可用（界面相关尤其）、顶层变量常驻内存。

- type 定义不影响启动（使用时才加载）。

- uni-app x 原生驱动、启动速度快，默认无 splash（可用简单 uvue 页面自做 splash，HBuilderX 3.99+ 支持配置 splash 启动界面）。

## 静态资源优化

- 静态资源一律放 `static/`（根目录或 uni\_modules 下），整体 copy、路径稳定。

- **及时清理 static 废文件**（整体 copy，废文件也会进包增加体积）。

- 不用变量路径引用静态资源（编译器无法识别会丢失）。

- css/js 代码文件勿放 static（重复打包 + 2 次热更新）。

## 编译缓存

- 编译结果缓存于 `unpackage/`，代码未变时优先用缓存，显著加快二次编译（类似传统强类型语言的 Build/clean）。

- 升级 HBuilderX 后自动重新编译。

- 将 `unpackage/` 加入安全软件信任，避免实时扫描拖慢编译。

## 渲染与列表性能

- App 端仅 flex 布局（见 `css-styles.md`），合理利用 flex 布局减少层级。

- 长列表优先使用内置高性能列表组件（list、scroll-view 等），避免大列表用 view 堆叠。

- 相关专题：官方知识库 `tutorial/` 下有 android-memoryleak（Android 内存泄漏）、android-16kb（16KB 页对齐）等文档；性能评测见 `benchmark/` 目录（vapor-benchmark-android/ios/harmony）。

## 内存注意

- `main.uts`、页面 script 中 `export default {}` 外创建的变量在应用存活时一直占据内存，不会随页面关闭回收——避免在这里存放大数据。

- 定时器等异步任务中避免持有页面引用造成泄漏（参见官方 android-memoryleak 文档）。
