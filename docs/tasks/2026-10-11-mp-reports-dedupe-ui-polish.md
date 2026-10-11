# 任务卡：小程序端 /me/reports 重复调用修复 + 全页面 UI/交互走查重设计

- 日期：2026-10-11
- 关联：2026-10-08-mp-cloud-alignment（云链路已通，gate.md 全链路验证项未勾）

## 1. 目标

修复用户实测发现的真实接口缺陷（/me/reports 每次切 tab 重复拉取、无节流），并对小程序核心页面做一轮 UI/交互走查重设计（图标、流程、交互反馈），使页面质量达到 ui-ux-pro-max 规范要求。

## 2. 范围

- 做：
  - store/report-history.uts 拉取节流（TTL + in-flight 去重 + 换号强制重拉）
  - /me/reports 与 /track/batch 响应形状的实证排查与结论记录（服务端零改动）
  - 核心页面（首页/成长/训练/我的/报告）UI 走查：图标体系（Lucide + 降级）、触摸反馈、空态、流程断点，并按走查清单逐项修复
- 不做：
  - 服务端路由/出参结构改动（已实证形状正确）
  - 面试房间（interview room）与数字人/口型相关改动（另属独立 skill 域，本卡不触达）
  - 全链路云端验证（建会话→答题→报告，属 gate.md 既有未勾项，由用户在开发者工具完成后勾验）

## 3. 依赖

- 前置：X-WX-SERVICE 路由修复（eb16399）已上线，云链路可用
- 外部环境：微信开发者工具（用户侧验证 UI 效果）；HBuilderX 不涉及
- 契约：不改 types/ 与 api/ 出入参结构（fetchFromServer 签名不变），不触发契约冻结

## 4. 验收标准

- [ ] 同一账号 60s 内切换 首页/成长/我的 三个 tab，/me/reports 仅发起 1 次请求（代码审查 + 逻辑单测可判定）
- [ ] 换账号登录后强制重拉，不展示上一账号报告
- [ ] 排查结论已记录：/track/batch data:null 为设计（上报无载荷）；/me/reports data:[] 为数据态（云端 reports=0）
- [ ] UI 走查清单成文且核心页面清单项全部修复（图标命中/降级、触摸反馈 hover-class、空态、≥44pt 触点）
- [ ] G2 门禁通过（客户端裁剪：lint + tsc + vitest + format + build:mp-weixin）
- [ ] App/H5（mock 模式）行为不回归

## 5. 风险与对策

| 风险                                            | 等级 | 对策                                                  |
| ----------------------------------------------- | ---- | ----------------------------------------------------- |
| UTS 的 Promise 字段在 Kotlin 侧 smart-cast 限制 | 中   | 局部变量中转判空，build:mp-weixin + 客户端单测验证    |
| TTL 内完成新面试后成长页短暂不刷新              | 低   | push() 本地已含最新报告；TTL 仅 60s，可接受           |
| UI 改动面大引入回归                             | 中   | 按页面分批改，每批跑 build:mp-weixin；不碰引擎/契约层 |

## 6. 产物路径

- 修改：store/report-history.uts、pages/（index/growth/training/mine/report 等）、components/（图标/空态类）
- 新增：docs/issues 或本卡附录走查清单（不新增独立文档，清单落在任务卡进度节）

## 7. 角色

- 主责：UX（mentorloop-role-uiux-designer + mentorloop-system-spec）
- 配合：FE（走查修复落地）、QA（G2）、PO（范围裁剪：页面分批）

## 8. 负责人

PO 把关范围；UX 主导设计走查；执行 Agent：TraeCode（GLM）

---

## 进度记录

### 2026-10-11 接口排查结论（已完成）

- 本地起服务实证：`/me/reports` 空库返回 `{"code":0,"data":[],"message":""}`，插入报告后返回 `data:[{sessionId,at,report}]`；`/track/batch` 返回 `{"code":0,"data":null,"message":""}`（上报接口设计如此，无业务载荷）
- 云端 `mentorloop_mp` 库 reports=0（2026-10-11 DMC 查证）：用户尚未完成任何面试，"data 空"是数据态而非序列化 bug
- 本仓 server 无 M1 型 `map(async` 缺 Promise.all 问题（grep 零命中）
- 已修复：store/report-history.uts 加 FETCH_TTL=60s + in-flight 去重（局部变量规避 Kotlin smart-cast）+ 换号强制重拉 + clear() 重置节流标记
