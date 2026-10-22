# 任务卡：上线前验收巡检与收口（AI 工程开放 + 业务闭环 + UX/视觉）

- 日期：2026-10-22
- 关联：剩余工作报告 `2026-10-22-remaining-work-report.md`（CNT-1 / UX-1..UX-5 / U8）、上线前验收

## 1. 目标

在提审前把可由代码收口的验收问题一次清空：修正 AI 工程方向的错误置灰，补齐面试主链路的失败分流与报告落库时序，并收敛已登记的排版、文案与交互缺陷。

## 2. 范围

- 做：
  1. **AI 工程开放**：双端 `position-options` 的 `ai.available` 置 `true`；补齐 AI 岗位收束题（双端）；同步「关于」页方向说明；prep / onboarding / prefs 三处选择器可选。
  2. **业务闭环**：
     - 生成报告前等待最后一条答案上报落库（消除「最后一题丢分」竞态）；
     - 出题失败分流：仅业务码 2001 /「面试题目已收束」进入总结，其余可重试，不再把网络错误当收束；
     - 创建会话失败给出可重试 / 退出路径，不再停在「准备开始…」；
     - 「继续上次面试」真实续接：快照恢复后复用原 sessionId 与已答记录，不再新建会话。
  3. **UX / 视觉 / 文案**：
     - 报告空态 CTA 直达面试准备页；首页「累计面试 / 平均等级」入口语义拆分；平均等级空态给出解释；
     - 简历页 `loader-circle` 缺字形替换为已收录图标；解析中移除虚假 60% 进度；
     - 安全页账号信息补宽度约束，防长昵称/UID 溢出；
     - 训练页通用任务标题去除后端岗位绑定；
     - 隐私页纠正「所有数据仅存储在本机」的错误表述；
     - 付费页去除未实现的「连续包月 / 快练·标准·深度模式」承诺，按实际 30/365 天有效期表述。
  4. **验证**：G2（lint / typecheck / test / build）+ 关键 E2E 场景同步。

- 不做：
  - 云端部署 W2–W5、W6 真单、平台测试推送、iOS IAP；
  - 真实短信、协议 URL / 会员协议回填、合法域名白名单、TLS 收紧、密钥轮换（外部 / 运维 / LC 项）；
  - 新增 AI 岗位专属能力图谱文件（MP 运行时消费云内容库 + 六维通用域，图谱属内容资产，另走 content-review）；
  - `types/` / `api/` 契约变更；
  - 整站视觉重做（只修验收缺陷）。

## 3. 依赖

- 前置：云端内容库已同步四方向（`2026-10-18-cloud-bank-integration.md` §192：ai 2777/2777）；本地内容夹具含 ai 150 题。
- 外部环境：微信开发者工具、CLI 构建链可用；真机 / 云环境不阻塞本卡代码与单测。
- 契约：不改 `types/` 与 `api/`，无冻结需求。

## 4. 验收标准

- [x] 双端 `POSITION_OPTIONS` 的 `ai.available === true`，三处选择器可选且不再提示「题库建设中」。
- [x] AI 收束题双端存在且 `positionId === 'ai'`；`selectNext` 在 AI 蓝图题量达上限时返回该收束题。
- [x] 正式面试结束生成报告前，最后一条答案已收到服务端成功响应（或完成一次重试）。
- [x] `/interview/next` 非 2001 错误不再触发总结，用户可重试；`/interview/session` 失败可重试或退出。
- [x] `resume=1` 进入房间复用快照 `sessionId` 与已答题目数，不新建会话；快照失效时给出明确出口。
- [x] 报告空态 CTA 直达 `pages/interview/prep`；首页两统计入口分别落到「本场报告 / 成长趋势」。
- [x] 简历页不再使用 `loader-circle`；`check F` 通过。
- [x] 安全页长昵称 / UID 不溢出卡片；隐私页无「所有数据仅存储在本机」错误表述。
- [x] `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build:mp-weixin` 退出码 0；产物 grep 关键文案 / 色值通过。

> 门禁与真机取证：[G2 记录](./2026-10-22-pre-launch-acceptance-sweep.gate.md)。

## 5. 风险与对策

| 风险                                    | 等级 | 对策                                                                  |
| --------------------------------------- | ---- | --------------------------------------------------------------------- |
| AI 方向内容质量不足（云题以短标题为主） | 中   | 题面生成层沿用确定性模板；本卡只解除置灰，内容质量另走 content-review |
| 等待答案上报拉长结束流程                | 低   | 仅在存在在途上报时等待；超时由请求层 30s 兜底，失败降级本地报告       |
| 续接会话与服务端状态不一致              | 中   | 只复用原 sessionId；服务端 404 时提示「已失效」并退出，不伪造进度     |
| 改首页入口语义影响 E2E                  | 低   | 同步 IA1-B2/B3/D2/D3 断言与文案                                       |
| 付费文案改动触及合规口径                | 中   | 只陈述代码事实（30/365 天、不自动续费）；会员协议 URL 仍由 LC 回填    |

## 6. 产物路径

- 新增：`docs/tasks/2026-10-22-pre-launch-acceptance-sweep.md`
- 修改：
  - `data/position-options.uts`、`server/src/data/position-options.ts`
  - `data/wrapup.uts`、`server/src/data/wrapup.ts`
  - `engine/question-selector.uts`（仅当收束匹配需调整）、`server/src/rules/question-selector.ts`
  - `pages/interview/room.uvue`、`store/interview-session.uts`、`App.uvue`
  - `pages/report/report.uvue`、`pages/index/index.uvue`
  - `pages/resume/resume.uvue`、`pages/mine/security.uvue`、`pages/mine/privacy.uvue`
  - `pages/training/training.uvue`、`pages/mine/about.uvue`、`pages/membership/paywall.uvue`
  - `data/membership.uts`、`components/ml-tag.uvue`（如需要）
  - `tests/interview-engine.spec.ts`、`e2e/mp/scenarios.mjs`
  - `api/client.uts`（失败提示文案）

## 7. 角色

- 主责：FE
- 配合：AI（收束题与选题断言）、UX（入口语义 / 空态 / 文案）、QA（G2 / E2E）

## 8. 负责人

FE / 执行 Agent（内容与合规裁决仍归 CO / LC / 用户）

## 9. 开工前质询（未决项清单）

| #   | 质询                                                  | 结论                                                                                                                                                                     |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | AI 工程为什么不可选？是内容缺失还是开关遗漏？         | 已查证：云内容库 ai 2777 题、本地夹具 150 题；双端 `available:false` 是 2026-10-18 内容库切换后的遗留开关，未发现技术阻塞                                                |
| 2   | AI 出题还缺什么？                                     | 已查证：选题器只按 `positionId` 过滤；`getWrapupForPosition('ai')` 回退到 backend 收束题，`matchesPosition` 不通过 → 收束阶段返回 null。补 AI 收束题即可，无需改选题算法 |
| 3   | 是否必须补 `ai-map`？                                 | 已决策：MP 运行时只消费云内容库与六维通用域，岗位专属图谱不参与出题/评分；不新造内容资产，图谱补齐留给 content-review 专项                                               |
| 4   | 报告可能漏最后一题吗？                                | 已查证：`room.handleAnswer` 对 `submitAnswer` 未 await，`summary.genReport` 立即读库；存在竞态。本卡在总结前等待在途上报                                                 |
| 5   | 网络错误会不会被当成面试收束？                        | 已查证：`ask()` 对所有异常都 `goSummary()`；改为仅 2001 /「面试题目已收束」进入总结                                                                                      |
| 6   | 「继续上次面试」真的能继续吗？                        | 已查证：App 只跳 `/pages/interview/room`，room 的 `init()` 必新建会话并 `reset` 快照 → 当前是伪续接。本卡加 `resume=1` 分支                                              |
| 7   | 会员是不是自动续费？                                  | 已查证：服务端 `memberDays` 30/365，一次性购买，无自动续费字段；文案改为月卡/年卡并删除「连续包月」「随时取消」                                                          |
| 8   | 会员权益里的「快练/深度」「追问深度解锁」是否已实现？ | 已查证：UI 已无模式选择，追问深度对所有用户统一上限 2 层；删除未兑现承诺，改为已实现能力                                                                                 |
| 9   | 协议 URL 能否本卡回填？                               | 待定（2026-10-29 前提审前由 LC 提供 `AGREEMENT_URL` / `PRIVACY_URL`；本卡不伪造法律文本）                                                                                |
| 10  | 是否有契约变更？                                      | 已查证：仅本地快照结构与 UI 数据字段，`types/`、`api/` 入出参不变，无冻结                                                                                                |
