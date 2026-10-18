// 六维能力域分类器（服务端镜像，与 engine/dimension-classifier.uts 逻辑一致）
// 输入：云题 keywords[] + subtrack + tech + type；输出六维之一（见 data/dimension-rules.ts）。
// 纯函数、确定性：同输入恒同输出（单测锁定）。

import { DIMENSION_RULES, SUBTRACK_DOMAIN } from '../data/dimension-rules.js'

export type DimensionInput = {
  keywords: string[]
  subtrack: string
  tech: string
  qType: string
}

export function classifyDimension(input: DimensionInput): string {
  const hay = input.keywords.join(',') + ',' + input.subtrack + ',' + input.tech
  const lower = hay.toLowerCase()

  let best = ''
  let bestScore = 0
  for (let i = 0; i < DIMENSION_RULES.length; i++) {
    const rule = DIMENSION_RULES[i]
    let score = 0
    for (let j = 0; j < rule.keywords.length; j++) {
      if (lower.indexOf(rule.keywords[j].toLowerCase()) !== -1) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = rule.domain
    }
  }
  if (bestScore > 0) return best

  // 关键词全未命中：special（深挖/设计题）归系统设计，其余按赛道归属兜底
  if (input.qType === 'special') return 'analysis'
  const byTrack = SUBTRACK_DOMAIN[input.subtrack]
  if (byTrack != null) return byTrack
  return 'knowledge'
}
