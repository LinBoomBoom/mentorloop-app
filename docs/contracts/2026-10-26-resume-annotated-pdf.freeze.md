# 契约冻结：简历批注版 PDF 导出

- 日期：2026-10-26
- 触发：批次 2 新增「批注版 PDF 导出」端点与客户端可见出参；任务卡 [2026-10-26-resume-annotated-pdf.md](../tasks/2026-10-26-resume-annotated-pdf.md)
- 父契约：[2026-10-21-resume-ai-review.freeze.md](./2026-10-21-resume-ai-review.freeze.md)（本单只做**增量**，父单不变项继续生效）
- 状态：已冻结
- 双签：服务端 ✓ / 客户端 ✓（2026-10-26，同一 Agent 按两端代码同步核对）

## 1. 变更内容

| 项   | 变更前                   | 变更后                                                                 |
| ---- | ------------------------ | ---------------------------------------------------------------------- |
| 端点 | 无批注导出               | 新增 `POST /resume/annotate`                                           |
| 出参 | 无                       | `ResumeAnnotateResult { fileID, expiresAt, issueCount, pages }`        |
| 依赖 | `pdf-lib` 仅用于测试     | 新增运行期依赖 `@pdf-lib/fontkit`；新增字体资产 `server/assets/fonts/` |
| 额度 | 完整评审 / 预览 / 单次包 | **零变更**：导出不新增计数、不扣次数                                   |

## 2. 端点契约（逐字）

```
POST /resume/annotate            （requireAuth；JSON）
请求体：{ "resumeId": string }
成功：{ code: 0, data: ResumeAnnotateResult }
错误：
  resumeId 缺失 / 非数字      → 400 '参数不合法'
  非本人 / 不存在             → 404 '简历不存在'（与 detail 统一措辞，防探测）
  mode='preview'              → 400 '完整评审后才能导出批注 PDF'（不生成文件、不扣额度）
  parse_payload 损坏 / 无 issues → 400 '该记录暂无可导出的批注'
  云存储不可用                → 503 '文件服务暂不可用，请稍后重试'
  生成超时 / 失败             → 500 '批注文件生成失败，请重试'
```

## 3. 类型（两端逐字段一致）

```ts
type ResumeAnnotateResult = {
  fileID: string // cloud:// 前缀；客户端直接用于预览/保存
  expiresAt: number // 临时下载链接过期时间（毫秒时间戳）；client 视为提示信息
  issueCount: number // 本次批注条数（= 记录中 issues.length）
  pages: number // 输出 PDF 总页数
}
```

## 4. 不变项（兼容性）

- `/resume/parse`、`/resume/history`、`/resume/detail`、`/resume/quota`、`DELETE /resume/detail`、`/resume/optimize` 的请求与出参**零变更**。
- `ResumeParseResult` / `ResumeIssue` / `ResumeQuota` 结构零变更；`locked` 语义不变。
- 额度表 `resume_usages` 不新增 `mode` 取值；导出不写该表。
- 删除记录时，`resumes/<uid>/` 下的原文件与批注文件一并 best-effort 清理。
- 批注文件路径固定为 `resumes/<uid>/annotated-<resumeId>.pdf`：同一记录重复导出覆盖同一对象，不堆积累积文件。
- 隐私口径不变：正文与批注内容不写日志；生成物仅写入用户自己的 `resumes/<uid>/` 前缀。

## 5. 双向核对矩阵

| 字段 / 行为                   | 服务端（`server/src/types/domain.ts`） | 客户端（`types/resume.uts`） | 一致 |
| ----------------------------- | -------------------------------------- | ---------------------------- | ---- |
| `ResumeAnnotateResult.fileID` | `fileID: string`                       | `fileID: string`             | ✓    |
| `expiresAt`                   | `expiresAt: number`                    | `expiresAt: number`          | ✓    |
| `issueCount`                  | `issueCount: number`                   | `issueCount: number`         | ✓    |
| `pages`                       | `pages: number`                        | `pages: number`              | ✓    |
| 404 措辞                      | `'简历不存在'`                         | 透传 `ApiError.message`      | ✓    |
| 预览态拒绝码                  | HTTP 400 + 上述文案                    | 展示文案、不出文件           | ✓    |
| 导出扣额度                    | 不调用 `reserve*` / `refund*`          | 不刷新额度                   | ✓    |

## 6. 回归验证清单

1. `POST /resume/annotate` 对 full 记录 → 200，`fileID` 以 `cloud://` 开头，`issueCount` 等于该记录 `issues.length`。
2. 同记录连续调用 3 次 → 三次均 200；`GET /resume/quota` 前后完全一致。
3. 预览态记录 → 400 且文案为「完整评审后才能导出批注 PDF」；`resume_usages` 无新增行。
4. 他人记录 / 不存在的 `resumeId` → 404「简历不存在」。
5. 生成物用 `pdfjs` 回读：末页文本包含首条 issue 的 `quote` 与 `suggested`。
6. 删除该记录后 `GET /resume/detail` → 404；云存储 `resumes/<uid>/annotated-*` 已清理（best-effort）。

## 7. 核验命令

```bash
cd server && npx vitest run src/resume-annotate.spec.ts
grep -n "resume/annotate" server/src/routes/misc.ts
grep -n "ResumeAnnotateResult" types/resume.uts server/src/types/domain.ts
```
