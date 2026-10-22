# 剩余未完成任务明细报告（2026-10-22）

- 性质：**现状盘点报告**（不新建需求、不替代任务卡）
- 基线：`main` @ `a34a946`，工作区干净，与 `origin/main` 同步
- 口径：仅列入任务卡、验收记录、问题台账与代码中可取证的事项；未证实事项标注「待核实」
- 关联：[系统问题清单](./2026-10-21-system-issue-inventory.md) · [虚拟支付父卡](./2026-10-21-mp-virtual-payment-feasibility.md) · [体验缺陷台账](../issues/2026-10-16-mp-ux-backlog.md)

## 0. 结论先行

主干链路「简历 → 面试 → 报告 → 训练 → 支付」已闭环，P0 缺口已于 2026-10-15 清空。剩余任务分四类：

1. **代码已完成、验收未收口**：W6 虚拟支付测试验收、专项训练线上题库切换、设备检测去伪；
2. **明确待启动**：简历 AI 评审批次 2（批注版 PDF）、提示词质量评测；
3. **延期决策 / 外部等待**：D1–D5 成本与定价、云端部署与平台测试推送、iOS IAP；
4. **发布前红线与体验债**：万能验证码、TLS 放宽、凭据轮换、TTS 截断，以及 U4–U10 / M1–M2 台账项。

## 1. 总览表

| ID    | 优先级 | 任务                           | 当前状态                               | 剩余动作                                      | 主责       | 截止 / 依赖          |
| ----- | ------ | ------------------------------ | -------------------------------------- | --------------------------------------------- | ---------- | -------------------- |
| W6    | P0     | 虚拟支付测试与真单验收         | 代码就绪，无 `.gate.md` / `.accept.md` | 小额真单、推送发货、幂等、部署、对账          | QA + BE/FE | 需先部署 W2–W5       |
| TRN   | P1     | 专项训练接入线上题库           | 代码已落地（`17b98ae`），验收 5 项未勾 | 跑 G2、真机核验题源、补验收记录               | FE         | 无                   |
| DEV   | P1     | 设备检测去伪与录音自检         | 实施 + G2 完成（`a34a946`）            | 真机取证 3 项                                 | QA + FE    | 真机                 |
| RES-2 | P1     | 简历评审批次 2：批注版 PDF     | 未启动                                 | 契约冻结 → 实现 → 验收                        | BE + AI    | 需新增冻结单         |
| RES-Q | P2     | 简历提示词质量人工评测         | 未启动                                 | 10–20 份真实简历评分                          | AI + 内容  | 真实样本             |
| D1    | P1     | 会员公平使用阈值               | 待 PO 签字                             | 拍板 60 场 / 深度 20 场（建议值）             | PO         | 2026-10-29           |
| D3    | P2     | 云端模型名迁移                 | 代码侧告警已就绪                       | 云端 `LLM_MODEL=deepseek-v4-flash`            | BE         | 下次部署             |
| D4    | P2     | MySQL 计费形态核对             | 待账单                                 | 核对按量/常驻，评估降配                       | BE         | 2026-11-15           |
| D5    | P1     | 税务与申报口径                 | 待外部结论                             | LC / 税务师出具口径                           | LC         | 2026-11-30（提审前） |
| ASR-B | P3     | 微信 ASR 是否计费              | 待账单                                 | 账单复核，修正成本模型                        | BE         | 2026-11-15           |
| SEC-1 | P0     | 云端万能验证码                 | 代码守卫已具备，云端待整改             | 改随机 `MOCK_SMS_CODE` 并关闭放行阀           | BE/DevOps  | 发布前               |
| SEC-2 | P2     | 微信域名 TLS 放宽              | 仍存在                                 | 取证书链 → `NODE_EXTRA_CA_CERTS` → 删放宽分支 | BE         | 无                   |
| SEC-3 | P2     | 凭据轮换                       | 未执行                                 | 轮换 `WX_SECRET` / 云密钥 / `JWT_SECRET` 等   | BE/DevOps  | 发布前               |
| TTS-1 | P3     | TTS 超长文本静默截断           | 仍存在                                 | 分句合成或换长文本接口                        | BE         | 追问变长后触发       |
| UX-1  | P1     | 报告空态深链落点无意义（U4）   | 未修                                   | 空态提供可执行落点                            | FE + UX    | 下一轮               |
| UX-2  | P1     | 首页两入口同一落点（U5）       | 未修                                   | 入口语义拆分（PO 取舍）                       | FE + PO    | 下一轮               |
| UX-3  | P2     | 平均等级空值无解释（U6）       | 未修                                   | 文案 / 空值统一                               | FE         | 随发布               |
| UX-4  | P2     | 域名白名单与控制台噪音（U7）   | 未修                                   | 发布前配置合法域名                            | DevOps     | 发布前               |
| UX-5  | P3     | `loader-circle` 字形缺失（U8） | 仍存在                                 | 换图标或补字形                                | FE         | 独立小卡             |
| UX-6  | P2     | E2E 种子被真实后端覆盖（U10）  | 已临时跳过                             | 固定 mock 或种子后置                          | QA         | 无                   |
| E2E-1 | P2     | 页面巡检脚本（M1）             | 未做                                   | automator 遍历 + 快照                         | QA         | 无                   |
| E2E-2 | P2     | 五态用例矩阵（M2）             | 未做                                   | 空/加载/错误态矩阵                            | QA + UX    | 无                   |
| REL-1 | P0     | 云端部署 W2–W5                 | 线上仍旧包                             | 部署、回读变量、健康检查                      | BE/DevOps  | W6 前置              |
| REL-2 | P1     | 消息推送平台测试               | 未执行                                 | 平台「测试推送」返回 `ErrCode=0`              | BE         | 依赖 REL-1           |
| REL-3 | P1     | iOS IAP 真单                   | 外部开通中                             | IAP 生效后真机支付                            | QA         | 外部                 |
| REL-4 | P1     | App 两端真机编译验证           | 未验                                   | Android / iOS 真机验证                        | FE + QA    | 无                   |
| REL-5 | P2     | 合规公示项                     | 部分完成                               | 备案与协议链接核验                            | PO + LC    | 提审前               |
| CNT-1 | P3     | AI 工程方向置灰                | `available: false`                     | 核对内容库四方向覆盖后翻转                    | FE + 内容  | 待核实               |

## 2. 分组明细

### 2.1 支付批次：仅剩 W6

- **现状**：W0 凭据与 5 个道具已完成；W1a 冻结双签；W1b 取值完成；W2 `session_key` 完成；W3 下单签名、W4 推送/查单/退款、W5 客户端拉起均已签收。父卡 §15 明确「仅剩 W6」。
- **未完成证据**：`docs/tasks/` 下无 `2026-10-22-mp-virtual-pay-w6-test-acceptance.gate.md` 与 `.accept.md`。
- **待办**（对照 [W6 卡 §4](./2026-10-22-mp-virtual-pay-w6-test-acceptance.md)）：
  1. 服务端单测全绿（含签名、回调、查单新增用例）；
  2. Android 小额真单：`single_pack_3`（2900 分）→ 平台推送 → `query_order` 发货 → 账本一致；
  3. 重复推送、伪造推送均不重复发放；
  4. `MP_PAY_MODE=mock` 回归；
  5. App v3 JSAPI 回归（下单带 `platform='app'`）；
  6. 云端 `MP_PAY_MODE=virtual` 回读，禁止默认 mock 上线；
  7. G2 门禁 + `.gate.md` / `.accept.md`。
- **前置阻塞**：
  - 线上仍运行旧版本，W2–W5 代码未部署；`/membership/virtual/notify` 在旧包上会 404（见 [W4 验收 §4.1](./2026-10-22-mp-virtual-pay-w4-callback-query-refund.accept.md#L54-L63)）；
  - 平台「测试推送」需部署后执行；
  - iOS 真单依赖 IAP 开通（外部）。
- **回退口径**：`MP_PAY_MODE=mock` 可立即恢复下单即发放，无需回滚代码。

### 2.2 专项训练接入线上题库

- **现状**：代码已落地（提交 `17b98ae`）。客户端 [api/training.uts](../../api/training.uts) 调用 `POST /training/questions`；服务端 [routes/training.ts](../../server/src/routes/training.ts) 已注册；[room.uvue](../../pages/training/room.uvue#L326) 已改为进入时拉题；静态题库仅测试夹具引用。
- **未完成**：任务卡 5 条验收标准全部未勾，且无 `.gate.md` / `.accept.md`（见 [卡 §4](./2026-10-22-training-online-question-bank.md#L32-L38)）。
- **待办**：
  1. `pages/` / `engine/` / `api/` / `server/src/{routes,services,rules}` 无 `data/question-bank` 业务引用（当前静态引用仅在测试与 `env.d.ts` 声明）；
  2. 真机确认训练题 id 来自内容库，而非 `q-k01` / `f-k01`；
  3. 拉题失败或无题时提示明确且不扣训练额度；
  4. mock 模式明确报错、不返回本地静态题；
  5. 双端 `pnpm test`、`build:mp-weixin`、设计 token 机检通过。

### 2.3 设备检测去伪与录音自检

- **现状**：实施与 G2 已记录（提交 `a34a946`）；prep 四项检测、录音落盘非空校验、扬声器回放试音、监听注销、iOS `obeyMuteSwitch=false`、房间录音空文件与转写为空分流均已完成。
- **未完成**：真机取证，见 [卡 §10](./2026-10-22-voice-device-check-truthfulness.md#L73-L81)：
  1. 录音 → 回放试音全链路；
  2. iOS 开启静音键后仍能回放与念题；
  3. 进入房间录音不再被检测残留监听提前 `stop()`；
  4. 真机日志中的录音字节数符合预期。

### 2.4 简历 AI 评审

- **已完成**：批次 1（真实 PDF/DOCX 抽取、证据锚定评审、历史、额度、缓存、云端联调）已通过。
- **未完成**（见 [验收 §5](./2026-10-21-resume-ai-review.accept.md#L59-L68)）：
  1. 真机走查：上传 → 完整评审 → 历史回看 → 删除 → 付费包购买；
  2. 真实 DOCX 样本验证段落锚点与建议质量；
  3. **批次 2：批注版 PDF 导出**（PDF 高亮批注；DOCX 输出评审版 PDF），需另立契约冻结；
  4. 10–20 份真实简历的人工评测（可执行性 / 无幻觉 / 岗位相关性）；
  5. 发布前密钥轮换（与 SEC-3 合并执行）。

### 2.5 成本与定价决策

| 项                  | 结论 / 建议                            | 状态                                   |
| ------------------- | -------------------------------------- | -------------------------------------- |
| D1 会员公平使用阈值 | 建议 60 场 / 深度 20 场                | **待 PO 2026-10-29 前签字**            |
| D2 TTS 音色锁定     | `APPROVED_TTS_VOICE_TYPES=[101001]`    | ✅ 已实施（随 W3）                     |
| D3 模型迁移         | 改用 `deepseek-v4-flash`               | 代码告警已就绪，**云端变量待下次部署** |
| D4 MySQL 计费形态   | 常驻算力约 246 元/月，占固定成本约 85% | **待 2026-11-15 账单核对**             |
| D5 税率与申报       | 个人主体口径                           | **待 2026-11-30 前 LC 出具**           |
| ASR 计费            | 暂按 0 计                              | **待 2026-11-15 账单复核**             |

> 单位经济结论：单场变动成本约 0.02 元，各 SKU 毛利率 > 94%；风险在会员重尾、音色误配与固定成本，不在单场成本（见 [成本卡](./2026-10-22-cost-and-pricing-decision.md)）。

### 2.6 系统安全与技术债

| 项               | 现状（代码取证）                                                                                                                                                          | 剩余动作                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| P0-1 万能验证码  | [config.ts#L123-L135](../../server/src/config.ts#L123-L135) 支持 `MOCK_SMS_CODE` + `ALLOW_WEAK_SMS_CODE` 放行；[config.ts#L215](../../server/src/config.ts#L215) 启动告警 | 云端改随机验证码并删除放行阀；写进发布 checklist               |
| P2-5 TLS 放宽    | [wx-http.ts#L67](../../server/src/services/wx-http.ts#L67) 仍 `rejectUnauthorized:false`                                                                                  | 抓取网关证书链 → `NODE_EXTRA_CA_CERTS` → 删除放宽分支          |
| P3-8 TTS 截断    | [tts.ts#L13](../../server/src/services/tts.ts#L13) / [#L36](../../server/src/services/tts.ts#L36) 超 200 字直接截断                                                       | 按句切分多次合成，或改长文本接口                               |
| P3-9 凭据轮换    | 联调期间出现过明文                                                                                                                                                        | 轮换云密钥、`WX_SECRET`、`JWT_SECRET`、`MYSQL_PASSWORD` 并回写 |
| P2-7 旧 ASR 接口 | 失败已诚实降级                                                                                                                                                            | 观察限流/下线公告，触发即切腾讯云 ASR                          |

### 2.7 体验与自动化台账

来源：[2026-10-16-mp-ux-backlog.md](../issues/2026-10-16-mp-ux-backlog.md)。该台账未随之后改动回写，以下为 2026-10-22 抽验结果：

| 项                  | 抽验结论 | 证据 / 说明                                                                                                                      |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| U4 报告空态深链     | 仍存在   | 分段意图已消费（[report.uvue#L433](../../pages/report/report.uvue#L433)），但空态仍只有「暂无报告」                              |
| U5 两入口同落点     | 仍存在   | 「累计面试」「平均等级」均 `@click="goResults"`（[index.uvue#L120-L129](../../pages/index/index.uvue#L120-L129)）                |
| U6 平均等级 `-`     | 未修     | 空值无解释文案                                                                                                                   |
| U7 域名与控制台噪音 | 未修     | 发布前需配合法域名白名单                                                                                                         |
| U8 图标字形缺失     | 仍存在   | [resume.uvue#L66](../../pages/resume/resume.uvue#L66) 使用 `loader-circle`，[icon-font.uts](../../styles/icon-font.uts) 无该字形 |
| U9 未登录入口不一致 | **已修** | [mine.uvue#L304](../../pages/mine/mine.uvue#L304) 已改登录半屏层                                                                 |
| U10 E2E 种子被覆盖  | 根因未修 | [scenarios.mjs#L5](../../e2e/mp/scenarios.mjs#L5) 当前为「数据缺失即显式跳过」                                                   |
| M1 页面巡检脚本     | 未做     | 建议 automator 遍历 + `page.data()` 快照                                                                                         |
| M2 五态用例矩阵     | 未做     | 空态 / 加载态 / 错误态覆盖不足                                                                                                   |

> U1–U3（首页底部操作区、首启画像、参数卡可编辑）已于 2026-10-16 交付；台账「待处理」区未回写。

### 2.8 发布与平台收口

- **REL-1 云端部署**：W2–W5 未上线，是 W6 与推送验证的硬前置；
- **REL-2 平台测试推送**：部署后验证 `<ErrCode>0</ErrCode>`；
- **REL-3 iOS IAP**：PO 开通中，真机支付待生效；
- **REL-4 App 真机编译**：闭环计划登记「小程序编译已通，Android / iOS 未验」；
- **REL-5 合规公示**：数据自助删除已落地，备案与协议链接未核；
- **CNT-1 AI 方向置灰**：[position-options.uts#L22](../../data/position-options.uts#L22) 仍 `available: false`，但内容库已覆盖四方向，需确认是否漏翻。

## 3. 建议执行顺序

1. **P0 收口**：部署 W2–W5 → 回读 `MP_PAY_MODE=virtual` → 平台测试推送 → W6 小额真单与对账；同步完成 SEC-1 云端验证码整改。
2. **P1 验收留痕**：专项训练 G2 + 真机；设备检测真机三项；简历批次 1 真机走查。
3. **P1 决策**：D1 阈值签字；D5 税务口径；U4 / U5 体验取舍。
4. **P2 开发**：简历批注版 PDF（先冻结契约）、U6 / U7 / U10 / M1 / M2、SEC-2 / SEC-3。
5. **P3 边界**：TTS 截断、U8 图标、AI 方向置灰核实。

## 4. 已闭环基线（不再列入待办）

- 语音链路：ASR 上行、TTS 播报、TTS ack 与对象回收、录音 55s 上限、`cloud://` 属主校验；
- 简历批次 1：真实抽取、证据锚定评审、缓存、额度、历史与删除、云端联调；
- 支付：W0 / W1a / W1b / W2 / W3 / W4 / W5；
- 设计系统重做、IA 收敛（4 tab）、UI 系统统一、首启画像、首页减负、跨 tab 分段深链；
- P0 闭环缺口 4 项（2026-10-15 复核）。

## 5. 核对方法与证据索引

- 代码：`server/src/config.ts`、`server/src/services/{wx-http,tts}.ts`、`server/src/routes/training.ts`、`api/training.uts`、`pages/{training/room,index/index,report/report,resume/resume,mine/mine}.uvue`、`e2e/mp/scenarios.mjs`；
- 任务与验收：`docs/tasks/2026-10-22-mp-virtual-pay-*`、`docs/tasks/2026-10-22-training-online-question-bank.md`、`docs/tasks/2026-10-22-voice-device-check-truthfulness.md`、`docs/tasks/2026-10-21-resume-ai-review.accept.md`、`docs/tasks/2026-10-21-system-issue-inventory.md`、`docs/tasks/2026-10-22-cost-and-pricing-decision.md`；
- 台账与计划：`docs/issues/2026-10-16-mp-ux-backlog.md`、`docs/closure-development-plan.md`、`docs/tasks/2026-10-21-mp-virtual-payment-feasibility.md`。
