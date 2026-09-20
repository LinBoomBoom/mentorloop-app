/// <reference types="@dcloudio/types" />

// uvue / uts 模块声明，供 vue-tsc 与 ESLint 识别
declare module '*.uvue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.uts' {
  const content: any
  export default content
}
