// 微信 HTTP 通道单测：自签证书识别 + 放宽回退分支
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSelfSignedCertError } from './services/wx-http.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isSelfSignedCertError', () => {
  it('识别云调用网关自签证书错误（Node fetch 的 e.cause.code）', () => {
    expect(isSelfSignedCertError({ cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' } })).toBe(true)
    expect(isSelfSignedCertError({ cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } })).toBe(true)
    expect(isSelfSignedCertError({ cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } })).toBe(true)
  })

  it('直接挂在错误对象上的 code 也识别', () => {
    expect(isSelfSignedCertError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })).toBe(true)
  })

  it('非证书类错误不识别（避免掩盖 DNS/超时等真实故障）', () => {
    expect(isSelfSignedCertError({ cause: { code: 'ENOTFOUND' } })).toBe(false)
    expect(isSelfSignedCertError({ cause: { code: 'ECONNREFUSED' } })).toBe(false)
    expect(isSelfSignedCertError({ message: 'fetch failed' })).toBe(false)
    expect(isSelfSignedCertError(null)).toBe(false)
  })
})

describe('wxApiFetch 优先走严格校验通道', () => {
  it('证书正常时直接用 fetch 结果，不触发放宽', async () => {
    const { wxApiFetch } = await import('./services/wx-http.js')
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: any) => {
      calls.push(String(url))
      return { status: 200, text: async () => '{"ok":1}' }
    })
    const r = await wxApiFetch({ url: 'https://api.weixin.qq.com/cgi-bin/token', timeoutMs: 1000 })
    expect(r).toEqual({ status: 200, body: '{"ok":1}' })
    expect(calls.length).toBe(1)
  })

  it('非证书类网络错误原样抛出（不静默降级）', async () => {
    const { wxApiFetch } = await import('./services/wx-http.js')
    vi.stubGlobal('fetch', async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    })
    await expect(
      wxApiFetch({ url: 'https://api.weixin.qq.com/cgi-bin/token', timeoutMs: 1000 })
    ).rejects.toThrow(/fetch failed/)
  })
})
