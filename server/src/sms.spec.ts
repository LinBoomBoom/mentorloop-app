// 腾讯云 SMS 单测：随机码 / 请求体 / TC3 头 / 发送成功落库 / 失败不落库 / mock 回归
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { loadEnv } from './config.js'
import type { Env } from './config.js'
import { closeDb, getDb } from './db.js'
import {
  buildTencentSmsPayload,
  generateSmsCode,
  sendTencentSms,
  setSmsTransportForTest,
  type SmsTransport
} from './services/sms.js'

type Call = {
  url: string
  init: { headers: { [k: string]: string }; body: string; timeoutMs: number }
}

const calls: Call[] = []

function smsEnv(): Env {
  const env = loadEnv()
  env.dbPath =
    './data/test-sms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.db'
  env.smsProvider = 'tencent'
  env.tencentSecretId = 'AKIDtest'
  env.tencentSecretKey = 'secretkey'
  env.smsSdkAppId = '1400000000'
  env.smsSignName = '测试签名'
  env.smsTemplateId = '1234567'
  env.mockSmsCode = '830211'
  return env
}

function okTransport(): SmsTransport {
  return async (url, init) => {
    calls.push({ url, init })
    return {
      status: 200,
      body: JSON.stringify({
        Response: {
          SendStatusSet: [{ Code: 'Ok', Message: 'send success' }],
          RequestId: 'req-test'
        }
      })
    }
  }
}

beforeEach(() => {
  calls.length = 0
  setSmsTransportForTest(okTransport())
})

afterEach(() => {
  setSmsTransportForTest(null)
  closeDb()
})

describe('短信验证码生成与请求体', () => {
  it('生成 6 位数字验证码', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSmsCode()).toMatch(/^\d{6}$/)
    }
  })

  it('腾讯云请求体：+86 手机号、AppID、签名、模板、单变量验证码', () => {
    const env = smsEnv()
    const payload = JSON.parse(buildTencentSmsPayload(env, '13800000000', '123456'))
    expect(payload.PhoneNumberSet).toEqual(['+8613800000000'])
    expect(payload.SmsSdkAppId).toBe('1400000000')
    expect(payload.SignName).toBe('测试签名')
    expect(payload.TemplateId).toBe('1234567')
    expect(payload.TemplateParamSet).toEqual(['123456'])
  })
})

describe('腾讯云 SendSms 调用', () => {
  it('成功：TC3 头齐全且返回 ok', async () => {
    const env = smsEnv()
    const res = await sendTencentSms(env, '13800000000', '123456')
    expect(res.ok).toBe(true)
    expect(calls.length).toBe(1)
    const c = calls[0]
    expect(c.url).toBe('https://sms.tencentcloudapi.com')
    expect(c.init.headers['X-TC-Action']).toBe('SendSms')
    expect(c.init.headers['X-TC-Version']).toBe('2021-01-11')
    expect(c.init.headers['X-TC-Region']).toBe('ap-guangzhou')
    expect(c.init.headers.Authorization).toContain('/sms/tc3_request')
    expect(c.init.body).toContain('+8613800000000')
  })

  it('官方返回 Error → 失败并带错误码', async () => {
    const env = smsEnv()
    setSmsTransportForTest(async () => ({
      status: 200,
      body: JSON.stringify({
        Response: { Error: { Code: 'AuthFailure.SecretIdNotFound', Message: 'no secret' } }
      })
    }))
    const res = await sendTencentSms(env, '13800000000', '123456')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('AuthFailure.SecretIdNotFound')
  })

  it('HTTP 非 2xx → 失败', async () => {
    const env = smsEnv()
    setSmsTransportForTest(async () => ({ status: 500, body: 'oops' }))
    const res = await sendTencentSms(env, '13800000000', '123456')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('HTTP_500')
  })

  it('缺配置 → 不发起请求', async () => {
    const env = smsEnv()
    env.smsTemplateId = ''
    const res = await sendTencentSms(env, '13800000000', '123456')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('SMS_NOT_CONFIGURED')
    expect(calls.length).toBe(0)
  })
})

describe('发码链路接入', () => {
  it('tencent：随机码发送成功后才落库', async () => {
    const env = smsEnv()
    const app = buildApp({ env })
    const phone = '138' + String(Date.now()).slice(-8)
    const r = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    expect(r.statusCode).toBe(200)
    expect(calls.length).toBe(1)
    const row = (await getDb(env.dbPath)
      .prepare('SELECT code FROM sms_codes WHERE phone = ?')
      .get(phone)) as { code: string } | undefined
    expect(row).toBeDefined()
    expect(row!.code).toMatch(/^\d{6}$/)
    expect(row!.code).not.toBe(env.mockSmsCode)
  })

  it('tencent：发送失败返回 502 且不落库', async () => {
    const env = smsEnv()
    setSmsTransportForTest(async () => ({
      status: 200,
      body: JSON.stringify({
        Response: {
          SendStatusSet: [{ Code: 'FailedOperation.PhoneNumberParseFail', Message: 'bad' }]
        }
      })
    }))
    const app = buildApp({ env })
    const phone = '139' + String(Date.now()).slice(-8)
    const r = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    expect(r.statusCode).toBe(502)
    const row = await getDb(env.dbPath)
      .prepare('SELECT code FROM sms_codes WHERE phone = ?')
      .get(phone)
    expect(row).toBeUndefined()
  })

  it('mock：本地固定码，不调用腾讯云', async () => {
    const env = smsEnv()
    env.smsProvider = 'mock'
    setSmsTransportForTest(async () => {
      throw new Error('should not call')
    })
    const app = buildApp({ env })
    const phone = '137' + String(Date.now()).slice(-8)
    const r = await app.inject({ method: 'POST', url: '/auth/sms-code', payload: { phone } })
    expect(r.statusCode).toBe(200)
    const row = (await getDb(env.dbPath)
      .prepare('SELECT code FROM sms_codes WHERE phone = ?')
      .get(phone)) as { code: string } | undefined
    expect(row!.code).toBe('830211')
    expect(calls.length).toBe(0)
  })
})
