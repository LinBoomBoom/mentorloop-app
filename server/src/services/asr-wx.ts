// 微信「语音上传+翻译」ASR 驱动（免费能力，无需额外开通，复用 WX_APPID/WX_SECRET）
// 契约（微信开放文档 · 语音上传+翻译）：
//   1. access_token：见 services/wx-access-token.ts（与 TTS 云存储共享同一份缓存）
//   2. 提交：POST /cgi-bin/media/voice/addvoicetorecofortext
//      ?access_token=&format=mp3&voice_id=&lang=zh_CN，body 为音频二进制
//      （音频硬限 1MB，超限 errcode 40010）
//   3. 轮询：POST /cgi-bin/media/voice/queryvoicetorecofortext
//      ?access_token=&voice_id=&lang=zh_CN；errcode=0 且 data 非空 → 完成（data 即文本），
//      data 为空 → 处理中，继续轮询
//   4. errcode 40001（credential 失效）→ 清 token 缓存重取后重试一次（提交/轮询各限一次，防死循环）
// 约束：不持久化音频（路由层 finally unlink，本驱动只读临时文件）；
//       缺密钥诚实降级空文本（与 stub 同策略，不伪造转写）。
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { AsrDriver, AsrDriverOpts, AsrResult } from './asr.js'
import { getWxAccessToken, resetWxAccessTokenCache } from './wx-access-token.js'

// 微信侧音频硬限 1MB（errcode 40010）
const MAX_AUDIO_BYTES = 1024 * 1024
// 轮询间隔（微信语音 ≤60s，识别通常数秒内完成）
const POLL_INTERVAL_MS = 500

const API_BASE = 'https://api.weixin.qq.com'

// 测试辅助：清空 token 缓存（保留旧导出名，既有 spec 零改动）
export function resetWxAsrTokenCache(): void {
  resetWxAccessTokenCache()
}

async function fetchJson(
  url: string,
  init: { method?: string; body?: Uint8Array } | undefined,
  timeoutMs: number
): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    throw new Error('ASR_WX_HTTP_' + res.status)
  }
  return res.json()
}

// 获取 access_token（force=true 强制重取，用于 40001 恢复）—— 复用共享缓存模块
function getToken(
  appId: string,
  secret: string,
  timeoutMs: number,
  force: boolean
): Promise<string> {
  return getWxAccessToken({ appId, secret, timeoutMs, force })
}

function wxQuery(path: string, token: string, extra: Record<string, string>): string {
  let q = API_BASE + path + '?access_token=' + encodeURIComponent(token)
  for (const k of Object.keys(extra)) {
    q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extra[k])
  }
  return q
}

export function createWxAsrDriver(opts: {
  appId: string
  secret: string
  lang: string
}): AsrDriver {
  // 依赖不可用 → 明确降级（不伪造转写），与 stub 同策略
  const ready = opts.appId.length > 0 && opts.secret.length > 0
  const lang = opts.lang.length > 0 ? opts.lang : 'zh_CN'
  return {
    name: 'wx',
    async transcribe(filePath: string, o: AsrDriverOpts): Promise<AsrResult> {
      if (!ready) {
        console.warn('[asr-wx] WX_APPID/WX_SECRET 未配置，降级为空转写')
        return { text: '', confidence: 0 }
      }
      const timeoutMs = o.timeoutMs > 0 ? o.timeoutMs : 30000
      // 单个微信 API 请求超时：不超过整体预算，上限 10s
      const reqTimeout = Math.min(timeoutMs, 10000)
      const buf = await readFile(filePath)
      if (buf.length > MAX_AUDIO_BYTES) {
        throw new Error('ASR_WX_FILE_TOO_LARGE')
      }
      const voiceId = randomUUID()

      // 提交（40001 → 强制刷新 token 后重试一次）
      const submitWith = (token: string) =>
        fetchJson(
          wxQuery('/cgi-bin/media/voice/addvoicetorecofortext', token, {
            format: 'mp3',
            voice_id: voiceId,
            lang: lang
          }),
          { method: 'POST', body: new Uint8Array(buf) },
          reqTimeout
        )
      let token = await getToken(opts.appId, opts.secret, reqTimeout, false)
      let submitRes = await submitWith(token)
      if (submitRes != null && submitRes.errcode === 40001) {
        token = await getToken(opts.appId, opts.secret, reqTimeout, true)
        submitRes = await submitWith(token)
      }
      if (submitRes == null || submitRes.errcode !== 0) {
        const code = submitRes != null ? submitRes.errcode : 'null'
        throw new Error('ASR_WX_SUBMIT_' + code)
      }

      // 轮询识别结果（处理中 = errcode 0 且 data 为空）
      const deadline = Date.now() + timeoutMs
      let refreshed = false
      for (;;) {
        const r = await fetchJson(
          wxQuery('/cgi-bin/media/voice/queryvoicetorecofortext', token, {
            voice_id: voiceId,
            lang: lang
          }),
          { method: 'POST' },
          reqTimeout
        )
        if (r != null && r.errcode === 40001 && !refreshed) {
          refreshed = true
          token = await getToken(opts.appId, opts.secret, reqTimeout, true)
          continue
        }
        if (r == null || r.errcode !== 0) {
          throw new Error('ASR_WX_QUERY_' + (r != null ? r.errcode : 'null'))
        }
        const text = typeof r.data === 'string' ? r.data : ''
        if (text.length > 0) {
          return { text: text, confidence: 1 }
        }
        if (Date.now() >= deadline) {
          throw new Error('ASR_WX_TIMEOUT')
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    }
  }
}
