// 路由汇总
import { FastifyInstance } from 'fastify'
import authRoutes from './auth.js'
import interviewRoutes from './interview.js'
import miscRoutes from './misc.js'
import membershipRoutes from './membership.js'
import meRoutes from './me.js'

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes)
  await app.register(interviewRoutes)
  await app.register(miscRoutes)
  await app.register(membershipRoutes)
  await app.register(meRoutes)
}
