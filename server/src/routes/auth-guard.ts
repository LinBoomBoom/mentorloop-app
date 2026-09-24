// 统一鉴权预处理器：JWT 校验失败返回业务 401（前端 client.uts 识别后自动登出）
import { FastifyRequest, FastifyReply } from 'fastify'
import { fail } from '../util.js'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send(fail(401, '未登录或登录已过期'))
  }
}
