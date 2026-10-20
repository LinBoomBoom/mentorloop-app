// 微信 ASR 驱动单测（asr-wx.ts）：mock 全局 fetch，锁定契约行为
// 覆盖：缺密钥诚实降级 / 成功轮询链路 / 提交错误码 / 1MB 音频硬限 / 轮询超时 / 40001 token 恢复
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWxAsrDriver, resetWxAsrTokenCache } from './services/asr-wx.js'

function mkRes(body: any) {
  // text() 供 services/wx-http.ts 的 token 通道使用；json() 供 asr-wx 的提交/轮询使用
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
}

type WxRoutes = {
  token?: () => any
  submit?: (url: string) => any
  query?: (url: string) => any
}

// mock fetch：按 URL 片段分发到 token / submit / query 处理器
function stubWxFetch(routes: WxRoutes) {
  const calls: Array<[string, any]> = []
  const fn = vi.fn(async (url: any, init?: any) => {
    const u = String(url)
    calls.push([u, init])
    if (u.indexOf('/cgi-bin/token') >= 0) {
      return mkRes(routes.token != null ? routes.token() : {})
    }
    if (u.indexOf('addvoicetorecofortext') >= 0) {
      return mkRes(routes.submit != null ? routes.submit(u) : { errcode: 0 })
    }
    if (u.indexOf('queryvoicetorecofortext') >= 0) {
      return mkRes(routes.query != null ? routes.query(u) : { errcode: 0, data: '' })
    }
    throw new Error('unexpected fetch url: ' + u)
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

let dir = ''

beforeEach(async () => {
  resetWxAsrTokenCache()
  dir = await mkdtemp(join(tmpdir(), 'asr-wx-'))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  if (dir.length > 0) {
    await rm(dir, { recursive: true, force: true })
  }
})

function makeDriver() {
  return createWxAsrDriver({ appId: 'wx-app', secret: 'wx-secret', lang: 'zh_CN' })
}

describe('wx asr driver', () => {
  it('缺密钥：诚实降级空文本，不发起任何网络请求', async () => {
    const { fn } = stubWxFetch({})
    const driver = createWxAsrDriver({ appId: '', secret: '', lang: 'zh_CN' })
    const audioPath = join(dir, 'a.mp3')
    await writeFile(audioPath, Buffer.alloc(100, 1))
    const r = await driver.transcribe(audioPath, { timeoutMs: 5000 })
    expect(r).toEqual({ text: '', confidence: 0 })
    expect(fn).not.toHaveBeenCalled()
  })

  it('成功链路：取 token → 提交二进制 → 轮询处理中 → 返回识别文本', async () => {
    const { calls } = stubWxFetch({
      token: () => ({ access_token: 'TOKEN_1', expires_in: 7200 }),
      query: (_u) => {
        // 第一次轮询处理中（data 空），第二次返回文本
        return calls.filter(([url]) => url.indexOf('queryvoicetorecofortext') >= 0).length === 1
          ? { errcode: 0, data: '' }
          : { errcode: 0, data: '你好，面试官' }
      }
    })
    const audioPath = join(dir, 'a.mp3')
    await writeFile(audioPath, Buffer.alloc(2048, 7))
    const r = await makeDriver().transcribe(audioPath, { timeoutMs: 5000 })
    expect(r).toEqual({ text: '你好，面试官', confidence: 1 })
    // 端点顺序：token → submit → query ×2
    const urls = calls.map(([u]) => u)
    expect(urls.length).toBe(4)
    expect(urls[0]).toContain('/cgi-bin/token')
    expect(urls[1]).toContain('addvoicetorecofortext')
    // 提交契约：format=mp3 / voice_id / lang=zh_CN / 音频二进制随 body 上送
    expect(urls[1]).toContain('format=mp3')
    expect(urls[1]).toContain('voice_id=')
    expect(urls[1]).toContain('lang=zh_CN')
    expect(urls[1]).toContain('access_token=TOKEN_1')
    const submitInit = calls[1][1]
    expect(submitInit.method).toBe('POST')
    const body = submitInit.body as Uint8Array
    expect(body.length).toBe(2048)
    expect(body[0]).toBe(7)
  })

  it('提交失败（errcode 500）：抛 ASR_WX_SUBMIT_500，不进入轮询', async () => {
    stubWxFetch({
      token: () => ({ access_token: 'TOKEN_1', expires_in: 7200 }),
      submit: () => ({ errcode: 500, errmsg: 'system error' })
    })
    const audioPath = join(dir, 'a.mp3')
    await writeFile(audioPath, Buffer.alloc(100, 1))
    await expect(makeDriver().transcribe(audioPath, { timeoutMs: 5000 })).rejects.toThrow(
      'ASR_WX_SUBMIT_500'
    )
  })

  it('音频超过 1MB：抛 ASR_WX_FILE_TOO_LARGE，不发起网络请求', async () => {
    const { fn } = stubWxFetch({})
    const audioPath = join(dir, 'big.mp3')
    await writeFile(audioPath, Buffer.alloc(1024 * 1024 + 1, 1))
    await expect(makeDriver().transcribe(audioPath, { timeoutMs: 5000 })).rejects.toThrow(
      'ASR_WX_FILE_TOO_LARGE'
    )
    expect(fn).not.toHaveBeenCalled()
  })

  it('轮询超时：识别一直未完成，抛 ASR_WX_TIMEOUT', async () => {
    stubWxFetch({
      token: () => ({ access_token: 'TOKEN_1', expires_in: 7200 }),
      query: () => ({ errcode: 0, data: '' })
    })
    const audioPath = join(dir, 'a.mp3')
    await writeFile(audioPath, Buffer.alloc(100, 1))
    await expect(makeDriver().transcribe(audioPath, { timeoutMs: 200 })).rejects.toThrow(
      'ASR_WX_TIMEOUT'
    )
  })

  it('提交返回 40001：强制刷新 token 后重试成功', async () => {
    let tokenCalls = 0
    let submitCalls = 0
    const { calls } = stubWxFetch({
      token: () => {
        tokenCalls++
        return { access_token: 'TOKEN_' + tokenCalls, expires_in: 7200 }
      },
      submit: () => {
        // 首次提交 token 失效，重试成功
        submitCalls++
        return submitCalls === 1 ? { errcode: 40001, errmsg: 'invalid credential' } : { errcode: 0 }
      },
      query: () => ({ errcode: 0, data: '重试后成功' })
    })
    const audioPath = join(dir, 'a.mp3')
    await writeFile(audioPath, Buffer.alloc(100, 1))
    const r = await makeDriver().transcribe(audioPath, { timeoutMs: 5000 })
    expect(r).toEqual({ text: '重试后成功', confidence: 1 })
    // token 拉取两次（首次 + 40001 恢复），第二次提交使用新 token
    expect(tokenCalls).toBe(2)
    const submitUrls = calls.filter(([u]) => u.indexOf('addvoicetorecofortext') >= 0)
    expect(submitUrls.length).toBe(2)
    expect(submitUrls[0][0]).toContain('access_token=TOKEN_1')
    expect(submitUrls[1][0]).toContain('access_token=TOKEN_2')
  })
})
