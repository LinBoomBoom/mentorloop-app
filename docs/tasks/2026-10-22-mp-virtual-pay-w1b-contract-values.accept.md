# 验收结论：W1b 虚拟支付契约取值

- 日期：2026-10-22
- 任务卡：[2026-10-22-mp-virtual-pay-w1b-contract-values.md](./2026-10-22-mp-virtual-pay-w1b-contract-values.md)
- 契约冻结：[2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md) §11（取值章节）
- 结论：**通过**。5 个道具取值已冻结，`skus.ts` 与后台逐字一致；结构未变，无新增端点。

## 1. 结果

| 项             | 结果                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| 后台道具       | 5/5 已发布现网（2026-10-22），线上版本列表可查                              |
| 自定义道具 ID  | 后台支持，5 个道具直接使用 skuId → `productId === skuId`                    |
| `skus.ts` 变更 | 新增 `wxProductId: string` 字段，5 个 SKU 全部回填                          |
| 价格一致性     | 3900 / 22800 / 2900 / 7900 / 2900 分，与后台 39 / 228 / 29 / 79 / 29 元一致 |
| 密钥           | `AppKey` 仅在云端变量 `MP_APP_KEY`；仓库零明文                              |
| 契约结构       | 未改（§1–§8 原样），仅追加 §11 取值                                         |
| 双签           | FE / BE 均已签（冻结单 §11.4）                                              |

## 2. 验收标准核验（对照任务卡 §4）

- [x] 冻结单含 5 条 `skuId → productId` 映射，与 W0 后台记录一致
- [x] `OfferID` 与 `AppKey` 仅登记键名与云端存放位置，明文不落仓库
- [x] `skus.ts` 的 `wxProductId` 字段命名与冻结单一致
- [x] 与 W0 截图/记录逐项比对记录入本验收记录（§1）

## 3. 代码改动

| 文件                                                                                             | 改动                                                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [server/src/data/skus.ts](../../server/src/data/skus.ts#L5-L63)                                  | `SkuSpec` 增 `wxProductId`；5 个 SKU 回填同名取值，含取值来源注释 |
| [docs/contracts/2026-10-21-virtual-pay.freeze.md](../contracts/2026-10-21-virtual-pay.freeze.md) | 追加 §11 取值（常量 / 密钥位置 / 映射表 / 双签 / 核验命令）       |

## 4. 门禁记录（G2 服务端）

| 检查         | 命令                                          | 结果                      |
| ------------ | --------------------------------------------- | ------------------------- |
| 类型检查     | `npx tsc --noEmit -p tsconfig.json`           | 通过（零错误）            |
| 单测（支付） | `npx vitest run src/services/payment.spec.ts` | 5/5 通过                  |
| 单测（全量） | `npx vitest run`                              | 23 files / **171 passed** |
| Lint         | `npx eslint src/data/skus.ts`                 | 无输出                    |

> 环境提示：本次首次运行因 `mammoth` / `pdfjs-dist` 未安装而失败（与本卡改动无关），已执行 `pnpm install --frozen-lockfile` 后复跑全绿。

## 5. 遗留 / 下一步

1. **W3 服务端下单**：`virtual-pay.ts` 从 `skus.ts` 取 `wxProductId` + `priceCent` 生成 `signData`，`paySig`/`signature` 双签名。
2. **生效时间**：道具 2026-10-22 发布，W3 联调前确认已过 10 分钟；报 `-15014` 属未生效而非签名错误。
3. **W5 客户端**：不改 `api/membership.uts` 的取值，`productId` 由服务端下发。
4. 道具改名须同步后台与 `skus.ts`，属契约取值变更，需重走 W1b 并在冻结单 §11 登记。

## 6. 签字

| 角色             | 结论       | 日期       |
| ---------------- | ---------- | ---------- |
| 审查 Agent（BE） | 通过       | 2026-10-22 |
| 审查 Agent（FE） | 通过       | 2026-10-22 |
| QA               | 待 W3 联调 |            |
