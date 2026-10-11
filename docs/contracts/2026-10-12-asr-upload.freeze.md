# 契约冻结：ASR 上传封装与 wx 转写驱动

- 日期：2026-10-12
- 触发：P0 收尾第 5 项（ASR 上传无统一通道：api/asr.uts 自拼 uni.uploadFile 无鉴权头，真模式被 requireAuth 401 拒绝；服务端缺低成本转写驱动）
- 状态：已实施（客户端 api 层 + 服务端驱动 + 双侧测试）
- 双签：服务端 ✓ 客户端 ✓（/interview/asr 出入参零变更，新增能力均为增量）

## 变更内容

| 项         | 变更前                                                 | 变更后                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 客户端上传 | api/asr.uts 自拼 `uni.uploadFile`，无 Authorization 头 | 新增 `api/client.uts upload(path, filePath, name, formData?, timeoutMs?)` 统一通道：注入 Bearer token、401 自动登出、业务码/HTTP 统一处理；asr.uts 改为接线调用                                                 |
| 上传链路   | 仅 BASE_URL 直连                                       | MP-WEIXIN 与 App/H5 均走公网 BASE_URL + uni.uploadFile（callContainer 请求包 100KB 硬限不支持文件，云链路明确不承载上传）                                                                                       |
| 服务端驱动 | `asrProvider: stub \| aliyun`                          | 新增 `'wx'`：微信「语音上传+翻译」（免费，复用 WX_APPID/WX_SECRET，音频硬限 1MB mp3 16k 单声道；addvoicetorecofortext 提交 + queryvoicetorecofortext 轮询，token 模块级缓存提前 5min 刷新，40001 自动恢复一次） |
| 启动自检   | 无                                                     | `api/env.uts warnIfBaseUrlMissing()`：非 mock 且 BASE_URL 为空时 console.error（initCloud 启动调用）；upload() 在 BASE_URL 为空时显式 reject（不静默失败）                                                      |

## 不变项（兼容性）

- `POST /interview/asr`：multipart 字段 `audio`，出参 `{ text, confidence }` 零变更；转写失败仍返回 `code=0` + 空文本（诚实降级，不卡流程）。
- `api/asr.uts` 对外导出 `uploadAsr(audioPath): Promise<AsrResponse>` 签名不变，调用方（api/speech.uts transcribeCloud）零改动。
- MP-WEIXIN 普通 JSON 请求仍走 callContainer 私有链路，不依赖 BASE_URL；仅文件上传走公网域名（部署后回填 `api/env.uts API_BASE_URL`）。
- 隐私红线：录音不持久化（路由层 finally unlink，wx 驱动只读临时文件）；转写失败不伪造文本。

## 核验命令

```bash
cd server && npx vitest run src/asr-wx.spec.ts   # 预期：6 用例全绿
grep -n "'wx'" server/src/config.ts              # 预期：asrProvider 联合类型含 wx
grep -n "export function upload" api/client.uts  # 预期：统一上传通道
grep -n "upload(" api/asr.uts                    # 预期：不再自拼 uni.uploadFile
```
