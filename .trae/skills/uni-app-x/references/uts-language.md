# uts 语言

基于官方知识库 `uts/README.md`、`uts/uts-optimize.md`、`api/README.md` 提炼。

## 是什么

uts（uni type script）是 uni-app x 的跨平台强类型语言：

- 编译到 **Kotlin**（Android）/ **Swift**（iOS）/ **ArkTS**（HarmonyOS）/ **JS**（Web、小程序）。
- **Android 普通页面编译为 Kotlin；iOS 普通页面编译为 JS（JS 驱动模式）**。
- **uts 插件（`uni_modules/utssdk`）总是编译为原生语言**（Kotlin/Swift/ArkTS），因此可无缝调用原生 API。

## 基本语法

- 类型声明：`let` / `const` + 冒号：
  ```ts
  let count: number = 0
  const name: string = 'uni-app x'
  ```
- HBuilderX 4.31+ 支持函数返回值自动推导。
- **联合类型只支持 `| null`**（不支持其他联合如 `string | number`）。
- 选项式 `data` 中需用 `as` 显式声明类型：
  ```ts
  data() {
    return {
      age: 18 as number
    }
  }
  ```
- 类型（type/interface）只在使用时加载，不影响启动速度。

## 常见编译错误与修复

**可选属性直接返回导致类型不匹配**：函数返回类型声明为 `number`，但返回可选属性（可能为空）时报类型不匹配。修复：`??` 兜底。

```ts
type UserProfile = { age?: number }
function getUserAge(): number {
  const userProfile: UserProfile = {}
  return userProfile.age ?? 0 // 必须兜底，不能直接返回 userProfile.age
}
```

## 调用原生 API

uni-app x 不限制任何平台原生 API 的调用：

- **Android** 所有原生 API（kotlin/java，如 `import Build from 'android.os.Build'`）
- **iOS** 所有原生 API（swift）
- **HarmonyOS** 所有原生 API（ArkTS）
- Web 浏览器所有 API、小程序所有 API

示例（Android VDOM 模式，页面内直接调用）：

```ts
<script setup lang="uts">
import Build from 'android.os.Build';
onLoad(() => {
  console.log(Build.MODEL)                       // 原生对象
  console.log(uni.getSystemInfoSync().deviceModel) // 同值的 uni API
})
</script>
```

**规范约束**：

- 页面内直接调用原生 API 仅在 Android VDOM 模式、鸿蒙 arkts 驱动下可行，但**不规范**；规范做法是封装为 **uts 插件**（`uni_modules/utssdk`）使用，便于共享与跨平台。
- **iOS 在 JS 驱动模式时，uvue 页面中不支持调用 swift API**，必须封装为 uts 插件调用原生 API。
- 大多数 `uni.*` API 本身就是 uts 开发的模块（开源在 `gitcode.com/dcloud/uni-api`），可作为 uts 插件范例。

## uts 插件（uni_modules/utssdk）

- 目录：`uni_modules/<plugin-name>/utssdk/`，可再按平台细分 `app-android/`、`app-ios/` 等。
- 插件内用 uts 语法调用对应平台原生 API。
- 插件编译为原生语言，跨平台共享、与页面直接互操作。
- 可在插件中集成三方 SDK（Android 的 aar/gradle、iOS 的 pod 等）。

## 内置对象

- uts 内置对象 API（`global` 等）：见知识库 `uts/buildin-object-api/`。
- 平台专有对象：**UTSAndroid**、**UTSiOS**、**UTSHarmony**，用于访问平台运行时对象与原生能力。

## 不再支持

- uni-app x 中**不再支持 plus 和 weex 的 API**。过去 plus API 中常用能力已替换增补为 uni API，或提供 uts 操作原生的示例（见官方 `api/ext.md`）。
