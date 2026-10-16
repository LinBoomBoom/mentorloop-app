# 任务卡：全站 UI 设计系统统一（按钮 / chip / 卡片结构层收敛）

- 日期：2026-10-17
- 关联：用户直接反馈「prep 页按钮与其他按钮主题不一致，按钮大小/颜色/边框/字号、字体颜色大小、卡片、Tab 等组件必须统一设计系统」

## 1. 目标

消除结构层手搓漂移：选择 chip、迷你操作按钮、可选中卡片、文字链全部收敛到统一组件（新增 `ml-chip`、扩展 `ml-card`/`ml-button`），迁移全部手搓页面，并给设计 token 机检补结构检查防回潮。

## 2. 范围

- 做：
  1. 新增 `components/ml-chip.uvue`：select（`h-11 px-3.5 rounded-chip`，selected=白底 border-smart + check / 未选=bg-muted / 禁用=opacity-60 且点击仍回传，hint 槽）+ action（`h-11 px-4`，tone smart/outline/soft + muted 完成态）
  2. 新增 `components/ml-segmented.uvue`：页内分段切换（Tab）唯一入口，muted 容器 + 选中实底 smart；双段标量 props（MP 序列化约束）+ id1/id2 透传保 E2E 契约（`#seg-report`/`#seg-growth`）
  3. `ml-card` 扩展：`selected` prop（chip-smart 底 + smart 描边，paywall 套餐用）；根节点补 `relative`（卡内 absolute 徽标定位）
  4. `ml-button` 扩展：`link` 变体（无底描边 smart 字，onboarding「跳过」）+ `tonal` 变体（chip-smart 实底，login 发送验证码）
  5. `ml-tag` 扩展：`icon` + `iconColor` props（文件名标签 / mine 徽标 / 两个房间页深色面状态标签）
  6. 页面迁移（全量 rounded-chip 清点后扩大）：prep、onboarding（chips+跳过）、prefs（chips，选中态由实底 smart 归一为描边+check）、training（维度宫格迁 ml-card、「开始」迁 ml-chip action）、login（卡迁 ml-card、发送验证码迁 tonal）、resume（步骤流卡迁 ml-card、文件/技术栈标签迁 ml-tag、采用/忽略/导出迁 ml-chip action）、paywall（SKU 卡迁 ml-card selected、徽标迁 ml-tag）、mine（会员徽标迁 ml-tag）、report（分段迁 ml-segmented、会话选择迁 ml-chip mono）、interview/room + training/room（深色面状态标签迁 ml-tag）
  7. 机检扩展（check-design-tokens.mjs）：检查 G = pages/ 手搓卡片禁令（`bg-surface`+`rounded-card` 同行，虚线投放区例外）；检查 H = pages/ 手搓 chip 禁令（`rounded-chip` 仅组件可出现，复选框与深色面会员行动点例外）
  8. 规格反写：新增 ml-chip.md / ml-segmented.md；更新 ml-card.md / ml-button.md / ml-tag.md（并修正旧文档 rounded-2xl/rounded-full 陈旧记录）
- 不做：
  - index 首页深色面卡片（navy 半透明 cardStyle 已单源，与白卡 ml-card 不同表面体系，保持现状）
  - index「登录后同步…」提示行（warn 色状态提示带图标，非纯文字链，语义不同）
  - paywall《会员服务协议》行内文字链（行内流式文本无法组件化，规格记录为 text-xs text-smart）
  - resume 虚线上传卡（唯一投放区形态，白名单例外保留）
  - 底部原生 tabBar（PNG 图标配置，另一体系）
  - engine / api / types / server 零改动

## 3. 依赖

- 前置：无
- 外部环境：验证需 `pnpm build:mp-weixin`；批量编辑期间不得有 CLI watch 并行写产物
- 契约：不触 types/ 与 api/，无契约冻结

## 4. 验收标准

- [x] pages/ 全部 .uvue 中 `rounded-chip` 出现次数 = 0（机检检查 H 通过；login 复选框、mine 深色面行动点两处例外已登记）
- [x] pages/ 全部 .uvue 中 `bg-surface`+`rounded-card` 同行出现 = 0，resume 虚线卡例外已登记（机检检查 G 通过）
- [x] `node scripts/check-design-tokens.mjs` 退出码 0（A–H 八项全绿，2026-10-17 实测）
- [x] `pnpm build:mp-weixin` 成功，产物 wxss 以色值/规则名验证新样式存活（注意 wtu- 哈希，不用类名 grep）
- [x] ml-segmented 标签文案出现在产物 js（VDOM 模式文案在 .js 非 .wxml）且 `#seg-report`/`#seg-growth` id 存活（E2E 契约）
- [x] G2 门禁全绿（纯客户端范围；typecheck 环境类非阻塞已定性留痕，见 *.gate.md）
- [x] ml-chip.md / ml-segmented.md / ml-card.md / ml-button.md / ml-tag.md 与实现一致
- [x] （后置已收敛）真机走查 + E2E 重跑：走查通过（发现并修复 ml-segmented 渲染 bug 与 E2E 时序脆弱点），E2E 4 过/7 跳过/0 失败，见 *.accept.md §3/§4

## 5. 风险与对策

| 风险                                                        | 等级 | 对策                                                                       |
| ----------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| uvue 组件 class fallthrough（ml-chip 上传 mr-2 mb-2）不生效 | 中   | 已有先例 onboarding `ml-button class="mt-4"` 正常；迁移后真机/产物验证布局 |
| 机检 G/H 误报                                               | 中   | 仅扫 pages/（组件内部合法）；例外显式登记在脚本白名单                      |
| 批量编辑与 CLI watch 并行写产物                             | 中   | 编辑前确认无 watch 进程；构建用一次性 build:mp-weixin                      |
| UTS props 动态 class 三元过长难读                           | 低   | ml-chip 内聚状态 computed，消费端只传标量 props                            |
| 视觉回归（p-3.5/py-3.5 → p-4 等归一）                       | 低   | 差异 ≤2px 且方向是统一；设计走查覆盖                                       |

## 6. 产物路径

- 新增：`components/ml-chip.uvue`、`components/ml-segmented.uvue`、`design-system/mentorloop/components/ml-chip.md`、`design-system/mentorloop/components/ml-segmented.md`
- 修改：`components/ml-card.uvue`、`components/ml-button.uvue`、`components/ml-tag.uvue`、`pages/interview/prep.uvue`、`pages/interview/room.uvue`、`pages/onboarding/onboarding.uvue`、`pages/training/training.uvue`、`pages/training/room.uvue`、`pages/login/login.uvue`、`pages/resume/resume.uvue`、`pages/membership/paywall.uvue`、`pages/mine/mine.uvue`、`pages/mine/prefs.uvue`、`pages/report/report.uvue`、`scripts/check-design-tokens.mjs`、`design-system/mentorloop/components/ml-card.md`、`design-system/mentorloop/components/ml-button.md`、`design-system/mentorloop/components/ml-tag.md`

## 7. 角色

- 主责：FE
- 配合：UX（规格与设计走查）、QA（G2 门禁）、PO（范围裁决已收口）

## 8. 负责人

FE / 执行 Agent（UX 裁决走用户确认）

## 9. 开工前质询（未决项清单，2026-10-15 起）

| #   | 质询                                         | 结论                                                                                                                                               |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 范围切法：全量一次 vs 分批？                 | 已决策（用户 2026-10-17）：全量一次完成                                                                                                            |
| 2   | 文字链统一方式？                             | 已决策（用户 2026-10-17）：并入 ml-button 加 link 变体                                                                                             |
| 3   | 「Tab 不一致」指什么？                       | 已查证：全仓 grep 无页内 Tab/分段控件（border-b 命中均为列表分隔线）；底部 tabBar 为原生 PNG 体系。按无页内 Tab 处理；若用户后续指认具体元素另立卡 |
| 4   | index 首页卡片为何不迁 ml-card？             | 已查证（index.uvue L30/L99/L119）：深色面 navy 半透明 cardStyle 单源自洽，ml-card 是浅色面白卡组件，跨表面迁移会破坏双表面体系（MASTER §A1）       |
| 5   | class fallthrough 在 uvue 是否可靠？         | 已查证：onboarding.uvue L93 `<ml-button class="mt-4">` 为现存先例且页面布局正常                                                                    |
| 6   | 机检结构检查的误报面？                       | 已决策：G/H 仅扫 pages/；resume 虚线卡登记为脚本内显式例外（附理由）                                                                               |
| 7   | 契约影响？                                   | 已查证：改动清单无 types/、api/、server 文件，无冻结需求                                                                                           |
| 8   | paywall skuStyle 动态边框能否映射 selected？ | 已查证（paywall.uvue L27-L35）：选中=边框高亮 + radio 实心，映射 ml-card selected（border-smart）+ 槽内自绘 radio，迁移时逐项核对 skuStyle         |
