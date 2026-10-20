// 微信 access_token 共享缓存（ASR / TTS 云存储 / 未来的其他微信服务端 API 共用）
// 契约（微信开放文档 · 获取接口调用凭据）：
//   GET /cgi-bin/token?grant_type=client_credential&appid=&secret=
//   → { access_token, expires_in }（默认 7200s）
// 策略：进程内模块级缓存，提前 5min 刷新；调用方遇 errcode 40001 时传 force=true 强制重取。
// 注意：多个 appid 不能共用同一缓存（按 appId 分键）。
const API_BASE = 'https://api.weixin.qq.com'
// token 提前刷新余量（5min）
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

let tokenCache: { appId: string; token: string; expiresAt: number } | null = null

// 测试辅助：清空 token 缓存（每个用例独立）
export function resetWxAccessTokenCache(): void {
  tokenCache = null
}

export async function getWxAccessToken(opts: {
  appId: string
  secret: string
  timeoutMs: number
  force?: boolean
}): Promise<string> {
  const force = opts.force === true
  if (
    !force &&
    tokenCache != null &&
    tokenCache.appId === opts.appId &&
    Date.now() < tokenCache.expiresAt
  ) {
    return tokenCache.token
  }
  const url =
    API_BASE +
    '/cgi-bin/token?grant_type=client_credential&appid=' +
    encodeURIComponent(opts.appId) +
    '&secret=' +
    encodeURIComponent(opts.secret)
  const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs) })
  if (!res.ok) {
    throw new Error('WX_TOKEN_HTTP_' + res.status)
  }
  const r: any = await res.json()
  if (r == null || typeof r.access_token !== 'string' || r.access_token.length === 0) {
    const code = r != null ? r.errcode : 'null'
    throw new Error('WX_TOKEN_FAILED_' + code)
  }
  const expiresIn = typeof r.expires_in === 'number' ? r.expires_in : 7200
  tokenCache = {
    appId: opts.appId,
    token: r.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn * 1000 - TOKEN_REFRESH_MARGIN_MS)
  }
  return tokenCache.token
}
