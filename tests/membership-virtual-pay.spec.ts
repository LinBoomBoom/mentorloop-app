// 虚拟支付客户端纯逻辑单测（W5）：版本门控与失败码文案（契约 §5.2）
import { describe, it, expect } from 'vitest'
import {
  PAY_CANCELLED,
  isWechatVersionAtLeast,
  describeVirtualPayError,
  isSessionExpiredCode,
  isDuplicateOrderCode
} from '../api/virtual-pay.uts'

describe('微信版本门控（W5）', () => {
  it('iOS 最低 8.0.68：等于/高于放行，低于拒绝', () => {
    expect(isWechatVersionAtLeast('8.0.68', '8.0.68')).toBe(true)
    expect(isWechatVersionAtLeast('8.0.67', '8.0.68')).toBe(false)
    expect(isWechatVersionAtLeast('8.1.0', '8.0.68')).toBe(true)
    expect(isWechatVersionAtLeast('9', '8.0.68')).toBe(true)
    expect(isWechatVersionAtLeast('8.0.68.1', '8.0.68')).toBe(true)
  })

  it('空版本号视为不满足（不静默放行）', () => {
    expect(isWechatVersionAtLeast('', '8.0.68')).toBe(false)
  })

  it('异常分段按 0 处理，不抛错', () => {
    expect(isWechatVersionAtLeast('8.x.68', '8.0.68')).toBe(false)
  })
})

describe('虚拟支付失败码文案（W5）', () => {
  it('取消支付返回 PAY_CANCELLED（调用方静默处理）', () => {
    expect(describeVirtualPayError(-2)).toBe(PAY_CANCELLED)
  })

  it('会话过期 / 单号重复可被重试逻辑识别', () => {
    expect(isSessionExpiredCode(-15007)).toBe(true)
    expect(isDuplicateOrderCode(-15002)).toBe(true)
    expect(isSessionExpiredCode(-15002)).toBe(false)
    expect(isDuplicateOrderCode(-15007)).toBe(false)
  })

  it('关键错误码映射到用户可读文案', () => {
    expect(describeVirtualPayError(-15007)).toContain('会话')
    expect(describeVirtualPayError(-15010)).toBe('商品暂不可售')
    expect(describeVirtualPayError(-15018)).toBe('商品暂不可售')
    expect(describeVirtualPayError(-15014)).toContain('10 分钟')
    expect(describeVirtualPayError(-4)).toContain('风控')
    expect(describeVirtualPayError(-15020)).toContain('频繁')
  })

  it('未知码兜底为通用失败文案（不暴露内部码）', () => {
    expect(describeVirtualPayError(0)).toBe('支付失败，请重试')
    expect(describeVirtualPayError(-99999)).toBe('支付失败，请重试')
  })
})
