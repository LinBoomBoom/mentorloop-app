// 云存储批量删除单测：凭据缺省跳过 / 官方参数与分批 / 失败抛错
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteCloudFiles } from './services/wx-storage.js'
import { resetWxAccessTokenCache } from './services/wx-access-token.js'

function mkRes(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body
  } as any
}

beforeEach(() => {
  resetWxAccessTokenCache()
  vi.unstubAllGlobals()
})

const base = { appId: 'wxappid', secret: 'wxsecret', envId: 'prod-test', timeoutMs: 1000 }

describe('deleteCloudFiles', () => {
  it('缺凭据/环境 → 返回 0，不发任何请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await deleteCloudFiles({ ...base, appId: '', fileIDs: ['cloud://e.b/x.mp3'] })
    expect(r).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('按官方 /tcb/batchdeletefile + fileid_list 删除，超过 50 个分批', async () => {
    const bodies: any[] = []
    vi.stubGlobal('fetch', async (url: any, init: any) => {
      const u = String(url)
      if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
      if (u.indexOf('/tcb/batchdeletefile') >= 0) {
        bodies.push(JSON.parse(String(init.body)))
        return mkRes({ errcode: 0, errmsg: 'ok', delete_list: [] })
      }
      throw new Error('unexpected ' + u)
    })

    const ids = Array.from({ length: 51 }, (_, i) => 'cloud://e.b/f' + i)
    const r = await deleteCloudFiles({ ...base, fileIDs: ids })
    expect(r).toBe(51)
    expect(bodies.length).toBe(2)
    expect(bodies[0].env).toBe('prod-test')
    expect(bodies[0].fileid_list.length).toBe(50)
    expect(bodies[1].fileid_list.length).toBe(1)
  })

  it('errcode 非 0 → 抛 WX_STORAGE_DELETE_<code>，由调用方降级', async () => {
    vi.stubGlobal('fetch', async (url: any) => {
      const u = String(url)
      if (u.indexOf('/cgi-bin/token') >= 0) return mkRes({ access_token: 'TK', expires_in: 7200 })
      return mkRes({ errcode: 85088, errmsg: 'no qbase privilege' })
    })
    await expect(deleteCloudFiles({ ...base, fileIDs: ['cloud://e.b/x.mp3'] })).rejects.toThrow(
      /WX_STORAGE_DELETE_85088/
    )
  })

  it('空列表 → 0，不请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await deleteCloudFiles({ ...base, fileIDs: [] })).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
