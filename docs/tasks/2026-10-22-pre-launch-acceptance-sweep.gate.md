# G2 质量门记录：上线前验收巡检与收口

- 日期：2026-10-22
- 任务卡：[2026-10-22-pre-launch-acceptance-sweep.md](./2026-10-22-pre-launch-acceptance-sweep.md)
- 结论：**通过（代码与构建层）**；外部部署 / 支付 / 合规项不在本卡门禁范围

## 1. 命令与结果

| 检查        | 命令                                   | 结果                                                                           |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| 客户端格式  | `pnpm format:check`                    | 0（All matched files use Prettier code style）                                 |
| 客户端 Lint | `pnpm lint`                            | 0（无 warning）                                                                |
| 客户端类型  | `pnpm typecheck`                       | 0（同时修复既有 `EvalCase.resumeTechStacks` / `reportSegmentIntent` 声明缺口） |
| 客户端单测  | `pnpm test`                            | 8 文件 / 113 用例全绿                                                          |
| uvue 守卫   | `node scripts/check-uvue-css.mjs`      | OK（31 文件，0 违规）                                                          |
| token 守卫  | `node scripts/check-design-tokens.mjs` | A–H 全绿（图标 97 / 引用 74 全命中）                                           |
| 小程序构建  | `pnpm build:mp-weixin`                 | DONE（干净目录重建，避免 WXML/JS 版本错位）                                    |
| 服务端 Lint | `pnpm --dir server lint`               | 0                                                                              |
| 服务端类型  | `pnpm --dir server typecheck`          | 0                                                                              |
| 服务端单测  | `pnpm --dir server test`               | 27 文件 / 202 用例全绿                                                         |
| 服务端构建  | `pnpm --dir server build`              | 0                                                                              |

## 2. 产物核验

- `dist/build/mp-weixin/data/position-options.js`：`{ id:"ai", name:"AI 工程", available:!0 }`。
- `server/dist/data/wrapup.js` 含 `q-wrapup-ai`；AI 蓝图出满一场后返回岗位专收束题（服务端 content-mapper spec）。
- 编译产物无 `loader-circle`、`所有数据仅存储在本机`、`连续包月`、`快练/标准/深度` 旧文案。
- `pages/report` 已无重复的「成长趋势」section action；分段仍为唯一切换入口。

## 3. 真机 / 模拟器人工取证

| 场景                            | 结果                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| AI 工程房间深链 `positionId=ai` | 成功建会话并出 AI 题（KeywordTableIndex / 多轮记忆管理）；顶部「结束」按钮已避开微信胶囊 |
| 训练房间深链                    | 成功拉取服务端题目；计时器与胶囊不重叠                                                   |
| 首页「累计面试」                | 落到「本场报告」分段（截图核验）                                                         |
| 首页「平均等级」                | 落到「成长趋势」分段；caption 插值正确、最强维度短名不折行                               |
| 报告空态                        | 提供「开始模拟面试 / 先做专项训练」两个可执行落点                                        |
| 总结页 0 题                     | 不生成空报告，展示「本场没有可评分的回答」与返回首页                                     |
| 关于页协议 URL 未配置           | 如实显示「即将上线」，不再伪装为可查看                                                   |

## 4. 覆盖要求核验（TDD 留痕）

- 新增 / 修改纯逻辑测试：
  - `tests/interview-engine.spec.ts`：AI 方向可用、AI 收束题、`prepareResume` 续接、任意作答态收口 `ASKING → WRAP_UP`。
  - `tests/rules-consistency.spec.ts`：AI 收束题双端逐字段一致。
  - `server/src/content-mapper.spec.ts`：AI 蓝图出满一场后返回 `q-wrapup-ai`。
- 修 Bug 的复现证据：
  - 状态机：修复前 `ASKING → WRAP_UP` 属非法迁移（返回 null，报告收口状态静默失败）；修复后用例断言非 null 并走到 `COMPLETED`。
  - 报告竞态 / 出题失败分流：属 UI 时序与网络分支，单测不覆盖；以代码路径核验 + 模拟器场景截图留痕。
  - 简历文件名溢出 / 假进度：以模拟器截图与 token 守卫留痕。

## 5. 未覆盖 / 已知非阻塞

- E2E 报告类 7 条仍为 skip：`ml-segmented` 等 virtualHost 组件对 automator 不可见（历史台账已登记），且登录态 `/me/reports` 会覆盖种子；本次以模拟器截图人工核验深链与分段。
- `AGREEMENT_URL` / `PRIVACY_URL` 外链仍为空（无备案域名）；三份协议全文已于 2026-10-23 内置应用内 `pages/legal/legal`，提审时可访问，外链待 LC 备案后回填（任务卡 §9 #9）。
- 云端部署 W2–W5、W6 真单、短信真发、合法域名与密钥轮换不在本卡范围。

## 6. 2026-10-23 补记：应用内协议全文

- 新增 `data/legal-docs.uts`（用户协议 / 隐私政策 / 会员服务协议全文）与 `pages/legal/legal.uvue`（按 `doc` 参数渲染）。
- 入口切换：登录页与登录面板（URL 空 → 应用内全文，URL 非空 → webview）、关于页（取消「即将上线」）、付费页（会员协议全文）、隐私页（新增全文入口）。
- G2 复核：`pnpm lint` 0、`pnpm typecheck` 0、`pnpm test` 8 文件 / 113 用例全绿、`node scripts/check-uvue-css.mjs` OK（32 文件）、`node scripts/check-design-tokens.mjs` A–H 全绿、`pnpm build:mp-weixin` DONE。
- 产物核验：`dist/build/mp-weixin/app.json` 含 `pages/legal/legal`；`data/legal-docs.js` 含「会员服务协议」「不自动续费」「注销账号」等关键文案。
