// MentorLoop 服务端端到端冒烟脚本（P1.1）
// 用法：先启动服务端（本地默认 8787），再运行：
//   node server/e2e/smoke.mjs [baseUrl]
// 默认 http://127.0.0.1:8787
import assert from 'node:assert/strict'

const base = process.argv[2] ?? 'http://127.0.0.1:8787'
// 动态手机号，避免跨轮次配额/账本残差影响断言
const phone = '138' + String(Date.now()).slice(-8)
const pass = []

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body != null ? JSON.stringify(body) : undefined
  })
  const json = await res.json()
  return json
}

function step(name, cond) {
  assert.ok(cond, name + ' 断言失败')
  pass.push(name)
  console.log('  ✔', name)
}

async function main() {
  console.log('[smoke] base =', base)

  // 1. 认证链路
  await api('/auth/sms-code', { method: 'POST', body: { phone } })
  const login = await api('/auth/login', { method: 'POST', body: { phone, code: '123456' } })
  step('登录成功并返回 token', login.code === 0 && typeof login.data.token === 'string')
  const token = login.data.token
  const me = await api('/auth/me', { token })
  step('me 返回 uid 与默认配额 3', me.code === 0 && me.data.quota.freeInterviewsLeft === 3)
  const uid = me.data.uid

  // 2. 面试链路（岗位过滤 + 收束）
  const s = await api('/interview/session?mode=quick', {
    method: 'POST',
    token,
    body: { positionId: 'java-backend', experienceLevel: 'junior', position: 'Java 后端' }
  })
  step('创建会话', s.code === 0 && typeof s.data.sessionId === 'string')
  const sessionId = s.data.sessionId

  const ids = []
  for (let i = 0; i < 3; i++) {
    const n = await api(`/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`, {
      token
    })
    step(`第 ${i + 1} 题岗位匹配`, n.code === 0 && n.data.positionId === 'java-backend')
    ids.push(n.data.id)
    await api('/interview/answer', {
      method: 'POST',
      token,
      body: {
        sessionId,
        questionId: n.data.id,
        text: '我负责了模块设计，RT 从 300ms 降到 80ms。',
        isFollowup: false
      }
    })
  }
  const wrap = await api(`/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`, {
    token
  })
  step('达题量上限返回岗位收束题', wrap.code === 0 && wrap.data.id === 'q-wrapup')
  const empty = await api(`/interview/next?sessionId=${sessionId}&mode=quick&remainSeconds=600`, {
    token
  })
  step('再取题返回收束标记(2001)', empty.code === 2001)

  // 3. 报告（幂等）与配额扣减
  const r1 = await api(`/report?sessionId=${sessionId}`, { token })
  step('报告含六维', r1.code === 0 && r1.data.dimensions.length === 6)
  const q1 = await api('/membership/quota', { token })
  step('完成面试后免费额度 3 → 2', q1.code === 0 && q1.data.freeInterviewsLeft === 2)
  const my = await api('/me/reports', { token })
  step(
    '我的报告历史含本场且 overall 非空',
    my.code === 0 && my.data.length >= 1 && my.data[0].report.overall.length > 0
  )

  // 3.6 ASR 上传链路（P2-13；默认 stub 明确降级，不伪造转写）
  const fd = new FormData()
  fd.append('audio', new Blob(['fakem4abytes'], { type: 'audio/mp4' }), 'answer.m4a')
  const asrRes = await fetch(base + '/interview/asr', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: fd
  })
  const asrJson = await asrRes.json()
  step('ASR 上传链路可用（stub 返回空转写）', asrJson.code === 0 && asrJson.data.text === '')

  // 4. 简历
  const parse = await api('/resume/parse', {
    method: 'POST',
    token,
    body: { fileUrl: 'resume.pdf' }
  })
  step('简历解析结构合法', parse.code === 0 && Array.isArray(parse.data.techStack))
  const opt = await api('/resume/optimize', {
    method: 'POST',
    token,
    body: { text: '项目经历', position: 'Java 后端' }
  })
  step('改写建议结构合法', opt.code === 0 && Array.isArray(opt.data) && opt.data.length > 0)

  // 5. 埋点
  const payload = JSON.stringify({
    event: 'interview_complete',
    userId: uid,
    sessionId,
    platform: 'mp-weixin',
    timestamp: Date.now(),
    questionCount: ids.length
  })
  const tr = await api('/track/batch', { method: 'POST', body: { events: [payload, payload] } })
  step('埋点批量接收成功（重复事件幂等）', tr.code === 0)

  // 6. 支付（P1.3 mock 模式：下单即发放）
  const pay = await api('/membership/order', {
    method: 'POST',
    token,
    body: { skuId: 'member_monthly' }
  })
  step(
    'mock 下单返回 payParams=null 且含 orderId',
    pay.code === 0 && pay.data.payParams === null && typeof pay.data.orderId === 'string'
  )
  const q2 = await api('/membership/quota', { token })
  step('下单后会员生效（memberUntil > 0）', q2.code === 0 && q2.data.memberUntil > 0)

  console.log(`\n[smoke] 通过 ${pass.length} 项 ✔`)
}

main().catch((e) => {
  console.error('[smoke] 失败:', e)
  process.exit(1)
})
