# 契约冻结：简历 AI 深度解析 / 历史 / 额度

- 日期：2026-10-21
- 触发：P1-2 简历解析由占位实现升级为真实抽取 + 证据锚定评审；新增历史与付费额度。任务卡：[2026-10-21-resume-ai-review.md](../tasks/2026-10-21-resume-ai-review.md)
- 状态：已冻结，批次 1 已实施（批注版 PDF 属批次 2，另行冻结）
- 双签：服务端 ✓ 客户端 ✓

## 变更内容

| 项       | 变更前                                       | 变更后                                                                                                                     |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 解析出参 | `ResumeParseResult` 6 字段，服务端固定假数据 | 增加 `resumeId/fileName/fileType/pages/issues/mode/cached/quota`；数据来自真实抽取                                         |
| 请求体   | `POST /resume/parse { fileUrl }`             | `{ fileUrl, position? }`；`position` 用于岗位匹配，可选                                                                    |
| 端点     | 无历史记录                                   | 新增 `GET /resume/history`、`GET /resume/detail`、`DELETE /resume/detail`、`GET /resume/quota`                             |
| 额度     | 简历解析无额度                               | 会员每月 5 次完整评审；单次包 3 次；免费每天 3 次确定性预览                                                                |
| 支付     | SKU 仅 member / single（面试场次）           | 新增 `resume_pack_3`（kind=`resume`，3 次，29 元）；`/membership/order` 形状不变                                           |
| DB       | `resumes` 无文件元信息；`users` 无简历额度   | `resumes` 增 `file_name/file_type/content_hash/position/mode`；`users` 增 `resume_single_total/used`；新增 `resume_usages` |
| 依赖     | 无文档抽取                                   | `pdfjs-dist`（PDF 文本+坐标）、`mammoth`（DOCX）、`pdf-lib`（批次 2 批注）                                                 |

## 端点契约（逐字）

```
POST /resume/parse            （requireAuth；JSON）
请求体：{ "fileUrl": string, "fileName": string?, "position": string? }
                              // fileUrl: cloud:// fileID（MP）；fileName 用于历史展示；position 用于岗位匹配
成功：{ code: 0, data: ResumeParseResult & { quota: ResumeQuota } }
错误：
  非本人 resumes/<uid>/ 路径             → 403 '无权访问该文件'（既有）
  文件类型不支持 / 超过 10MB / 超过 20 页 → 400（消息明确）
  扫描版 PDF（无文本层）                  → 400 '请上传可复制文本的 PDF'
  免费额度用尽                            → 403 '需要会员或单次包'（不扣额度）
  AI 未配置 / 超时                        → 503 'AI 服务暂不可用'（不扣额度）
```

```
GET /resume/history?limit=20   （requireAuth）
成功：{ code: 0, data: { items: ResumeHistoryItem[] } }
ResumeHistoryItem = { resumeId, fileName, fileType, createdAt, mode, issuesHigh, issuesTotal, projects, quantified }

GET /resume/detail?resumeId=   （requireAuth）
成功：{ code: 0, data: ResumeParseResult & { quota: ResumeQuota } }
非本人 / 不存在 → 404 '简历不存在'（统一措辞，防探测）

DELETE /resume/detail?resumeId=（requireAuth）
成功：{ code: 0, data: null }   // 删除记录 + 云上原文件（best-effort）

GET /resume/quota              （requireAuth）
成功：{ code: 0, data: ResumeQuota }
```

## 类型（两端逐字段一致）

```ts
type ResumeIssue = {
  issueId: string
  severity: 'high' | 'medium' | 'low'
  category: 'quantification' | 'ownership' | 'techMatch' | 'format' | 'language' | 'completeness'
  page: number // PDF 页码（1 起）；DOCX 为 0
  paragraph: number // DOCX 段落序号（0 起）；PDF 为 -1
  quote: string // 必须在原文中精确命中，否则该条丢弃
  original: string
  suggested: string
  reason: string
  needsUserEvidence: boolean
}

type ResumeParseResult = {
  resumeId: string
  fileName: string
  fileType: 'pdf' | 'docx'
  pages: number
  contact: boolean
  projects: number
  techStack: string[]
  quantified: boolean
  gaps: string[]
  formatRisks: string[]
  issues: ResumeIssue[]
  mode: 'full' | 'preview'
  cached: boolean
}

type ResumeQuota = {
  memberMonthlyTotal: number
  memberMonthlyLeft: number
  singleLeft: number
  freePreviewLeftToday: number
  canFull: boolean
}
```

## 不变项（兼容性）

- `/resume/optimize` 请求与出参零变更（旧投递版本入口保留）。
- 账号注销仍级联删除 `resumes` 行与云对象；新增字段一并清理。
- `POST /interview/asr-cloud`、`/interview/tts*` 零变更。
- 客户端 `uploadResumeFile` 签名不变；`parseResume` 增加可选 `position` 参数。
- 隐私红线：不记录简历正文到日志；LLM 请求前脱敏手机号/邮箱；用户可删除单条记录与注销。
- 额度扣减只在完整评审成功后发生；失败/缓存命中不计费。

## 核验命令

```bash
cd server && npx vitest run src/resume-extract.spec.ts src/resume-review.spec.ts src/resume-quota.spec.ts src/payment.spec.ts
grep -n "resume/history\|resume/detail\|resume/quota" server/src/routes/misc.ts
grep -n "resume_pack_3\|resume_single" server/src/data/skus.ts server/src/services/payment.ts server/src/schema.sql
grep -n "ResumeIssue\|ResumeQuota" types/resume.uts server/src/types/domain.ts
```
