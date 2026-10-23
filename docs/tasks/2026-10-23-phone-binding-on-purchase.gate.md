# G2 门禁记录：购买前绑定手机号

- 日期：2026-10-23
- 任务卡：[2026-10-23-phone-binding-on-purchase.md](./2026-10-23-phone-binding-on-purchase.md)
- 契约：[2026-10-23-phone-binding.freeze.md](../contracts/2026-10-23-phone-binding.freeze.md)
- 结论：**通过**（全部门禁项绿；`format:check` 仅命中本任务之前已存在的无关文件，见 §3）

## 1. 客户端 / 根工程

| 命令                                   | 结果                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `pnpm lint`                            | 0 error / 0 warning                                     |
| `pnpm typecheck`                       | 通过                                                    |
| `pnpm test`                            | 8 文件 / 113 通过                                       |
| `node scripts/check-uvue-css.mjs`      | OK（34 个 .uvue，无受限原子类）                         |
| `node scripts/check-design-tokens.mjs` | 全绿（A–H 八项）                                        |
| `pnpm build:mp-weixin`                 | 构建成功（含新增 `ml-phone-bind-sheet`）                |
| `pnpm format:check`                    | 仅 `docs/issues/2026-10-16-mp-ux-backlog.md` 报格式问题 |

## 2. 服务端

| 命令                                         | 结果                              |
| -------------------------------------------- | --------------------------------- |
| `pnpm --filter @mentorloop/server typecheck` | 通过                              |
| `pnpm --filter @mentorloop/server test`      | 28 文件 / 209 通过（含新增 5 例） |
| `pnpm --filter @mentorloop/server build`     | 通过                              |

新增单测 [phone-bind.spec.ts](../../server/src/phone-bind.spec.ts) 覆盖：

1. 未登录访问 `/me/phone` → 401
2. 微信账号绑定成功、uid 不变、重复绑定幂等
3. 验证码错误 → 400 且手机号不落库
4. 手机号已属其他账号 → 409 / 业务码 40901，原归属不被覆盖
5. 未绑定下单 → 409 / 业务码 40902；绑定后下单成功

## 3. 已知偏差（非本任务引入，不阻断）

- `format:check` 命中 `docs/issues/2026-10-16-mp-ux-backlog.md`：该文件在本任务开始前已处于未提交修改状态（`git status` 可见），本任务未改动它，不做顺带格式化以免混淆提交范围。
- 真机联调项：小程序端需在体验版验证「未绑定 → 绑定半屏层 → 自动续接支付」「手机号冲突提示」两条路径；自动化无法覆盖微信支付拉起。

## 4. 契约双向核对

| 项                    | 客户端                           | 服务端                        | 一致 |
| --------------------- | -------------------------------- | ----------------------------- | ---- |
| `GET /me/phone` 出参  | `{ phone: string \| null }`      | `okData({ phone })`           | ✅   |
| `POST /me/phone` 入参 | `{ phone, code }`                | `schema` required phone/code  | ✅   |
| `POST /me/phone` 出参 | `{ phone: string }`              | `okData({ phone })`           | ✅   |
| 冲突错误              | 按 `e.code === 40901` 展示冲突态 | HTTP 409 + `fail(40901, ...)` | ✅   |
| 未绑定下单            | `PHONE_REQUIRED` → 打开绑定层    | HTTP 409 + `fail(40902, ...)` | ✅   |
| uid 归属              | 不覆盖 uid/token                 | 仅 UPDATE 当前 `users.id`     | ✅   |
