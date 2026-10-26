// 服务端配置（环境变量 + 常量）
import { mkdirSync } from 'node:fs'

export type Env = {
  port: number
  dbPath: string
  jwtSecret: string
  uploadDir: string
  mysqlHost: string // 云托管注入；为空走本地 node:sqlite
  mysqlPort: number
  mysqlUser: string
  mysqlPassword: string
  mysqlDatabase: string
  mysqlPoolSize: number
  desktopDbName: string // 桌面端库名（同实例跨库只读）；为空=关闭账号互通，零跨库查询
  mockSmsCode: string
  smsTtlMs: number
  smsProvider: 'mock' | 'tencent'
  smsRegion: string
  smsSdkAppId: string
  smsSignName: string
  smsTemplateId: string
  smsTimeoutMs: number
  llmEnabled: boolean
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  llmTimeoutMs: number
  payMode: 'mock' | 'wx'
  wxAppId: string
  wxSecret: string // 小程序 AppSecret：/auth/wechat body.code 换 openid（jscode2session）
  trustWxHeaders: boolean // 仅云托管私有链路部署时开启：采信网关注入的 X-WX-* 头；关闭时服务端强制剥离该类头
  wxMockLogin: boolean // 本地联调豁免：无 WX_SECRET 时用 'wx_'+code 作 openid（生产禁止）
  allowWeakSmsCode: boolean // 显式放行「万能验证码 123456」上云（上线前联调专用，默认禁止）
  wxMchId: string
  wxMchSerial: string
  wxApiV3Key: string
  wxMchPrivateKey: string
  wxPlatformPublicKey: string
  wxNotifyUrl: string
  // 小程序虚拟支付（契约：docs/contracts/2026-10-21-virtual-pay.freeze.md）
  // 与 App 的 PAY_MODE 分离：MP_PAY_MODE 只作用于 platform=mp-weixin 的下单
  mpPayMode: 'mock' | 'virtual'
  mpOfferId: string // 虚拟支付 OfferID（非密钥）
  mpAppKey: string // 现网 AppKey（密钥级：仅云端变量，不落日志/仓库）
  asrProvider: 'stub' | 'aliyun' | 'wx'
  asrTimeoutMs: number
  asrAliyunAccessKeyId: string
  asrAliyunAccessKeySecret: string
  asrAliyunAppKey: string
  asrAliyunRegion: string
  // 面试官 TTS 下行（契约：docs/contracts/2026-10-19-tts-outbound.freeze.md）
  ttsProvider: 'stub' | 'probe' | 'tencent'
  tencentSecretId: string
  tencentSecretKey: string
  tencentTtsRegion: string
  tencentTtsVoiceType: number
  wxCloudEnvId: string // 云存储环境（写合成音频用；非密钥）
  // 简历 AI 评审额度（2026-10-21）
  resumeMemberMonthlyQuota: number // 会员每自然月完整评审次数
  resumeFreePreviewDaily: number // 免费用户每日结构预览次数
  // 虚拟支付查单兜底间隔（2026-10-26 预上线降配）：<=0 关闭；默认 60 分钟
  virtualReconcileIntervalMs: number
}

const DEFAULT_ENV: Env = {
  port: 8787,
  dbPath: './data/mentorloop.db',
  jwtSecret: 'dev-only-change-me',
  uploadDir: './data/uploads',
  mysqlHost: '',
  mysqlPort: 3306,
  mysqlUser: '',
  mysqlPassword: '',
  mysqlDatabase: 'mentorloop_mp',
  mysqlPoolSize: 5,
  desktopDbName: '', // 默认关闭：互通是增强项，零配置必须可跑
  mockSmsCode: '123456',
  smsTtlMs: 300000,
  smsProvider: 'mock', // 本地默认 mock；云端默认不启用（个人主体无法办理签名），置 tencent 才开启手机号登录
  smsRegion: 'ap-guangzhou',
  smsSdkAppId: '',
  smsSignName: '',
  smsTemplateId: '',
  smsTimeoutMs: 8000,
  llmEnabled: false, // P1.2：默认关闭，报告回退纯规则；开启后 LLM 仅生成解释与优秀示例
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  llmTimeoutMs: 30000,
  payMode: 'mock', // P1.3：默认 mock 支付（下单即发放）；'wx' 需要 WX_* 配置齐全
  wxAppId: '',
  wxSecret: '',
  trustWxHeaders: false, // 默认不信任：公网部署时客户端可伪造 X-WX-OPENID；云托管部署显式开启
  wxMockLogin: false, // 默认关闭：'wx_'+code 假 openid 仅限本地联调显式开启
  allowWeakSmsCode: false, // 默认禁止：需显式 ALLOW_WEAK_SMS_CODE=true 才允许万能验证码上云
  wxMchId: '',
  wxMchSerial: '',
  wxApiV3Key: '',
  wxMchPrivateKey: '',
  wxPlatformPublicKey: '',
  wxNotifyUrl: '',
  // 小程序虚拟支付：默认 mock（下单即发放，零配置可跑）；生产必须显式置 virtual
  mpPayMode: 'mock',
  mpOfferId: '',
  mpAppKey: '',
  asrProvider: 'stub', // P2-13：默认 stub（明确降级，不伪造转写）；'wx' 复用 WX_APPID/WX_SECRET（音频≤1MB mp3）；'aliyun' 需 ASR_ALIYUN_* 齐全
  asrTimeoutMs: 30000,
  asrAliyunAccessKeyId: '',
  asrAliyunAccessKeySecret: '',
  asrAliyunAppKey: '',
  asrAliyunRegion: 'cn-shanghai',
  ttsProvider: 'stub', // 默认 stub：诚实降级（空 fileID），客户端回退字幕模式
  tencentSecretId: '',
  tencentSecretKey: '',
  tencentTtsRegion: 'ap-guangzhou',
  tencentTtsVoiceType: 101001, // 智瑜（基础女声，mp3 16k）
  wxCloudEnvId: 'prod-d6gaa83ds8accb61b',
  resumeMemberMonthlyQuota: 5,
  resumeFreePreviewDaily: 3,
  virtualReconcileIntervalMs: 60 * 60 * 1000
}

export function loadEnv(): Env {
  const e = process.env || {}
  const reconcileRaw = parseInt(e.VIRTUAL_RECONCILE_INTERVAL_MS ?? '', 10)
  return {
    port: parseInt(e.PORT ?? '', 10) || DEFAULT_ENV.port,
    dbPath: e.DB_PATH ?? DEFAULT_ENV.dbPath,
    jwtSecret: e.JWT_SECRET ?? DEFAULT_ENV.jwtSecret,
    uploadDir: e.UPLOAD_DIR ?? DEFAULT_ENV.uploadDir,
    mysqlHost: e.MYSQL_HOST ?? '',
    mysqlPort: parseInt(e.MYSQL_PORT ?? '', 10) || DEFAULT_ENV.mysqlPort,
    mysqlUser: e.MYSQL_USER ?? '',
    mysqlPassword: e.MYSQL_PASSWORD ?? '',
    mysqlDatabase: e.MYSQL_DATABASE || DEFAULT_ENV.mysqlDatabase,
    mysqlPoolSize: parseInt(e.MYSQL_POOL_SIZE ?? '', 10) || DEFAULT_ENV.mysqlPoolSize,
    desktopDbName: e.DESKTOP_DB_NAME ?? DEFAULT_ENV.desktopDbName,
    mockSmsCode: e.MOCK_SMS_CODE ?? DEFAULT_ENV.mockSmsCode,
    smsTtlMs: parseInt(e.SMS_TTL_MS ?? '', 10) || DEFAULT_ENV.smsTtlMs,
    smsProvider: e.SMS_PROVIDER === 'tencent' ? 'tencent' : 'mock',
    smsRegion: e.SMS_REGION ?? DEFAULT_ENV.smsRegion,
    smsSdkAppId: e.SMS_SDK_APP_ID ?? DEFAULT_ENV.smsSdkAppId,
    smsSignName: e.SMS_SIGN_NAME ?? DEFAULT_ENV.smsSignName,
    smsTemplateId: e.SMS_TEMPLATE_ID ?? DEFAULT_ENV.smsTemplateId,
    smsTimeoutMs: parseInt(e.SMS_TIMEOUT_MS ?? '', 10) || DEFAULT_ENV.smsTimeoutMs,
    llmEnabled: e.LLM_ENABLED === 'true',
    llmBaseUrl: e.LLM_BASE_URL ?? DEFAULT_ENV.llmBaseUrl,
    llmApiKey: e.LLM_API_KEY ?? DEFAULT_ENV.llmApiKey,
    llmModel: e.LLM_MODEL ?? DEFAULT_ENV.llmModel,
    llmTimeoutMs: parseInt(e.LLM_TIMEOUT_MS ?? '', 10) || DEFAULT_ENV.llmTimeoutMs,
    payMode: e.PAY_MODE === 'wx' ? 'wx' : 'mock',
    wxAppId: e.WX_APPID ?? DEFAULT_ENV.wxAppId,
    wxSecret: e.WX_SECRET ?? DEFAULT_ENV.wxSecret,
    trustWxHeaders: e.TRUST_WX_HEADERS === 'true',
    wxMockLogin: e.WX_MOCK_LOGIN === 'true',
    allowWeakSmsCode: e.ALLOW_WEAK_SMS_CODE === 'true',
    wxMchId: e.WX_MCHID ?? DEFAULT_ENV.wxMchId,
    wxMchSerial: e.WX_MCH_SERIAL ?? DEFAULT_ENV.wxMchSerial,
    wxApiV3Key: e.WX_API_V3_KEY ?? DEFAULT_ENV.wxApiV3Key,
    wxMchPrivateKey: e.WX_MCH_PRIVATE_KEY ?? DEFAULT_ENV.wxMchPrivateKey,
    wxPlatformPublicKey: e.WX_PLATFORM_PUBLIC_KEY ?? DEFAULT_ENV.wxPlatformPublicKey,
    wxNotifyUrl: e.WX_NOTIFY_URL ?? DEFAULT_ENV.wxNotifyUrl,
    mpPayMode: e.MP_PAY_MODE === 'virtual' ? 'virtual' : 'mock',
    mpOfferId: e.MP_OFFER_ID ?? DEFAULT_ENV.mpOfferId,
    mpAppKey: e.MP_APP_KEY ?? DEFAULT_ENV.mpAppKey,
    asrProvider: e.ASR_PROVIDER === 'aliyun' ? 'aliyun' : e.ASR_PROVIDER === 'wx' ? 'wx' : 'stub',
    asrTimeoutMs: parseInt(e.ASR_TIMEOUT_MS ?? '', 10) || DEFAULT_ENV.asrTimeoutMs,
    asrAliyunAccessKeyId: e.ASR_ALIYUN_ACCESS_KEY_ID ?? DEFAULT_ENV.asrAliyunAccessKeyId,
    asrAliyunAccessKeySecret:
      e.ASR_ALIYUN_ACCESS_KEY_SECRET ?? DEFAULT_ENV.asrAliyunAccessKeySecret,
    asrAliyunAppKey: e.ASR_ALIYUN_APPKEY ?? DEFAULT_ENV.asrAliyunAppKey,
    asrAliyunRegion: e.ASR_ALIYUN_REGION ?? DEFAULT_ENV.asrAliyunRegion,
    ttsProvider:
      e.TTS_PROVIDER === 'tencent' ? 'tencent' : e.TTS_PROVIDER === 'probe' ? 'probe' : 'stub',
    tencentSecretId: e.TENCENTCLOUD_SECRET_ID ?? DEFAULT_ENV.tencentSecretId,
    tencentSecretKey: e.TENCENTCLOUD_SECRET_KEY ?? DEFAULT_ENV.tencentSecretKey,
    tencentTtsRegion: e.TENCENT_TTS_REGION ?? DEFAULT_ENV.tencentTtsRegion,
    tencentTtsVoiceType:
      parseInt(e.TENCENT_TTS_VOICE_TYPE ?? '', 10) || DEFAULT_ENV.tencentTtsVoiceType,
    wxCloudEnvId: e.WX_CLOUD_ENV_ID ?? DEFAULT_ENV.wxCloudEnvId,
    resumeMemberMonthlyQuota:
      parseInt(e.RESUME_MEMBER_MONTHLY_QUOTA ?? '', 10) || DEFAULT_ENV.resumeMemberMonthlyQuota,
    resumeFreePreviewDaily:
      parseInt(e.RESUME_FREE_PREVIEW_DAILY ?? '', 10) || DEFAULT_ENV.resumeFreePreviewDaily,
    virtualReconcileIntervalMs: Number.isFinite(reconcileRaw)
      ? reconcileRaw
      : DEFAULT_ENV.virtualReconcileIntervalMs
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

// 云端部署（MYSQL_HOST 注入）启动安全守卫：拒绝以开发默认值上生产。
// - 默认 JWT_SECRET → 任何人可伪造 token（越权全站）
// - 默认万能验证码 → 任意手机号接管账号
// - 虚拟支付 half-configured → 下单必然签名失败
// - TTS 非精品音色 → 单场成本放大 4–21 倍（成本卡 §12）
// 本地 SQLite（mysqlHost 为空）零配置可跑，不受影响。

// 允许在云端使用的 TTS 音色白名单（均为精品音色，0.3 元/万字符）。
// 成本对照（官方后付费）：大模型音色 1.2 元/万（4×）、超自然大模型音色 6.5 元/万（21×）。
// 增删音色前必须先重跑 docs/tasks/2026-10-22-cost-and-pricing-decision.md §12 敏感性表。
export const APPROVED_TTS_VOICE_TYPES: number[] = [101001]

// 已弃用模型名（DeepSeek 于 2026-07-24 弃用，仍做兼容映射，但不保证能力与价格口径）
export const DEPRECATED_LLM_MODELS: string[] = ['deepseek-chat', 'deepseek-reasoner']

// 手机号验证码登录可用性：
// - 本地/测试（无 MYSQL_HOST）：mock 码直接可用，便于开发与单测
// - 云端：仅当短信通道（腾讯云 SMS）就绪时可用；个人主体无法办理签名，故默认关闭，
//   避免「万能验证码可登录任意手机号」（SEC-1）
export function isPhoneLoginEnabled(env: Env): boolean {
  if (env.mysqlHost.length === 0) return true
  return env.smsProvider === 'tencent'
}

// App 端支付可用性：
// - 配置真实商户凭据（PAY_MODE=wx）：可用
// - 本地/测试（无 MYSQL_HOST）：允许 mock 下单即发放，便于联调
// - 云端未配置商户凭据：不可用，拒绝下单（避免 mock 分支免费发放；App 本期不上线）
export function isAppPayEnabled(env: Env): boolean {
  if (env.payMode === 'wx') return true
  return env.mysqlHost.length === 0
}

export function assertCloudSafety(env: Env): void {
  if (env.mysqlHost.length === 0) return
  const problems: string[] = []
  if (env.jwtSecret === DEFAULT_ENV.jwtSecret) {
    problems.push('JWT_SECRET 仍为开发默认值 dev-only-change-me')
  }
  if (env.wxMockLogin) {
    problems.push('WX_MOCK_LOGIN=true（假 openid 登录）禁止在云端开启')
  }
  if (env.mpPayMode === 'virtual' && (env.mpOfferId.length === 0 || env.mpAppKey.length === 0)) {
    problems.push('MP_PAY_MODE=virtual 但 MP_OFFER_ID / MP_APP_KEY 未配齐（签名必然失败）')
  }
  // 短信通道：仅当显式启用腾讯云 SMS 时校验凭据（个人主体无法办理签名，云端默认不启用）
  if (env.smsProvider === 'tencent') {
    if (env.tencentSecretId.length === 0 || env.tencentSecretKey.length === 0) {
      problems.push('SMS_PROVIDER=tencent 但 TENCENTCLOUD_SECRET_ID/KEY 未配齐')
    }
    if (
      env.smsSdkAppId.length === 0 ||
      env.smsSignName.length === 0 ||
      env.smsTemplateId.length === 0
    ) {
      problems.push(
        'SMS_PROVIDER=tencent 但 SMS_SDK_APP_ID / SMS_SIGN_NAME / SMS_TEMPLATE_ID 未配齐'
      )
    }
  }
  if (
    env.ttsProvider === 'tencent' &&
    APPROVED_TTS_VOICE_TYPES.indexOf(env.tencentTtsVoiceType) < 0
  ) {
    problems.push(
      'TENCENT_TTS_VOICE_TYPE=' +
        String(env.tencentTtsVoiceType) +
        ' 不在已核准白名单（' +
        APPROVED_TTS_VOICE_TYPES.join(',') +
        '）：非精品音色单价为 1.2–6.5 元/万字符，成本放大 4–21 倍，须先重跑成本卡 §12'
    )
  }
  if (problems.length > 0) {
    throw new Error('[config] 拒绝启动（云模式安全守卫）：' + problems.join('；'))
  }
  // 非阻断告警：云端仍用 mock 会在下单时直接发放权益（免费白送），生产必须显式 virtual
  if (env.mpPayMode === 'mock') {
    console.warn(
      '[config] MP_PAY_MODE=mock（云端）：mp-weixin 下单将直接发放权益，不产生支付；生产环境请置 virtual'
    )
  }
  if (!isPhoneLoginEnabled(env)) {
    console.warn(
      '[config] 云端未启用腾讯云 SMS：手机号验证码登录已自动关闭（/auth/sms-code 与 /auth/login 返回不可用），仅保留微信登录'
    )
  } else if (env.mockSmsCode === DEFAULT_ENV.mockSmsCode || env.allowWeakSmsCode) {
    console.warn(
      '[config] 云端手机号登录启用中，但 MOCK_SMS_CODE=123456 或 ALLOW_WEAK_SMS_CODE=true 仍在生效，请尽快改为真实随机码'
    )
  }
  if (env.llmEnabled && DEPRECATED_LLM_MODELS.indexOf(env.llmModel) >= 0) {
    console.warn(
      '[config] LLM_MODEL=' +
        env.llmModel +
        ' 已于 2026-07-24 弃用（现映射 deepseek-v4-flash），建议显式改为 deepseek-v4-flash'
    )
  }
}
