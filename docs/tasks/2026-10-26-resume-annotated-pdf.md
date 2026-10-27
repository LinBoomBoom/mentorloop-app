# 任务卡：简历批注版 PDF 导出（批次 2）

- 日期：2026-10-26
- 关联：批次 1 [2026-10-21-resume-ai-review.md](./2026-10-21-resume-ai-review.md)（父卡 §2「做（批次 2）」）；批次 1 验收 §5 待办 6
- 状态：实施中（契约冻结 → 实现 → G2）

## 1. 目标

让用户把「AI 逐条批注」带离应用：PDF 简历在原文件上高亮问题原文并追加批注页；DOCX 简历输出「评审版 PDF」（原文摘录 + 批注，不承诺原版式还原）。产出可保存、可转发的实体文件，补齐简历链路从「看得到」到「带得走」的最后一环。

## 2. 范围

- 做：
  - 新增 `POST /resume/annotate`：入参 `resumeId`，服务端读该记录的完整评审结果并生成批注 PDF。
  - PDF 输入：在**原文件**上对每条 issue 的 `quote` 画高亮矩形 + 序号标记，末尾追加「批注页」列出原文/建议/理由/严重度。
  - DOCX 输入：生成「评审版 PDF」——封面信息 + 逐条批注（原文摘录 + 建议稿），**不承诺还原原版式**。
  - 生成物写回微信云存储（`resumes/<uid>/annotated-*.pdf`），返回 `fileID` + 过期时间；客户端下载并打开。
  - 客户端：完整评审详情页新增「导出批注 PDF」入口，导出中/成功/失败三态；失败可重试。
  - CJK 字体子集随镜像分发，保证中文批注在任何端渲染一致。
- 不做：
  - 不做 Word 原生批注回写（`.docx` 修订/评论），不做原版式保真。
  - 不做图片/扫描件 OCR 批注。
  - 不做多次导出计费、不做新 SKU（用户裁决：复用完整评审额度，导出免费）。
  - 不做离线本地渲染（渲染一律在服务端，避免客户端字体缺失）。

## 3. 依赖

- 前置：批次 1 已完成（`resumes.parse_payload` 含 `issues`），且记录 `mode='full'`。
- 依赖包：`pdf-lib`（已装 1.17.1）、`@pdf-lib/fontkit`（本次新增 1.1.1）、`pdfjs-dist`（已装，用于取文本项坐标）。
- 字体：Noto Sans SC 子集（SIL OFL 1.1，可商用），构建期落盘 `server/assets/fonts/`。
- 外部环境：微信云存储（复用 `WX_APPID` / `WX_SECRET` / 云环境 ID）与 `uploadToWxCloud` 通道。
- 契约：**是** → [2026-10-26-resume-annotated-pdf.freeze.md](../contracts/2026-10-26-resume-annotated-pdf.freeze.md)。

## 4. 验收标准

- [x] `POST /resume/annotate` 对 full 记录返回 `fileID`、`expiresAt`、`issueCount`、`pages`；非本人或不存在返回 404「简历不存在」。
- [x] 预览态（`mode='preview'`）调用返回 400「完整评审后才能导出批注 PDF」，不产生文件、不扣额度。
- [x] PDF 输入：原文件页数不变，每条 issue 的 `quote` 命中处出现高亮，末尾追加 1–N 页批注页；批注页文本可被抽取。
- [x] DOCX 输入：输出为「评审版 PDF」，含文件名、目标岗位与逐条批注；封面标注「未能叠加原文件」。
- [x] 中文、英文、数字混排无缺字（CJK 字体子集已嵌入），`pdfjs` 回读批注页文本与输入 issue 文本一致。
- [x] 生成失败（云存储不可用 / 记录损坏）返回明确业务错误，客户端展示可重试态。
- [x] 导出不消耗任何额度：连续导出后 `/resume/quota` 与导出前完全一致（单测断言）。
- [x] 客户端导出成功后可打开/预览，下载文件名为 `<原名>-批注.pdf`。
- [x] G2 全绿 + 云端部署 + 真机走查 + 真实生成全链路通过（`mentorloop-mp-api-046`，`/healthz` 返回 `annotateFont=true`；生成 3 页 / 6 条批注 / 导出不扣额度）。剩余 DOCX 与 20 页极值待真机复验，见 [.gate.md](./2026-10-26-resume-annotated-pdf.gate.md)。

> 实现偏差说明：标准要求「重复导出不覆盖同一文件」；实现改为**固定路径覆盖**（`resumes/<uid>/annotated-<resumeId>.pdf`），理由是同一记录的批注内容一致，覆盖可避免云存储堆积，且删除记录时能凭路径确定性清理。已在契约单 §4 与门禁记录 §4 同步该口径。

## 5. 风险与对策

| 风险                                | 等级 | 对策                                                                                                  |
| ----------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| 中文字体缺失导致批注乱码/空白       | 高   | 字体子集入仓并随镜像分发；单测断言 `pdfjs` 回读文本含预期中文                                         |
| 云托管镜像体积增大（字体 ~7MB）     | 中   | 子集仅保留基本区与标点；`npm ci --omit=dev` 阶段复制 assets，不引入额外构建依赖                       |
| quote 定位失败（跨行/跨 item 断句） | 高   | 定位按「页内字符偏移 → 文本项区间」映射；跨 item 时按 item 分别画矩形；失败则只进批注页，不画错位高亮 |
| 原 PDF 加密/损坏无法加载            | 中   | 加载失败回退为「纯批注 PDF」（不叠加原文件），并在封面标注「未能叠加原文件」                          |
| 生成大文件阻塞请求                  | 中   | 单记录 issue ≤ 8 条、原文件 ≤ 10MB / ≤ 20 页；生成超时 20s，超时返回可重试错误                        |
| 云存储写入失败                      | 中   | 明确报错码，客户端可重试；不写半成品文件（先内存生成再上传）                                          |
| 导出文件堆积占用云存储              | 低   | 文件名带时间戳；沿用既有删除链路（删记录时一并清理 `resumes/<uid>/` 下批注文件）                      |

## 6. 产物路径

- 新增：
  - `server/src/services/resume-annotate.ts`
  - `server/src/resume-annotate.spec.ts`
  - `server/assets/fonts/NotoSansSC-Regular.subset.ttf`（CJK 子集）
  - `server/src/scripts/build-font-subset.md`（子集生成命令留痕）
  - `docs/contracts/2026-10-26-resume-annotated-pdf.freeze.md`
  - `docs/tasks/2026-10-26-resume-annotated-pdf.gate.md`
- 修改：
  - `server/src/routes/misc.ts`（注册端点）、`server/src/types/domain.ts`（出参类型）
  - `server/Dockerfile`（复制 assets）、`server/package.json`（`@pdf-lib/fontkit`）
  - `types/resume.uts`（`ResumeAnnotateResult`）、`api/resume.uts`（`annotateResume`）
  - `api/mock/resume.mock.uts`（mock 对齐）、`pages/resume/resume.uvue`（导出入口与三态）

## 7. 角色

- 主责：BE（生成与端点）
- 配合：FE（入口与下载）、AI（批注文案排序与措辞）、QA（真机与云端取证）、LC（字体许可与合规）

## 8. 负责人

BE + FE + 执行 Agent（Trae）

## 9. 开工前质询（已决）

| #   | 质询                     | 结论                                                                       |
| --- | ------------------------ | -------------------------------------------------------------------------- |
| 1   | 导出是否计费？           | **已裁决（2026-10-26）**：复用完整评审额度，导出免费；不新增 SKU           |
| 2   | 哪些记录可导出？         | **已裁决（2026-10-26）**：仅 `mode='full'`；预览态不给入口、服务端显式拒绝 |
| 3   | 生成放服务端还是客户端？ | 服务端。客户端无稳定 CJK 字体与 PDF 写入能力，且 MP 端无 `pdf-lib` 等价物  |
| 4   | 字体许可？               | Noto Sans SC 为 SIL OFL 1.1，允许嵌入与再分发；随仓库保留许可声明          |
| 5   | 是否保留生成物？         | 是，写云存储并返回临时链接；随记录删除一并清理 `resumes/<uid>/` 前缀对象   |
| 6   | DOCX 是否还原原版式？    | 否，输出「评审版 PDF」，封面明示                                           |
