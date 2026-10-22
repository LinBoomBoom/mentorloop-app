// 专项训练路由（契约：docs/contracts/2026-10-22-training-online-question-bank.freeze.md）
// 只读取题：内容库 questions → 题目选择器 → 本场题目列表；不建会话、不写答题记录。

import { FastifyInstance } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { loadTrainingQuestions } from '../services/training.js'
import { okData, fail } from '../util.js'
import { PositionId, ExperienceLevel } from '../types/interview.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  app.post(
    '/training/questions',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['positionId', 'experienceLevel', 'count'],
          properties: {
            positionId: { type: 'string', enum: ['frontend', 'backend', 'devops', 'ai'] },
            experienceLevel: {
              type: 'string',
              enum: ['fresh', 'junior', 'mid', 'senior']
            },
            domain: { type: 'string' },
            count: { type: 'number', minimum: 1, maximum: 10 }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as any
      try {
        const questions = await loadTrainingQuestions(db, {
          positionId: body.positionId as PositionId,
          experienceLevel: body.experienceLevel as ExperienceLevel,
          domain: typeof body.domain === 'string' ? body.domain : '',
          count: Number(body.count)
        })
        return okData({ questions })
      } catch (e: any) {
        console.warn('[training] load questions failed', e != null ? e.message : e)
        return reply.code(500).send(fail(500, '题库加载失败'))
      }
    }
  )
}
