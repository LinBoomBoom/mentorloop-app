// 内容库适配层单测（批次 A）：字段映射逐列 / 分类器 / 题面生成 / fixture 驱动四方向出题
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getDb, closeDb, Db } from './db.js'
import {
  mapRawQuestion,
  toQuestionItem,
  questionParams,
  QUESTION_UPSERT_SQL,
  purposeOf,
  EVIDENCE_MAX,
  type RawQuestion
} from './services/content-mapper.js'
import { techIdFor } from './data/tech-vocabulary.js'
import { classifyDimension } from './rules/dimension-classifier.js'
import { phraseQuestion, isQuestionShaped } from './rules/question-phrasing.js'
import { loadCandidates, findQuestionById } from './services/content-bank.js'
import { buildBatchUpsertSql, runContentSync } from './scripts/sync-content-questions.js'
import { selectNext, type SelectorInput } from './rules/question-selector.js'
import type { PositionBlueprint, QuestionItem, PositionId } from './types/interview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'data', 'content-fixture.json')

const SAMPLES: RawQuestion[] = [
  {
    id: 'fq39',
    track: 'frontend',
    type: 'hot',
    q: 'CSS 优先级与层叠规则',
    a: '参考答案全文……',
    keywords: '["优先级","specificity","层叠","!important"]',
    weight: 3,
    difficulty: 'easy',
    tech: 'CSS',
    subtrack: 'fe-web',
    skill: null,
    license: 'cc-by-sa'
  },
  {
    id: 'bq7',
    track: 'backend',
    type: 'special',
    q: '分库分表后的跨库查询',
    a: '答案',
    keywords: '["分片","跨库","聚合"]',
    weight: 5,
    difficulty: 'hard',
    tech: 'MySQL',
    subtrack: 'be-db',
    skill: '分库分表方案',
    license: 'unknown'
  }
]

describe('tech 词表归一（techIdFor）', () => {
  it('中文展示名 → 词表 id（按模块）', () => {
    expect(techIdFor('devops', 'Kubernetes')).toBe('k8s')
    expect(techIdFor('backend', 'Java')).toBe('java')
    expect(techIdFor('backend', 'Go')).toBe('go')
    expect(techIdFor('frontend', '网络')).toBe('network')
    expect(techIdFor('ai', 'RAG')).toBe('rag')
    expect(techIdFor('frontend', '综合应用')).toBe('general')
  })

  it('无对照 / 空值 → 空串（通用题）', () => {
    expect(techIdFor('backend', '')).toBe('')
    expect(techIdFor('backend', '不存在的技术')).toBe('')
    expect(techIdFor('unknown-module', 'Java')).toBe('')
  })
})

describe('六维分类器与题面生成', () => {
  it('关键词命中取胜：设计/权衡类 → analysis', () => {
    expect(
      classifyDimension({
        keywords: ['限流', '降级', '容量'],
        subtrack: 'be-web',
        tech: '系统设计',
        qType: 'hot'
      })
    ).toBe('analysis')
  })

  it('基础机制类 → knowledge', () => {
    expect(
      classifyDimension({
        keywords: ['优先级', '层叠'],
        subtrack: 'fe-web',
        tech: 'CSS',
        qType: 'hot'
      })
    ).toBe('knowledge')
  })

  it('subtrack 兜底：无关键词命中时按赛道归属（op-* → engineering）', () => {
    expect(
      classifyDimension({ keywords: ['zzz'], subtrack: 'op-k8s', tech: '', qType: 'hot' })
    ).toBe('engineering')
  })

  it('special 无命中 → analysis；其余无命中 → knowledge', () => {
    expect(
      classifyDimension({ keywords: ['zzz'], subtrack: 'fe-web', tech: '', qType: 'special' })
    ).toBe('analysis')
    expect(
      classifyDimension({ keywords: ['zzz'], subtrack: 'fe-web', tech: '', qType: 'hot' })
    ).toBe('knowledge')
  })

  it('题面生成：hot/special 模板确定', () => {
    expect(phraseQuestion('DNS 解析过程', 'hot')).toBe(
      '请说明「DNS 解析过程」的原理，并结合你的项目经历谈谈实际处理方式。'
    )
    expect(phraseQuestion('分库分表后的跨库查询', 'special')).toBe(
      '请结合具体案例，说明你在「分库分表后的跨库查询」上的设计与取舍。'
    )
  })

  it('问句型 q 直通不二次包装（ISS-20261019-01 锁定）', () => {
    const raw =
      '错误消息会跨进程透传给调用方，为什么必须脱敏？请举例说明哪些内容绝对不能放进 error message，并给出正确的写法。'
    expect(isQuestionShaped(raw)).toBe(true)
    expect(phraseQuestion(raw, 'hot')).toBe(raw)
    expect(phraseQuestion(raw, 'special')).toBe(raw)
    // 知识点标题不被误判，仍走模板
    expect(isQuestionShaped('DNS 解析过程')).toBe(false)
    expect(isQuestionShaped('K8s 中 Pod 的探针')).toBe(false)
    expect(isQuestionShaped('CSS 优先级与层叠规则')).toBe(false)
    // 空输入不再产出「请说明「」…」空引号模板
    expect(phraseQuestion('   ', 'hot')).toBe('')
  })
})

describe('字段映射（mapRawQuestion → QuestionRow）', () => {
  it('逐列映射：track/difficulty/tech/keywords/knowledgePoint/evidence/q_type/license', () => {
    const row = mapRawQuestion(SAMPLES[0], 1234)
    expect(row).not.toBeNull()
    expect(row!.id).toBe('fq39')
    expect(row!.position_id).toBe('frontend')
    expect(row!.track).toBe('frontend')
    expect(row!.subtrack).toBe('fe-web')
    expect(row!.difficulty).toBe('junior') // easy → junior
    expect(row!.ability_domain).toBe('knowledge')
    expect(row!.content_raw).toBe('CSS 优先级与层叠规则')
    expect(row!.content).toBe(phraseQuestion('CSS 优先级与层叠规则', 'hot'))
    expect(row!.tech_token).toBe('css')
    expect(row!.knowledge_point).toBe('优先级') // skill 空 → keywords[0]
    expect(row!.keywords).toBe('优先级,specificity,层叠,!important')
    expect(row!.q_type).toBe('hot')
    expect(row!.license).toBe('cc-by-sa')
    expect(row!.weight).toBe(3)
    expect(row!.synced_at).toBe(1234)
  })

  it('skill 优先于 keywords 作 knowledgePoint；hard → senior', () => {
    const row = mapRawQuestion(SAMPLES[1], 1)
    expect(row!.knowledge_point).toBe('分库分表方案')
    expect(row!.difficulty).toBe('senior')
    expect(row!.ability_domain).toBe('analysis') // special + 分片关键词
    expect(row!.tech_token).toBe('mysql')
  })

  it('不可用行被跳过：track/difficulty 越界、题面为空', () => {
    expect(mapRawQuestion({ ...SAMPLES[0], track: 'pm' }, 1)).toBeNull()
    expect(mapRawQuestion({ ...SAMPLES[0], difficulty: 'normal' }, 1)).toBeNull()
    expect(mapRawQuestion({ ...SAMPLES[0], q: '   ' }, 1)).toBeNull()
  })

  it('keywords 非 JSON 时按逗号切分兜底', () => {
    const row = mapRawQuestion({ ...SAMPLES[0], keywords: 'a,b,c' }, 1)
    expect(row!.knowledge_point).toBe('a')
    expect(row!.keywords).toBe('a,b,c')
  })

  it('期望证据超阈值截断', () => {
    const long = 'x'.repeat(EVIDENCE_MAX + 100)
    const row = mapRawQuestion({ ...SAMPLES[0], a: long }, 1)
    expect(row!.evidence.length).toBe(EVIDENCE_MAX + 1)
    expect(row!.evidence.endsWith('…')).toBe(true)
  })

  it('确定性：同输入同输出', () => {
    expect(mapRawQuestion(SAMPLES[0], 7)).toEqual(mapRawQuestion(SAMPLES[0], 7))
  })
})

describe('QuestionItem 派生（toQuestionItem）', () => {
  it('type 映射 hot→scenario / special→design；缺口字段留空；resumeRisk=false', () => {
    const hot = toQuestionItem(mapRawQuestion(SAMPLES[0], 1)!)
    expect(hot.type).toBe('scenario')
    expect(hot.positionId).toBe('frontend')
    expect(hot.abilityDomain).toBe('knowledge')
    expect(hot.subAbility).toBe('fe-web')
    expect(hot.knowledgePoint).toBe('优先级')
    expect(hot.techStack).toBe('css')
    expect(hot.misconceptions).toEqual([])
    expect(hot.followupPrompts).toEqual([])
    expect(hot.resumeRisk).toBe(false)

    const special = toQuestionItem(mapRawQuestion(SAMPLES[1], 1)!)
    expect(special.type).toBe('design')
  })

  it('purpose 由六维 + 知识点确定性派生', () => {
    const row = mapRawQuestion(SAMPLES[1], 1)!
    expect(purposeOf(row)).toBe('考察系统设计：分库分表方案')
    expect(toQuestionItem(row).purpose).toBe('考察系统设计：分库分表方案')
  })
})

describe('fixture 驱动：四方向出题链路', () => {
  let db: Db
  let sampleId = ''
  const POSITIONS: PositionId[] = ['frontend', 'backend', 'devops', 'ai']

  beforeAll(() => {
    db = getDb(':memory:')
  })

  afterAll(() => {
    closeDb()
  })

  it('fixture 全量可映射并入库', async () => {
    const raws = JSON.parse(readFileSync(FIXTURE, 'utf8')) as RawQuestion[]
    expect(raws.length).toBe(600)
    const stmt = db.prepare(QUESTION_UPSERT_SQL)
    const syncedAt = Date.now()
    let n = 0
    for (const raw of raws) {
      const row = mapRawQuestion(raw, syncedAt)
      expect(row).not.toBeNull() // fixture 全部为可用抽样
      await stmt.run(...questionParams(row!))
      n++
    }
    expect(n).toBe(600)
    const one = (await db.prepare('SELECT id FROM questions LIMIT 1').get()) as { id: string }
    sampleId = one.id
    expect(sampleId.length).toBeGreaterThan(0)
  })

  it('每方向候选池非空且同方向过滤正确', async () => {
    for (const pos of POSITIONS) {
      const c = await loadCandidates(db, pos)
      expect(c.length).toBeGreaterThan(0)
      for (const q of c) expect(q.positionId).toBe(pos)
    }
  })

  it('四方向各出满一场（7 题）：不重复、岗位正确、能力域多域覆盖', async () => {
    for (const pos of POSITIONS) {
      const candidates = await loadCandidates(db, pos)
      const blueprint = {
        positionId: pos,
        position: pos,
        experienceLevel: 'junior',
        experienceRange: '1-3年',
        companyType: '互联网',
        language: '中文',
        target: '求职'
      } as PositionBlueprint
      const asked: QuestionItem[] = []
      const ids = new Set<string>()
      const domains = new Set<string>()
      for (let i = 0; i < 7; i++) {
        const input = {
          blueprint,
          mode: 'standard',
          asked,
          remainSeconds: 1200,
          resumeRiskTopics: [],
          resumeTechStacks: [],
          focusDomain: '',
          maxQuestions: 0,
          candidates
        } as SelectorInput
        const out = selectNext(input)
        expect(out).not.toBeNull()
        expect(out!.isWrapup).toBe(false)
        expect(out!.question.positionId).toBe(pos)
        expect(ids.has(out!.question.id)).toBe(false)
        ids.add(out!.question.id)
        domains.add(out!.question.abilityDomain)
        asked.push(out!.question)
      }
      expect(ids.size).toBe(7)
      expect(domains.size).toBeGreaterThan(1)

      // 第 8 次：达题量上限 → 岗位专属收束题
      const wrap = selectNext({
        blueprint,
        mode: 'standard',
        asked,
        remainSeconds: 1200,
        resumeRiskTopics: [],
        resumeTechStacks: [],
        focusDomain: '',
        maxQuestions: 0,
        candidates
      } as SelectorInput)
      expect(wrap).not.toBeNull()
      expect(wrap!.isWrapup).toBe(true)
      expect(wrap!.question.positionId).toBe(pos)
      // 2026-10-22：AI 方向开放，补齐岗位专属收束题 q-wrapup-ai
      if (pos === 'ai') expect(wrap!.question.id).toBe('q-wrapup-ai')
    }
  })

  it('单题回查：库中题返回完整 QuestionItem，未入库 id 返回 null', async () => {
    const hit = await findQuestionById(db, sampleId)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(sampleId)
    expect(hit!.content.length).toBeGreaterThan(0)
    expect(await findQuestionById(db, 'not-in-library')).toBeNull()
  })
})

describe('同步脚本构建（buildBatchUpsertSql）', () => {
  it('单行：16 个占位符，且方言已翻成 MySQL（无 excluded. 残留）', () => {
    const one = buildBatchUpsertSql(1)
    expect((one.match(/\?/g) ?? []).length).toBe(16)
    expect(one.includes('ON DUPLICATE KEY UPDATE')).toBe(true)
    expect(one.indexOf('excluded.')).toBe(-1)
    expect(one.includes('VALUES(position_id)')).toBe(true)
    // id 为主键，不进 SET 子句
    expect(one.includes('id=VALUES(id)')).toBe(false)
  })

  it('批量 100 行：1600 个占位符', () => {
    const many = buildBatchUpsertSql(100)
    expect((many.match(/\?/g) ?? []).length).toBe(1600)
    expect(many.includes('ON DUPLICATE KEY UPDATE')).toBe(true)
  })

  it('列序与 questionParams 输出长度一致（16）', () => {
    const row = mapRawQuestion(SAMPLES[0], 1)!
    expect(questionParams(row).length).toBe(16)
  })
})

describe('同步脚本入参校验（不发起网络连接）', () => {
  it('缺少 MYSQL_HOST 时明确报错', async () => {
    const saved = process.env.MYSQL_HOST
    delete process.env.MYSQL_HOST
    try {
      await expect(runContentSync()).rejects.toThrow(/MYSQL_HOST/)
    } finally {
      if (saved != null) process.env.MYSQL_HOST = saved
    }
  })
})
