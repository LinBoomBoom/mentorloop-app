# 契约冻结：面试官 TTS 下行通道（POST /interview/tts → 云存储 fileID）

- 日期：2026-10-19
- 触发：承接 `docs/tasks/2026-10-19-mp-voice-channel-feasibility.md` 方案 A（POC 三问已全过）。当前 `api/speech.uts` 的 `speak()` 在 MP-WEIXIN 走 `speakSilent`（只字幕不出声），需新增官方通道让面试官真正出声。
- 状态：已冻结，待实施
- 双签：服务端 ✓ 客户端 ✓（新增端点 + 新增客户端 api 模块；既有端点全部零变更）

## 变更内容

| 项     | 变更前                                                | 变更后                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 端点   | 无 TTS 通道                                           | 新增 `POST /interview/tts`（`requireAuth`）；请求 `{ text }`，响应 `okData({ fileID, provider, format, chars })`                                                                                             |
| 服务端 | 无 TTS 能力                                           | 新增 `services/tts.ts` 驱动注册表 `ttsProvider: stub \| probe \| tencent`；`services/wx-storage.ts` 写云存储拿 `fileID`；`services/wx-access-token.ts` 与 ASR 共享 access_token 缓存                         |
| 客户端 | `api/speech.uts speak()` MP-WEIXIN 直接 `speakSilent` | 新增 `api/tts.uts`（`requestTts`）；`speak()` 改为「取 fileID → `InnerAudioContext.src = fileID`」；无 fileID/失败才回退 `speakSilent`                                                                       |
| 配置   | `config.ts` 无 TTS 项                                 | 新增 `ttsProvider`(默认 `stub`)、`tencentSecretId`、`tencentSecretKey`、`tencentTtsRegion`(默认 `ap-guangzhou`)、`tencentTtsVoiceType`(默认 `101001`)、`wxCloudEnvId`(默认 `prod-d6gaa83ds8accb61b`，非密钥) |

## 端点契约（逐字）

```
POST /interview/tts          （requireAuth；JSON）
请求体：{ "text": string }   // 题面/追问文本，长度上限 200 字（超限截断，不报错）

成功：{ code: 0, message: "", data: { fileID, provider, format, chars } }
      fileID   string  // 'cloud://…' 可直接作 InnerAudioContext.src；降级时为空串
      provider string  // 'stub' | 'probe' | 'tencent'
      format   string  // 'mp3' | 'wav'；降级时为空串
      chars    number  // 实际送入合成的字符数

诚实降级（不伪造音频）：合成不可用（缺密钥 / 云存储写入失败 / text 为空）→ 仍返回 code:0，
      fileID='' 且 format=''；客户端据此回退 speakSilent（只字幕），流程不阻塞。
业务失败：text 缺失或非字符串 → fail(400, '缺少文本')。
```

## 不变项（兼容性）

- `POST /interview/asr`：multipart 字段 `audio`，出参 `{ text, confidence }` **零变更**。
- `api/speech.uts` 对外导出不变：`speak(text): TtsHandle`、`onTtsState(cb)`、`speechCapability()` 签名与语义（`start`/`end` 事件）保持；调用方（面试房间/训练页）**零改动**。
- App/H5 分支维持既有降级（App TTS 原生层仍待补，本卡不触及）。
- 隐私红线：**云存储只存合成音频，不存用户录音**；不新增本地落盘。
- `manifest.json` 零改动（不再依赖 wechatSI 插件，也不再声明它）。

## 核验命令

```bash
cd server && npx vitest run src/tts.spec.ts src/asr-wx.spec.ts   # 预期：全绿（含签名固定向量 + 降级用例）
grep -n "interview/tts" server/src/routes/interview.ts            # 预期：路由已注册
grep -n "requestTts" api/tts.uts api/speech.uts                    # 预期：客户端接线
grep -n "ttsProvider" server/src/config.ts server/.env.example    # 预期：config 与示例同步
```
