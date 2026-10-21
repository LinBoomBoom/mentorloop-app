// 面试官 TTS 下行：文本 → 合成音频 → 写入微信云存储 → 返回 cloud:// fileID
// 契约：docs/contracts/2026-10-19-tts-outbound.freeze.md
// 驱动注册表（与 asr.ts 同构，诚实降级不伪造音频）：
//   - stub（默认）：直接返回空 fileID，客户端回退 speakSilent（只字幕）
//   - probe：内置探针音（440Hz 方波短音，仅链路验证），provider 明标 probe
//   - tencent：腾讯云语音合成 TextToVoice（TC3-HMAC-SHA256 签名，mp3 16k）
// 关键约束：本服务只写合成音频，绝不落任何用户录音；合成失败一律返回空 fileID。
import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { Env } from '../config.js'
import { uploadToWxCloud } from './wx-storage.js'

// 题面/追问送入合成的长度上限（契约：超限截断，不报错）
export const MAX_TTS_CHARS = 200

// 单次合成 + 写存储的整体预算（TTS 通常 1~3s，云存储 1~2s）
export const TTS_TIMEOUT_MS = 20000

export type TtsProvider = 'stub' | 'probe' | 'tencent'

export type TtsResult = {
  fileID: string // cloud://…；降级时为空串
  provider: TtsProvider
  format: string // mp3 | wav；降级时为空串
  chars: number // 实际送入合成的字符数
}

export type TtsDriverOpts = { timeoutMs: number; uid?: string }

export type TtsDriver = {
  name: TtsProvider
  synthesize(text: string, opts: TtsDriverOpts): Promise<TtsResult>
}

// 按契约截断（超 200 字不报错）
export function clampTtsText(text: string): string {
  return text.length > MAX_TTS_CHARS ? text.substring(0, MAX_TTS_CHARS) : text
}

// ---------------- TC3-HMAC-SHA256 签名（腾讯云 API 通用） ----------------

export type Tc3Params = {
  secretId: string
  secretKey: string
  token?: string
  host: string
  service: string
  action: string
  version: string
  region: string
  payload: string
  timestamp: number // 秒级，单测固定向量使用
}

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex')
const hmac = (key: Buffer | string, s: string): Buffer =>
  createHmac('sha256', key).update(s).digest()

// 返回可直接拼进 fetch 的请求头（含 Authorization）；固定 timestamp 即可锁定向量
export function tc3Headers(p: Tc3Params): { [k: string]: string } {
  const date = new Date(p.timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders =
    'content-type:application/json; charset=utf-8\n' +
    'host:' +
    p.host +
    '\n' +
    'x-tc-action:' +
    p.action.toLowerCase() +
    '\n'
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(p.payload)
  ].join('\n')
  const scope = date + '/' + p.service + '/tc3_request'
  const stringToSign = ['TC3-HMAC-SHA256', p.timestamp, scope, sha256Hex(canonicalRequest)].join(
    '\n'
  )
  const kDate = hmac('TC3' + p.secretKey, date)
  const kService = hmac(kDate, p.service)
  const kSigning = hmac(kService, 'tc3_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  const headers: { [k: string]: string } = {
    Authorization:
      'TC3-HMAC-SHA256 Credential=' +
      p.secretId +
      '/' +
      scope +
      ', SignedHeaders=' +
      signedHeaders +
      ', Signature=' +
      signature,
    'Content-Type': 'application/json; charset=utf-8',
    Host: p.host,
    'X-TC-Action': p.action,
    'X-TC-Version': p.version,
    'X-TC-Timestamp': String(p.timestamp),
    'X-TC-Region': p.region
  }
  if (p.token != null && p.token.length > 0) headers['X-TC-Token'] = p.token
  return headers
}

// ---------------- stub（默认，明确降级） ----------------

export const stubTtsDriver: TtsDriver = {
  name: 'stub',
  async synthesize(text: string): Promise<TtsResult> {
    return { fileID: '', provider: 'stub', format: '', chars: clampTtsText(text).length }
  }
}

// ---------------- 探针音（仅链路验证） ----------------

// 生成 16k 单声道 PCM16 WAV（440Hz 正弦，默认 0.6s）——无需外部依赖
export function buildProbeWav(seconds: number = 0.6, freq: number = 440): Uint8Array {
  const sampleRate = 16000
  const total = Math.max(1, Math.round(sampleRate * seconds))
  const dataBytes = total * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16) // fmt 块长度
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // 单声道
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // 字节率
  buf.writeUInt16LE(2, 32) // 块对齐
  buf.writeUInt16LE(16, 34) // 位深
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(dataBytes, 40)
  // 首尾各 20ms 淡入淡出，避免爆音
  const fade = Math.round(sampleRate * 0.02)
  for (let i = 0; i < total; i++) {
    const env = i < fade ? i / fade : i > total - fade ? (total - i) / fade : 1
    const v = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.3 * env
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return new Uint8Array(buf)
}

export function createProbeDriver(storage: StorageOpts): TtsDriver {
  return {
    name: 'probe',
    async synthesize(text: string, o: TtsDriverOpts): Promise<TtsResult> {
      const chars = clampTtsText(text).length
      const fileID = await writeAudio(storage, buildProbeWav(), 'wav', o.timeoutMs, 'probe', o.uid)
      return {
        fileID: fileID,
        provider: 'probe',
        format: fileID.length > 0 ? 'wav' : '',
        chars: chars
      }
    }
  }
}

// ---------------- 腾讯云语音合成 TextToVoice ----------------

const TTS_HOST = 'tts.tencentcloudapi.com'
const TTS_SERVICE = 'tts'
const TTS_ACTION = 'TextToVoice'
const TTS_VERSION = '2019-08-23'

export function createTencentDriver(opts: {
  secretId: string
  secretKey: string
  region: string
  voiceType: number
  storage: StorageOpts
}): TtsDriver {
  const ready = opts.secretId.length > 0 && opts.secretKey.length > 0
  return {
    name: 'tencent',
    async synthesize(text: string, o: TtsDriverOpts): Promise<TtsResult> {
      const content = clampTtsText(text)
      const chars = content.length
      if (content.length === 0) {
        return { fileID: '', provider: 'tencent', format: '', chars: 0 }
      }
      if (!ready) {
        console.warn('[tts] 腾讯云密钥未配置，降级为字幕模式')
        return { fileID: '', provider: 'tencent', format: '', chars: chars }
      }
      const payload = JSON.stringify({
        Text: content,
        SessionId: randomUUID().replaceAll('-', ''),
        ModelType: 1,
        VoiceType: opts.voiceType,
        Codec: 'mp3',
        SampleRate: 16000,
        Speed: 0,
        Volume: 0,
        ProjectId: 0,
        PrimaryLanguage: 1,
        EnableSubtitle: false
      })
      const res = await fetch('https://' + TTS_HOST, {
        method: 'POST',
        headers: tc3Headers({
          secretId: opts.secretId,
          secretKey: opts.secretKey,
          host: TTS_HOST,
          service: TTS_SERVICE,
          action: TTS_ACTION,
          version: TTS_VERSION,
          region: opts.region,
          payload: payload,
          timestamp: Math.floor(Date.now() / 1000)
        }),
        body: payload,
        signal: AbortSignal.timeout(o.timeoutMs)
      })
      if (!res.ok) throw new Error('TTS_HTTP_' + res.status)
      const body: any = await res.json()
      const r = body != null ? body.Response : null
      if (r == null) throw new Error('TTS_EMPTY_RESPONSE')
      if (r.Error != null) {
        throw new Error('TTS_' + String(r.Error.Code) + '_' + String(r.Error.Message))
      }
      if (typeof r.Audio !== 'string' || r.Audio.length === 0) {
        throw new Error('TTS_EMPTY_AUDIO')
      }
      const audio = new Uint8Array(Buffer.from(r.Audio, 'base64'))
      const fileID = await writeAudio(opts.storage, audio, 'mp3', o.timeoutMs, 'tencent', o.uid)
      return {
        fileID: fileID,
        provider: 'tencent',
        format: fileID.length > 0 ? 'mp3' : '',
        chars: chars
      }
    }
  }
}

// ---------------- 云存储写入公共段 ----------------

export type StorageOpts = {
  appId: string
  secret: string
  envId: string
}

// 写云存储；缺凭据或写入失败 → 空串（诚实降级，不抛给路由）
// 路径带 uid 段：播放结束由 /interview/tts-ack 凭同段做属主校验后删除，避免对象堆积
async function writeAudio(
  storage: StorageOpts,
  data: Uint8Array,
  ext: 'mp3' | 'wav',
  timeoutMs: number,
  tag: string,
  uid?: string
): Promise<string> {
  if (storage.appId.length === 0 || storage.secret.length === 0) {
    console.warn('[tts] WX_APPID/WX_SECRET 未配置，无法写云存储，降级为字幕模式')
    return ''
  }
  if (storage.envId.length === 0) {
    console.warn('[tts] 云环境 ID 未配置，无法写云存储，降级为字幕模式')
    return ''
  }
  const d = new Date()
  const ymd =
    d.getFullYear().toString() +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    ('0' + d.getDate()).slice(-2)
  const owner = uid != null && uid.length > 0 ? uid : 'anon'
  const cloudPath = 'tts/' + owner + '/' + tag + '/' + ymd + '/' + randomUUID() + '.' + ext
  try {
    return await uploadToWxCloud({
      appId: storage.appId,
      secret: storage.secret,
      envId: storage.envId,
      cloudPath: cloudPath,
      data: data,
      contentType: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      timeoutMs: timeoutMs
    })
  } catch (e: any) {
    const msg = e != null && e.message != null ? String(e.message) : 'unknown'
    console.warn('[tts] 云存储写入失败，降级为字幕模式：', msg)
    return ''
  }
}

// ---------------- 注册表 ----------------

export function getTtsDriver(env: Env): TtsDriver {
  const storage: StorageOpts = {
    appId: env.wxAppId,
    secret: env.wxSecret,
    envId: env.wxCloudEnvId
  }
  if (env.ttsProvider === 'tencent') {
    return createTencentDriver({
      secretId: env.tencentSecretId,
      secretKey: env.tencentSecretKey,
      region: env.tencentTtsRegion,
      voiceType: env.tencentTtsVoiceType,
      storage: storage
    })
  }
  if (env.ttsProvider === 'probe') {
    return createProbeDriver(storage)
  }
  return stubTtsDriver
}
