# 2026-10-27 当日工作汇报

> 覆盖范围：2026-10-26 夜间至 2026-10-27 凌晨，内容为「简历批注版 PDF（批次 2）」从契约冻结到云端上线。

## 1. 当日任务完成情况

| 任务                           | 状态       | 产物                                                                                                |
| ------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| 简历批注版 PDF（批次 2）任务卡 | 完成       | [2026-10-26-resume-annotated-pdf.md](./2026-10-26-resume-annotated-pdf.md)                          |
| 契约冻结单（双签）             | 完成       | [2026-10-26-resume-annotated-pdf.freeze.md](../contracts/2026-10-26-resume-annotated-pdf.freeze.md) |
| 服务端批注生成                 | 完成       | `server/src/services/resume-annotate.ts`、`server/src/resume-annotate.spec.ts`                      |
| CJK 字体子集入仓               | 完成       | `server/assets/fonts/NotoSansSC-Regular.subset.ttf`（16.9 MB → 2.32 MB）                            |
| 客户端导出入口与打开           | 完成       | `pages/resume/resume.uvue`、`api/resume.uts`、`types/resume.uts`                                    |
| G2 门禁                        | 完成，全绿 | [2026-10-26-resume-annotated-pdf.gate.md](./2026-10-26-resume-annotated-pdf.gate.md)                |
| 云端部署与 smoke               | 完成       | 线上 `mentorloop-mp-api-045`；`/healthz` 返回 `annotateFont=true`                                   |

## 2. 关键交付详情

### 2.1 功能口径（用户裁决）

- **导出免费**：复用完整评审额度，不新增 SKU、不扣次数；生成过程零 LLM 调用。
- **仅完整评审可导出**：预览态无入口，服务端显式 400 拒绝。
- **固定路径覆盖**：`resumes/<uid>/annotated-<resumeId>.pdf`，重复导出覆盖同一对象，删除记录时凭路径确定性清理。

### 2.2 服务端

- 新端点 `POST /resume/annotate`：`/^\d+$/` 校验 → 属主校验（`resumes.id + users.uid`）→ 模式校验 → 生成 → 写云存储。
- PDF 输入：原文件逐条 `quote` 定位并画高亮，序号与批注条目号一一对应；原文件不可读时降级为纯批注 PDF 并在封面标注。
- DOCX 输入：输出「评审版 PDF」（封面 + 逐条原文/建议/原因），不承诺原版式。
- 五类错误口径：400 参数不合法 / 404 简历不存在 / 400 预览不可导出 / 503 文件服务不可用 / 500 生成失败可重试。
- 生成超时 20s；字体缺失抛 `RESUME_ANNOTATE_FONT_MISSING`。

### 2.3 客户端

- 完整评审详情页新增「批注版 PDF」卡：生成中 / 已生成 / 失败重试三态。
- `openAnnotatedPdf` 走 `wx.cloud.downloadFile` → `wx.openDocument(showMenu: true)`，可保存与转发。
- 每次落新解析结果都重置导出态，避免沿用上一记录的 fileID。

### 2.4 门禁与线上核验

| 项                                                 | 结果                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 服务端单测                                         | 31 文件 / 247 用例（新增 10 例）                                                                                            |
| 客户端单测                                         | 8 文件 / 117 用例                                                                                                           |
| lint / format / typecheck / uvue 守卫 / token 守卫 | 全绿                                                                                                                        |
| 双端构建                                           | `build:mp-weixin` 与 `tsc` 均成功                                                                                           |
| 线上版本                                           | `mentorloop-mp-api-045`，规格 0.5C/1G、副本 0–2、端口 8787、访问策略三项未变                                                |
| EnvParams                                          | 25 键完整保留（`MP_PAY_MODE=virtual`、`LLM_MODEL=deepseek-v4-flash`、`ASR_PROVIDER=wx`）                                    |
| smoke                                              | `/healthz` 200 + `annotateFont=true`；`/resume/annotate` 无 token 401（路由已注册）；短信登录 400、微信缺 code 400 符合红线 |

## 3. 当日遇到的问题与解决思路

| 问题                                      | 根因                                                                       | 解决思路                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 中文字体原文件 16.9 MB，不适合入镜像      | Noto Sans SC 为可变字体，全量字形远超所需                                  | 按 GB2312 字符集（7542 字 + 常用标点）子集化，降到 2.32 MB，并先做嵌入 + 回读 POC 再落代码 |
| 高亮偏移可能错位                          | 先用 `join(' ')` 拼串、再 `normalizeText` 二次归一化，空格折叠导致下标漂移 | 构建字符表时即归一化（空白折叠 + 首尾去空白），`text` 下标与字符归属严格一一对应           |
| 高亮序号与批注页条目号对不上              | 初版按「命中顺序」累加编号                                                 | 改为按 issue 索引编号；同一条跨文本项时只在首个矩形左侧标一次                              |
| 重复 quote 相互覆盖                       | `locateQuoteOnPages` 返回 `Map`，同 key 覆盖                               | 改为返回与入参等长的数组，未命中为 `null`，重复 quote 各自独立                             |
| 线上必然缺字体                            | 运行阶段 Dockerfile 只复制 `dist`，`assets` 未随镜像分发                   | 构建与运行两阶段均 `COPY assets`；并在 `.dockerignore` 排除临时目录                        |
| 无法用部署日志确认字体是否就位            | `tcb cloudrun logs process` 只返回部署事件，读不到应用 stdout              | 在 `/healthz` 增加 `annotateFont` 布尔字段（向后兼容），一次 GET 即可核验镜像资产          |
| `pnpm test` 直接失败                      | 新增 `@pdf-lib/fontkit` 后 lockfile 过期，CI 默认 frozen                   | `pnpm install --no-frozen-lockfile` 同步 lockfile                                          |
| `format:check` 报「无法检查某文件」       | 我把云托管详情导出成 `.smoke-detail.json` 放在仓库根，被 Prettier 扫描     | 删除临时文件；约定运维中间产物不落仓库根                                                   |
| 首次回读详情时 EnvParams 明文进了工具日志 | 整段 `ConvertFrom-Json` 直接打印                                           | 改为 Python 解析后只输出白名单字段；同时把 SEC-3 凭据轮换的优先级再次上调                  |

## 4. 今日定版决策

1. **导出免费**：只做排版、不新增 LLM 调用，不触发成本卡 §14 红线 6（新增按次计费能力）。
2. **仅 full 可导出**：预览态 `suggested` 为空，导出会产出空洞批注，削弱付费动机。
3. **CJK 字体子集入仓**：Noto Sans SC 为 SIL OFL 1.1，允许嵌入与再分发；换来任何环境渲染一致。
4. **固定路径覆盖而非时间戳命名**：避免云存储堆积，且删除记录时可确定性清理。
5. **`/healthz` 增加 `annotateFont`**：把「资产是否随镜像分发」变成一次 GET 可验证的发布项。

## 5. 待办

- **真机走查（MP）**：上传 PDF → 完整评审 → 生成批注 → 打开/转发；验证 `wx.openDocument` 与中文字形观感。
- **真机走查（DOCX）**：确认输出评审版 PDF 且封面标注生效。
- **大文件极值**：20 页简历的生成耗时与容器 1G 内存占用。
- **App 端 `openDocument`**：本期 App 不上线，随 App 版本一并验证。
- **SEC-3 凭据轮换**：本次操作中 EnvParams 明文第三次进入工具日志，建议尽快轮换（`JWT_SECRET` 轮换会使已登录 token 失效，需单独窗口）。
