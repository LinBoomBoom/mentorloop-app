// ASR 转写服务（P2-13）：上传音频 → 驱动识别 → 返回 { text, confidence }
// 策略（与支付双模式同构）：
//   - ASR_PROVIDER=stub（默认）：不伪造转写（文档 04：避免污染证据链），返回空文本，
//     客户端据此走既有「文字作答」降级提示。
//   - ASR_PROVIDER=aliyun：阿里云智能语音交互（NLS）录音文件识别 FileTrans，
//     需 ASR_ALIYUN_ACCESS_KEY_ID/SECRET/APPKEY 齐全；音频需为公网可访问链接
//     （生产由对象存储提供 FileLink），本地上传文件由路由落盘后交给驱动，
//     驱动若拿不到公网链接则明确降级。
// 实现：驱动注册表 getAsrDriver(env)；签名采用阿里云 RPC 风格（HMAC-SHA1，
// RFC3986 编码），aliyunSign 可被单测固定向量校验。
import { createHmac } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { Env } from '../config.js'

export type AsrResult = { text: string; confidence: number }
export type AsrDriverOpts = { timeoutMs: number }
export type AsrDriver = {
  name: string
  transcribe(filePath: string, opts: AsrDriverOpts): Promise<AsrResult>
}

// ---------------- stub（默认，明确降级） ----------------

export const stubDriver: AsrDriver = {
  name: 'stub',
  async transcribe(_filePath: string, _opts: AsrDriverOpts): Promise<AsrResult> {
    // 无真实引擎：返回空文本（不伪造转写，客户端提示文字作答）
    return { text: '', confidence: 0 }
  }
}

// ---------------- 阿里云 NLS FileTrans ----------------

// RFC3986 百分号编码（encodeURIComponent 未转义的字符需补充）
function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

// 阿里云 RPC 签名：StringToSign = HTTPMethod & "/" & canonicalizedQuery（参数排序后编码拼接）
// 供 FileTrans 的 SubmitTask/GetTask 等 RPC 接口使用；固定向量单测锁定算法。
export function aliyunSign(
  method: string,
  params: { [k: string]: string },
  secret: string
): string {
  const keys = Object.keys(params).sort()
  const parts: string[] = []
  for (const k of keys) {
    parts.push(percentEncode(k) + '=' + percentEncode(params[k]))
  }
  const canonical = parts.join('&')
  const stringToSign = method + '&%2F&' + percentEncode(canonical)
  return createHmac('sha1', secret + '&')
    .update(stringToSign)
    .digest('base64')
}

// 构建 RPC 通用参数集（公共签名面）
function rpcParams(
  action: string,
  accessKeyId: string,
  secret: string,
  extra: { [k: string]: string }
): { [k: string]: string } {
  const nowIso = new Date().toISOString()
  // 阿里云 RPC 时间戳形如 2026-09-24T08:00:00.000Z
  const timestamp = nowIso.replace(/\.\d{3}Z$/, 'Z')
  const params: { [k: string]: string } = {
    Action: action,
    Version: '2018-08-17',
    Format: 'JSON',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: randomUUID().replaceAll('-', ''),
    Timestamp: timestamp,
    ...extra
  }
  params['Signature'] = aliyunSign('GET', params, secret)
  return params
}

function rpcQuery(params: { [k: string]: string }): string {
  const keys = Object.keys(params).sort()
  const parts: string[] = []
  for (const k of keys) {
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
  }
  return parts.join('&')
}

async function rpcGet(
  base: string,
  params: { [k: string]: string },
  timeoutMs: number
): Promise<any> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const res = await fetch(base + '?' + rpcQuery(params), { method: 'GET', signal: timeout })
  if (!res.ok) {
    throw new Error('ASR_HTTP_' + res.status)
  }
  return res.json()
}

// 拖住文本：解析 FileTrans 任务结果 JSON（数组形式每句一段）
function extractText(resultJson: any): string {
  try {
    if (resultJson == null) return ''
    // 结果可能为 JSON 字符串或对象数组；逐句取 text 拼接
    let arr: any = resultJson
    if (typeof resultJson === 'string') {
      arr = JSON.parse(resultJson)
    }
    if (!Array.isArray(arr)) return ''
    let text = ''
    for (const it of arr) {
      const t = it != null && it.text != null ? String(it.text) : ''
      if (t.length > 0) text += t
    }
    return text
  } catch {
    return ''
  }
}

export function createAliyunDriver(opts: {
  accessKeyId: string
  accessKeySecret: string
  appKey: string
  region: string
}): AsrDriver {
  // 依赖不可用（缺密钥/缺公网链接）→ 明确降级，禁止伪造文本
  const ready =
    opts.accessKeyId.length > 0 && opts.accessKeySecret.length > 0 && opts.appKey.length > 0
  const endpoint = `https://nls-filetrans.${opts.region.length > 0 ? opts.region : 'cn-shanghai'}.aliyuncs.com`
  return {
    name: 'aliyun',
    async transcribe(filePath: string, o: AsrDriverOpts): Promise<AsrResult> {
      if (!ready) {
        console.warn('[asr] aliyun 密钥未配置，降级为空转写')
        return { text: '', confidence: 0 }
      }
      // FileTrans 需公网可访问的音频链接（生产由对象存储提供）；本地临时文件无法直接提交
      if (filePath.indexOf('http://') !== 0 && filePath.indexOf('https://') !== 0) {
        console.warn('[asr] 音频需公网链接（待接入对象存储），降级为空转写')
        return { text: '', confidence: 0 }
      }
      const timeoutMs = o.timeoutMs > 0 ? o.timeoutMs : 30000
      const submit = await rpcGet(
        endpoint,
        rpcParams('SubmitTask', opts.accessKeyId, opts.accessKeySecret, {
          Task: 'SubmitTask',
          Appkey: opts.appKey,
          FileLink: filePath
        }),
        timeoutMs
      )
      const taskId = submit != null ? (submit.TaskId ?? submit.taskId) : ''
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('ASR_SUBMIT_FAILED')
      }
      // 轮询任务状态（最长 timeoutMs）
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const state = await rpcGet(
          endpoint,
          rpcParams('GetTask', opts.accessKeyId, opts.accessKeySecret, {
            Task: 'GetTask',
            TaskId: taskId
          }),
          timeoutMs
        )
        const status = state != null ? state.Status : ''
        if (status === 'SUCCESS' || status === 'FAILED') {
          const taskResult = state != null && state.TaskResult != null ? state.TaskResult : null
          if (status === 'SUCCESS' && taskResult != null) {
            return { text: extractText(taskResult.Result), confidence: 1 }
          }
          throw new Error('ASR_TASK_FAILED')
        }
        if (Date.now() >= deadline) {
          throw new Error('ASR_TIMEOUT')
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }
}

export const aliyunDriver: AsrDriver = createAliyunDriver({
  accessKeyId: '',
  accessKeySecret: '',
  appKey: '',
  region: ''
})

// 注册表：按配置选择驱动（默认 stub）
export function getAsrDriver(env: Env): AsrDriver {
  if (env.asrProvider === 'aliyun') {
    return createAliyunDriver({
      accessKeyId: env.asrAliyunAccessKeyId,
      accessKeySecret: env.asrAliyunAccessKeySecret,
      appKey: env.asrAliyunAppKey,
      region: env.asrAliyunRegion
    })
  }
  return stubDriver
}

export interface AsrDriverFactory {
  (env: Env): AsrDriver
}
