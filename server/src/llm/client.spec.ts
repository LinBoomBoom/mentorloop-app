// LLM 客户端：请求体契约（thinking 注入）与失败降级
// 背景（2026-10-27 线上实测）：DeepSeek v4 默认开启思考模式，reasoning_content 与 content
// 共享 max_tokens；免费预览 maxTokens=700 被推理占满 → content 为空 → 预览恒 0 条。
import { afterEach, describe, expect, it } from 'vitest'
import { chatComplete, resetFetchForTest, setFetchForTest } from './client.js'

type Captured = { url: string; body: any }

function capture(
  result: any = { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) }
) {
  const list: Captured[] = []
  setFetchForTest(async (url: string, init: any) => {
    list.push({ url, body: JSON.parse(String(init.body)) })
    return result
  })
  return list
}

const envs = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test',
  model: 'deepseek-v4-flash',
  timeoutMs: 5000
}

afterEach(() => resetFetchForTest())

describe('chatComplete · thinking 注入', () => {
  it('DeepSeek 模型默认关闭思考模式', async () => {
    const calls = capture()
    await chatComplete(envs, [{ role: 'user', content: 'hi' }], { maxTokens: 700 })
    expect(calls.length).toBe(1)
    expect(calls[0].body.thinking).toEqual({ type: 'disabled' })
    expect(calls[0].body.max_tokens).toBe(700)
  })

  it('显式开启思考时透传 enabled', async () => {
    const calls = capture()
    await chatComplete(envs, [{ role: 'user', content: 'hi' }], { thinking: 'enabled' })
    expect(calls[0].body.thinking).toEqual({ type: 'enabled' })
  })

  it('非 DeepSeek 模型不注入 thinking（避免第三方 400）', async () => {
    const calls = capture()
    await chatComplete({ ...envs, model: 'qwen-plus' }, [{ role: 'user', content: 'hi' }], {
      maxTokens: 700
    })
    expect(calls[0].body.thinking).toBeUndefined()
  })

  it('HTTP 失败返回 null（调用方回退，不抛错）', async () => {
    capture({ ok: false, status: 500, json: async () => ({}) })
    const r = await chatComplete(envs, [{ role: 'user', content: 'hi' }])
    expect(r).toBe(null)
  })

  it('content 为空返回 null（思考被截断的真实故障形态）', async () => {
    capture({ ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) })
    const r = await chatComplete(envs, [{ role: 'user', content: 'hi' }])
    expect(r).toBe(null)
  })
})
