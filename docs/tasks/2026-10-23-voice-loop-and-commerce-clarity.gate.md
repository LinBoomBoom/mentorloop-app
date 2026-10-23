# G2 门禁记录：语音闭环可见性 + 套餐权益动态化 + 歧义收口

- 日期：2026-10-23
- 任务卡：[2026-10-23-voice-loop-and-commerce-clarity.md](./2026-10-23-voice-loop-and-commerce-clarity.md)

## 1. 门禁结果

| 项        | 命令                   | 退出码 | 结论                                         |
| --------- | ---------------------- | ------ | -------------------------------------------- |
| Lint      | `pnpm lint`            | 0      | 通过（首轮 1 处 `vue/no-unused-vars`，已修） |
| Typecheck | `pnpm typecheck`       | 0      | 通过                                         |
| Test      | `pnpm test`            | 0      | 113/113 通过                                 |
| Build     | `pnpm build:mp-weixin` | 0      | DONE（先删 `dist/build/mp-weixin` 再构建）   |

产物抽检：`dist/build/mp-weixin/pages/interview/room.js` 含「识别结果 · 请确认」「语音播报暂不可用」；`pages/membership/paywall.js` 含「加量包 · 单次购买」；`pages/resume/detail.*` 已产出。

## 2. 已知未闭环（真机项）

- **TTS 是否能真实出声**：本轮只保证「不再静默」。若真机题面下方出现「语音播报暂不可用」，判定为服务端侧问题，按下列顺序取证：
  1. 云托管运行日志过滤 `[tts]`：`TENCENTCLOUD_SECRET_*` 未配置 / `TTS_HTTP_*` / `TTS_UnsupportedOperation.PkgExhausted`（TTS 资源包未领取或耗尽）。
  2. `[tts] WX_APPID/WX_SECRET 未配置，无法写云存储` 或 `[tts] 云存储写入失败` → 云端 `WX_APPID`/`WX_SECRET` 缺失。
  3. 客户端日志 `[speech] TTS 播放失败` → `cloud://` fileID 播放异常，需复现设备信息。
- 客户端超时已从 8s 调到 22s（必须大于服务端 20s 预算），避免「服务端合成完成前客户端已放弃」。

## 3. 待另立卡

- 购买时绑定手机号：需新增 `POST /me/phone` 契约与服务端实现（当前仅有 `/auth/sms-code`、`/auth/login`、`/auth/wechat`）。

## 4. 遗留风险

- 房间/训练页新增确认卡后，小屏（≤667pt）存在纵向挤压风险；已用「确认态隐藏语音可视化」缓解，仍需真机截图确认。

## 5. 2026-10-23 真机复测补记

- **TTS 合成**：云端 `TENCENTCLOUD_SECRET_ID/KEY` 未随密钥轮换更新，日志为 `TTS_AuthFailure.SecretIdNotFound`；控制台更新并重新发布后合成恢复。
- **TTS 播放**：iOS 上直接以 `cloud://` 作 `InnerAudioContext.src` 报 `operateAudio:fail audioInstance is not set`；换 HTTPS 临时链接后报 `INNERERRCODE:-1001 请求超时`；最终改为 `wx.cloud.downloadFile` 下载本地临时文件再播放，真机通过。
- **ASR 上传**：`wx.cloud.uploadFile` 出现既无 success 也无 fail 回调，页面永久停在「转写中…」；`api/asr.uts` 增加 20s 超时兜底与上传/转写分步日志，真机转写恢复。
- **降级提示**：`speakSilent` 的 start 事件曾把「语音播报暂不可用」覆盖为「正在播报」，已改为不可用提示优先。
- **门禁复核**：`lint` / `typecheck` / `test`（113 通过）/ `build:mp-weixin` / `format:check` / uvue 守卫 / 设计 token 守卫全部通过。
- **结论**：任务卡 §4 最后一项「真机复验」通过。
