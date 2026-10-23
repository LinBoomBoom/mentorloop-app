# 今日工作报告：语音闭环修复与商务/登录口径收口

- 日期：2026-10-23
- 来源：用户体验版真机走查反馈（4 项）
- 关联任务卡：[2026-10-23-voice-loop-and-commerce-clarity.md](./2026-10-23-voice-loop-and-commerce-clarity.md)
- 门禁记录：[2026-10-23-voice-loop-and-commerce-clarity.gate.md](./2026-10-23-voice-loop-and-commerce-clarity.gate.md)

## 1. 已完成

### 1.1 语音闭环（P0，用户反馈核心问题）

| 问题                                     | 根因                                                         | 处置                                                                                |
| ---------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 语音录完直接跳下一题，看不到自己说了什么 | `handleAnswer` 在 600/800ms 后直接追问或 `ask()`，无确认态   | 新增「识别结果 · 请确认」卡片：文本可编辑，可「重新录制 / 确认提交」，未确认不推进  |
| 看不到字幕                               | MP 端稳定识别文本只累加进 `liveTranscript`，未回写 `caption` | 中间结果与稳定结果均实时上屏，停止录音后保留最终文本                                |
| 听不到面试官念题且无任何提示             | `speakWeixin` 在超时/空 fileID/播放失败时静默 `speakSilent`  | 新增 `onUnavailable` 回调，题面下方明示「语音播报暂不可用」；播放中显示「正在播报」 |
| 客户端必然无声的时序缺陷                 | 客户端 8s 放弃，服务端 TTS 预算 20s                          | 客户端超时提到 22s，确保不会先于服务端放弃                                          |
| 训练房间同样看不到回答                   | `applyFeedback` 1.2s 后自动 `nextQuestion()`                 | 加确认态；确认后停留展示即时反馈，手动「下一题」                                    |

涉及文件：

- [api/speech.uts](file:///e:/LsqCoding/Mentorloop-app/api/speech.uts)
- [pages/interview/room.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/interview/room.uvue)
- [pages/training/room.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/training/room.uvue)

### 1.2 套餐权益动态化

- 权益列表按选中 SKU 渲染（月卡 / 年卡 / 3 场包 / 10 场包 / 简历包各不相同）。
- 会员套餐与「加量包 · 单次购买」分区；加量包明示「无需开通会员」，并列出「本套餐不含」项。
- 支付按钮语义拆分：「立即开通」仅用于会员，「立即购买」用于单次包/加量包。

涉及文件：

- [data/membership.uts](file:///e:/LsqCoding/Mentorloop-app/data/membership.uts)
- [pages/membership/paywall.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/membership/paywall.uvue)

### 1.3 歧义收口（第一批）

- 简历解析历史改为独立详情页回放，不再覆盖当前解析/优化工作区。
  新增 [pages/resume/detail.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/resume/detail.uvue)，并注册到 `pages.json`。
- 小程序端 openid 静默登录即可进入面试，移除手机号强制门控；首页 / 我的 / 面试准备页的登录入口均改为「先静默登录，失败才弹兜底层」。

涉及文件：

- [pages/resume/resume.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/resume/resume.uvue)、`pages/resume/detail.uvue`、`pages.json`
- [pages/interview/prep.uvue](file:///e:/LsqCoding/Mentorloop-app/pages/interview/prep.uvue)、`pages/index/index.uvue`、`pages/mine/mine.uvue`、`components/ml-login-sheet.uvue`

### 1.4 文档与门禁

- 任务卡（八要素 + §9 质询）与 G2 门禁记录已落盘。
- 门禁结果：`pnpm lint` / `pnpm typecheck` / `pnpm test`（113 通过）/ `pnpm build:mp-weixin` 退出码均为 0。
- 产物抽检：`pages/interview/room.js` 含「识别结果 · 请确认」「语音播报暂不可用」；`pages/membership/paywall.js` 含「加量包 · 单次购买」；`pages/resume/detail.*` 已产出。

### 1.5 设计稿

- 购买时绑定手机号四屏效果图（未绑定提示 → 绑定半屏层 → 手机号冲突 → 账号与安全）。
- 源文件：[2026-10-23-phone-binding-mockup.html](file:///e:/LsqCoding/Mentorloop-app/docs/design/2026-10-23-phone-binding-mockup.html)
- 效果图：[2026-10-23-phone-binding-mockup.png](file:///e:/LsqCoding/Mentorloop-app/docs/design/2026-10-23-phone-binding-mockup.png)

### 1.6 提交推送

| commit    | 内容                                                                  |
| --------- | --------------------------------------------------------------------- |
| `46d2502` | `fix(voice)`：语音确认与字幕、套餐权益动态化、简历详情页、openid 登录 |
| `bf45ec9` | `docs(design)`：绑定手机号四屏效果图                                  |

均已推送 `origin/main`。

## 2. 未完成 / 待办

| #   | 事项                       | 卡点 / 下一步                                                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | 真机复验面试官念题能否出声 | 需重新上传体验版；若出现「语音播报暂不可用」，按 gate 记录读云端 `[tts]` 日志判定服务端配置或资源包问题 |
| 2   | 手机号绑定开发             | 等设计稿评审结论 + 3 个决策（是否强制绑定、手机号冲突处理、采集时机）                                   |
| 3   | 手机号绑定契约冻结         | 需新增 `POST /me/phone`、`GET /me/phone` 并做下单前置校验，属契约变更，须先双签                         |
| 4   | 其余「歧义文案」           | 用户暂未提供具体页面/句子，未做无依据改动                                                               |
| 5   | 小屏纵向挤压               | 已用「确认态隐藏语音可视化」缓解，仍需真机截图确认                                                      |
| 6   | 设计稿评审结论             | 待用户确认                                                                                              |

## 3. 决策待办

1. 手机号是否强制：当前设计为「不绑定不下单」，是否允许先买后绑。
2. 手机号已被其他微信账号绑定时：当前设计为「不覆盖，走客服」，是否支持本人申诉迁移。
3. 采集时机：当前为支付前弹层采集，是否改为支付成功后再引导绑定。

## 4. 建议推进顺序

1. 用户复验真机语音，反馈题面下方播报提示的实际状态。
2. 确认绑定手机号设计稿与 3 个决策。
3. 开契约冻结卡并实现服务端绑定端点与客户端绑定流程。
4. 补充其余歧义文案清单后统一收口。
