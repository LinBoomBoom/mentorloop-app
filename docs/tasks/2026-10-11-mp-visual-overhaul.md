# 任务卡：小程序整体视觉升级（ui-2）

- 日期：2026-10-11
- 关联：2026-10-11-mp-reports-dedupe-ui-polish（C1-C7 矛盾清单待裁决项不在本卡）

## 1. 目标

把浅色学习面从「后台表格感」升级为有品牌感的产品级视觉：统一设计令牌与基座组件，重排首页首屏保证主 CTA 可见，让「深色沉浸 + 浅色学习」双表面都有明确的 MentorLoop 视觉身份。

## 2. 范围

- 做：
  - 设计令牌补全：品牌渐变、六维能力色板正式化（main.css @theme + theme.uts + MASTER.md 三处对齐）
  - 基座组件升级：ml-button（secondary 白底描边态 + size 变体）、ml-section-header 统一收编 report 自绘头、新增 ml-stat-bar（三页统计条组件化）
  - 核心页升级：index（首屏重排）/ growth / training / mine / report / prep / paywall / summary
  - tabBar 选中色核对；hover-class 命名与 opacity 两档收敛
- 不做：
  - 面试房间 / 训练房间（interview-room-ux 域）
  - 数字人 PNG 资产重绘（avatar-design 域，另立卡）；本期数字人仅布局调整 + CSS 细节增强
  - C1-C5/C7 端间一致性矛盾（另立卡，C1/C4 待 PO 裁决）
  - 服务端与契约（types/、api/ 零改动，不触发 contract-freeze）

## 3. 依赖

- 前置：图标 StringMap 修复（c6fee32）已推送，模拟器渲染正常
- 环境：CLI watch（pnpm dev:mp-weixin）常驻 + 用户侧微信开发者工具验证
- 契约：无

## 4. 验收标准

- [ ] 新增色板/渐变在 main.css @theme、theme.uts、MASTER.md §A1 三处同步
- [ ] ml-button secondary 为白底描边态，全页无灰实底次按钮
- [ ] growth/training/mine 统计条换用统一组件，无复制粘贴样式
- [ ] 667px 高屏内首页主 CTA「开始模拟面试」完整可见（模拟器截图实证）
- [ ] hover-class 命名收敛为 pressed-* 前缀，opacity 只保留 0.7/0.85 两档
- [ ] report 三处自绘 section 头改用 ml-section-header；空态换 ml-empty
- [ ] G2 客户端裁剪全绿（lint + tsc + vitest + format + build:mp-weixin）
- [ ] 模拟器截图走查核心 5 页（index/growth/training/mine/report）确认无回归

## 5. 风险与对策

| 风险                     | 等级 | 对策                                                             |
| ------------------------ | ---- | ---------------------------------------------------------------- |
| 改动面大引入回归         | 中   | 分批推进（令牌/基座 → 核心页 → 收尾），每批 build:mp-weixin 验证 |
| UTS 内联样式类型坑       | 中   | 沿用普通对象字面量模式，禁 StringMap/Map（c6fee32 教训）         |
| 首页重排影响条件编译分支 | 低   | MP-WEIXIN 胶囊避让（rightPad=100）逻辑保持不动                   |

## 6. 产物路径

- 修改：main.css、styles/theme.uts、design-system/mentorloop/MASTER.md、components/（ml-button/ml-section-header/ml-stat-bar 新增）、pages/（index/growth/training/mine/report/prep/paywall/summary）、pages.json
- 新增：components/ml-stat-bar.uvue

## 7. 角色

- 主责：UX（mentorloop-role-uiux-designer + mentorloop-system-spec）
- 配合：FE（落地）、QA（G2 + 截图走查）、PO（风格方向裁决、分批验收）

## 8. 负责人

PO 把关风格方向与批次验收；UX 主导设计走查与方案；执行 Agent：TraeCode（GLM）

---

## 进度记录

### 2026-10-11 走查诊断（已完成，待用户确认方向）

问题清单（按影响排序）：

| #   | 问题                                                                                                                        | 位置                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| V1  | 浅色页全是白卡+灰线+灰影，无品牌锚点，像后台管理系统；缺教练类产品的情绪层                                                  | growth/training/mine/report 等      |
| V2  | 统计条三页复制粘贴且语义色各不相同，无主次层级                                                                              | growth L21 / training L5 / mine L54 |
| V3  | 首页数字人区固定 300px（占屏 40%+），内容区可视空间被压缩；CTA 本身在固定底栏始终可见，问题在于首屏内容密度与数字人比例失衡 | index L41                           |
| V4  | ml-button secondary 是灰实底（bg-line），视觉廉价；无 size 变体、无 loading 态                                              | ml-button L27                       |
| V5  | hover-class 命名混乱（hero/row/card/chip/sku-pressed 各页自造），opacity 0.5-0.85 五档混用                                  | 全部页面                            |
| V6  | report 三处自绘 section 头、自绘空态，与 ml-section-header / ml-empty 组件并存                                              | report L45/L114/L129/L3             |
| V7  | 六维色板（#7C5CFF/#0EA5B7/#E0654A 等）硬编码散落三处（growth/training/report），不在 token 体系                             | 各页 DIM_META                       |
| V8  | 页面左右 padding 不统一（px-5/px-4/p-4），圆角混用（rounded-lg/xl/2xl）                                                     | 全部页面                            |
| V9  | 深浅面切换生硬：首页深色 → prep 全白，无过渡语言                                                                            | index → prep                        |
| V10 | prep 选中态是实色靛紫块填充，未选中是灰实底，选项「chip」质感差                                                             | prep L25/L82                        |

升级方案（批次）：

- 批次 A 令牌与基座：渐变/六维色 token 三处对齐；ml-button 重做（secondary 白底描边 + sm/md/lg）；ml-stat-bar 新组件；hover 规范收敛
- 批次 B 核心页：首页首屏重排（数字人区 300→约 230px，CTA 上移进一屏）+ 品牌头部带方案（待裁决）+ 统计条换新组件 + report/prep/paywall 跟进
- 批次 C 收尾：tabBar 选中色、圆角/间距统一、截图走查 5 页

### 2026-10-11 批次 A 令牌与基座（已完成）

- main.css @theme 新增：--color-dim-_（六维正式色板 6 色）+ --color-dim-_-tint（6 色）
- styles/theme.uts 同步导出 DIM_COLOR/DIM_TINT，供页面消费；MASTER.md §A1 增补六维色板表与品牌头部带定义
- ml-button 重做：secondary 改白底描边（bg-surface + border-line + text-ink，去灰实底）；新增 size（sm=40px/md=48px/lg=56px，默认 md）；按压统一 pressed-card
- ml-stat-bar 新组件：props 为 9 个标量（value1-3/label1-3/color3 + tappable），事件 stat-tap 回传索引——MP props 序列化不支持函数跨组件传递，故不用函数 prop
- hover-class 收敛进 main.css 全局三档：pressed-row(0.7) / pressed-card(0.85) / pressed-chip(0.8)，禁各页自造 -pressed 命名
- ml-card / ml-section-header 本地 style 块删除，hover 换全局类

### 2026-10-11 批次 B 核心页（已完成）

- 首页：数字人区 300px→232px（呼吸环 w-52/w-44、头部 96→88px、身体 128→120px 同比缩小），给内容区让位；CSS 细节增强（白色椭圆高光 + 领结，纯 CSS 不动 avatar 资产域）；hover 收敛 pressed-card/pressed-chip/pressed-row
- growth/training/resume：顶部加品牌头部带（ml-brand-band 靛紫渐变 135deg + 标题白字 + 副标题 mist + 主题图标，静态无 blur），内容区 -mt-5 衔接；三页结构逐字一致
- growth/training：统计条换 ml-stat-bar；六维色改源 theme.uts DIM_COLOR/DIM_TINT，去本地硬编码
- mine：统计条换 ml-stat-bar + :tappable="true"（0→成长/1→报告/2→训练）。设计裁决：mine 不加头部带——资料卡已是深色品牌锚点，再加头部带会双重头部，例外处理
- report：空态改 ml-card+ml-empty+「回首页开始面试」按钮；三处自绘 section 头换 ml-section-header；总体判断卡加综合等级徽章（深色面等级色 A-D）
- prep：方向/经验/时长 chip 全改描边选中态（选中=bg-surface+border-smart+text-smart+check 图标；未选=bg-bg-muted；locked=opacity-60）
- paywall：sku-pressed → pressed-card + 删本地 style；summary/login 跟随基座组件自动受益
- 遗留修复：index 残留 hero-pressed、prefs 漏改 3 处 chip-pressed（replace_all 后发现），均已收敛，全仓 grep 旧命名清零

### 2026-10-11 批次 C 收尾（代码层完成，视觉走查移交用户）

- tabBar：pages.json 已有 selectedColor=#5B6CFF / color=#94A3B8，核对无需改动
- 圆角：全仓 grep 无 rounded-3xl/4xl 越界值，体系收敛为卡片 2xl / 内嵌块 xl / chip lg / 圆形 full
- 模拟器截图走查：待用户在微信开发者工具（导入 dist/dev/mp-weixin）验证 5 页，本侧不代跑

### 2026-10-11 严重缺陷修复：main.css 手写规则被管线丢弃（V11，用户报「页面排版全部错乱」）

- 现象：用户侧全部页面样式错乱不可用；dist 产物中 WXML 有 ml-brand-band/pressed-* 类名，但所有 WXSS（app.wxss + 页面 wxss）均无对应规则
- 根因：weapp-tailwindcss 管线只保留 Tailwind 工具类通道（@theme/@utility 生成的 wtu-* 类），main.css 里手写的普通 CSS 规则被静默丢弃——与已知「@font-face 被丢弃」同机制（:root/page 基线、reduced-motion 块同样从未生效）
- 修复：4 个自定义类改用 Tailwind 4 `@utility` 注册（ml-brand-band/pressed-row/pressed-card/pressed-chip），走工具类生成通道后正常进入页面 wxss，WXML/WXSS 重命名映射一致
- 连带处置：旧 CLI watch 因编辑中间态累积 css-finalizer「Unclosed block」错误且 wxml(15:31)/wxss(15:40) 版本错位 → 杀旧 watch、清 dist/dev/mp-weixin、重启新 watch，产物验证干净无 finalizer 错误
- 遗留说明：`:root, page` 背景基线与 prefers-reduced-motion 块仍不在产物中（历史如此，非本次回归；页面自带 bg-bg-light 不受影响），后续如需生效须另想办法（JS 注入或 App.uvue style）
- 教训入 memory：自定义全局类必须 @utility；G2 build 产物「exit 0」不代表样式存活，验收必须 grep 产物关键类名

### 2026-10-11 验收与提交

- [ ] 八项验收标准：令牌三处同步 / secondary 描边 / 统计条组件化 / hover 收敛 / report 组件收编 —— 代码层已达成
- [ ] G2 客户端裁剪（lint + tsc + vitest + format + build:mp-weixin）—— 待跑
- [ ] 模拟器截图走查 5 页无回归 —— 待用户验证
- [ ] 提交推送 —— 用户授权后执行
