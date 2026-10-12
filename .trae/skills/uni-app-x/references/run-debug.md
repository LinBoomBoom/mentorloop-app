# 运行调试

基于官方知识库 `tutorial/run-app.md`、`compiler/README.md`、`tutorial/uni-uts-debug.md` 提炼。

## 真机运行（无模拟器）

HBuilder 未提供 App 模拟器，需要连接真实手机或手机模拟器运行测试，即"真机运行"。

- **Android**：支持 adb 协议。usb 线连接设备，或使用电脑上的 Android 模拟器（Google 官方、雷电、夜神等）。需开启手机 USB 调试（开发者选项）。HBuilderX 4.71+ 支持 Android 无线连接设备。

- **iOS**：支持 itunes 协议，usb 连接 iPhone/iPad；Mac 可连接 Xcode 自带 iOS 模拟器。arm 架构 cpu 可直接启动真机运行基座。

- **iOS 真机注意**：自 2022-09-14 起 iOS 真机不再支持标准运行基座（苹果企业证书限制），需向苹果申请证书制作**自定义基座**，或 Mac 上用 iOS 模拟器。

运行入口：HBuilder 顶部运行菜单、工具栏运行按钮、快捷键 Ctrl+R（可搭配数字键快速选择运行目标）。

多设备可同时运行（每个设备一个控制台窗口），但**一个设备同时只能运行一个项目**。

## 标准运行基座

- uni-app x 标准基座包名 `io.dcloud.uniappx`，图标为绿色 U（uni-app js 版为 `io.dcloud.HBuilder` 绿色 H）。

- 标准基座可热刷 js/动态代码（uni-app x Android 端 uts 编译为 kt 后通过 dex 动态加载实现热刷新）。

- 系统版本要求：Android 5.0（API 21）+；iOS 10+。更低版本需自定义基座。

- 修改代码后差量同步、动态热刷，`console.log` 打印到 HBuilder 控制台并可点击跳转源码。

- uni-app x 的 web-view 组件网页日志和错误从 HBuilderX 4.51+ 同步显示到控制台。

## 自定义运行基座

标准基座无法生效的配置（包名、名称、图标、证书、权限、原生模块、xml 资源、三方 SDK 等）需要自定义基座，否则需完整打包。

自定义基座生效范围：App 名称/图标/封面 splash/包名/证书、模块与三方 SDK 配置（微信、推送、地图、语音等）、App 权限、原生插件/SDK、其他 manifest 需打包生效的配置。

- 打包入口：HBuilder 顶部发行菜单或 Ctrl+U。

- 可**云打包**自定义基座（无需配置原生环境），也可**离线打包**。

- 产物存放：`项目目录/unpackage/debug/`，文件名 `android_debug.apk` / `iOS_debug.ipa` / `Pandora_simulator_debug.app`。

- 一个项目只能生成一个自定义基座，多次生成只保留最后一次。

- 生成后在设备选择窗口选择"自定义基座-本地基座"运行。

- 自定义运行基座只能在 HBuilderX 真机运行使用，不可直接安装使用；正式发版需正常重新打包。

- HBuilderX 4.71+（仅 Android）：离线打包基座已通过 Android Studio 安装到手机后，可选"已安装基座"。

## 编译缓存与排障

- 编译产物缓存持久化在 `unpackage/`；代码未变时优先使用缓存，升级 HBuilderX 或编译器版本后重新编译。

- 修改代码后手机端没有更新 → HBuilderX 运行窗口勾选\*\*"清理构建缓存"\*\*。

- HBuilderX 4.02 以下版本，运行到自定义基座报"uts插件\[xxx]不存在"需重新打包自定义基座。

- 安全软件（360/微软）会扫描编译产生的 kt/class 临时文件，建议将 `unpackage/` 设为信任目录以提升编译性能。

- HBuilderX 4.28 起，运行到 Web 端浏览器打开后会自动触发剩余页面编译（减少页面跳转等待）。

## 断点调试

- uts 与原生代码混编时支持整体断点 Debug（见 `native-sdk.md`）。

- 各平台 uts 调试文档：`tutorial/uni-uts-debug.md`、`tutorial/uni-uts-debug-ios.md`、`tutorial/uni-uts-debug-harmony.md`（官方知识库）。
