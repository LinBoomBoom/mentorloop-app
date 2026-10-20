// 微信服务端 API 的 HTTP 通道（api.weixin.qq.com）
//
// 为什么需要这层：
// 微信云托管容器内访问 api.weixin.qq.com 时，流量会被「云调用」网关接管，网关使用自签证书，
// Node 默认 TLS 校验必然失败（DEPTH_ZERO_SELF_SIGNED_CERT，官方 FAQ 有记载）。
// 本仓不采用全局 NODE_TLS_REJECT_UNAUTHORIZED=0（会把腾讯云 TTS 等其他出网一起降级），
// 而是「默认严格校验，仅当确证是自签证书错误时，才对这一条请求走 https 放宽校验」。
// 放宽范围仅限 api.weixin.qq.com，且该链路始终在微信云内网，不经过公网。
import { request as httpsRequest } from 'node:https'

// 判定是否「云调用网关自签证书」这一类 TLS 失败
const SELF_SIGNED_CODES = [
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
]

export function isSelfSignedCertError(e: any): boolean {
  const cause = e != null && e.cause != null ? e.cause : e
  const code = cause != null ? String(cause.code ?? '') : ''
  return SELF_SIGNED_CODES.indexOf(code) >= 0
}

export type WxHttpResponse = { status: number; body: string }

// 以「放宽证书校验」方式发一次请求（仅用于 api.weixin.qq.com）
export function wxApiRequestLoose(opts: {
  url: string
  method?: 'GET' | 'POST'
  jsonBody?: any
  timeoutMs: number
}): Promise<WxHttpResponse> {
  const u = new URL(opts.url)
  const method = opts.method ?? 'GET'
  const payload = opts.jsonBody != null ? JSON.stringify(opts.jsonBody) : null
  const headers: { [k: string]: string } = {}
  if (payload != null) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(Buffer.byteLength(payload))
  }
  return new Promise<WxHttpResponse>((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port.length > 0 ? u.port : 443,
        path: u.pathname + u.search,
        method: method,
        headers: headers,
        // 仅对本通道放宽：网关自签证书由微信云签发，公开根证书库中不存在
        rejectUnauthorized: false
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        })
      }
    )
    req.setTimeout(opts.timeoutMs, () => {
      req.destroy(new Error('WX_HTTP_TIMEOUT'))
    })
    req.on('error', (e) => reject(e))
    if (payload != null) req.write(payload)
    req.end()
  })
}

// 统一入口：先走标准 fetch（严格校验）；命中自签证书错误才回退放宽通道
export async function wxApiFetch(opts: {
  url: string
  method?: 'GET' | 'POST'
  jsonBody?: any
  timeoutMs: number
}): Promise<WxHttpResponse> {
  const method = opts.method ?? 'GET'
  const headers: { [k: string]: string } = {}
  let body: string | undefined
  if (opts.jsonBody != null) {
    body = JSON.stringify(opts.jsonBody)
    headers['Content-Type'] = 'application/json'
  }
  try {
    const res = await fetch(opts.url, {
      method: method,
      headers: headers,
      body: body,
      signal: AbortSignal.timeout(opts.timeoutMs)
    })
    return { status: res.status, body: await res.text() }
  } catch (e) {
    if (!isSelfSignedCertError(e)) throw e
    console.warn('[wx-http] 云调用网关自签证书，对 api.weixin.qq.com 单次放宽校验')
    return wxApiRequestLoose(opts)
  }
}
