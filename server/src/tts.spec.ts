// TTS 下行单测：驱动三态 / 截断 / 诚实降级 / TC3 签名向量 / 云存储写入
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_TTS_CHARS,
  buildProbeWav,
  clampTtsText,
  createProbeDriver,
  createTencentDriver,
  getTtsDriver,
  stubTtsDriver,
  tc3Headers
} from './services/tts.js'
import { resetWxAccessTokenCache } from './services/wx-access-token.js'
import type { Env } from './config.js'

// ---------------- fetch 桩 ----------------

type Route = (url: string, init: any) => any

function mkRes(body: any, status: number = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as any
}

function stubFetch(routes: { token?: Route; ticket?: Route; cos?: Route; tts?: Route }): {
  calls: Array<[string, any]>
} {
  const calls: Array<[string, any]> = []
  vi.stubGlobal('fetch', async (url: any, init: any) => {
    const u = String(url)
    calls.push([u, init])
    if (u.indexOf('/cgi-bin/token') >= 0) {
      return mkRes(
        routes.token ? routes.token(u, init) : { access_token: 'TOKEN_1', expires_in: 7200 }
      )
    }
    if (u.indexOf('/tcb/uploadfile') >= 0) {
      return mkRes(
        routes.ticket
          ? routes.ticket(u, init)
          : {
              errcode: 0,
              errmsg: 'ok',
              url: 'https://cos.example.com/upload',
              token: 'COS_TOKEN',
              authorization: 'COS_SIGN',
              file_id: 'cloud://test-env.7465-test/tts/probe/x.wav',
              cos_file_id: 'cos-file-id'
            }
      )
    }
    if (u.indexOf('tts.tencentcloudapi.com') >= 0) {
      return mkRes(
        routes.tts ? routes.tts(u, init) : { Response: { Audio: 'QUJD', RequestId: 'r1' } }
      )
    }
    return mkRes(routes.cos ? routes.cos(u, init) : {}, 204)
  })
  return { calls: calls }
}

const storage = { appId: 'wxappid', secret: 'wxsecret', envId: 'prod-test' }

beforeEach(() => {
  resetWxAccessTokenCache()
  vi.unstubAllGlobals()
})

// ---------------- 截断与 stub ----------------

describe('clampTtsText / stub 驱动', () => {
  it('超 200 字截断，不报错', () => {
    const text = 'a'.repeat(MAX_TTS_CHARS + 50)
    expect(clampTtsText(text).length).toBe(MAX_TTS_CHARS)
    expect(clampTtsText('短文').length).toBe(2)
  })

  it('stub 诚实降级：空 fileID + 空 format，chars 反映实际文本长度', async () => {
    const r = await stubTtsDriver.synthesize('你好面试官', { timeoutMs: 1000 })
    expect(r).toEqual({ fileID: '', provider: 'stub', format: '', chars: 5 })
  })
})

// ---------------- TC3 签名 ----------------

describe('tc3Headers', () => {
  const base = {
    secretId: 'AKIDtest',
    secretKey: 'secretkey',
    host: 'tts.tencentcloudapi.com',
    service: 'tts',
    action: 'TextToVoice',
    version: '2019-08-23',
    region: 'ap-guangzhou',
    payload: '{"Text":"hi"}',
    timestamp: 1792500000
  }

  it('同一入参签名稳定（固定向量），且请求头齐全', () => {
    const h1 = tc3Headers(base)
    const h2 = tc3Headers(base)
    expect(h1.Authorization).toBe(h2.Authorization)
    expect(h1.Authorization).toContain('TC3-HMAC-SHA256 Credential=AKIDtest/')
    expect(h1.Authorization).toContain('/tts/tc3_request')
    expect(h1.Authorization).toContain('SignedHeaders=content-type;host;x-tc-action')
    expect(h1.Authorization).toMatch(/Signature=[0-9a-f]{64}$/)
    expect(h1['X-TC-Action']).toBe('TextToVoice')
    expect(h1['X-TC-Version']).toBe('2019-08-23')
    expect(h1['X-TC-Region']).toBe('ap-guangzhou')
    expect(h1['X-TC-Timestamp']).toBe('1792500000')
    expect(h1['X-TC-Token']).toBeUndefined()
  })

  it('ayload 或时间戳变化 → 签名变化（防止签名未覆盖正文）', () => {
    const a = tc3Headers(base).Authorization
    const b = tc3Headers({ ...base, payload: '{"Text":"hi2"}' }).Authorization
    const c = tc3Headers({ ...base, timestamp: base.timestamp + 1 }).Authorization
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('传入 token 时附加 X-TC-Token（STS 临时凭据场景）', () => {
    const h = tc3Headers({ ...base, token: 'sts-token' })
    expect(h['X-TC-Token']).toBe('sts-token')
  })
})

// ---------------- 探针驱动 ----------------

describe('probe 驱动', () => {
  it('生成的 WAV 头正确（RIFF/WAVE/fmt/data）', () => {
    const wav = buildProbeWav(0.1)
    const buf = Buffer.from(wav)
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE')
    expect(buf.toString('ascii', 12, 16)).toBe('fmt ')
    expect(buf.toString('ascii', 36, 40)).toBe('data')
    expect(buf.readUInt16LE(22)).toBe(1) // 单声道
    expect(buf.readUInt32LE(24)).toBe(16000) // 采样率
    expect(wav.length).toBe(44 + Math.round(16000 * 0.1) * 2)
  })

  it('走云存储 → 返回 cloud:// fileID，provider=probe，路径带 uid 段', async () => {
    const { calls } = stubFetch({})
    const r = await createProbeDriver(storage).synthesize('测试', {
      timeoutMs: 5000,
      uid: 'u_abc123'
    })
    expect(r.fileID).toBe('cloud://test-env.7465-test/tts/probe/x.wav')
    expect(r.provider).toBe('probe')
    expect(r.format).toBe('wav')
    expect(r.chars).toBe(2)
    // 先取 token，再取上传链接，最后 multipart 上传
    const urls = calls.map(([u]) => u)
    expect(urls[0]).toContain('/cgi-bin/token')
    expect(urls[1]).toContain('/tcb/uploadfile')
    expect(urls[2]).toContain('cos.example.com/upload')
    // 上传路径：tts/<uid>/<tag>/<ymd>/<uuid>.<ext>（回收时凭 uid 段做属主校验）
    const ticketCall = calls.find(([u]) => u.indexOf('/tcb/uploadfile') >= 0)
    const ticketBody = JSON.parse(String(ticketCall![1].body))
    expect(ticketBody.path.indexOf('tts/u_abc123/probe/')).toBe(0)
  })

  it('缺微信凭据 → 空 fileID（不伪造），但仍返回真实 chars', async () => {
    stubFetch({})
    const r = await createProbeDriver({ appId: '', secret: '', envId: 'prod-test' }).synthesize(
      '无凭据',
      { timeoutMs: 1000 }
    )
    expect(r.fileID).toBe('')
    expect(r.format).toBe('')
    expect(r.chars).toBe(3)
  })
})

// ---------------- 腾讯云驱动 ----------------

describe('tencent 驱动', () => {
  const driver = () =>
    createTencentDriver({
      secretId: 'AKIDtest',
      secretKey: 'secretkey',
      region: 'ap-guangzhou',
      voiceType: 101001,
      storage: storage
    })

  it('合成 + 写存储全链路 → 返回 fileID/format=mp3', async () => {
    const { calls } = stubFetch({})
    const r = await driver().synthesize('请介绍一下你自己', { timeoutMs: 5000 })
    expect(r.fileID).toBe('cloud://test-env.7465-test/tts/probe/x.wav')
    expect(r.provider).toBe('tencent')
    expect(r.format).toBe('mp3')
    expect(r.chars).toBe(8)
    const ttsCall = calls.find(([u]) => u.indexOf('tts.tencentcloudapi.com') >= 0)
    expect(ttsCall).toBeTruthy()
    const body = JSON.parse(ttsCall![1].body)
    expect(body.Text).toBe('请介绍一下你自己')
    expect(body.Codec).toBe('mp3')
    expect(body.SampleRate).toBe(16000)
    expect(body.VoiceType).toBe(101001)
    expect(ttsCall![1].headers['X-TC-Action']).toBe('TextToVoice')
  })

  it('超过 200 字 → 送 synth 的 Text 被截断，chars=200', async () => {
    let sentText = ''
    stubFetch({
      tts: (_u, init) => {
        sentText = JSON.parse(init.body).Text
        return { Response: { Audio: 'QUJD' } }
      }
    })
    const r = await driver().synthesize('a'.repeat(260), { timeoutMs: 5000 })
    expect(sentText.length).toBe(MAX_TTS_CHARS)
    expect(r.chars).toBe(MAX_TTS_CHARS)
  })

  it('缺腾讯云密钥 → 空 fileID（不调用外部接口）', async () => {
    const { calls } = stubFetch({})
    const r = await createTencentDriver({
      secretId: '',
      secretKey: '',
      region: 'ap-guangzhou',
      voiceType: 101001,
      storage: storage
    }).synthesize('无密钥', { timeoutMs: 1000 })
    expect(r.fileID).toBe('')
    expect(r.format).toBe('')
    expect(r.chars).toBe(3)
    expect(calls.length).toBe(0)
  })

  it('空文本 → 直接降级，不发起任何请求', async () => {
    const { calls } = stubFetch({})
    const r = await driver().synthesize('', { timeoutMs: 1000 })
    expect(r.fileID).toBe('')
    expect(r.chars).toBe(0)
    expect(calls.length).toBe(0)
  })

  it('腾讯云返回错误 → 抛 TTS_<Code>（由路由兜底降级）', async () => {
    stubFetch({
      tts: () => ({
        Response: { Error: { Code: 'UnsupportedOperation.PkgExhausted', Message: 'no pack' } }
      })
    })
    await expect(driver().synthesize('额度用尽', { timeoutMs: 1000 })).rejects.toThrow(
      /TTS_UnsupportedOperation\.PkgExhausted/
    )
  })

  it('云存储写入失败（85088）→ 空 fileID，不抛错', async () => {
    stubFetch({
      ticket: () => ({ errcode: 85088, errmsg: 'env not bound' })
    })
    const r = await driver().synthesize('写盘失败', { timeoutMs: 5000 })
    expect(r.fileID).toBe('')
    expect(r.format).toBe('')
    expect(r.chars).toBe(4)
  })
})

// ---------------- 注册表 ----------------

describe('getTtsDriver 注册表', () => {
  const base = {
    wxAppId: '',
    wxSecret: '',
    wxCloudEnvId: 'prod-test',
    tencentSecretId: '',
    tencentSecretKey: '',
    tencentTtsRegion: 'ap-guangzhou',
    tencentTtsVoiceType: 101001
  } as unknown as Env

  it('默认 stub', () => {
    expect(getTtsDriver({ ...base, ttsProvider: 'stub' } as Env).name).toBe('stub')
  })

  it('probe / tencent 按配置切换', () => {
    expect(getTtsDriver({ ...base, ttsProvider: 'probe' } as Env).name).toBe('probe')
    expect(getTtsDriver({ ...base, ttsProvider: 'tencent' } as Env).name).toBe('tencent')
  })
})
