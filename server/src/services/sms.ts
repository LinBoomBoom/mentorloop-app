// 腾讯云短信（SendSms）驱动
// 仅用于发送登录/绑定验证码；不记录验证码明文到日志。
// 本地默认 mock（写 MOCK_SMS_CODE），云端必须 SMS_PROVIDER=tencent。
import { randomInt } from 'node:crypto'
import type { Env } from '../config.js'
import { tc3Headers } from './tc3.js'

export const SMS_HOST = 'sms.tencentcloudapi.com'
export const SMS_SERVICE = 'sms'
export const SMS_ACTION = 'SendSms'
export const SMS_VERSION = '2021-01-11'
export const SMS_TIMEOUT_MS = 8000

export type SmsSendResult = {
  ok: boolean
  provider: 'mock' | 'tencent'
  code?: string
  message?: string
}

export type SmsHttpResponse = { status: number; body: string }

export type SmsTransport = (
  url: string,
  init: { headers: { [k: string]: string }; body: string; timeoutMs: number }
) => Promise<SmsHttpResponse>

let injectedTransport: SmsTransport | null = null

export function setSmsTransportForTest(fn: SmsTransport | null): void {
  injectedTransport = fn
}

const defaultTransport: SmsTransport = async (url, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
      signal: controller.signal
    })
    return { status: res.status, body: await res.text() }
  } finally {
    clearTimeout(timer)
  }
}

export function generateSmsCode(): string {
  return String(randomInt(100000, 1000000))
}

export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function normalizeSmsPhone(phone: string): string {
  return phone.startsWith('+') ? phone : '+86' + phone
}

export function isTencentSmsReady(env: Env): boolean {
  return (
    env.tencentSecretId.length > 0 &&
    env.tencentSecretKey.length > 0 &&
    env.smsSdkAppId.length > 0 &&
    env.smsSignName.length > 0 &&
    env.smsTemplateId.length > 0
  )
}

export function buildTencentSmsPayload(env: Env, phone: string, code: string): string {
  return JSON.stringify({
    PhoneNumberSet: [normalizeSmsPhone(phone)],
    SmsSdkAppId: env.smsSdkAppId,
    SignName: env.smsSignName,
    TemplateId: env.smsTemplateId,
    // 模板约定：单变量验证码模板，{1} = 6 位验证码
    TemplateParamSet: [code]
  })
}

export async function sendTencentSms(
  env: Env,
  phone: string,
  code: string,
  timeoutMs: number = env.smsTimeoutMs || SMS_TIMEOUT_MS
): Promise<SmsSendResult> {
  if (!isTencentSmsReady(env)) {
    return { ok: false, provider: 'tencent', code: 'SMS_NOT_CONFIGURED' }
  }
  const payload = buildTencentSmsPayload(env, phone, code)
  const headers = tc3Headers({
    secretId: env.tencentSecretId,
    secretKey: env.tencentSecretKey,
    host: SMS_HOST,
    service: SMS_SERVICE,
    action: SMS_ACTION,
    version: SMS_VERSION,
    region: env.smsRegion,
    payload: payload,
    timestamp: Math.floor(Date.now() / 1000)
  })
  const transport = injectedTransport ?? defaultTransport
  let res: SmsHttpResponse
  try {
    res = await transport('https://' + SMS_HOST, {
      headers: headers,
      body: payload,
      timeoutMs: timeoutMs
    })
  } catch (e: any) {
    return {
      ok: false,
      provider: 'tencent',
      code: 'NETWORK',
      message: e instanceof Error ? e.message : String(e)
    }
  }
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, provider: 'tencent', code: 'HTTP_' + String(res.status) }
  }
  let json: any = null
  try {
    json = JSON.parse(res.body)
  } catch {
    return { ok: false, provider: 'tencent', code: 'BAD_RESPONSE' }
  }
  const response = json != null ? json.Response : null
  if (response == null) return { ok: false, provider: 'tencent', code: 'BAD_RESPONSE' }
  if (response.Error != null) {
    return {
      ok: false,
      provider: 'tencent',
      code: typeof response.Error.Code === 'string' ? response.Error.Code : 'UNKNOWN',
      message: typeof response.Error.Message === 'string' ? response.Error.Message : ''
    }
  }
  const first =
    Array.isArray(response.SendStatusSet) && response.SendStatusSet.length > 0
      ? response.SendStatusSet[0]
      : null
  if (first != null && first.Code === 'Ok') {
    return { ok: true, provider: 'tencent' }
  }
  return {
    ok: false,
    provider: 'tencent',
    code: first != null && typeof first.Code === 'string' ? first.Code : 'UNKNOWN',
    message: first != null && typeof first.Message === 'string' ? first.Message : ''
  }
}
