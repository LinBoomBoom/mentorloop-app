// ASR 服务单测（P2-13）：stub 驱动降级、注册表选择、阿里云 RPC 签名固定向量、上传端点
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import { closeDb } from './db.js'
import { stubDriver, aliyunSign, getAsrDriver, createAliyunDriver } from './services/asr.js'

describe('ASR 驱动', () => {
  beforeEach(() => closeDb())

  it('stub 驱动明确降级：不伪造转写文本', async () => {
    const r = await stubDriver.transcribe('/tmp/x.m4a', { timeoutMs: 1000 })
    expect(r.text).toBe('')
    expect(r.confidence).toBe(0)
  })

  it('注册表：默认 stub；aliyun 缺少密钥时同样降级', async () => {
    const env = loadEnv()
    expect(getAsrDriver(env).name).toBe('stub')

    const envAliyun = loadEnv()
    envAliyun.asrProvider = 'aliyun'
    expect(getAsrDriver(envAliyun).name).toBe('aliyun')
    // 缺密钥 → 不报错、不伪造，返回空转写
    const degrade = await getAsrDriver(envAliyun).transcribe('./data/uploads/a.m4a', {
      timeoutMs: 1000
    })
    expect(degrade.text).toBe('')
    expect(degrade.confidence).toBe(0)
  })

  it('aliyun RPC 签名：固定向量校验（HMAC-SHA1 + RFC3986）', () => {
    const params = { AccessKeyId: 'test', Action: 'Hello' }
    const sig = aliyunSign('GET', params, 'secret')
    // 由独立计算得到的期望值：锁定算法正确性
    expect(sig).toBe('3EhBeBagK+/sIk2nnkIVa8ExKds=')
  })

  it('aliyun 驱动携带本地路径时不发送网络请求，直接降级', async () => {
    const driver = createAliyunDriver({
      accessKeyId: 'k1',
      accessKeySecret: 's1',
      appKey: 'app1',
      region: 'cn-shanghai'
    })
    const r = await driver.transcribe('./local/only.m4a', { timeoutMs: 1000 })
    expect(r.text).toBe('')
  })
})

describe('ASR 上传端点 /interview/asr', () => {
  beforeEach(() => closeDb())

  async function login(app: any): Promise<string> {
    await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone: '13900000009' } })
    const r = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '13900000009', code: '123456' }
    })
    return r.json().data.token
  }

  it('未登录返回 401', async () => {
    const app = buildApp({ env: withDb() })
    const r = await app.inject({ method: 'POST', url: '/interview/asr' })
    expect(r.json().code).toBe(401)
    closeDb()
  })

  it('multipart 上传音频：stub 返回空转写（明确降级）', async () => {
    const app = buildApp({ env: withDb() })
    const token = await login(app)
    const boundary = '----mlasrtest'
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="audio"; filename="answer.m4a"\r\n` +
      `Content-Type: audio/mp4\r\n\r\n` +
      `fakem4abytes` +
      `\r\n--${boundary}--\r\n`
    const r = await app.inject({
      method: 'POST',
      url: '/interview/asr',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(body, 'utf8')
    })
    expect(r.json().code).toBe(0)
    expect(r.json().data.text).toBe('')
    expect(r.json().data.confidence).toBe(0)
    closeDb()
  })
})

function withDb() {
  const env = loadEnv()
  env.dbPath = './data/test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  return env
}
