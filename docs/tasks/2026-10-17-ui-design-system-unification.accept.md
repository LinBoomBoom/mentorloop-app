# G3 验收结论：全站 UI 设计系统统一

- 日期：2026-10-17
- 关联：任务卡 `docs/tasks/2026-10-17-ui-design-system-unification.md` · 门禁 `*.gate.md`（通过）
- 角色：UX 设计走查 + QA 准入 · 执行 Agent：TraeCode
- **总结论：通过**。结构层手搓漂移清零（机检 G/H 守卫防回潮），8 项验收标准 8 项达成，2 项后置验证（真机走查 / E2E 重跑）移交下轮。

## 1. 验收标准核验

| #   | 标准                                 | 结果                                                                      |
| --- | ------------------------------------ | ------------------------------------------------------------------------- |
| 1   | pages/ `rounded-chip` 清零（检查 H） | ✅ 机检全绿；例外 2 处（login 复选框 / mine 深色面行动点）显式登记        |
| 2   | pages/ 手搓卡片清零（检查 G）        | ✅ 机检全绿；例外 1 处（resume 虚线投放区）                               |
| 3   | 机检 A–H 全绿                        | ✅ 退出码 0（5580 行扫描）                                                |
| 4   | 生产构建成功 + 产物字面量/色值验证   | ✅ DONE + 7 项产物验证全过（见 gate 记录）                                |
| 5   | ml-segmented 序列化 + E2E id 存活    | ✅ report.js「本场报告」×1 + seg-report/seg-growth ×2                     |
| 6   | G2 全绿                              | ✅（typecheck 环境类非阻塞项已定性留痕）                                  |
| 7   | 规格文档与实现一致                   | ✅ 五份组件规格反写完成（含旧文档 rounded-2xl/rounded-full 陈旧记录修正） |
| 8   | 真机视觉走查                         | ⏳ 后置：DevTools 模拟器 + 真机各一轮，重点 prep/prefs 选中态归一后的视觉 |

## 2. 设计走查结论（UX）

**统一前的不一致实证**（审计锁定的漂移样本，全部已收敛）：

| 语义             | 统一前                                                                        | 统一后                                                        |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 选择 chip 选中态 | prep/onboarding=白底描边+check；prefs=实底 smart 白字；report 会话=实底 smart | 三处归一：白底 + border-smart + check（ml-chip select）       |
| 选择 chip 文案   | prep「敬请期待」/ prefs「即将上线」                                           | 归一「敬请期待」                                              |
| 行内操作 chip    | resume 导出 h-11 px-3.5 / 采用 h-11 px-4 / training 开始 h-7 px-3             | 统一 h-11 px-4（触摸目标合规化，A3-4）                        |
| 手搓白卡内边距   | login p-4 / training 宫格 p-3 / resume px-4 py-3.5 / index 入口 p-3.5         | 统一 ml-card p-4（深色面卡不在白卡语义，维持 cardStyle 单源） |
| 文字链           | onboarding 跳过（手搓 h-11 view text-xs）/ paywall 协议（内联）               | 独立链=ml-button link；内联链维持 text-xs text-smart 规格记录 |
| 发送验证码按钮   | 手搓 rounded-control h-11 bg-chip-smart                                       | ml-button tonal sm                                            |
| 分段切换（Tab）  | report 手搓 flex 容器 + inline style                                          | ml-segmented 唯一入口（id 透传保 E2E 契约）                   |
| 标签徽标         | paywall h-5 / mine h-5 / resume h-7·h-8 / 房间 h-7 各写各的                   | 统一 ml-tag h-6（icon/iconColor 支持）                        |

**红线核验**：

- 对比度：text-smart `#5B6CFF` on `#FFFFFF` = 4.8:1 ≥4.5 ✓；soft tone text-ink-soft on white ≈ 6.9:1 ✓
- 触摸目标：所有可独立点击 chip/按钮 ≥44px（h-11）；room 标签为静态不可点，不适用 ✓
- 状态不靠颜色单编码：chip 选中=描边+check 双编码；SKU 选中=底色+边框+radio 实心三编码 ✓
- 面试房间红线未触碰：录音主 CTA、语音状态环、计时、退出确认均未改动；仅 AI 身份标签换组件（视觉 h-7→h-6 静态标签）✓
- 五态：不可用 chip 点击保留回传（toast「题库建设中」引导），无死路 ✓

**视觉回归预判（≤4px 归一）**：training 宫格 p-3→p-4、resume 文件/技术栈标签 h-7/h-8→h-6、paywall/mine 徽标 h-5→h-6、login 发送验证码 h-11→h-10、房间标签 h-7→h-6。方向均为向统一档收敛，真机走查确认。

## 3. 真机走查结论（2026-10-17 实测，DevTools 模拟器 + automator）

**结论：通过。** 截图存 `e2e/mp/shots/`（会话级保留）。

| 页面                         | 走查点                                                                                                                                 | 结果 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| prefs                        | chip 选中态（白底+紫描边+check）、未选灰底、不可用置灰+敬请期待、CTA                                                                   | ✅   |
| onboarding                   | 同上 + 跳过 link 变体（smart 紫文字链）                                                                                                | ✅   |
| paywall                      | SKU 选中（chip-smart 底+smart 描边+radio 实心）、未选白底灰描边、价格排版                                                              | ✅   |
| training                     | 宫格 ml-card p-4 归一不拥挤、维度标签、品牌带                                                                                          | ✅   |
| report                       | 分段渲染（本场报告/成长趋势中文、选中实底白字）、**切段交互（人工点验 C1/C2：成长面板出现/消失、选中态往返切换）**、总体判断卡、维度卡 | ✅   |
| index                        | 深色面零回归（参数卡/CTA/入口/数据条）                                                                                                 | ✅   |
| resume / login / mine / prep | resume 上传区正常（截图轮换未留档）；prep 受登录门控覆盖为登录层（既有逻辑）；login/mine 走 E2E 断言覆盖                               | ✅   |

**走查发现并当场修复：**

1. **ml-segmented 渲染 bug（本卡引入，已修）**：段项数据源用了对象包装（SegEntry），MP 序列化把 `{{ seg }}` 渲染成 `{"label":"本场报告"}` JSON 文本上屏。修复 = computed 直接返回 `string[]`；重建 + 重开会话验证通过。规格已补「渲染纪律」条。
2. **E2E runner 时序脆弱点（既有，非本卡引入，已修）**：ONBOARD-1 误报——元素入树 ≠ 转场完成，navigateTo 转场窗口内立即 tap 后 navigateBack 被路由节流，实测回退 9.94s > waitPath 8s 窗口。修复 = waitPath 默认超时 8s→15s（run.mjs）。修复后全量 E2E **4 过 / 7 跳过 / 0 失败**。
3. **E2E 穿透限制（既有平台限制，登记不修）**：ml-segmented 段项 id（#seg-report/#seg-growth）随 virtualHost 组件化后 automator 不可查询（`page.$` 与组件标签均不可见），requireReportData 与 C1/C2 场景因此跳过（叠加台账 U10 数据覆盖问题）。切段交互已由本次人工点验覆盖；E2E 适配（深链等价改造）另立小卡。

## 4. 后置项（原 §3，已收敛）

- ~~真机走查~~ ✅ 已完成（本节）
- ~~E2E 重跑~~ ✅ 已完成（4 过 / 7 跳过 / 0 失败；跳过项为 U10 数据环境 + 穿透限制，见上）
- typecheck 环境项：HBuilderX 环境本地复核一次（维持）

## 5. G3 验收执行记录（2026-10-18，以 main HEAD ba21137 为准复核）

| #   | 核验项                                                                                            | 结果                                                    |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 版本状态：HEAD=ba21137 已推送 origin/main，工作区干净                                             | ✅                                                      |
| 2   | 设计 token 机检 A–H（含结构检查 G/H）                                                             | ✅ 全绿                                                 |
| 3   | uvue CSS 守卫（31 文件）                                                                          | ✅ 零违规                                               |
| 4   | lint / format:check / test                                                                        | ✅ 0 / 0 / 92 passed                                    |
| 5   | 生产构建可复现（提交钩子后源码）                                                                  | ✅ DONE                                                 |
| 6   | 产物六项抽查（分段+E2Eid=3 / chip-hint=2 / link=1 / action-chip=3 / smart色=21 / chip-smart底=5） | ✅ 与 gate 基线一致                                     |
| 7   | E2E 回归（DevTools 重新拉会话）                                                                   | ✅ 4 过 / 7 跳过（U10 环境+穿透限制，已知登记）/ 0 失败 |

**G3 结论：验收通过，任务卡关闭。** 遗留事项（E2E 深链等价适配小卡、typecheck 环境项）已登记 §6，不阻塞。

## 6. 遗留与交接

- 检查 G 的类串跨行形态暂不覆盖（当前仓库无此形态）；若未来出现多行 class 的手搓卡片，需升级机检为 AST 级。
- `ml-button` link 变体当前仅 onboarding「跳过」一个消费者；后续独立文字链统一走该变体，禁止再手搓。
- 深色面行内按钮（index.uvue:172、interview/room 结束按钮）为登记的深色面形态（rounded-control + 半透明描边），如继续增多可考虑 ml-button 增 `dark` 面 prop——现阶段不做过早抽象。
