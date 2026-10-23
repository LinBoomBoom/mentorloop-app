# ml-login-sheet 登录半屏层

> 规格以 `components/ml-login-sheet.uvue` 实现为准反写（2026-10-14，ds-1 F5）。改动实现须同步本文件。

登录门控半屏层（业务组件，非纯 UI）：小程序个人主体无手机号授权权限，走「手机号 + 短信验证码」（决策记录 D1 修订；服务端 `/auth/sms-code` + `/auth/login` 契约已冻结）。

## Props

无 props；状态自管理（phone / code / agreed / loading / countdown）。

## Events

| 事件    | 参数 | 说明                                                 |
| ------- | ---- | ---------------------------------------------------- |
| success | —    | 登录成功（`applyAuth` + 埋点后触发）                 |
| exit    | —    | 点击遮罩外出口「暂不登录，返回」（loading 时不触发） |

## 版式

- 全屏 `fixed z-50`；遮罩 `bg-navy-deep opacity-60`，点击不放行（强制门控）。
- 面板 `bg-surface rounded-t-2xl px-5 pt-4 pb-9`：标题行（`text-lg font-bold text-ink` + 右上 x 关闭钮 `w-11 h-11 rounded-full`）→ 手机号输入（`h-11 rounded-xl bg-bg-muted`，maxlength 11）→ 验证码输入 + 发送钮（60s 倒计时）→ 协议勾选行 → ml-button primary block → 「暂不登录，返回」出口（`h-10 pressed-row`）→ 隐私说明脚注。

## 状态

| 状态     | 表现                                                               |
| -------- | ------------------------------------------------------------------ |
| 默认     | 输入可编辑，发送钮 `bg-bg-muted opacity-60` 置灰                   |
| 可发送   | phone 11 位且 countdown=0 → 发送钮 `bg-chip-smart`（text-smart）   |
| 倒计时   | 「Ns 后重发」，按钮置灰，60s 计时（setInterval，onUnmounted 清理） |
| 登录中   | 按钮文案「登录中…」+ disabled；输入与关闭钮全部拦截                |
| 校验拦截 | 未勾协议 / 手机号非 11 位 / 验证码非 6 位 → toast 提示并 return    |
| 发送失败 | toast「发送失败，请稍后重试」                                      |
| 登录失败 | toast「登录失败，请检查验证码」                                    |

## 关键实现约束

- 内嵌 ml-icon 与 ml-button，不重复实现图标/按钮样式。
- 协议链接（`《用户协议》/《隐私政策》`）URL 为空时打开应用内全文页 `pages/legal/legal`，非空跳 webview 页。
- 倒计时 timer 必须在 `onUnmounted` 清理，防泄漏。
