// 做题记录 / SRS 路由（Phase 2.1，契约：docs/contracts/2026-10-23-practice-sync.freeze.md）
// 记录以服务端为权威：客户端本地队列补传后拉取汇总与错题，实现跨设备同步。
import { FastifyInstance } from 'fastify'
import { requireAuth } from './auth-guard.js'
import { okData } from '../util.js'
import {
  recordAnswers,
  listRecords,
  summaryOf,
  wrongQuestions,
  dueQuestions,
  type PracticeAnswerInput
} from '../services/practice.js'

export default async function (app: FastifyInstance): Promise<void> {
  const db = (app as any).db as import('../db.js').Db

  app.post(
    '/practice/records',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['records'],
          properties: {
            records: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['questionId', 'subtrack', 'difficulty', 'result'],
                properties: {
                  questionId: { type: 'string', minLength: 1, maxLength: 64 },
                  subtrack: { type: 'string', maxLength: 64 },
                  difficulty: { type: 'string', enum: ['junior', 'mid', 'senior'] },
                  result: { type: 'string', enum: ['known', 'fuzzy', 'unknown'] },
                  answeredAt: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const uid = (request.user as any).uid as string
      const body = request.body as any
      const items: PracticeAnswerInput[] = []
      for (let i = 0; i < body.records.length; i++) {
        const r = body.records[i]
        items.push({
          questionId: String(r.questionId),
          subtrack: typeof r.subtrack === 'string' ? r.subtrack : '',
          difficulty: String(r.difficulty),
          result: String(r.result) as PracticeAnswerInput['result'],
          answeredAt: typeof r.answeredAt === 'number' ? r.answeredAt : 0
        })
      }
      const summary = await recordAnswers(db, uid, items)
      return okData({ summary: summary })
    }
  )

  app.get('/practice/records', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    return okData({ records: await listRecords(db, uid) })
  })

  app.get('/practice/summary', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    return okData({ summary: await summaryOf(db, uid) })
  })

  app.get('/practice/wrong', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const limitRaw = Number((request.query as any).limit)
    const limit = limitRaw > 0 && limitRaw <= 100 ? limitRaw : 100
    return okData({ questions: await wrongQuestions(db, uid, limit) })
  })

  app.get('/practice/due', { preHandler: requireAuth }, async (request) => {
    const uid = (request.user as any).uid as string
    const q = request.query as any
    const subtrack = typeof q.subtrack === 'string' ? q.subtrack : ''
    const limitRaw = Number(q.limit)
    const limit = limitRaw > 0 && limitRaw <= 20 ? limitRaw : 10
    const r = await dueQuestions(db, uid, subtrack, limit)
    return okData(r)
  })
}
