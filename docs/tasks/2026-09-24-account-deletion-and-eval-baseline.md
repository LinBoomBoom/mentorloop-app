# 任务卡：评测基线制度 + 协议链接 + 账号自助删除

- 日期：2026-09-24
- 关联：M2 发布前缺口（compliance-sop.md §5 两条）+ 评测集「M2 前待完善」标注 ×4

## 1. 目标

补齐 M2 发布前的三块缺口：评测集阈值基线与人工抽检制度（消除 4 处「待完善」标注）、登录页协议链接可跳转、服务端账号数据自助删除（DELETE /me/account + 客户端注销入口）。

## 2. 范围

- 做：
  - 评测基线：以当前 15/15 全绿为 v1 基线，落盘 `docs/evals/2026-09-24-baseline-v1.md`；阈值 = 结构性断言 100% 通过；人工抽检制度 = CO+AI 按层抽检、结论记录于评测报告 §4；更新 4 处标注。
  - 协议链接：`login.uvue` 协议文案拆分为可点击《用户协议》《隐私政策》（URL 常量 + 空值降级 toast）；`about.uvue` 协议行同步激活。
  - 账号删除：服务端新增 `DELETE /me/account`（requireAuth、幂等、级联清理 9 表 + UPLOAD_DIR 简历文件）+ 单测；`api/auth.uts` 新增 `deleteAccount()`（mock + real）；`security.uvue` 注销账号行激活（双重确认）；`privacy.uvue` 文案更新。
- 不做：
  - 真实协议 URL 内容与 ICP/App 备案（外部依赖，URL 常量留空降级）。
  - 数据恢复 / 软删除 / 冷却期机制（v1 直接硬删）。
  - 真机验证（HBuilderX 侧，发布前人工执行）。
  - 评分 / 选题规则变更（评测集断言与用例均不动）。

## 3. 依赖

- 前置：固定评测集 v1.0.0 已建立（15/15 全绿）；`docs/contracts/`、`docs/evals/`、`docs/tasks/` 目录已存在。
- 外部环境：真实协议 URL（备案后回填）；HBuilderX 真机验证（发布前）。
- 契约：新增端点 `DELETE /me/account` + `api/auth.uts` 新增函数 → **触发契约冻结**，冻结单 `docs/contracts/2026-09-24-delete-me-account.freeze.md`。

## 4. 验收标准

- [ ] `docs/evals/2026-09-24-baseline-v1.md` 存在，含基线值、阈值、抽检制度三节；4 处标注更新完毕（README.md §3、release-sop.md §2、domain-content-sop.md §6、AI-engineer SKILL.md）。
- [ ] `login.uvue` 中《用户协议》《隐私政策》可点击：URL 非空跳转、为空 toast 降级；勾选行为不变。
- [ ] `about.uvue` 协议两行 `soon` 移除，跳转行为与登录页一致。
- [ ] `server` 新增测试通过：未登录 401；登录后删除 → users/sessions/answers/reports/resumes/orders/tracking_events/sms_codes 全清；重复调用返回 ok（幂等）；UPLOAD_DIR 简历文件被删除。
- [ ] `api/auth.uts` 新增 `deleteAccount()`：mock 返回成功；real 走 DELETE /me/account；`security.uvue` 注销行走双重确认 → 调接口 → 清本地 → logout；`privacy.uvue` 文案指向安全页。
- [ ] 根目录 `pnpm format` / `pnpm lint` / `pnpm test` / `pnpm typecheck` 全绿；server `pnpm test` / `typecheck` / `build` 全绿。

## 5. 风险与对策

| 风险                                                            | 等级 | 对策                                                                                                                                                    |
| --------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 级联删除漏表或顺序错误（FK ON）                                 | 中   | 固定顺序：tracking_events → answers/session_asked（经 session）→ reports → resumes → orders → sessions → sms_codes（按 phone）→ users；单测断言全表清空 |
| `resumes.original_url` 格式不定（/resume/parse 直存任意字符串） | 中   | 删文件前判断 `resumes/` 前缀，文件不存在忽略，不抛错                                                                                                    |
| 误删风险（不可恢复）                                            | 中   | 客户端双重确认 modal；服务端 requireAuth + 按 token 用户删，无跨用户路径                                                                                |
| 协议 URL 为空导致死链                                           | 低   | URL 常量空值降级 toast，不跳转                                                                                                                          |
| UTS 语法约束（type/空值/`<text>`）                              | 低   | 沿用现有页面写法，lint + typecheck 兜底                                                                                                                 |

## 6. 产物路径

- 新增：`docs/evals/2026-09-24-baseline-v1.md`、`docs/contracts/2026-09-24-delete-me-account.freeze.md`、本任务卡
- 修改：`docs/sop/README.md`、`docs/sop/release-sop.md`、`docs/sop/domain-content-sop.md`、`docs/sop/compliance-sop.md`、`.trae/skills/mentorloop-role-ai-engineer/SKILL.md`、`server/src/routes/me.ts`、`server/src/me.spec.ts`、`api/auth.uts`、`api/mock/auth.mock.uts`、`pages/login/login.uvue`、`pages/mine/security.uvue`、`pages/mine/privacy.uvue`、`pages/mine/about.uvue`

## 7. 角色

- 主责：BE（端点与级联删除）+ FE（客户端链路）+ AI（评测基线制度）
- 配合：CO（抽检制度执行方）、QA（门禁校验）、LC（合规文案确认）

## 8. 负责人

BE/FE/AI 联合交付，QA 出具门禁结论；执行 Agent：TraeCode（本会话）。
