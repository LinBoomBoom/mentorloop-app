---
编号: SOP-13
名称: uni-app x 平台规范符合性
适用范围: pages/ components/ engine/ api/ store/ utssdk/ 内 .uvue 与 .uts 代码、Tailwind 原子类、编译产物与运行模式
版本: 1.0.0
最后更新: 2026-10-12
---

# uni-app x 平台规范符合性 SOP

生成日期：2026-10-12
归属：SOP 系统 L2 领域层 · 领域：客户端平台规范
上游：[README.md](./README.md) §4；规范正本：仓库根 `README.md` §5；官方文档：https://doc.dcloud.net.cn/uni-app-x/ ；相关：[quality-gate-sop.md](./quality-gate-sop.md)、[domain-design-sop.md](./domain-design-sop.md) §5

---

## 1. 目的与适用

本项目反复出现一类 bug：**代码在 H5 / 编译期看起来正常，在原生端或小程序端静默失效甚至报错**——gap 失效、文字样式丢失、类型不匹配、构建产物路径错误（典型：ISS-20261011-01）。根因基本都是「按 Vue/Web 直觉写了 uni-app x 不支持的写法」。

本 SOP 把规范符合性从事后 debug 变成事前拦截。所有 `.uvue` / `.uts` 改动适用。

分工：**规范条款的正本在根 `README.md` §5**（与 `mentorloop-system-spec` skill 同源），本文不重复定义，只沉淀防线机制、bug 模式与检查清单。

---

## 2. 规范速查（条款出处：根 README §5）

### UTS（`*.uts` 与 `<script setup lang="uts">`）

| 禁止                        | 必须用                            | 失效形态          |
| --------------------------- | --------------------------------- | ----------------- |
| `interface` 声明对象类型    | `type X = { ... }`                | 编译错误          |
| `undefined`                 | `null`                            | 编译错误          |
| 匿名对象字面量作参数/返回值 | 先命名类型，字面量 `as NamedType` | 类型丢失/编译错误 |
| 无类型变量/参数/返回值      | 全部显式类型                      | 编译错误          |

### uvue（页面 / 组件）

| 禁止                                | 必须用                                      | 失效形态                                               |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| 选项式 API / mixin                  | `<script setup lang="uts">`（蒸汽模式强制） | 编译失败                                               |
| 裸文本、容器上写 text-_/font-_      | 文字包 `<text>`，样式写在 `<text>` 上       | **静默失效**：样式不继承                               |
| `gap-*` / `space-x-*` / `space-y-*` | `mt-*` / `ml-*`                             | **静默失效**：原生端布局错乱                           |
| 透明度修饰符（如 `bg-white/5`）     | 内联 `rgba()`                               | **静默失效**：Tailwind 4 输出 `color-mix()` 原生不支持 |
| 复杂后代选择器 `.a .b`              | 扁平原子类                                  | **静默失效**：选择器不生效                             |
| view 默认竖排被当横排用             | 显式 `flex-row`                             | 布局方向错误                                           |
| 内联 `<svg>`                        | Lucide 图标字体 / PNG                       | **静默失效**                                           |

### Tailwind

| 禁止                                                                  | 必须用                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 再注册 `tailwindcss()` / `@tailwindcss/postcss` / `@tailwindcss/vite` | weapp-tailwindcss `uniAppX()` 独占生成                            |
| 新增页面不查 `@source`                                                | `main.css` `@source` 覆盖 `App.uvue`、`pages/**`、`components/**` |
| token 只改一处                                                        | `main.css` @theme ↔ `styles/theme.uts` ↔ `MASTER.md` §A1 三处同步 |

---

## 3. 三层防线

| 层            | 机制                                                               | 拦截范围                                                                 | 状态      |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| ① 编译期      | `vite.config.ts` `uvueUnsupported: 'error'`                        | gap / space-* / 渐变等受限原子类直接报错，不静默失效                     | ✅ 已启用 |
| ② 提交 / CI   | `scripts/check-uvue-css.mjs`（husky lint-staged + CI，G2 第 4 项） | class 属性中的受限原子类                                                 | ✅ 已接入 |
| ③ 评审 / 自查 | 本文 §5 清单 + `mentorloop-system-spec`                            | 静态扫描覆盖不到的：样式不继承、flex 方向、UTS 类型、`@source`、产物来源 | 人工执行  |

**新问题闭环纪律**：出现新的「静默失效 / 平台差异」类 bug 后，除修复代码外必须完成三件事，否则视为未收口：

1. 若属新约束 → 在根 `README.md` §5 补条款行，并同步本文件 §2 / §4；
2. 评估能否升级到防线 ①（编译报错）或防线 ②（脚本扫描），能自动化的一律自动化；
3. 按 `docs/issues/_templates/issue.md` 登记，frontmatter「涉及skill或SOP」填本 SOP。

---

## 4. 高频 bug 模式（真实案例）

| 模式               | 症状                                                                         | 根因                                                                                                                       | 出处               |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 运行模式产物污染   | 开发者工具报 `[WXSS 文件编译错误] '../../uvue.wxss' not found`，全页样式失效 | HBuilderX「运行」模式把全部页面样式聚合进根 app.wxss，注入的 `@import "../../uvue.wxss"` 相对路径越界；同时段 CLI 产物正常 | ISS-20261011-01    |
| 双 watch 并行      | `dist/dev` 与 `unpackage/dist/dev` 内容不一致，误判产物来源                  | CLI watch 与 HBuilderX 运行会话同时各写一个目录                                                                            | ISS-20261011-01    |
| gap/space 静默失效 | H5 正常，真机布局错乱                                                        | 原生端不支持且编译不报错（防线 ①② 已拦截新增代码）                                                                         | check-uvue-css.mjs |
| 文字样式丢失       | 容器上写了 text-_/font-_ 但文字未生效                                        | uvue 样式不继承                                                                                                            | 根 README §5       |

**构建产物纪律**（源自 ISS-20261011-01）：

- 小程序端开发循环固定为：`pnpm dev:mp-weixin`（CLI watch 常驻）+ 微信开发者工具导入 `dist/dev/mp-weixin`；HBuilderX 仅用于 App 端真机调试。
- 排查样式/编译问题，先确认开发者工具实际导入的产物目录，再对比「CLI 产物 vs HBuilderX 产物」同文件内容定位差异。
- 性能验证一律用 release 包，debug 包性能不代表真实表现。

---

## 5. 检查清单（G2 / 代码评审用）

**UTS**：

- [ ] 对象类型全部 `type` 声明，无 `interface`
- [ ] 空值用 `null`，无 `undefined`
- [ ] 对象字面量已 `as NamedType`；参数/返回类型均已命名
- [ ] 变量/参数/返回值显式类型

**uvue / 样式**：

- [ ] 全部 `<script setup lang="uts">`，无选项式 API / mixin
- [ ] 文字均在 `<text>` 内，text-_/font-_ 写在 `<text>` 上
- [ ] 无 gap-* / space-*；横向布局显式 `flex-row`
- [ ] 无透明度修饰符；颜色用内联 `rgba()`
- [ ] 无复杂后代选择器；无内联 SVG

**结构与产物**：

- [ ] `engine/` 无 UI、无 `uni.*`；`api/` 契约未动（动了先走 G1 契约冻结）
- [ ] `utssdk/` 降级实现未伪造结果
- [ ] 新页面已确认 `main.css` `@source` 覆盖；token 三处同步
- [ ] MP 端验证用的是 CLI 产物 `dist/dev/mp-weixin`，非 HBuilderX 运行产物 `unpackage/dist/dev`
- [ ] `node scripts/check-uvue-css.mjs` 通过（G2 已含）

---

## 6. 承载 skill 与证据要求

- 客户端改动入口必载 `mentorloop-system-spec`；平台能力存疑时按 `mentorloop-role-feasibility-analyst` 要求，以官方文档（https://doc.dcloud.net.cn/uni-app-x/ ）核实后才可作为决策依据，禁止凭直觉断言「支持 / 不支持」。
- 涉及编译器 / 平台行为差异的问题按 issue 模板登记；结论（版本门槛、产物行为等）同步风险登记册。

---

## 7. 更新触发条件

| 触发事件                                              | 更新内容                                   | 版本  |
| ----------------------------------------------------- | ------------------------------------------ | ----- |
| 新增「静默失效 / 平台差异」bug 模式                   | §4，并按 §3 闭环纪律同步防线与根 README §5 | minor |
| 新增可静态扫描的受限写法（check-uvue-css.mjs 扩规则） | §3 防线 ② 描述                             | minor |
| 根 `README.md` §5 条款变更                            | §2 速查表同步                              | minor |
| 官方文档新增平台约束                                  | §2 / §5，以官方文档为准                    | minor |
