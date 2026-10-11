# 任务卡：首页/面试准备页减法改版（溢出修复 + 去重复入口 + 去时长选择）

- 编号：ui-3-index-prep-simplify
- 日期：2026-10-11
- PO 裁决（用户指令原文）：①首页左上角用户信息溢出截断要修；②AI 面试官底部滚动区三个 tab（专项训练/简历优化/我的成长）与底部 tabbar 冲突重复，去掉；③快练 5 分钟/标准 20 分钟/深度 40 分钟不要了，「难以把控成本而且没法真实做到精确把控，按用户自己面试多久就多久好了」

## 1. 目标

消除首页信息溢出与导航重复，移除面试时长三档选择，时长语义改为「用户自主控制」（题量池封顶 + 随时可手动结束）。

## 2. 范围

- 在范围内：index 溢出修复 + 删次级入口块 + 删模式选择器；prep 删面试时长卡；room 倒计时自动收束改为正计时（mm:ss）+ 取消归零自动结束
- 不在范围内：引擎题量预算（getModeBudget 保持 standard 档内部默认）；专项训练任务的分钟制（属任务设计非面试时长）；契约变更（mode 参数保留，恒传 standard，零契约变更）

## 3. 依赖

- 无外部环境依赖；types/api 零变更（InterviewMode 类型保留供引擎/契约使用）

## 4. 验收标准

- [ ] 首页左上角「日期 · 方向 · 年限」在窄屏不溢出（受 flex-1 约束自动换行）
- [ ] 首页滚动区不再出现三个次级入口卡片；底部 CTA 区不再出现快练/标准/深度选择
- [ ] prep 页不再出现面试时长卡；开始面试恒以 standard 预算创建会话
- [ ] 面试房间顶部显示已进行时长（正计时），倒计时归零自动收束逻辑移除；用户仍可「退出」或答完题池自然收束
- [ ] G2 客户端门禁全绿 + build 产物抽查

## 5. 风险

- 房间失去自动收束后，若用户不点退出且题池未耗尽会一直进行——题池本身有限（standard 8 题），答完自动进总结，风险可控
- index goResume 仅被次级入口引用，删块后同步删函数避免未使用告警

## 6. 产物路径

- pages/index/index.uvue、pages/interview/prep.uvue、pages/interview/room.uvue

## 7. 角色

- UI/UX 设计师（lead）：信息架构减法与溢出修复
- 客户端工程师：页面实施

## 8. 负责人

- 产品负责人裁决 + UI/UX 设计师牵头；执行 agent：TraeCode

## 实施记录（2026-10-11 完成）

**四页面改动**：

1. `pages/index/index.uvue`
   - 溢出修复：问候+日期行容器 `flex-col` → `flex-col flex-1 mr-2`，窄屏受宽度约束自动换行
   - 删除「次级入口」三 tab 块（专项训练/简历优化/我的成长，与 tabbar 重复）
   - 删除「模式选择」块（快练/标准/深度）；CTA 直达 `uni.navigateTo({ url: '/pages/interview/prep' })`
   - 脚本清理：Mode 类型 / modes 数组 / mode ref / entries 数组 / goResume 函数
2. `pages/interview/prep.uvue`
   - 删除「面试时长」整卡；删除 mode ref / onLoad mode 解析 / 相关 import
   - 导航 URL 恒传 `mode=standard`（契约零变更，时长语义 v2 注释）
3. `pages/interview/room.uvue`
   - 顶部 `{{ remain }}″` 倒计时 → `{{ elapsedText }}` mm:ss 正计时
   - `remain` → `elapsed`；tick 改为 elapsed+1；删除倒计时归零自动收束块
   - 收束路径 = 顶部「退出」confirmExit + 题池答完自动 goSummary（既有逻辑）
4. `pages/mine/prefs.uvue`（残留 grep 发现的联动清理）
   - 「默认面试模式」选择器随模式移除成为无效设置项，一并删除（modes/mode/InterviewMode import）
   - save() 补齐 `phone: null`（UserProfilePatch 全字段一致性），说明文案改「默认方向与年限」

**裁决与契约**：mode 参数保留但恒传 'standard'，types/api 零变更，无需契约冻结；引擎 getModeBudget 保持 standard 档内部默认。

**门禁**：LINT=0 / TS=0 / TEST=0 / FMT=0 / BUILD=0（G2 客户端五项全绿）。

**产物级验证**：

- dist/build：prep.js 含 `mode=standard`、房间跳转 URL、首页跳 prep URL；`快练` 字样在首页产物缺席（INDEX_NO_QUICK）
- dist/dev（CLI watch）：room 产物含 elapsedText 正计时
- 教训复用：生产产物变量名被压缩混淆，grep 验证必须用字符串字面量
