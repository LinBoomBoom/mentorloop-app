# 契约冻结单：简历免费预览有证据诊断（previewIssues）

- 日期：2026-10-24
- 关联任务卡：[2026-10-24-resume-free-value-funnel.md](../tasks/2026-10-24-resume-free-value-funnel.md)
- 类型：出参新增字段（`types/` 与服务端出参变更，无新增端点）
- 状态：**已冻结（FE / BE 双签，2026-10-26）**

## 0. 随方案落定的决策

| 决策     | 结论                                                                |
| -------- | ------------------------------------------------------------------- |
| 免费深度 | 最多 3 条诊断；首条给完整改写，其余锁定                             |
| 锁定实现 | 服务端不下发 locked 条目的 `suggested`，客户端只做占位              |
| 预览缓存 | 同 user + 文件 hash + 岗位命中缓存时不调 LLM、不扣每日预览次数      |
| 失败回退 | LLM 未配置 / 超时 / 失败 → 结构预览（`previewIssues=[]`），HTTP 200 |
| 历史去重 | preview → full 更新同一行，`resumeId` 不变                          |
| 旧端兼容 | `previewIssues` 为增量字段；`issues` 语义不变（仅付费完整评审）     |

## 1. 端点变更

| 端点              | 方法 | 变更                                                    |
| ----------------- | ---- | ------------------------------------------------------- |
| `/resume/parse`   | POST | 出参新增 `previewIssues`；预览态 `cached` 可能为 `true` |
| `/resume/detail`  | GET  | 出参新增 `previewIssues`（预览记录回放）                |
| `/resume/history` | GET  | 不变                                                    |
| `/resume/quota`   | GET  | 不变                                                    |

无新增端点、无新增业务码。

## 2. 端点契约（逐字）

```
POST /resume/parse                 （requireAuth；JSON：{ fileUrl, fileName, position }）
成功（免费预览，mode='preview'）：
{
  "code": 0,
  "data": {
    "resumeId": string,
    "fileName": string,
    "fileType": "pdf" | "docx",
    "pages": number,
    "contact": boolean,
    "projects": number,
    "techStack": string[],
    "quantified": boolean,
    "gaps": string[],
    "formatRisks": string[],
    "issues": [],
    "previewIssues": [
      {
        "issueId": string,
        "severity": "high" | "medium" | "low",
        "category": "quantification" | "ownership" | "techMatch" | "format" | "language" | "completeness",
        "page": number,
        "paragraph": number,
        "quote": string,          // 必须逐字命中原文
        "original": string,
        "suggested": string,      // 首条非空；locked 条目为空串
        "reason": string,
        "needsUserEvidence": boolean,
        "locked": boolean         // [0] = false；[1..] = true
      }
    ],
    "mode": "preview",
    "cached": boolean,          // 预览缓存命中时为 true
    "quota": { ...不变 }
  }
}
规则：
  - previewIssues 长度 1–3；无可用问题时为空数组（不等于请求失败）
  - issues 在 preview 恒为 []
  - locked=true 的条目不返回 suggested（防绕过）

成功（完整评审，mode='full'）：
  - issues: 0–8 条，全部 locked=false
  - previewIssues: []
```

```
GET /resume/detail?resumeId=...    （requireAuth）
成功：与 /resume/parse 相同的 result 形状（含 previewIssues / issues / mode / cached）
  - 旧记录（2026-10-24 前落库）→ previewIssues 回填 []；issues 补齐 locked=false
```

## 3. 业务码新增

无。预览 AI 失败不新增错误码，静默回退结构预览。

## 4. 字段 diff

| 字段                              | 变更前       | 变更后                                | 端              |
| --------------------------------- | ------------ | ------------------------------------- | --------------- |
| `ResumeIssue.locked`              | 不存在       | `boolean`，必填                       | server → client |
| `ResumeParseResult.previewIssues` | 不存在       | `ResumeIssue[]`，必填（full 时 `[]`） | server → client |
| preview `issues`                  | `[]`         | 仍为 `[]`（语义不变）                 | server → client |
| preview `cached`                  | 恒 `false`   | `boolean`（命中预览缓存为 `true`）    | server → client |
| `resume_usages` preview 记录      | 每次预览新增 | 缓存命中不新增                        | server 内部     |
| `resumes.parse_payload`           | 存 `issues`  | 另存 `previewIssues`（旧记录回填）    | server 内部     |

## 5. 影响面

- 客户端：`types/resume.uts`（类型）、`api/resume.uts`（透传，不改端点）、`api/mock/resume.mock.uts`（Mock 对齐）、`pages/resume/resume.uvue`（诊断摘要 / 锁态 / 自动续跑）、`pages/resume/detail.uvue`（locked 回放）
- 服务端：`server/src/types/domain.ts`、`services/resume.ts`（预览编排 / 缓存 / 去重历史）、`services/resume-review.ts`（预览 prompt 与输出裁剪）、`routes/misc.ts`（出参透传 / 旧记录回填）
- 数据：`resumes.parse_payload` 新增 `previewIssues` 字段；无表结构变更
- 额度：`resume-quota.ts` 口径不变（预览每日 3 次；缓存命中不计次）
- 成本：新增免费预览 LLM 调用点，需在 [成本与定价决策](../tasks/2026-10-22-cost-and-pricing-decision.md) §11 补行
- 支付 / 会员：不变

## 6. 双向核对矩阵

| 项                                | 客户端（`types/resume.uts`）    | 服务端（`types/domain.ts`） | 一致 |
| --------------------------------- | ------------------------------- | --------------------------- | ---- |
| `ResumeIssue.locked`              | `boolean`，必填                 | `boolean`，必填             | ✅   |
| `ResumeParseResult.previewIssues` | `ResumeIssue[]`，必填           | `ResumeIssue[]`，必填       | ✅   |
| preview `issues`                  | `[]`                            | `[]`                        | ✅   |
| preview `cached`                  | `boolean`（缓存命中 `true`）    | `boolean`                   | ✅   |
| `locked` 条目                     | 只做占位，不渲染 `suggested`    | 不下发 `suggested`（空串）  | ✅   |
| 出参形状                          | `ResumeParseResult & { quota }` | `okData(result + quota)`    | ✅   |

## 7. 回归验证清单（G2 依据）

- [ ] `previewIssues` 长度 1–3；`[0].locked=false` 且 `suggested` 非空；其余 `locked=true` 且 `suggested=''`。
- [ ] 每条 `previewIssues[].quote` 均命中原文（复用 `validateIssues`）。
- [ ] preview 态 `issues=[]`；full 态 `previewIssues=[]`。
- [ ] LLM 未配置 / 超时 / 失败 → `previewIssues=[]`、HTTP 200、不扣额度。
- [ ] 同 user + hash + 岗位二次预览 → `cached=true`，不调 LLM、不新增 `resume_usages` preview 行。
- [ ] 同 user + hash + 岗位 preview→full 更新同一行，`resumeId` 不变，历史仅一条。
- [ ] 旧记录（2026-10-24 前）读 `detail` → `previewIssues=[]` 且 `issues[].locked=false` 补齐。

## 8. 双签

| 角色 | 签署       | 结论 |
| ---- | ---------- | ---- |
| FE   | 2026-10-26 | 同意 |
| BE   | 2026-10-26 | 同意 |

> 双签完成，可进入编码；G2 阶段按本单逐字核对出参字段。
