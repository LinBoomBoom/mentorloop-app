// 服务端权威 SKU 目录（P1.3；与前端 data/membership.uts 展示配置对齐）
// 金额/天数/场次以本文件为准；下单仅认 skuId，拒绝客户端传价。
export type SkuKind = 'member' | 'single'

export type SkuSpec = {
  id: string
  kind: SkuKind
  priceCent: number
  memberDays: number // kind=member 时生效
  singleCount: number // kind=single 时生效
}

export const SKUS: SkuSpec[] = [
  { id: 'member_monthly', kind: 'member', priceCent: 3900, memberDays: 30, singleCount: 0 },
  { id: 'member_yearly', kind: 'member', priceCent: 22800, memberDays: 365, singleCount: 0 },
  { id: 'single_pack_3', kind: 'single', priceCent: 2900, memberDays: 0, singleCount: 3 },
  { id: 'single_pack_10', kind: 'single', priceCent: 7900, memberDays: 0, singleCount: 10 }
]

export function getSku(id: string): SkuSpec | null {
  for (const s of SKUS) {
    if (s.id === id) return s
  }
  return null
}
