# 契约冻结：录音作答上行（云存储中转 → 微信 ASR）

- 日期：2026-10-21
- 触发：真机复验发现「录入声音不行」。根因链：MP 实时识别依赖 wechatSI（个人主体不可用）→ 转写文本恒空 → MP 分支从不调用云端 ASR；且 `upload()` 需公网 `BASE_URL`（云托管默认域名不可配）→ 无上行通道。
- 状态：已冻结，待实施
- 双签：服务端 ✓ 客户端 ✓

## 变更内容

| 项     | 变更前                                            | 变更后                                                                                                                  |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 端点   | 仅 `POST /interview/asr`（multipart，需公网域名） | 新增 `POST /interview/asr-cloud`（`requireAuth`，JSON，走 callContainer 私有链路，免域名）                              |
| 服务端 | 无 fileID 取音频能力                              | `wx-storage.ts` 增 `getCloudFileTempUrl`（`/tcb/batchdownloadfile`）；路由按 fileID 取字节转写                          |
| 客户端 | MP 停止录音后直接用（恒空的）实时识别文本         | `api/asr.uts` 增 `uploadAsrCloud`：`wx.cloud.uploadFile` → `POST /interview/asr-cloud` → `wx.cloud.deleteFile` 即刻清理 |
| 配置   | 云端 `ASR_PROVIDER` 未设（默认 stub）             | 注入 `ASR_PROVIDER=wx`（复用已有 `WX_APPID/WX_SECRET`）                                                                 |

## 端点契约（逐字）

```
POST /interview/asr-cloud     （requireAuth；JSON）
请求体：{ "fileID": string }   // cloud:// 文件 ID（客户端 wx.cloud.uploadFile 返回）

成功：{ code: 0, message: "", data: { text, confidence } }
      text       string   // 识别文本；不可用时为空串
      confidence number   // 0 表示降级

诚实降级（不伪造转写）：驱动不可用 / 取音频失败 / 转写失败 → code:0，text=''，confidence=0
业务失败：fileID 缺失或非字符串 → fail(400, '缺少文件ID')
```

## 不变项（兼容性）

- `POST /interview/asr`（multipart）**零变更**，App 端既有路径不受影响。
- `api/asr.uts` 既有导出 `uploadAsr(audioPath)` 保持不变；仅新增 `uploadAsrCloud`。
- `speech.uts` 对外导出不变；房间页仅在 `handleRecordingStopped` 的 MP 分支增加「实时文本为空则走云存储转写」。
- 隐私红线：转写完成后**立即删除**云存储中的录音对象（best-effort），不保留任何用户录音。

## 核验命令

```bash
cd server && npx vitest run src/asr-cloud.spec.ts src/asr-wx.spec.ts
grep -n "interview/asr-cloud" server/src/routes/interview.ts
grep -n "uploadAsrCloud" api/asr.uts pages/interview/room.uvue
grep -n "ASR_PROVIDER" server/.env.example
```
