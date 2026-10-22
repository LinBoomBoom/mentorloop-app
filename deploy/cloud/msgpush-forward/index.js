// 消息推送转发云函数（方案 B · 父卡 §13 回退路径）
// 背景：微信「消息推送」不接受云托管默认域名作为正式接收地址（平台提示：仅测试使用）。
// 做法：由云函数 HTTP 访问服务接收推送，原样转发到云托管 /membership/virtual/notify，
//      并把上游响应（含 XML 回包与状态码）原样返回给微信。
// 说明：本函数不校验签名、不做业务判断；发货权威仍是云托管侧的 query_order 查单。
const TARGET =
  'https://mentorloop-mp-api-324175-6-1501249243.sh.run.tcloudbase.com/membership/virtual/notify'

function buildQuery(params) {
  if (params == null) return ''
  const keys = Object.keys(params)
  const parts = []
  for (let i = 0; i < keys.length; i++) {
    const v = params[keys[i]]
    if (v == null) continue
    parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(String(v)))
  }
  return parts.length > 0 ? '?' + parts.join('&') : ''
}

exports.main = async (event) => {
  const method = event.httpMethod || 'POST'
  const url = TARGET + buildQuery(event.queryStringParameters)
  const headers = event.headers || {}
  const contentType = headers['content-type'] || headers['Content-Type'] || 'application/xml'
  const rawBody = event.body == null ? '' : String(event.body)
  const body = event.isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf8') : rawBody

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'content-type': contentType },
      body: method === 'GET' ? undefined : body
    })
    const text = await res.text()
    return {
      statusCode: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/xml'
      },
      body: text
    }
  } catch {
    // 转发失败：回非 0，让平台重试（与云托管侧失败语义一致）
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<xml><ErrCode>1</ErrCode><ErrMsg><![CDATA[relay failed]]></ErrMsg></xml>'
    }
  }
}
