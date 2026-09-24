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
  messages: ChatMessage[]
): Promise<ChatCompleteResult | null> {
  if (envs.baseUrl.length === 0 || envs.model.length === 0) return null
  const url = envs.baseUrl.replace(/\/$/, '') + '/chat/completions'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), envs.timeoutMs)
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(envs.apiKey.length > 0 ? { Authorization: 'Bearer ' + envs.apiKey } : {})
      },
      body: JSON.stringify({
        model: envs.model,
        messages,
        temperature: 0.4,
        max_tokens: 900
      }),
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
