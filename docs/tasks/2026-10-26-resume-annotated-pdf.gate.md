# G2 质量门记录：简历批注版 PDF 导出（批次 2）

- 日期：2026-10-26（云端 smoke：2026-10-27）
- 任务卡：[2026-10-26-resume-annotated-pdf.md](./2026-10-26-resume-annotated-pdf.md)
- 契约冻结：[2026-10-26-resume-annotated-pdf.freeze.md](../contracts/2026-10-26-resume-annotated-pdf.freeze.md)
- 结论：**G2 通过，云端已部署并 smoke 通过**（版本 `mentorloop-mp-api-045`）。真机走查与一次真实生成待补，见 §5 / §8.4。

## 1. 命令与结果

| 检查        | 命令                                         | 结果                   |
| ----------- | -------------------------------------------- | ---------------------- |
| 客户端 Lint | `pnpm lint`                                  | 0 error / 0 warning    |
| 客户端格式  | `pnpm format:check`                          | 通过                   |
| 客户端类型  | `npx tsc --noEmit`                           | 通过                   |
| 客户端单测  | `pnpm test`                                  | 8 文件 / 117 用例全绿  |
| uvue 守卫   | `node scripts/check-uvue-css.mjs`            | OK（33 文件，0 违规）  |
| token 守卫  | `node scripts/check-design-tokens.mjs`       | A–H 全绿               |
| 服务端类型  | `pnpm --filter @mentorloop/server typecheck` | 通过                   |
| 服务端单测  | `npx vitest run`（server）                   | 31 文件 / 247 用例全绿 |
| 服务端构建  | `npx tsc -p tsconfig.json`                   | 通过                   |
| 小程序构建  | `pnpm build:mp-weixin`                       | DONE                   |

## 2. 关键可行性验证（实施前）

批次 2 的核心风险是「中文 PDF 渲染 + 原文高亮定位」。先做最小 POC 再落代码：

| 验证项           | 结果                                                              |
| ---------------- | ----------------------------------------------------------------- |
| CJK 字体嵌入     | `pdf-lib` + `@pdf-lib/fontkit` 嵌入 Noto Sans SC 子集成功         |
| 中文回读         | `pdfjs` 抽取出「简历批注 ①②③ 建议：主导订单系统重构…」逐字一致    |
| 原文定位         | 文本项 `transform` + `width` 计算字符比例，跨项短语可拆成多个矩形 |
| 高亮与批注页叠加 | 原 PDF 1 页 → 输出 2 页（原页高亮 + 批注页），页数符合预期        |

## 3. 字体体积治理

| 方案                        | 体积        | 采纳 | 说明                                       |
| --------------------------- | ----------- | ---- | ------------------------------------------ |
| Noto Sans SC 可变字体原文件 | 16.9 MB     | ✗    | 体积过大，不适合入镜像                     |
| 静态 Regular 全量           | 10.1 MB     | ✗    | 仍偏大                                     |
| CJK 基本区（U+4E00-9FFF）   | 7.16 MB     | ✗    | 覆盖广但冗余多                             |
| **GB2312 字符集子集**       | **2.32 MB** | ✓    | 7542 字 + 常用标点，覆盖简历中英文混排场景 |

产物：`server/assets/fonts/NotoSansSC-Regular.subset.ttf`（SIL OFL 1.1，允许嵌入与再分发）。

## 4. 实现要点与防护

| 项             | 实现                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| 端点           | `POST /resume/annotate`，入参 `resumeId`；`/^\\d+$/` 校验，非法返回 400「参数不合法」   |
| 属主校验       | 复用 `findOwnedRow`（`resumes.id + users.uid`），非本人 404「简历不存在」               |
| 仅 full 可导出 | `mode !== 'full'` → 400「完整评审后才能导出批注 PDF」；不生成文件、不写 `resume_usages` |
| 零额度消耗     | 全程不调用 `reserveFullReview` / `reservePreview` / `refundResumeQuota`                 |
| 原文件降级     | 原 PDF 不可读（加密/损坏/云存储不可用）→ 纯批注 PDF，封面标注「未能叠加原文件」         |
| 定位失败降级   | 未命中的 quote 不进高亮，只在批注页列出；封面提示「已定位 N 处」                        |
| 云存储覆盖     | 固定路径 `resumes/<uid>/annotated-<resumeId>.pdf`，重复导出覆盖，不堆积                 |
| 删除联动       | `deleteResumeRecord` 同时清理原文件与批注文件（best-effort）                            |
| 生成超时       | `ANNOTATE_TIMEOUT_MS = 20000`，超时返回可重试错误                                       |
| 镜像分发       | `Dockerfile` 构建与运行两阶段均 `COPY assets`；`.dockerignore` 排除 `.poc-tmp/`         |

## 5. 未完成项（人工 / 真机，阻断 G3）

| 项                    | 原因 / 下一步                                                             | 状态                      |
| --------------------- | ------------------------------------------------------------------------- | ------------------------- |
| 云端部署与可达性      | 见 §8.1 / §8.2                                                            | ✅ 已完成（`-045`）       |
| 中文字体线上分发      | `/healthz` 的 `annotateFont=true` 已证明镜像内字体可读                    | ✅ 已完成（观感仍需真机） |
| 真机走查（MP）        | 上传 PDF → 完整评审 → 生成批注 → 打开/转发；需验证 `wx.openDocument` 表现 | 待执行                    |
| 真机走查（DOCX）      | 同上，确认输出「评审版 PDF」且封面标注生效                                | 待执行                    |
| 一次真实生成（云端）  | 需真实 token + full 记录，脚本无法安全取得；随真机走查一并完成            | 待执行                    |
| 大文件真机表现        | 20 页 PDF 生成耗时与内存占用（本地 POC 未覆盖极值）                       | 待执行                    |
| App 端 `openDocument` | App 端 PDF 预览依赖系统能力，需真机确认                                   | 待执行（本期 App 不上线） |

## 6. 顺带发现与处置

| 发现                                                   | 处置                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 初始定位实现用 `normalizeText` 二次归一化，偏移会错位  | 改为构建字符表时即归一化（空白折叠 + 首尾去空白），`text` 下标与 `owners` 严格对应 |
| 初版高亮序号按「命中顺序」编号，与批注页条目号不一致   | 改为按 issue 索引编号；同一条跨项时只在首个矩形左侧标一次                          |
| 初版 `locateQuoteOnPages` 返回 Map，无法处理重复 quote | 改为返回与入参等长数组（未命中为 `null`），重复 quote 各自独立                     |
| 运行阶段 Dockerfile 只复制 `dist`，字体不会进镜像      | 补 `COPY --from=build /app/assets ./assets`                                        |

## 7. 产物

- 新增：`server/src/services/resume-annotate.ts`、`server/src/resume-annotate.spec.ts`、`server/assets/fonts/NotoSansSC-Regular.subset.ttf`、本记录
- 修改：`server/src/routes/misc.ts`、`server/src/server.ts`、`server/src/types/domain.ts`、`server/src/services/resume.ts`、`server/Dockerfile`、`server/.dockerignore`、`server/package.json`、`types/resume.uts`、`api/resume.uts`、`pages/resume/resume.uvue`

## 8. 云端部署与 smoke（2026-10-27）

### 8.1 部署

| 项        | 结果                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 命令      | `tcb cloudrun deploy --env-id prod-d6gaa83ds8accb61b --service-name mentorloop-mp-api --source . --port 8787 --min-num 0 --max-num 2 --open-access-types "OA,PUBLIC,MINIAPP" --wait --force --yes` |
| 在线版本  | `mentorloop-mp-api-045`（DeployId 045，100% 流量）                                                                                                                                                 |
| 规格      | 0.5C / 1G，副本 0–2，端口 8787（未变）                                                                                                                                                             |
| 访问策略  | `MINIAPP / OA / PUBLIC`（未变，公网仍可达）                                                                                                                                                        |
| EnvParams | 25 键完整保留；`MP_PAY_MODE=virtual`、`MP_OFFER_ID=1450672438`、`LLM_MODEL=deepseek-v4-flash`、`ASR_PROVIDER=wx`、`TTS_PROVIDER=tencent`                                                           |

> 三次部署（043 → 044 → 045）均未覆盖访问策略与副本规格，也未丢失环境变量。

### 8.2 可达性与红线 smoke

直连默认域名 `https://mentorloop-mp-api-324175-6-1501249243.sh.run.tcloudbase.com`：

| #   | 请求                                               | 结果                                                        |
| --- | -------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `GET /healthz`                                     | 200 `/ driver=mysql / annotateFont=true`                    |
| 2   | `POST /resume/annotate`（无 token）                | 401「未登录或登录已过期」→ **路由已注册**（未注册会是 404） |
| 3   | `POST /resume/annotate`（非法 resumeId，无 token） | 401（鉴权先于参数校验，符合预期）                           |
| 4   | `GET /resume/quota`（无 token）                    | 401                                                         |
| 5   | `POST /auth/sms-code`                              | 400「手机号登录暂不可用，请使用微信登录」（万能码红线保持） |
| 6   | `POST /auth/wechat`（无 code）                     | 400「缺少微信身份凭证」（正常）                             |
| 7   | `POST /membership/order`（无 token）               | 401                                                         |

### 8.3 字体分发验证（本次最大风险项）

应用 stdout 无法通过 `tcb cloudrun logs process` 读取（该命令只返回部署事件），因此改为在 `/healthz` 出参加 `annotateFont` 字段：

- 实现：`annotateFontStatus()` 检查 `assets/fonts/NotoSansSC-Regular.subset.ttf` 是否可读，`/healthz` 返回布尔值；
- 实测：部署 045 后 `annotateFont=true`，**证明字体已随镜像分发且运行时可读**；
- 该字段为向后兼容的新增键，长期保留用于发布核验（不需要每次跑一次导出才能发现资产缺失）。

### 8.4 未覆盖（需真机或授权数据）

| 项                     | 原因                                                                                          | 下一步                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 真实生成一次批注 PDF   | 云端仅保留微信登录；`POST /resume/annotate` 需要真实用户 token 与 full 记录，脚本无法安全取得 | 真机走查时顺带完成（生成 → 打开 → 转发）     |
| 云端中文字形实际观感   | 字体可读已验证，但字形排版需肉眼确认                                                          | 真机导出后查看批注页                         |
| 20 页大文件耗时与内存  | 本地未覆盖极值；容器 1G 内存                                                                  | 真机用大简历实测，必要时降至 10 页或提高内存 |
| DOCX → 评审版 PDF 真机 | 需真实 DOCX 与登录态                                                                          | 真机走查第二例                               |
