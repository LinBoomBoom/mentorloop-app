// 服务端权威 SKU 目录（P1.3；与前端 data/membership.uts 展示配置对齐）
// 金额/天数/场次以本文件为准；下单仅认 skuId，拒绝客户端传价。
export type SkuKind = 'member' | 'single' | 'resume'

export type SkuSpec = {
  id: string
  // 虚拟支付道具 ID（W1b 取值，2026-10-22）：后台「道具管理」允许自定义 ID，
  // 5 个道具均直接使用 skuId，故两者同名；改名须与后台已发布道具逐字一致。
  wxProductId: string
  kind: SkuKind
  priceCent: number
  memberDays: number // kind=member 时生效
  singleCount: number // kind=single 时生效（面试场次）
  resumeCount: number // kind=resume 时生效（简历完整评审次数）
}

export const SKUS: SkuSpec[] = [
  {
    id: 'member_monthly',
    wxProductId: 'member_monthly',
    kind: 'member',
    priceCent: 3900,
    memberDays: 30,
    singleCount: 0,
    resumeCount: 0
  },
  {
    id: 'member_yearly',
    wxProductId: 'member_yearly',
    kind: 'member',
    priceCent: 22800,
    memberDays: 365,
    singleCount: 0,
    resumeCount: 0
  },
  {
    id: 'single_pack_3',
    wxProductId: 'single_pack_3',
    kind: 'single',
    priceCent: 2900,
    memberDays: 0,
    singleCount: 3,
    resumeCount: 0
  },
  {
    id: 'single_pack_10',
    wxProductId: 'single_pack_10',
    kind: 'single',
    priceCent: 7900,
    memberDays: 0,
    singleCount: 10,
    resumeCount: 0
  },
  // 简历 AI 深度评审单次包（暂定 29 元 / 3 次，PO 可单点调整）
  {
    id: 'resume_pack_3',
    wxProductId: 'resume_pack_3',
    kind: 'resume',
    priceCent: 2900,
    memberDays: 0,
    singleCount: 0,
    resumeCount: 3
  },
  // 小额支付联调专用（隐藏测试入口，不进入任何对外套餐列表；0.1 元 / 1 场）
  // 后台道具 ID 与价格：test_pay_01 / 0.1 元（2026-10-22 已发布）
  {
    id: 'test_pay_01',
    wxProductId: 'test_pay_01',
    kind: 'single',
    priceCent: 10,
    memberDays: 0,
    singleCount: 1,
    resumeCount: 0
  },
  // 小额支付联调专用（iOS 端 Apple 支付最低 1 元，0.1 元道具 iOS 无法下单）
  // 后台道具 ID 与价格：test_pay_1 / 1 元（2026-10-22 已发布）
  {
    id: 'test_pay_1',
    wxProductId: 'test_pay_1',
    kind: 'single',
    priceCent: 100,
    memberDays: 0,
    singleCount: 1,
    resumeCount: 0
  }
]

export function getSku(id: string): SkuSpec | null {
  for (const s of SKUS) {
    if (s.id === id) return s
  }
  return null
}
