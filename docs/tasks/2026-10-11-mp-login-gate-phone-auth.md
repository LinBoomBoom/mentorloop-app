# 任务卡：小程序登录体系（进面试强制登录 + 微信手机号授权）

- 日期：2026-10-11
- 关联：8da24ba（ui-2 视觉升级）；C1 方向体系另立卡

## 1. 目标

把面试这一核心动作收敛到真实身份：用户浏览可继续用静默匿名身份，但「进入面试」前必须完成微信手机号授权登录，使面评报告归属到可触达的手机号账号。

## 2. 范围

- 做：
  - 客户端：prep 页 onShow 增加登录门控（无手机号身份 → 弹登录层）；登录层提供 button open-type="getPhoneNumber" 一键授权 + 协议勾选
  - 客户端：api/auth.uts 新增手机号授权登录请求（loginCode + phoneCode 双码上行）
  - 服务端：/auth/wechat-phone 端点（getuserphonenumber 换手机号 + X-WX-OPENID/openid 归一 → 查/建用户并绑定 phone → JWT 签发，响应形状不变）
  - 服务端：微信凭据配置（WX_APPID/WX_APPSECRET env + stable_token 缓存）；code2session 兜底
  - 测试：服务端 spec 覆盖新端点（成功/换号重登绑定/无手机号 code 失败）
- 不做：
  - App 端短信验证码登录改造（现状保留）
  - 桌面端任何改动（账号打通走既有 desktop_user_id 机制）
  - 退出登录/注销流程重设计、用户资料页改版
  - 游客浏览功能的裁剪决策（静默登录保留）

## 3. 依赖

- 前置：小程序主体须为企业认证（getPhoneNumber 仅企业主体可用）——**待用户确认**
- 服务端 env：WX_APPID / WX_APPSECRET 需用户在云托管控制台版本配置中填入（CLI 部署 EnvParams 不继承，见 memory）
- 官方文档核实（动手前必查）：getuserphonenumber、getStableAccessToken 签名与云托管内调用方式
- 契约：新增端点复用 {uid,nickname,token} 出参形状；若动 types/api 需契约冻结（实施时判定）

## 4. 验收标准

- [ ] 未授权手机号的用户点「进入面试」无法进入房间，出现登录层
- [ ] 登录层一键授权成功后自动关闭并放行面试入口；users 表该用户 phone 字段被正确写入
- [ ] 同一 openid 换手机号重登 → phone 更新为新号（max-merge 语义沿用账号打通裁决）
- [ ] phoneCode 无效/过期 → 客户端可见错误提示，不产生会话
- [ ] 服务端新端点 spec 通过；G2 客户端裁剪 + 服务端三项全绿
- [ ] 静默登录浏览行为不变（不授权仍可看首页/成长/报告历史）

## 5. 风险与对策

| 风险                                    | 等级 | 对策                                                                 |
| --------------------------------------- | ---- | -------------------------------------------------------------------- |
| 小程序为个人主体，getPhoneNumber 不可用 | 高   | 实施前向用户确认主体类型；不可用则回退「验证码登录」方案另立卡       |
| AppSecret 泄露面扩大                    | 中   | 只存云托管 env，不入仓；token 缓存进程内即可（单实例下限 1）         |
| 云托管内调用 openapi 的鉴权方式不确定   | 中   | 动手前 WebFetch 官方文档核实（云调用/stable_token 二选一），禁止盲试 |
| 门控误伤已登录老用户                    | 低   | 判定条件用「token 存在且已绑手机号」，仅缺手机号才弹层               |

## 6. 产物路径

- 修改：pages/interview/prep.uvue（门控 + 登录层）、api/auth.uts、types/auth 相关（如需）、server/src/routes/auth.ts、server/src/services/auth.ts、server/src/config（env 读取）
- 新增：无独立新文件（登录层内联 prep 页或抽 components/ml-login-sheet.uvue 视体量定）
- 测试：server/src/auth-phone.spec.ts（或并入既有 auth spec）

## 7. 角色

- 主责：FE（客户端门控/授权流）+ BE（端点与凭据链路）
- 配合：PO（主体类型确认、强制登录语义裁决）、QA（门禁与验收走查）

## 8. 负责人

PO 把关登录语义与主体前提；执行 Agent：TraeCode（GLM）

---

## 进度记录

### 2026-10-11 立卡（已完成 PO 裁决）

- 现状探查结论：MP 启动已有静默 wx.login（匿名身份）；服务端 /auth/wechat 依赖云托管私有链路 X-WX-OPENID 头（免 code2session），无 AppSecret 配置；users 表已有 phone/openid/channel 字段；prep 页无登录检查
- PO 裁决 ①：小程序为**个人主体** → getPhoneNumber 手机号授权不可用，方案回退为「手机号 + 短信验证码」登录层
- PO 裁决 ②：登录语义 = 静默登录保留用于浏览，仅面试入口门控手机号身份
- PO 裁决 ③：短信通道先跑通流程——mock 验证码（MOCK_SMS_CODE，默认 123456），真实短信服务商（腾讯云 SMS）后续另立卡接入
- 契约判定：服务端 /auth/sms-code + /auth/login 已完备（auth.spec 全覆盖），api/auth.uts 的 sendSmsCode/loginByPhone 已存在 → **types/api/服务端出参零变更，无需契约冻结**
- 实施方案：user-profile.uts 加 phone 字段（含旧缓存兼容）；applyAuth 加 phone 参数（2 调用点同步）；新建 components/ml-login-sheet.uvue（手机号+验证码+协议+60s 倒计时，从 login.uvue 适配）；prep.uvue onShow 门控（phone 非空判定）+「暂不登录并返回」出口

### 2026-10-11 实施（已完成，待用户验证）

- store/user-profile.uts：UserProfile/UserProfilePatch 加 phone 字段，hasPhoneIdentity() 门控判定，restore() 旧缓存兼容（无 phone 补空串）
- api/auth.uts：applyAuth 加 phone 参数；App.uvue（静默登录传 ''）与 pages/login（传手机号）两调用点同步
- components/ml-login-sheet.uvue 新建：半屏登录层（遮罩+底部面板），手机号/验证码输入、60s 倒计时重发、协议勾选、登录按钮、「暂不登录，返回」出口；遮罩点击不放行（强制语义）
- pages/interview/prep.uvue：onShow 门控（无 phoneOk 弹层）；CTA 三态文案（登录后进入面试/进入面试/开始检测）；登录成功放行 + toast
- 契约：types/api/服务端零变更（/auth/sms-code 与 /auth/login 沿用已冻结契约）
- G2 客户端裁剪全绿（lint/typecheck/vitest 64/64/format/uvue-css/build）；产物验证：ml-login-sheet 组件 wxml 含 input、wxss 含 position:fixed、wtu-* 映射一致
- 遗留：真实短信服务商接入另立卡；企业认证后可升级 getPhoneNumber 一键授权
