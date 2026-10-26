// 腾讯云 API 通用 TC3-HMAC-SHA256 签名
// 供 TTS / SMS 等腾讯云服务复用；固定 timestamp 即可锁定签名向量
import { createHash, createHmac } from 'node:crypto'

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

// 返回可直接拼进 fetch 的请求头（含 Authorization）
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
