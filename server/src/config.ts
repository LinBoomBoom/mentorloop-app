// 服务端配置（环境变量 + 常量）
import { mkdirSync } from 'node:fs'

export type Env = {
  port: number
  dbPath: string
  jwtSecret: string
  uploadDir: string
  mockSmsCode: string
  smsTtlMs: number
  llmEnabled: boolean
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  llmTimeoutMs: number
  payMode: 'mock' | 'wx'
  wxAppId: string
  wxMchId: string
  wxMchSerial: string
  wxApiV3Key: string
  wxMchPrivateKey: string
  wxPlatformPublicKey: string
  wxNotifyUrl: string
  asrProvider: 'stub' | 'aliyun'
  asrTimeoutMs: number
  asrAliyunAccessKeyId: string
  asrAliyunAccessKeySecret: string
  asrAliyunAppKey: string
  asrAliyunRegion: string
}

const DEFAULT_ENV: Env = {
  port: 8787,
  dbPath: './data/mentorloop.db',
  jwtSecret: 'dev-only-change-me',
  uploadDir: './data/uploads',
  mockSmsCode: '123456',
  smsTtlMs: 300000,
  llmEnabled: false, // P1.2：默认关闭，报告回退纯规则；开启后 LLM 仅生成解释与优秀示例
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  llmTimeoutMs: 30000,
  payMode: 'mock', // P1.3：默认 mock 支付（下单即发放）；'wx' 需要 WX_* 配置齐全
  wxAppId: '',
  wxMchId: '',
  wxMchSerial: '',
  wxApiV3Key: '',
  wxMchPrivateKey: '',
  wxPlatformPublicKey: '',
  wxNotifyUrl: '',
  asrProvider: 'stub', // P2-13：默认 stub（明确降级，不伪造转写）；'aliyun' 需 ASR_ALIYUN_* 齐全
  asrTimeoutMs: 30000,
  asrAliyunAccessKeyId: '',
  asrAliyunAccessKeySecret: '',
  asrAliyunAppKey: '',
  asrAliyunRegion: 'cn-shanghai'
}

export function loadEnv(): Env {
  const e = process.env || {}
  return {
    port: parseInt(e.PORT ?? '', 10) || DEFAULT_ENV.port,
    dbPath: e.DB_PATH ?? DEFAULT_ENV.dbPath,
    jwtSecret: e.JWT_SECRET ?? DEFAULT_ENV.jwtSecret,
    uploadDir: e.UPLOAD_DIR ?? DEFAULT_ENV.uploadDir,
    mockSmsCode: e.MOCK_SMS_CODE ?? DEFAULT_ENV.mockSmsCode,
    smsTtlMs: parseInt(e.SMS_TTL_MS ?? '', 10) || DEFAULT_ENV.smsTtlMs,
    llmEnabled: e.LLM_ENABLED === 'true',
    llmBaseUrl: e.LLM_BASE_URL ?? DEFAULT_ENV.llmBaseUrl,
    llmApiKey: e.LLM_API_KEY ?? DEFAULT_ENV.llmApiKey,
    llmModel: e.LLM_MODEL ?? DEFAULT_ENV.llmModel,
    llmTimeoutMs: parseInt(e.LLM_TIMEOUT_MS ?? '', 10) || DEFAULT_ENV.llmTimeoutMs,
    payMode: e.PAY_MODE === 'wx' ? 'wx' : 'mock',
    wxAppId: e.WX_APPID ?? DEFAULT_ENV.wxAppId,
    wxMchId: e.WX_MCHID ?? DEFAULT_ENV.wxMchId,
    wxMchSerial: e.WX_MCH_SERIAL ?? DEFAULT_ENV.wxMchSerial,
    wxApiV3Key: e.WX_API_V3_KEY ?? DEFAULT_ENV.wxApiV3Key,
    wxMchPrivateKey: e.WX_MCH_PRIVATE_KEY ?? DEFAULT_ENV.wxMchPrivateKey,
    wxPlatformPublicKey: e.WX_PLATFORM_PUBLIC_KEY ?? DEFAULT_ENV.wxPlatformPublicKey,
    wxNotifyUrl: e.WX_NOTIFY_URL ?? DEFAULT_ENV.wxNotifyUrl,
    asrProvider: e.ASR_PROVIDER === 'aliyun' ? 'aliyun' : 'stub',
    asrTimeoutMs: parseInt(e.ASR_TIMEOUT_MS ?? '', 10) || DEFAULT_ENV.asrTimeoutMs,
    asrAliyunAccessKeyId: e.ASR_ALIYUN_ACCESS_KEY_ID ?? DEFAULT_ENV.asrAliyunAccessKeyId,
    asrAliyunAccessKeySecret:
      e.ASR_ALIYUN_ACCESS_KEY_SECRET ?? DEFAULT_ENV.asrAliyunAccessKeySecret,
    asrAliyunAppKey: e.ASR_ALIYUN_APPKEY ?? DEFAULT_ENV.asrAliyunAppKey,
    asrAliyunRegion: e.ASR_ALIYUN_REGION ?? DEFAULT_ENV.asrAliyunRegion
  }
}

// 确保数据目录存在（db 与 uploads）
export function ensureDataDirs(env: Env): void {
  try {
    if (env.dbPath !== ':memory:') {
      const dbDir = env.dbPath.substring(0, env.dbPath.lastIndexOf('/'))
      if (dbDir.length > 0) mkdirSync(dbDir, { recursive: true })
    }
    if (env.uploadDir.length > 0) mkdirSync(env.uploadDir, { recursive: true })
  } catch (err) {
    console.warn('[config] ensureDataDirs failed', err)
  }
}

// 业务常量：新用户默认免费额度（与前端 store/quota.uts FREE_QUOTA 对齐）
export const DEFAULT_FREE_QUOTA = 3

// 面试时长模式 → 题目预算（与前端 question-selector getModeBudget 对齐）
export type ModeBudget = { maxQuestions: number; totalSeconds: number }

export function getModeBudget(mode: string): ModeBudget {
  if (mode === 'quick') return { maxQuestions: 3, totalSeconds: 300 }
  if (mode === 'deep') return { maxQuestions: 12, totalSeconds: 2400 }
  return { maxQuestions: 7, totalSeconds: 1200 }
}
