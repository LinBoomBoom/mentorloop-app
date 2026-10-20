// 云存储中转转写单测：fileID 校验 / 取链接 / 下载 / 落盘清理 / 超限与失败降级
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isCloudFileID, transcribeByCloudFileID } from './services/asr-cloud.js'
import { resetWxAccessTokenCache } from './services/wx-access-token.js'
import type { Env } from './config.js'
import type { AsrDriver } from './services/asr.js'

function mkRes(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    arrayBuffer: async () => body
  } as any
}

let dir = ''

beforeEach(async () => {
  resetWxAccessTokenCache()
  vi.unstubAllGlobals()
  dir = await mkdtemp(join(tmpdir(), 'asr-cloud-'))
})

const env = () =>
  ({
    wxAppId: 'wxappid',
    wxSecret: 'wxsecret',
    wxCloudEnvId: 'prod-test',
    asrTimeoutMs: 5000,
    uploadDir: dir
  }) as unknown as Env

const okDriver: AsrDriver = {
  name: 'fake',
  async transcribe() {
    return { text: '识别到的回答', confidence: 1 }
  }
}

describe('isCloudFileID', () => {
  it('仅接受 cloud:// 前缀', () => {
    expect(isCloudFileID('cloud://a.b/c.mp3')).toBe(true)
    expect(isCloudFileID('https://evil.com/x.mp3')).toBe(false)
    expect(isCloudFileID('')).toBe(false)
  })
})

describe('transcribeByCloudFileID', () => {
  it('全链路：取 token → 取下载链接 → 下载音频 → 转写，且临时文件已清理', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: any) => {
      const u = String(url)
      calls.push(u)
      if (u.indexOf('/cgi-bin/token') >= 0) {
        return mkRes({ access_token: 'TK', expires_in: 7200 })
      }
      if (u.indexOf('/tcb/batchdownloadfile') >= 0) {
        return mkRes({
          errcode: 0,
          errmsg: 'ok',
          file_list: [
            {
              fileid: 'cloud://prod-test.bucket/asr/x.mp3',
              download_url: 'https://cdn.example.com/x.mp3',
              status: 0
            }
          ]
        })
      }
      if (u.indexOf('cdn.example.com') >= 0) {
        return mkRes(new Uint8Array([1, 2, 3, 4]).buffer)
      }
      throw new Error('unexpected ' + u)
    })

    const r = await transcribeByCloudFileID(env(), 'cloud://prod-test.bucket/asr/x.mp3', {
      driver: okDriver
    })
    expect(r).toEqual({ text: '识别到的回答', confidence: 1 })
    expect(calls[0]).toContain('/cgi-bin/token')
    expect(calls[1]).toContain('/tcb/batchdownloadfile')
    expect(calls[2]).toContain('cdn.example.com')
    // 临时文件不残留（隐私红线）
    const left = await readdir(dir)
    expect(left.length).toBe(0)
  })

  it('取链接失败（85088）→ 抛错，由路由降级', async () => {
    vi.stubGlobal('fetch', async (url: any) => {
      const u = String(url)
      if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
      return mkRes({ errcode: 85088, errmsg: 'no qbase privilege' })
    })
    await expect(
      transcribeByCloudFileID(env(), 'cloud://prod-test.bucket/asr/x.mp3', { driver: okDriver })
    ).rejects.toThrow(/WX_STORAGE_DL_85088/)
  })

  it('下载超 1MB → 抛 ASR_CLOUD_TOO_LARGE（微信硬限）', async () => {
    vi.stubGlobal('fetch', async (url: any) => {
      const u = String(url)
      if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
      if (u.indexOf('/tcb/batchdownloadfile') >= 0) {
        return mkRes({
          errcode: 0,
          file_list: [{ download_url: 'https://cdn.example.com/big.mp3', status: 0 }]
        })
      }
      return mkRes(new Uint8Array(1024 * 1024 + 1).buffer)
    })
    await expect(
      transcribeByCloudFileID(env(), 'cloud://prod-test.bucket/asr/big.mp3', { driver: okDriver })
    ).rejects.toThrow(/ASR_CLOUD_TOO_LARGE/)
  })

  it('下载为空 → 抛 ASR_CLOUD_EMPTY_AUDIO', async () => {
    vi.stubGlobal('fetch', async (url: any) => {
      const u = String(url)
      if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
      if (u.indexOf('/tcb/batchdownloadfile') >= 0) {
        return mkRes({ errcode: 0, file_list: [{ download_url: 'https://cdn.example.com/e.mp3' }] })
      }
      return mkRes(new Uint8Array(0).buffer)
    })
    await expect(
      transcribeByCloudFileID(env(), 'cloud://prod-test.bucket/asr/e.mp3', { driver: okDriver })
    ).rejects.toThrow(/ASR_CLOUD_EMPTY_AUDIO/)
  })
})
