// LLM 客户端（P1.2）：OpenAI 兼容 chat/completions 封装
// 特点：
// - 通过 fetch 调用，无需额外依赖；baseUrl/key/model 由环境变量提供
// - LLM 调用可注入上游（fetch 注入），单测用伪响应验证合并与回退
// - 任何失败（网络/超时/解析）返回 null，由调用方回退规则结果，绝不阻断报告

export type ChatMessage = { role: 'system' | 'user'; content: string }

export type LmEnvs = {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export type ChatCompleteResult = {
  content: string
}

export type ChatCompleteOpts = {
  maxTokens?: number
  temperature?: number
  // DeepSeek v4 默认开启思考模式，思维链与正文共享 max_tokens。
  // 本项目调用均为结构化抽取/短文本生成，默认关闭；需要深度推理时显式传 'enabled'。
  thinking?: 'enabled' | 'disabled'
}

export type FetchLike = (url: string, init: any) => Promise<any>

let injectedFetch: FetchLike | null = null

// 测试注入：替换全局 fetch
export function setFetchForTest(fn: FetchLike): void {
  injectedFetch = fn
}

export function resetFetchForTest(): void {
  injectedFetch = null
}

function doFetch(url: string, init: any): Promise<any> {
  if (injectedFetch != null) return injectedFetch(url, init)
  return fetch(url, init)
}

// 调用 chat/completions（非流式），返回助手消息文本
export async function chatComplete(
  envs: LmEnvs,
  messages: ChatMessage[],
  opts: ChatCompleteOpts = {}
): Promise<ChatCompleteResult | null> {
  if (envs.baseUrl.length === 0 || envs.model.length === 0) return null
  const url = envs.baseUrl.replace(/\/$/, '') + '/chat/completions'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), envs.timeoutMs)
  const payload: any = {
    model: envs.model,
    messages,
    temperature: opts.temperature != null ? opts.temperature : 0.4,
    max_tokens: opts.maxTokens != null ? opts.maxTokens : 900
  }
  // 仅对 DeepSeek 注入 thinking：思考模式下 reasoning_content 与 content 共享 max_tokens，
  // 小配额（如免费预览 700）会被推理占满导致 content 为空、JSON 解析失败（2026-10-27 线上实测）。
  if (envs.model.indexOf('deepseek') >= 0) {
    payload.thinking = { type: opts.thinking != null ? opts.thinking : 'disabled' }
  }
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(envs.apiKey.length > 0 ? { Authorization: 'Bearer ' + envs.apiKey } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (res == null || typeof res.ok !== 'boolean' || !res.ok) return null
    const body = await res.json()
    const content = body?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) return null
    return { content }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
