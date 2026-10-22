// 虚拟支付 payData 与双签名单测（W3）：官方算法 §5.5 的字符串拼接与密钥口径
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  buildSignData,
  toSignDataString,
  calcPaySig,
  calcSignature,
  createVirtualPayParams,
  isVirtualPayReady,
  VIRTUAL_PAY_MODE,
  VIRTUAL_PAY_ENV
} from './virtual-pay.js'
import { getSku } from '../data/skus.js'
import type { Env } from '../config.js'
import { loadEnv } from '../config.js'

function envWithVirtual(): Env {
  const env = loadEnv()
  env.mpPayMode = 'virtual'
  env.mpOfferId = '1450672438'
  env.mpAppKey = 'test-app-key'
  return env
}

describe('虚拟支付签名（W3）', () => {
  it('signData 取 skus.ts 的 wxProductId 与 priceCent，env=0 / CNY / buyQuantity=1', () => {
    const sku = getSku('single_pack_3')
    expect(sku).not.toBeNull()
    const sd = buildSignData(sku!, 'o_abc123', '1450672438')
    expect(sd.offerId).toBe('1450672438')
    expect(sd.productId).toBe('single_pack_3')
    expect(sd.goodsPrice).toBe(2900)
    expect(sd.outTradeNo).toBe('o_abc123')
    expect(sd.attach).toBe('o_abc123')
    expect(sd.env).toBe(VIRTUAL_PAY_ENV)
    expect(sd.currencyType).toBe('CNY')
    expect(sd.buyQuantity).toBe(1)
  })

  it('paySig = HMAC-SHA256(AppKey, "requestVirtualPayment&" + signData)', () => {
    const sd = toSignDataString(buildSignData(getSku('member_monthly')!, 'o_x1', '1450672438'))
    const expected = createHmac('sha256', 'test-app-key')
      .update('requestVirtualPayment&' + sd, 'utf8')
      .digest('hex')
    expect(calcPaySig('test-app-key', sd)).toBe(expected)
    expect(calcPaySig('test-app-key', sd)).toHaveLength(64)
  })

  it('signature = HMAC-SHA256(sessionKey, signData)', () => {
    const sd = '{"a":1}'
    const expected = createHmac('sha256', 'SK_TEST').update(sd, 'utf8').digest('hex')
    expect(calcSignature('SK_TEST', sd)).toBe(expected)
  })

  it('换密钥 / 换 signData 必须产生不同签名（防拼接错误）', () => {
    const sd = '{"a":1}'
    expect(calcPaySig('k1', sd)).not.toBe(calcPaySig('k2', sd))
    expect(calcPaySig('k1', sd)).not.toBe(calcPaySig('k1', sd + ' '))
  })

  it('payData 结构：provider / mode / signData / 双签名 一致', () => {
    const env = envWithVirtual()
    const sku = getSku('resume_pack_3')!
    const p = createVirtualPayParams(env, sku, 'o_p1', 'SK_TEST')
    expect(p.provider).toBe('virtual')
    expect(p.mode).toBe(VIRTUAL_PAY_MODE)
    expect(p.orderId).toBe('o_p1')
    const parsed = JSON.parse(p.signData)
    expect(parsed.productId).toBe('resume_pack_3')
    expect(parsed.goodsPrice).toBe(2900)
    expect(p.paySig).toBe(calcPaySig(env.mpAppKey, p.signData))
    expect(p.signature).toBe(calcSignature('SK_TEST', p.signData))
  })

  it('isVirtualPayReady 对缺任一密钥返回 false', () => {
    const env = envWithVirtual()
    expect(isVirtualPayReady(env)).toBe(true)
    env.mpAppKey = ''
    expect(isVirtualPayReady(env)).toBe(false)
    env.mpAppKey = 'k'
    env.mpOfferId = ''
    expect(isVirtualPayReady(env)).toBe(false)
  })
})
