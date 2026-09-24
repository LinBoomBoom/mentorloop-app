// 答案信号分析器（服务端移植，与前端 engine/answer-signal.uts 一致）
// 从用户回答文本提取 AnswerSignal，供追问决策与评分使用。
// 注意：前端 followup-engine 未移植（追问由前端消费问题卡自派发）；此处仅定义评分所需信号类型。

export type AnswerSignal = {
  questionId: string
  text: string
  isVague: boolean
  hasMetrics: boolean
  isAbsolute: boolean
  contradictsPrevious: boolean
}

const VAGUE_PATTERNS: string[] = [
  '大概',
  '可能',
  '差不多',
  '好像',
  '应该是',
  '记不清',
  '不太记得',
  '之类的',
  '什么的',
  '云云',
  '一般般',
  '简单做了'
]

const ABSOLUTE_PATTERNS: string[] = [
  '肯定',
  '绝对',
  '一定',
  '所有',
  '全部',
  '永远',
  '从来',
  '完全',
  '百分之百',
  '100%',
  '必须',
  '毫无疑问'
]

const METRIC_REGEX_PARTS: string[] = [
  '%',
  '％',
  'QPS',
  'TPS',
  'RT',
  'ms',
  '毫秒',
  '秒',
  '分钟',
  'GB',
  'MB',
  'KB',
  '并发',
  '万',
  '亿',
  '倍',
  '人日',
  '人月'
]

function containsNumber(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch >= '0' && ch <= '9') return true
    if ('零一二三四五六七八九十百千'.indexOf(ch) >= 0) return true
  }
  return false
}

function containsAny(text: string, patterns: string[]): boolean {
  for (let i = 0; i < patterns.length; i++) {
    if (text.includes(patterns[i])) return true
  }
  return false
}

function isTooShort(text: string): boolean {
  let len = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\u3000') len += 1
  }
  return len < 20
}

// 分析回答文本 → AnswerSignal（questionId 由调用方填写）
export function analyzeAnswer(text: string, questionId: string): AnswerSignal {
  const vague = isTooShort(text) || containsAny(text, VAGUE_PATTERNS)
  const absolute = containsAny(text, ABSOLUTE_PATTERNS)

  let hasMetric = false
  if (containsNumber(text)) {
    if (containsAny(text, METRIC_REGEX_PARTS)) {
      hasMetric = true
    }
  }

  return {
    questionId,
    text,
    isVague: vague,
    hasMetrics: hasMetric,
    isAbsolute: absolute,
    contradictsPrevious: false
  }
}
