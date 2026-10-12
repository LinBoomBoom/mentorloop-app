# 插件生态

基于官方知识库 `plugin/README.md`、`component/README.md`、`api/README.md` 提炼。

## uni 插件市场

- uni 插件市场（ext.dcloud.net.cn）是官方插件生态地，提供大量现成插件（含 uts 插件）。
- 插件分类覆盖组件、原生能力封装、工具库、模板等。

## uni_modules（插件包管理方案）

- uni_modules 是官方插件包管理方案，一个包可同时放置多种依赖库：
  - npm 库（JS/TS 生态）
  - gradle 依赖（Android）
  - cocoaPods 依赖（iOS）
  - ohpm 依赖（HarmonyOS）
- 插件的静态资源放 `uni_modules/<plugin>/static/`，web-view 本地 html 放 `uni_modules/<plugin>/hybrid/`。

## uts 插件（封装原生能力）

- 目录：`uni_modules/<plugin>/utssdk/`（可按平台细分 `app-android/`、`app-ios/` 等）。
- uts 插件**总是编译为原生语言**（Kotlin/Swift/ArkTS），可无缝调用平台原生 API。
- 各平台原生 API 调用：
  - Android：kotlin/java
  - iOS：swift
  - HarmonyOS：ArkTS
- 用途：封装原生能力供页面使用，跨平台共享；**iOS JS 驱动模式下页面不能直接调 swift API，必须封装为 uts 插件**。
- 大多数 `uni.*` API 本身就是 uts 插件（开源在 `gitcode.com/dcloud/uni-api`），是编写 uts 插件的最佳范例。

## 原生组件插件

- 可用 uts 编写原生组件（`uni_modules` 中），编译为原生语言，通过 easycom 或显式引入使用（见 `components.md`）。

## web 生态兼容

- uni-app x 支持 web 生态（JS/TS 库）：
  - 通过 **web-view 组件**加载 web 页面（本地 html 放 `hybrid/` 目录）；
  - 或通过**蒸汽模式兼容 JS/TS 生态**。
- 注意：uni-app x 不再支持 plus 和 weex API（见 `uts-language.md`）。

## uni-agent（AI 辅助开发插件）

- uni-agent 可方便地开发 uts 插件、封装原生能力，即便不懂原生开发也可指挥 AI 完成 uts 插件开发（官方 `ai/` 文档）。

## 本项目现状

- 本仓库原生能力以 `utssdk/` 下的接口占位（audio / realtime / avatar / device）组织：方法签名 + 降级实现。补原生层时按本文件的 uts 插件机制落地；降级实现不得伪造结果。
