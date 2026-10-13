# 任务卡：去数字人 + IA 收敛（ui-3）

- 日期：2026-10-13
- 关联：决策记录 D3（冻结决策变更，待技术负责人双签）；里程碑 M1；关联 2026-10-11-mp-visual-overhaul

## 1. 目标

将产品视觉从「数字人主角」切换为「语音状态可视化 + 任务主角」，并把一级 tabBar 收敛为 4 个、清理跨页冗余内容，使首版可在不依赖美术资产与原生渲染的前提下快速上线。

## 2. 范围

- 做：
  - 首页与面试房间的视觉替换：语音状态环 + 声波 + 大字幕（替代具象数字人）
  - 下线 avatar 渲染桥与其资产依赖（`components/interviewer-avatar.uvue`、`data/avatar-assets.uts`、`utssdk/interviewer-avatar/`）
  - tabBar 收敛为 4：首页 / 专项训练 / 报告 / 我的
  - 报告页升为一级 tab（最近报告 + 历史列表）；成长、简历改为普通页
  - 去冗余 R1–R9（统计条重复、我的宫格与 tab 重复、偏好双入口、空态叠加、头带同质）
  - 同步 MASTER.md §A1/A4、文档 02 §4、文档 06 预算项、M1 出口标准
- 不做：
  - 不改 `types/`、`api/`（无契约变更，不触发契约冻结）
  - 不新增原生插件；不做多岗位 / 多角色 / 多音色
  - 不做口型同步与数字人美术资产
  - 不重构引擎 `engine/` 与服务端

## 3. 依赖

- 前置：决策 D3 经 PO + 技术负责人书面双签（本卡开工即视为 PO 已确认，待技术负责人补签）
- 外部环境：HBuilderX 真机 / 微信开发者工具截图走查
- 契约：无（`types/`、`api/` 零改动）

## 4. 验收标准

- [ ] 首页与面试房间无具象人形；asking / listening / followup 三态可分辨，且不只靠颜色（形状/波形/文案辅助）
- [ ] `utssdk/interviewer-avatar`、`data/avatar-assets.uts`、`components/interviewer-avatar.uvue` 全仓无引用残留（grep 清零）
- [ ] 面试房间保留 AI 面试官标识，且不显示实时评分
- [ ] tabBar 为 4 项；选中/未选中对比度 ≥4.5:1
- [ ] 报告页作为 tab 可展示历史列表并进入单场报告；成长/简历可由新入口到达
- [ ] R1–R9 逐项消除（首页不再与训练/报告重复承载同一训练计划；我的页无与 tab 重复的宫格）
- [ ] G2 客户端裁剪全绿（lint + typecheck + test + format + build:mp-weixin）
- [ ] MP 截图走查首页 / 房间 / 报告 / 训练 / 我的 5 页无回归

## 5. 风险与对策

| 风险                      | 等级 | 对策                                                     |
| ------------------------- | ---- | -------------------------------------------------------- |
| 去人形后沉浸感/情绪层下降 | 中   | 以品牌光环、状态动效与字幕层级补偿，保留深色沉浸面       |
| tabBar 改级联影响入口栈   | 中   | 全仓 grep switchTab/navigateTo 逐处核对，分批 build 验证 |
| 冻结决策变更未双签即开工  | 高   | 决策 D3 显式标注「待技术负责人双签」，未签不进入 G3      |
| UTS 内联样式类型坑        | 中   | 沿用普通对象字面量，禁 StringMap/Map 作内联样式          |

## 6. 产物路径

- 新增：`components/ml-voice-visual.uvue`
- 修改：`pages/index/index.uvue`、`pages/interview/room.uvue`、`pages/report/report.uvue`、`pages/growth/growth.uvue`、`pages/resume/resume.uvue`、`pages/training/training.uvue`、`pages/mine/mine.uvue`、`pages.json`、`main.css`、`styles/theme.uts`、`design-system/mentorloop/MASTER.md`、`docs/project-execution-plan.md`、`docs/MentorLoop_02_主体功能与AI面试引擎.md`、`docs/MentorLoop_06_预算合规与上线清单.md`、`README.md`
- 删除：`components/interviewer-avatar.uvue`、`data/avatar-assets.uts`、`utssdk/interviewer-avatar/`

## 7. 角色

- 主责：UX
- 配合：PO（决策双签）、FE、QA

## 8. 负责人

PO 裁决方向并双签；UX 主导设计规格；执行 Agent：TraeCode 落码与门禁。

---

## 进度记录

### 2026-10-13 开工

- 方案定稿：数字人 → 语音状态环 + 声波；tabBar 收敛为 4。详见对话方案。
- 治理产物：本任务卡、`project-execution-plan.md` §10 D3、`MASTER.md` §A1/A4 同步。
