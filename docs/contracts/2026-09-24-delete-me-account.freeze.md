# 契约冻结单：新增 DELETE /me/account（账号自助删除）

- 日期：2026-09-24
- 关联任务卡：docs/tasks/2026-09-24-account-deletion-and-eval-baseline.md
- 类型：新增端点

## 1. 端点变更

| 端点        | 方法   | 变更                                                                          |
| ----------- | ------ | ----------------------------------------------------------------------------- |
| /me/account | DELETE | 新增。requireAuth；幂等；成功返回 `ok()`（`{code:0,data:null,message:"ok"}`） |

## 2. 字段 diff

| 字段                                 | 变更前 | 变更后 | 端              |
| ------------------------------------ | ------ | ------ | --------------- |
| （无出参结构变更，统一响应包裹不变） | —      | —      | client / server |

## 3. 影响面

- 前端改动：`api/auth.uts` 新增 `deleteAccount(): Promise<boolean>`（mock + real 双实现，real 走 `request('/me/account', makeOptions('DELETE', null))`）；`pages/mine/security.uvue` 注销账号行激活（双重确认 → 调接口 → 清本地 → `userStore.logout()`）；`pages/mine/privacy.uvue` 文案更新；`pages/login/login.uvue` / `pages/mine/about.uvue` 协议链接（不触契约，仅 UI）。
- 服务端改动：`server/src/routes/me.ts` 新增 `DELETE /me/account`（requireAuth 预处理器；`getUserByUid` 查用户，查无用户仍返回 ok 实现幂等；级联清理顺序：tracking_events → answers/session_asked（经 session join）→ reports → resumes（先收集 original_url）→ orders → sessions → sms_codes（按 user.phone）→ users；随后删除 UPLOAD_DIR 下 `resumes/<rel>` 文件，文件不存在忽略）。
- 规则镜像：engine/* ↔ server/src/rules/* 不涉及（无选题/评分逻辑变更）。

## 4. 兼容性

- 是否破坏旧客户端：否。纯新增端点，旧客户端不调用即不受影响；统一响应结构不变。
- 回退方案：移除路由注册与客户端调用即可；数据删除不可逆，回退仅恢复功能不恢复数据（发布说明中明示）。

## 5. 双签

| 角色   | 结论 | 日期       |
| ------ | ---- | ---------- |
| 客户端 | 同意 | 2026-09-24 |
| 后端   | 同意 | 2026-09-24 |
