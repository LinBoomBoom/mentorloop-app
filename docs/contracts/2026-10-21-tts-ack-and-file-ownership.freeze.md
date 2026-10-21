# 契约冻结：TTS 回收回执 + cloud fileID 属主校验

- 日期：2026-10-21
- 触发：系统问题清单 P1-4（云存储堆积/注销不清云对象）与 P2-6（`cloud://` fileID 无属主校验）；批次 1+2 任务卡见 [2026-10-21-voice-storage-hardening.md](../tasks/2026-10-21-voice-storage-hardening.md)
- 状态：已冻结，待实施
- 双签：服务端 ✓ 客户端 ✓

## 变更内容

| 项     | 变更前                                                     | 变更后                                                                                                               |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 端点   | 无 TTS 回收通道                                            | 新增 `POST /interview/tts-ack`（`requireAuth`，JSON），客户端播放结束后通知服务端删除合成对象                        |
| 端点   | `/interview/asr-cloud` 仅校验 `cloud://` 前缀              | 增加属主校验：path 必须以 `asr/<uid>/` 开头，否则 `fail(403, '无权访问该文件')`                                      |
| 端点   | `/resume/parse` 对 `fileUrl` 无格式约束                    | `cloud://` 形态增加属主校验：path 必须以 `resumes/<uid>/` 开头，否则 `fail(403, '无权访问该文件')`；本地路径语义不变 |
| 客户端 | `asr/<时间戳>-<随机>.mp3`、`resumes/<时间戳>-<随机>.<ext>` | 上传路径改为 `asr/<uid>/…`、`resumes/<uid>/…`                                                                        |
| 服务端 | TTS 写入 `tts/<tag>/<ymd>/…`                               | 写入 `tts/<uid>/<tag>/<ymd>/…`                                                                                       |
| 服务端 | 注销仅删除本地 `resumes/` 文件                             | 注销额外收集该用户 `cloud://` 简历对象，调用 `/tcb/batchdeletefile` 批量删除（best-effort）                          |

## 端点契约（逐字）

```
POST /interview/tts-ack       （requireAuth；JSON）
请求体：{ "fileID": string }   // 必须是本次面试合成返回的 cloud:// fileID

成功：{ code: 0, message: "", data: null }   // 删除成功或删除不可用（best-effort）均返回成功
业务失败：
  fileID 缺失或非字符串       → fail(400, '缺少文件ID')
  非 cloud:// 形态            → fail(400, '文件ID格式不正确')
  非本人 tts/<uid>/ 路径      → fail(403, '无权访问该文件')
```

```
POST /interview/asr-cloud     （requireAuth；JSON）
请求体：{ "fileID": string }

成功：{ code: 0, message: "", data: { text, confidence } }   // 出参形状零变更
业务失败：
  fileID 缺失或非字符串       → fail(400, '缺少文件ID')          （既有，零变更）
  非 cloud:// 形态            → fail(400, '文件ID格式不正确')    （既有，零变更）
  非本人 asr/<uid>/ 路径      → fail(403, '无权访问该文件')       （新增）
```

```
POST /resume/parse            （requireAuth；JSON）
请求体：{ "fileUrl": string }  // cloud:// fileID 或本地路径

成功：{ code: 0, message: "", data: ResumeParseResult }        // 出参形状零变更
业务失败：
  cloud:// 且非本人 resumes/<uid>/ 路径 → fail(403, '无权访问该文件')   （新增）
```

## 不变项（兼容性）

- `/interview/asr`（multipart）零变更；App 端既有上行路径不受影响。
- `/interview/tts` 出参 `{ fileID, provider, format, chars }` 零变更；仅内部写入路径增加 uid 段。
- 统一响应封装 `{ code, data, message }` 不变；403 复用既有业务失败形态。
- 客户端 API 导出签名不变：`uploadAsrCloud(audioPath)`、`uploadResumeFile(filePath, ext)`、`parseResume(fileUrl)`、`requestTts(text)`；仅新增 `ackTts(fileID)`。
- 隐私红线：ASR 录音对象仍在客户端 finally 立即删除；TTS 对象为合成音频（非用户录音），由 ack 回收。
- 数据库结构零变更（不新增 TTS 文件表）。

## 影响面

- 旧版本客户端上传路径不含 uid，将被 403 拒绝；小程序尚未发布，无线上存量客户端（任务卡风险表已登记）。
- 服务端 `getTtsDriver` 合成时需传入 uid；`TtsDriverOpts` 增加可选 `uid`，缺省 `anon` 仅用于单测。
- 注销流程新增一次外部 HTTP 调用；无凭据或失败仅告警，不影响数据库级联删除与幂等返回。

## 核验命令

```bash
cd server && npx vitest run src/asr-cloud.spec.ts src/tts.spec.ts src/me.spec.ts
grep -n "tts-ack\|isOwnedCloudFileID" server/src/routes/interview.ts server/src/services/asr-cloud.ts
grep -n "tts/<uid>\|resumes/<uid>\|asr/<uid>" api/asr.uts api/resume.uts server/src/services/tts.ts
grep -n "batchdeletefile" server/src/services/wx-storage.ts
```
