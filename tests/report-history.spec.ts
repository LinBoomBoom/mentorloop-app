// 报告历史 store 单测：/me/reports 拉取节流（2026-10-11 任务卡验收项）
// 覆盖：TTL 去重 / in-flight 并发去重 / 换号强制重拉 / 失败不更新 TTL
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const useMockFn = vi.fn((): boolean => false)

vi.mock('../api/client.uts', () => ({
  get: (...args: unknown[]) => getMock(...args),
  useMock: () => useMockFn()
}))

const userState = { loggedIn: false, uid: '' }
vi.mock('../store/user-profile.uts', () => ({
  userStore: {
    isLoggedIn: () => userState.loggedIn,
    get profile() {
      return { uid: userState.uid }
    }
  }
}))

// uni 存储 stub（persist/load 使用）
const storage = new Map<string, string>()
;(globalThis as any).uni = {
  getStorageSync: (k: string) => storage.get(k) ?? '',
  setStorageSync: (k: string, v: string) => storage.set(k, v),
  removeStorageSync: (k: string) => storage.delete(k)
}

import { reportHistory } from '../store/report-history.uts'

function okResponse(reports: unknown[] = []) {
  return { code: 0, data: reports, message: '' }
}

function sampleReport(i: number) {
  return {
    overall: '报告' + i,
    strongest: '工程',
    topPriority: '沟通',
    dimensions: [],
    riskQuestions: [],
    trainingPlan: []
  }
}

beforeEach(() => {
  getMock.mockReset()
  useMockFn.mockReturnValue(false)
  userState.loggedIn = true
  userState.uid = 'u_a'
  storage.clear()
  // 重置单例内部节流状态（private 字段在编译产物中可直接赋值）
  const inst = reportHistory as unknown as {
    lastFetchAt: number
    lastFetchUid: string
    fetching: Promise<void> | null
    list: unknown[]
  }
  inst.lastFetchAt = 0
  inst.lastFetchUid = ''
  inst.fetching = null
  inst.list = []
})

describe('报告历史拉取节流（/me/reports 防重复）', () => {
  it('TTL 内的连续调用只发一次请求', async () => {
    getMock.mockResolvedValue(okResponse([{ sessionId: 's1', at: 1, report: sampleReport(1) }]))
    await reportHistory.fetchFromServer()
    await reportHistory.fetchFromServer()
    await reportHistory.fetchFromServer()
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(reportHistory.all().length).toBe(1)
  })

  it('并发 in-flight 调用共享同一请求（三个 tab 同时 onShow 场景）', async () => {
    let resolveGet!: (v: unknown) => void
    getMock.mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve
      })
    )
    const p1 = reportHistory.fetchFromServer()
    const p2 = reportHistory.fetchFromServer()
    const p3 = reportHistory.fetchFromServer()
    resolveGet(okResponse([]))
    await Promise.all([p1, p2, p3])
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('换账号后强制重拉，不展示上一账号报告', async () => {
    getMock.mockResolvedValue(okResponse([{ sessionId: 's_a', at: 1, report: sampleReport(1) }]))
    await reportHistory.fetchFromServer()
    expect(reportHistory.all().length).toBe(1)

    userState.uid = 'u_b'
    getMock.mockResolvedValue(okResponse([]))
    await reportHistory.fetchFromServer()
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(reportHistory.all().length).toBe(0)
  })

  it('请求失败不更新 TTL，下次调用重试', async () => {
    getMock.mockRejectedValueOnce(new Error('network'))
    await reportHistory.fetchFromServer()
    expect(getMock).toHaveBeenCalledTimes(1)

    getMock.mockResolvedValue(okResponse([{ sessionId: 's2', at: 2, report: sampleReport(2) }]))
    await reportHistory.fetchFromServer()
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(reportHistory.all().length).toBe(1)
  })

  it('mock 模式与未登录态直接跳过', async () => {
    useMockFn.mockReturnValue(true)
    await reportHistory.fetchFromServer()
    userState.loggedIn = false
    useMockFn.mockReturnValue(false)
    await reportHistory.fetchFromServer()
    expect(getMock).not.toHaveBeenCalled()
  })
})
