// 微信云存储写入（服务端通道）
// 契约（微信开放文档 · 云开发 HTTP API / 上传文件）：
//   1. 获取上传链接：POST https://api.weixin.qq.com/tcb/uploadfile?access_token=TOKEN
//      body { env, path } → { url, token, authorization, file_id, cos_file_id }
//   2. 上传：multipart POST 到上一步的 url，字段
//      key=path / Signature=authorization / x-cos-security-token=token /
//      x-cos-meta-fileid=cos_file_id / file=二进制
//   3. 成功返回的 file_id 形如 cloud://<env>.<bucket>/<path>，可直接作 InnerAudioContext.src
// 约束：环境未开通/未绑定时报 85088 → 由上层捕获并诚实降级（不伪造 fileID）。
import { getWxAccessToken } from './wx-access-token.js'
import { wxApiFetch } from './wx-http.js'

const API_BASE = 'https://api.weixin.qq.com'

// 网络层错误取底层原因（Node fetch 把真实原因放在 e.cause）
function netDetail(e: any): string {
  const cause = e != null && e.cause != null ? e.cause : null
  if (cause != null) return String(cause.code ?? cause.message ?? cause)
  return e != null ? String(e.message ?? e) : 'unknown'
}

export type WxCloudUploadOpts = {
  appId: string
  secret: string
  envId: string
  cloudPath: string
  data: Uint8Array
  contentType: string
  timeoutMs: number
}

// 换取上传链接（40001 时强制刷新 token 重试一次）
async function requestUploadTicket(opts: {
  appId: string
  secret: string
  envId: string
  cloudPath: string
  timeoutMs: number
}): Promise<{
  url: string
  token: string
  authorization: string
  fileId: string
  cosFileId: string
}> {
  const call = async (force: boolean) => {
    const accessToken = await getWxAccessToken({
      appId: opts.appId,
      secret: opts.secret,
      timeoutMs: opts.timeoutMs,
      force
    })
    const res = await wxApiFetch({
      url: API_BASE + '/tcb/uploadfile?access_token=' + encodeURIComponent(accessToken),
      method: 'POST',
      jsonBody: { env: opts.envId, path: opts.cloudPath },
      timeoutMs: opts.timeoutMs
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error('WX_STORAGE_TICKET_HTTP_' + res.status)
    }
    return JSON.parse(res.body) as any
  }

  let r = await call(false).catch((e: any) => {
    throw new Error('WX_STORAGE_TICKET_NET_' + netDetail(e))
  })
  if (r != null && r.errcode === 40001) {
    r = await call(true)
  }
  if (r == null || r.errcode !== 0 || typeof r.url !== 'string' || r.url.length === 0) {
    const code = r != null ? r.errcode : 'null'
    const msg = r != null && r.errmsg != null ? String(r.errmsg) : ''
    throw new Error('WX_STORAGE_TICKET_' + code + (msg.length > 0 ? '_' + msg : ''))
  }
  return {
    url: r.url,
    token: String(r.token ?? ''),
    authorization: String(r.authorization ?? ''),
    fileId: String(r.file_id ?? ''),
    cosFileId: String(r.cos_file_id ?? '')
  }
}

// 上传音频到云存储，返回可直接播放的 cloud:// fileID
export async function uploadToWxCloud(opts: WxCloudUploadOpts): Promise<string> {
  const ticket = await requestUploadTicket({
    appId: opts.appId,
    secret: opts.secret,
    envId: opts.envId,
    cloudPath: opts.cloudPath,
    timeoutMs: opts.timeoutMs
  })
  const form = new FormData()
  form.append('key', opts.cloudPath)
  form.append('Signature', ticket.authorization)
  form.append('x-cos-security-token', ticket.token)
  form.append('x-cos-meta-fileid', ticket.cosFileId)
  form.append(
    'file',
    new Blob([opts.data], { type: opts.contentType }),
    opts.cloudPath.split('/').pop()
  )
  const res = await fetch(ticket.url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(opts.timeoutMs)
  })
  if (!res.ok) {
    throw new Error('WX_STORAGE_UPLOAD_HTTP_' + res.status)
  }
  if (ticket.fileId.length === 0) {
    throw new Error('WX_STORAGE_NO_FILEID')
  }
  return ticket.fileId
}

// fileID → 临时下载链接（官方 POST /tcb/batchdownloadfile，服务端专用）
// 用途：客户端把录音上传到云存储后，服务端凭 fileID 取回音频字节做转写
export async function getCloudFileTempUrl(opts: {
  appId: string
  secret: string
  envId: string
  fileID: string
  maxAgeSeconds: number
  timeoutMs: number
}): Promise<string> {
  const call = async (force: boolean) => {
    const accessToken = await getWxAccessToken({
      appId: opts.appId,
      secret: opts.secret,
      timeoutMs: opts.timeoutMs,
      force
    })
    const res = await wxApiFetch({
      url: API_BASE + '/tcb/batchdownloadfile?access_token=' + encodeURIComponent(accessToken),
      method: 'POST',
      jsonBody: {
        env: opts.envId,
        file_list: [{ fileid: opts.fileID, max_age: opts.maxAgeSeconds }]
      },
      timeoutMs: opts.timeoutMs
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error('WX_STORAGE_DL_HTTP_' + res.status)
    }
    return JSON.parse(res.body) as any
  }

  let r = await call(false)
  if (r != null && r.errcode === 40001) {
    r = await call(true)
  }
  if (r == null || r.errcode !== 0) {
    const code = r != null ? r.errcode : 'null'
    const msg = r != null && r.errmsg != null ? String(r.errmsg) : ''
    throw new Error('WX_STORAGE_DL_' + code + (msg.length > 0 ? '_' + msg : ''))
  }
  const list = Array.isArray(r.file_list) ? r.file_list : []
  const first = list.length > 0 ? list[0] : null
  if (first == null || typeof first.download_url !== 'string' || first.download_url.length === 0) {
    throw new Error('WX_STORAGE_DL_NO_URL')
  }
  return first.download_url
}
