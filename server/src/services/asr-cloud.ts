// 云存储中转转写：fileID → 临时下载链接 → 取音频字节 → 落临时文件 → ASR 驱动 → 清理
// 契约：docs/contracts/2026-10-21-asr-cloud-upload.freeze.md
// 用途：小程序端无公网域名可上传（云托管默认域名不可配），改由 wx.cloud.uploadFile 走私有链路，
//       服务端再凭 fileID 取回音频。隐私：临时文件 finally 删除，不落任何持久化录音。
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Env } from '../config.js'
import { getCloudFileTempUrl } from './wx-storage.js'
import { getAsrDriver, type AsrDriver, type AsrResult } from './asr.js'
import { newId } from '../util.js'

// 微信语音识别硬限 1MB
const MAX_AUDIO_BYTES = 1024 * 1024
// 下载链接有效期（够本次请求取回即可）
const TEMP_URL_MAX_AGE = 300

export async function transcribeByCloudFileID(
  env: Env,
  fileID: string,
  opts: { timeoutMs?: number; driver?: AsrDriver } = {}
): Promise<AsrResult> {
  const timeoutMs = opts.timeoutMs != null && opts.timeoutMs > 0 ? opts.timeoutMs : env.asrTimeoutMs
  const driver = opts.driver != null ? opts.driver : getAsrDriver(env)

  const url = await getCloudFileTempUrl({
    appId: env.wxAppId,
    secret: env.wxSecret,
    envId: env.wxCloudEnvId,
    fileID: fileID,
    maxAgeSeconds: TEMP_URL_MAX_AGE,
    timeoutMs: Math.min(timeoutMs, 10000)
  })

  const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(timeoutMs, 15000)) })
  if (!res.ok) {
    throw new Error('ASR_CLOUD_DOWNLOAD_HTTP_' + res.status)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length === 0) {
    throw new Error('ASR_CLOUD_EMPTY_AUDIO')
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    throw new Error('ASR_CLOUD_TOO_LARGE')
  }

  const tmpPath = join(env.uploadDir, 'asr_' + newId('asr') + '.mp3')
  await writeFile(tmpPath, buf)
  try {
    return await driver.transcribe(tmpPath, { timeoutMs: timeoutMs })
  } finally {
    try {
      await unlink(tmpPath)
    } catch {
      // 忽略清理异常
    }
  }
}
