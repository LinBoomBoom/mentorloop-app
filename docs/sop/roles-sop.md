# 角色体系与协作 SOP

生成日期：2026-09-24
归属：SOP 系统 L0 治理层 · 角色职责
上游：[README.md](./README.md)；相关：`task-card-sop.md`（G1）、`admission-sop.md`（G3）、`release-sop.md`（G4）

---

## 1. 目的与适用

定义参与研发全流程的角色、职责、产物与门禁责任，使**每个 SOP 环节都有明确责任人**。小团队可兼任，但关键责任不可省略。

---

## 2. 角色目录

| 代号      | 角色           | 核心职责                                                     | 主要产物                         | 主责门禁 |
| --------- | -------------- | ------------------------------------------------------------ | -------------------------------- | -------- |
| **PO**    | 产品负责人     | 范围与优先级、验收裁决、里程碑出口、冻结决策变更             | 决策记录、里程碑评审结论         | G1 / G4  |
| **MP-PM** | 小程序产品经理 | 小程序端需求、微信平台特性、包体积与审核合规、登录与分享路径 | 小程序需求规格、页面流、审核材料 | G1       |
| **FA**    | 可行性分析师   | 技术可行性验证、官方文档核实、POC、版本兼容、风险登记        | 可行性结论、POC 报告、风险条目   | G1 / G4  |
| **UX**    | UI/UX 设计师   | 信息架构、交互、视觉系统、无障碍、设计走查                   | 设计稿、设计评审结论             | G3       |
| **FE**    | 客户端工程师   | uvue / UTS / 状态机 / 感知层 / 原生插件                      | 客户端代码 + 单测                | G2       |
| **BE**    | 后端工程师     | Fastify 服务、契约、幂等、配额账本、支付                     | 服务端代码 + 单测                | G2       |
| **AI**    | AI 工程师      | 能力图谱、选题、追问、评分、报告、评测集                     | 引擎逻辑、评测报告               | G2 / G4  |
| **CO**    | 内容运营       | 题库 / 图谱 / 评分量表的审核与上新、去重与质量审查           | 审核记录                         | G1       |
| **QA**    | QA / DevOps    | 测试策略、门禁执行、验收准入、监控告警、发布准入             | 验收结论、发布准入单             | G3 / G4  |
| **LC**    | 合规 / 法务    | 备案、隐私政策与协议、算法评估、支付与税务                   | 合规台账                         | G4       |

---

## 3. 角色 × 阶段 RACI

> A=最终负责，R=执行，C=需咨询，I=需知会。**按任务类型裁剪**：纯前端任务可省略 BE/AI/CO，纯内容任务可省略 FE/BE。

| 阶段   | PO    | MP-PM | FA  | UX  | FE    | BE    | AI    | CO  | QA      | LC  |
| ------ | ----- | ----- | --- | --- | ----- | ----- | ----- | --- | ------- | --- |
| ① 定义 | **A** | R     | R   | C   | C     | C     | C     | C   | I       | I   |
| ② 构建 | I     | C     | C   | R   | **R** | **R** | **R** | R   | I       | I   |
| ③ 验证 | C     | C     | C   | R   | R     | R     | C     | C   | **A**   | C   |
| ④ 交付 | C     | C     | I   | I   | R     | R     | I     | I   | **A/R** | R   |

---

## 4. 角色 × 门禁职责

| Gate          | 主责                   | 配合                                                       | 判定依据                                     |
| ------------- | ---------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **G1 契约门** | PO（裁决）             | MP-PM（需求）、FA（可行性）、FE/BE（双签）、CO（内容范围） | `task-card-sop.md`、`contract-freeze-sop.md` |
| **G2 质量门** | FE / BE / AI（执行）   | QA（监督）                                                 | `quality-gate-sop.md`                        |
| **G3 准入门** | QA（准入）             | UX（设计走查）、FE/BE（修复）                              | `admission-sop.md`                           |
| **G4 发布门** | QA（准入）、LC（合规） | PO（决策）、FA（风险）、MP-PM（审核材料）                  | `release-sop.md`、`compliance-sop.md`        |

---

## 5. 关键交接接口

```
PO ──任务卡（八要素）──▶ 各角色
MP-PM ──小程序页面流 + 平台约束──▶ UX / FE
FA ──可行性结论 + 风险条目──▶ PO / 全员
UX ──设计稿 + 设计评审结论──▶ FE
CO ──审核通过的题库/图谱──▶ AI
AI ──规则镜像（engine ↔ server/src/rules）──▶ BE
FE / BE ──构建产物──▶ QA
QA ──验收结论 + 发布准入单──▶ PO
LC ──合规台账──▶ QA（G4 核验）
```

交接必须落在**产物**上（任务卡、冻结单、评审结论、审核记录），不得口头交接。

---

## 6. 可行性分析师（FA）铁律

本项目曾两次因**原理推断**误判框架能力（Tailwind、Vapor），故 FA 角色固化以下硬规则：

1. 涉及「框架/平台**支持或不支持**」的判断，**必须先查官方文档**，不得只靠原理推断或第三方博客。
2. 结论必须附**证据来源**（官方文档链接 / 版本号 / 实测记录）。
3. 未验证的结论必须显式标注「**未验证**」，不得作为决策依据。
4. 关键可行性需以 **POC** 收口（对齐文档 04 §6 两周技术预研四项）。
5. 版本兼容风险（如 `@dcloudio/vite-plugin-uni` 与 HBuilderX 版本、vite 5.2.8 锁定）须登记到风险册。

---

## 7. 兼任与不可省略

- 小团队可兼任多角色（如 PO 兼 MP-PM、FE 兼 UX）。
- **不可省略**：QA、题库审核（CO）、AI 评测责任（文档 05）。
- 兼任时仍须**分别产出**各角色的门禁产物，不得因兼任而跳过。

---

## 8. 承载 skill

| 角色  | 承载 skill                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| MP-PM | `mentorloop-role-miniprogram-pm`                                                                                                               |
| FA    | `mentorloop-role-feasibility-analyst`                                                                                                          |
| UX    | `mentorloop-role-uiux-designer`、`mentorloop-avatar-design`、`mentorloop-lipsync-spec`、`mentorloop-interview-room-ux`、`domain-design-sop.md` |
| FE    | `mentorloop-system-spec`                                                                                                                       |
| BE    | `mentorloop-server-conventions`                                                                                                                |
| AI    | `mentorloop-role-ai-engineer`、`mentorloop-content-review`                                                                                     |
| CO    | `mentorloop-content-review`                                                                                                                    |
| QA    | `mentorloop-quality-gate`、`mentorloop-release-check`、`TRAE-code-review` / `TRAE-security-review`                                             |
| PO    | `mentorloop-role-product-owner`、`mentorloop-task-card`、`mentorloop-contract-freeze`                                                          |
