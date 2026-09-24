// 服务端配置（环境变量 + 常量）
import { mkdirSync } from 'node:fs'

export type Env = {
  port: number
  dbPath: string
  jwtSecret: string
  uploadDir: string
  mockSmsCode: string
  smsTtlMs: number
}

const DEFAULT_ENV: Env = {
  port: 8787,
  dbPath: './data/mentorloop.db',
  jwtSecret: 'dev-only-change-me',
  uploadDir: './data/uploads',
  mockSmsCode: '123456',
  smsTtlMs: 300000
}

export function loadEnv(): Env {
  const e = process.env || {}
  return {
    port: parseInt(e.PORT ?? '', 10) || DEFAULT_ENV.port,
    dbPath: e.DB_PATH ?? DEFAULT_ENV.dbPath,
    jwtSecret: e.JWT_SECRET ?? DEFAULT_ENV.jwtSecret,
    uploadDir: e.UPLOAD_DIR ?? DEFAULT_ENV.uploadDir,
    mockSmsCode: e.MOCK_SMS_CODE ?? DEFAULT_ENV.mockSmsCode,
    smsTtlMs: parseInt(e.SMS_TTL_MS ?? '', 10) || DEFAULT_ENV.smsTtlMs
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
