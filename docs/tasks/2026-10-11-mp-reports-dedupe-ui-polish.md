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

### 2026-10-11 图标黑色根因修复（已完成，截屏实证）

- 现象：图标字形正常但全部渲染为默认黑色，用户反馈「深色主体下 icon 是黑色的」
- 根因：`components/ml-icon.uvue` 的 iconStyle 返回类型标注为 `StringMap`（theme.uts 自定义类型）。编译产物中 StringMap 是 UTSType 子类，其构造函数在非 JSON-parse 模式下 `initProps` 仅 `return options` 不挂载实例属性（vendor.js L406-408）→ 实例无可枚举字段 → `normalizeStyle` 的 `for...in` 得到空对象 → 内联 style 序列化为**空串**，color/fontSize 全部失效；字形靠 `.font-icon` class 的 font-family 存活
- 旁证：模板内对象字面量 `:style="{...}"` 编译为 UTSJSONObject，normalizeStyle 有专门分支（vendor.js L836-841），故卡片背景色等内联样式一直正常
- 修复：iconStyle 去掉 StringMap 标注与 `as StringMap`，改普通对象字面量（编译为 UTSJSONObject）；已通过截屏开发者工具验证：统计条 target 浅琥珀 / medal 浅青 / flame 浅橙、引导卡 sparkles 浅紫全部按主题色渲染
- 经验：**uvue 内联 :style 绑定禁止使用 theme.uts 的 StringMap 类型标注/断言**，一律用普通对象字面量

### 2026-10-11 端间一致性矛盾清单（PO/PM 走查，待裁决）

事实基础（两仓代码比对 + 今日模拟器截屏）：

- 桌面端方向 = `frontend/backend/devops/ai`（MentorLoop/app/pages/interview/sim.vue L19-24、components/InterviewAsk.vue L4-10、server/api/interview/ask.post.ts L12-24）；Java/Go/Python 是 backend 方向内技术栈（app/data/learningTaxonomy.ts L144-148 be-web）
- 桌面端等级 = `junior/mid/senior` 三档（app/data/roadmap/types.ts L2-8），难度另映射 easy/medium/hard（server/utils/interview.ts L140-154）
- 桌面端面试模式 = 文字/语音/实时/视频/数字人 + maxTurns 题数制 + 音色选择 + 录制同意（sim.vue L40-72）；未登录/非 VIP 有 gate 卡（sim.vue L6-12）
- 小程序端方向 = `java-backend/frontend/golang-backend/pm`（types/interview.uts L9、data/position-options.uts L18-23）；等级 = `fresh/junior/mid/senior` 四档；模式 = quick/standard/deep 时长制
- 小程序 prep 选项双源：客户端 data/position-options.uts 与 server/src/data/position-options.ts 逐字相同、人工同步，无下发接口
- 小程序 `/interview/session` 要求 JWT（server/src/routes/interview.ts L13-22）

| #   | 矛盾点                                                                                                                                                                                                            | 根因                                                                                                                              | 等级 | 建议                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 方向体系不一致：仅"前端"重合。桌面把 Java/Go 当 backend 内技术栈，MP 升为独立方向；桌面有运维/AI 工程，MP 有产品经理                                                                                              | 两端方向表独立定义人工同步，无 single source of truth；PositionId 自造联合类型未与桌面 track 对齐，契约从未双签                   | P0   | PO 裁决以哪端为准修订 PositionId，落 contract-freeze 记录；方向表收敛服务端单源 + 接口下发                                                     |
| C2  | 经验档位不一致：MP 四档（含应届生）vs 桌面三档；难度词汇桌面另有 easy/medium/hard                                                                                                                                 | 同上，双源独立演进                                                                                                                | P1   | 档位收敛三档；easy/medium/hard 只作题库内部映射不外露                                                                                          |
| C3  | 面试模式语义不一致：MP 时长制（5/20/40min）vs 桌面交互制（文字/语音/实时/视频/数字人）+ 题数制                                                                                                                    | 两端面试引擎本就不同（MP 本地题库静态选题 vs 桌面 LLM 生成+题库混合）                                                             | P1   | 报告 schema 对齐 session 维度；深度 40min 标注题量预期（题库收束已有 NO_MORE_QUESTIONS 保护）                                                  |
| C4  | 未登录却展示"用户信息"：首页顶部常驻「Java 后端 · 1-3年」（index.uvue L22），来源是未登录用户的本地默认偏好（store/user-profile.uts L54-62），呈现成用户画像；页面明知登录态（loggedIn L272）却只在底部提示条使用 | profile 默认值与登录态展示逻辑缺失；且未登录用户走完 首页→prep→设备检测 后调 /interview/session 必 401（桌面端有 gate 卡，MP 无） | P0   | 未登录时顶部标签改为引导式入口；prep 开始前加登录门禁或静默登录重试；goLogin() MP 端 toast「微信授权登录中」不触发任何动作（L495-502），需修正 |
| C5  | prep 选项硬编码无接口铺排：方向/等级来自本地静态 data，服务端副本人工同步，available 标记无接口可查                                                                                                               | 无 GET /interview/options 类接口；扩方向客户端永远不知道                                                                          | P1   | 新增 GET /interview/options，prep 页 onShow 拉取缓存；本地文件仅留类型定义                                                                     |
| C6  | 首页右上设置按钮被微信胶囊遮挡（今日截屏实证：设置图标不可见）                                                                                                                                                    | 顶栏未让出胶囊宽度                                                                                                                | P1   | 右侧 padding 预留胶囊区，或设置入口移至胶囊左侧                                                                                                |
| C7  | 「AI 面试官·就绪」常驻 + 问候区无昵称：未开始会话即显示就绪，已登录用户也无个性化问候                                                                                                                             | 状态文案未区分登录态/会话态                                                                                                       | P2   | 状态文案区分访客；问候语接入昵称                                                                                                               |

- 需 PO 裁决：C1 方向归属、C4 门禁策略（登录前置 vs 全流程可走通）；C1/C5 涉及契约变更须过 mentorloop-contract-freeze
- 本卡范围：C6 可随本卡 UI 走查批次修复；C1-C5、C7 另立任务卡

### 2026-10-11 C6 胶囊遮挡修复（已完成，截屏实证）

- 修复：index.uvue 顶栏加 `paddingRight`（MP-WEIXIN 条件编译固定 100px，App/H5 保持 20px）。uni-app x 未暴露 `getMenuButtonBoundingClientRect`（官方 API 表 App/H5 列均为 ×，node_modules/@dcloudio 零引用），微信胶囊几何稳定（≈87px+右边距），故用固定避让值
- 验证：截屏放大实证——设置齿轮完整可见，与胶囊有安全间距，无遮挡
- G2 附带修复：typecheck 报 TS2305（spec 导入 `reportHistory` 落到 env.d.ts 的 `*.uts` 通配声明），按既有模式在 env.d.ts 追加宽松声明行；prettier --write 修复 2 文件格式

### 2026-10-11 WXSS「编译错误」诊断结论（虚惊，竞态）

- 现象：模拟器报「编译 WXSS 文件...错误」白屏，dist/dev/mp-weixin/app.wxss 为 172522B 聚合形态（ISS-20261011-01 的 HBuilderX 污染特征值也是 ~172KB，高度混淆）
- 裁决：**172KB 是 CLI watch（样式隔离 2.0）dev 模式正常形态**——watch 活性测试（touch 源文件 → 25s 内产物重写）证明产物由 CLI watch 维护；头部 `@import "/uvue.wxss"` 是根路径（合法），非 ISS 记录的 `../../` 越界缺陷；发行 build 产物 app.wxss 仅 281B（按需+压缩），两模式产物形态本就不同
- 根因：14:58:30 watch 重编译瞬间（index.uvue 保存触发），开发者工具恰好同时增量编译，读到半截产物 → 竞态报错；15:07 重编译完成后工具热重载已自愈，无需人工干预
- 经验：dev 产物聚合形态体积不是污染判据，判据是 import 路径形态（根路径 = CLI 正常，`../../` 越界 = HBuilderX 聚合缺陷）；模拟器 WXSS 竞态报错先点「编译」重试再排查
- ISS-20261011-01 结论不变（HBuilderX 产物缺陷仍成立），本次未复发
