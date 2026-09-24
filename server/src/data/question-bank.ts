// Java 后端首批题目卡（文档 02 §2.3 题目组织规范）
// 来源说明：历史题库素材经人工审核、去重、重构后使用（文档 01 §2）；
// 每题含知识点、常见误区、期望证据与预设追问话术。变更须经内容运营审核（文档 05 §4）。

import { QuestionItem, PositionId } from '../types/interview.js'

export const QUESTION_BANK: QuestionItem[] = [
  // ---------- 基础知识 · 并发与JVM ----------
  {
    id: 'q-k01',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.concurrency-jvm',
    knowledgePoint: '内存溢出定位',
    content: '请描述一次你定位过的内存溢出或内存持续增长问题。',
    purpose: '验证项目深度与个人贡献',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['只会背 jmap 命令，说不出定位过程', '混淆内存泄漏与内存溢出'],
    expectedEvidence: '指标、假设、验证、结果',
    followupPrompts: ['当时的堆内存指标是多少？', '你做了哪些假设，如何验证的？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-k02',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.concurrency-jvm',
    knowledgePoint: '线程池参数',
    content: '你在项目中是如何确定线程池的核心参数的？',
    purpose: '评估参数决策是否有依据',
    difficulty: 'mid',
    type: 'scenario',
    misconceptions: ['直接套用网上公式', '不考虑任务类型（IO/CPU）'],
    expectedEvidence: '任务类型、压测数据、调整过程',
    followupPrompts: ['参数调整后观察了哪些指标？', '如果任务突增会发生什么？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-k03',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.concurrency-jvm',
    knowledgePoint: '锁与并发安全',
    content: '讲一个你解决过的并发安全问题，比如数据不一致或死锁。',
    purpose: '验证真实排障经历',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['只会说加锁，说不出锁粒度与代价'],
    expectedEvidence: '现象、根因、方案、回归验证',
    followupPrompts: ['你是怎么复现这个问题的？', '方案上线后如何确认修复？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 基础知识 · Java核心 ----------
  {
    id: 'q-k04',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.java-core',
    knowledgePoint: '集合选型',
    content: 'HashMap 和 ConcurrentHashMap 你在项目中分别用在什么场景？为什么？',
    purpose: '评估选型是否结合场景',
    difficulty: 'junior',
    type: 'concept',
    misconceptions: ['只背原理不讲场景', '认为 ConcurrentHashMap 永远更优'],
    expectedEvidence: '具体使用场景、并发需求、性能考量',
    followupPrompts: ['有没有遇到过因为集合选型导致的问题？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-k05',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.java-core',
    knowledgePoint: '异常与资源管理',
    content: '你们项目中是如何规范处理异常和关闭资源的？',
    purpose: '评估工程习惯',
    difficulty: 'junior',
    type: 'concept',
    misconceptions: ['到处 catch Exception 吞异常'],
    expectedEvidence: '统一异常处理、try-with-resources、日志规范',
    followupPrompts: ['举一个你们统一异常处理的实际例子。'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 基础知识 · 中间件 ----------
  {
    id: 'q-k06',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.middleware',
    knowledgePoint: '缓存策略',
    content: '你在项目里是怎么用 Redis 的？缓存的过期和更新策略是什么？',
    purpose: '评估缓存设计的完整性',
    difficulty: 'mid',
    type: 'scenario',
    misconceptions: ['只说用了缓存，说不出一致性问题', '不了解缓存穿透/击穿'],
    expectedEvidence: '缓存场景、过期策略、一致性处理',
    followupPrompts: ['缓存和数据库不一致时你们怎么处理？', '热点 key 失效瞬间会发生什么？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-k07',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.middleware',
    knowledgePoint: '消息队列',
    content: '讲一个你用消息队列解决实际问题的例子。',
    purpose: '验证中间件真实使用深度',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['只会说解耦，说不出具体收益', '忽略消息丢失与重复消费'],
    expectedEvidence: '业务场景、可靠性处理、量化收益',
    followupPrompts: ['消息重复消费你们怎么防？', '如果消息积压了怎么办？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-k08',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.middleware',
    knowledgePoint: '数据库索引',
    content: '你做过哪些 SQL 优化？怎么判断索引是否生效？',
    purpose: '评估数据库实践',
    difficulty: 'junior',
    type: 'scenario',
    misconceptions: ['只会加索引，不看执行计划'],
    expectedEvidence: 'explain 分析、优化前后对比',
    followupPrompts: ['优化前后的耗时对比是多少？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 工程能力 · 项目个人贡献 ----------
  {
    id: 'q-e01',
    abilityDomain: 'engineering',
    subAbility: 'engineering.project-contribution',
    knowledgePoint: '关键决策',
    content: '你在上一个项目里最关键的技术决策是什么？',
    purpose: '区分团队成果与个人决策',
    difficulty: 'junior',
    type: 'project',
    misconceptions: ['把团队成果说成个人成果', '说不出决策的代价'],
    expectedEvidence: '个人贡献、决策依据、结果',
    followupPrompts: ['这个决策是你提出的还是团队决定的？', '当时有没有其他备选方案？'],
    resumeRisk: true,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-e02',
    abilityDomain: 'engineering',
    subAbility: 'engineering.project-contribution',
    knowledgePoint: '量化成果',
    content: '你简历里提到的项目成果，具体是怎么度量的？',
    purpose: '验证简历量化指标的真实性',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['指标来源说不清', '把预估当实测'],
    expectedEvidence: '指标定义、采集方式、对比基线',
    followupPrompts: ['这个数据是从哪个监控或报表看到的？', '优化前的基线是多少？'],
    resumeRisk: true,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-e03',
    abilityDomain: 'engineering',
    subAbility: 'engineering.project-contribution',
    knowledgePoint: '个人职责边界',
    content: '在这个项目里，哪些模块是你独立负责的？',
    purpose: '明确个人贡献边界',
    difficulty: 'junior',
    type: 'project',
    misconceptions: ['职责描述模糊', '夸大负责范围'],
    expectedEvidence: '具体模块、交付内容、协作方式',
    followupPrompts: ['这个模块的代码评审是谁做的？', '遇到跨模块问题时你怎么推动？'],
    resumeRisk: true,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-e04',
    abilityDomain: 'engineering',
    subAbility: 'engineering.project-contribution',
    knowledgePoint: '难点攻克',
    content: '项目中你遇到过的最难的技术问题是什么？你是怎么解决的？',
    purpose: '验证问题解决深度',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['问题描述空泛', '解决过程缺少验证环节'],
    expectedEvidence: '问题定义、排查路径、最终验证',
    followupPrompts: ['排查过程中走过哪些弯路？', '如果重来一次你会怎么做？'],
    resumeRisk: true,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 工程能力 · 代码质量 ----------
  {
    id: 'q-e05',
    abilityDomain: 'engineering',
    subAbility: 'engineering.code-quality',
    knowledgePoint: '测试实践',
    content: '你们项目的单元测试是怎么落地的？你写过哪类测试？',
    purpose: '评估质量意识',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只说写了测试，说不出覆盖策略'],
    expectedEvidence: '测试类型、覆盖重点、实际案例',
    followupPrompts: ['哪部分逻辑你们认为最值得测？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-e06',
    abilityDomain: 'engineering',
    subAbility: 'engineering.code-quality',
    knowledgePoint: '评审与发布',
    content: '讲一次你在代码评审或发布流程中发现并阻止问题的经历。',
    purpose: '评估工程协作与风险意识',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['说不出具体案例'],
    expectedEvidence: '问题、发现方式、处理结果',
    followupPrompts: ['这个问题如果流到线上会怎样？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 系统设计 · 容量与权衡 ----------
  {
    id: 'q-a01',
    abilityDomain: 'analysis',
    subAbility: 'analysis.capacity-tradeoff',
    knowledgePoint: '容量估算',
    content: '设计一个短链服务，说明你的容量估算与主要权衡。',
    purpose: '评估约束澄清与方案取舍',
    difficulty: 'mid',
    type: 'design',
    misconceptions: ['不做容量估算直接画架构', '忽略读写比例'],
    expectedEvidence: '约束、估算过程、备选方案、取舍',
    followupPrompts: ['如果读流量是写的 100 倍，设计会有什么变化？', '发号器你会怎么选型？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-a02',
    abilityDomain: 'analysis',
    subAbility: 'analysis.capacity-tradeoff',
    knowledgePoint: '高可用设计',
    content: '如果让你给一个核心接口做高可用改造，你会从哪些方面入手？',
    purpose: '评估系统性思维',
    difficulty: 'mid',
    type: 'design',
    misconceptions: ['只堆技术名词，不分优先级'],
    expectedEvidence: '限流、降级、超时、监控的优先级与理由',
    followupPrompts: ['预算有限时你先做哪一项？为什么？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-a03',
    abilityDomain: 'analysis',
    subAbility: 'analysis.capacity-tradeoff',
    knowledgePoint: '存储选型',
    content: '订单数据量增长后，分库分表和换 NewSQL 你会怎么选？',
    purpose: '评估技术选型的权衡能力',
    difficulty: 'senior',
    type: 'design',
    misconceptions: ['不了解两种方案的运维成本差异'],
    expectedEvidence: '数据量、团队能力、迁移成本的权衡',
    followupPrompts: ['分库分表后跨库查询怎么办？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 系统设计 · 问题分析 ----------
  {
    id: 'q-a04',
    abilityDomain: 'analysis',
    subAbility: 'analysis.problem-analysis',
    knowledgePoint: '性能问题拆解',
    content: '线上接口 P99 突然升高，你会怎么一步步排查？',
    purpose: '评估排查路径的结构化程度',
    difficulty: 'mid',
    type: 'scenario',
    misconceptions: ['直接猜原因，没有排查顺序'],
    expectedEvidence: '从监控到代码的分层排查路径',
    followupPrompts: ['如果应用层指标正常，你下一步看什么？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-a05',
    abilityDomain: 'analysis',
    subAbility: 'analysis.problem-analysis',
    knowledgePoint: '故障复盘',
    content: '讲一次你参与处理的线上故障，从发现到恢复的过程。',
    purpose: '评估应急与复盘能力',
    difficulty: 'mid',
    type: 'project',
    misconceptions: ['只讲恢复不讲根因与改进'],
    expectedEvidence: '时间线、止血动作、根因、改进项',
    followupPrompts: ['复盘后落地了哪些改进？', '如何避免同类故障再次发生？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 沟通表达 · 结构化叙述 ----------
  {
    id: 'q-c01',
    abilityDomain: 'communication',
    subAbility: 'communication.star',
    knowledgePoint: 'STAR叙述',
    content: '用结构化方式讲一个你和同事意见不一致、最终解决冲突的例子。',
    purpose: '评估表达结构与结论先行',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['流水账叙述，没有结论'],
    expectedEvidence: '结论、证据、反思',
    followupPrompts: ['如果重来，你会在哪个环节做得不一样？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-c02',
    abilityDomain: 'communication',
    subAbility: 'communication.star',
    knowledgePoint: '技术讲解',
    content: '请用一分钟向一个不懂技术的同事解释你最近做的一个功能。',
    purpose: '评估表达清晰度与受众意识',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['堆砌技术术语'],
    expectedEvidence: '业务价值表述、类比能力',
    followupPrompts: ['对方最可能追问什么？你怎么回答？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 学习与复盘 ----------
  {
    id: 'q-l01',
    abilityDomain: 'learning',
    subAbility: 'learning.retrospective',
    knowledgePoint: '失败复盘',
    content: '讲一个你搞砸过或判断失误的技术决定，以及你从中学到了什么。',
    purpose: '评估复盘深度与诚实度',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['把失败包装成成功', '归因全部外部'],
    expectedEvidence: '失败案例、纠偏动作、成长路径',
    followupPrompts: ['这个教训后来在哪个场景帮到了你？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,
  {
    id: 'q-l02',
    abilityDomain: 'learning',
    subAbility: 'learning.retrospective',
    knowledgePoint: '学习方法',
    content: '你最近半年系统学习的一项新技术是什么？是怎么学的？',
    purpose: '评估学习能力与自驱力',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只列书单，没有实践'],
    expectedEvidence: '学习路径、实践产出',
    followupPrompts: ['学完后在项目中用上了吗？效果如何？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 职业动机 ----------
  {
    id: 'q-m01',
    abilityDomain: 'motivation',
    subAbility: 'motivation.goal-fit',
    knowledgePoint: '求职动机',
    content: '你为什么考虑在这个阶段换工作？你期望下一份工作给你什么？',
    purpose: '评估目标一致性与诚实边界',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只谈薪资', '与简历经历矛盾'],
    expectedEvidence: '目标与岗位的一致性',
    followupPrompts: ['你了解我们这个岗位的日常工作吗？'],
    resumeRisk: false,
    positionId: 'java-backend'
  } as QuestionItem,

  // ---------- 前端岗位题库（P0-2.3 题库与岗位补齐，岗位隔离展示） ----------

  // 前端 · 基础知识 · JS 运行时与浏览器
  {
    id: 'f-k01',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.js-runtime',
    knowledgePoint: '事件循环与异步',
    content: '请结合一个真实场景，说明 setTimeout、Promise 和浏览器渲染在你的项目里是如何配合的？',
    purpose: '验证对事件循环与渲染交互的理解',
    difficulty: 'junior',
    type: 'concept',
    misconceptions: ['只背宏任务/微任务顺序，说不清与渲染的关系'],
    expectedEvidence: '任务队列、渲染时机、实际场景',
    followupPrompts: ['如果这个任务改成 requestAnimationFrame 会有什么不同？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-k02',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.rendering',
    knowledgePoint: '关键渲染路径',
    content: '你优化过首屏加载吗？当时是依据哪些渲染链路和指标做的判断？',
    purpose: '验证性能指标与关键路径的理解',
    difficulty: 'mid',
    type: 'design',
    misconceptions: ['只列优化手段，说不出 FCP/LCP 等指标依据'],
    expectedEvidence: '指标定义、瓶颈定位、优化与回测',
    followupPrompts: ['优化前后 FCP 和 LCP 各是多少？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-k03',
    abilityDomain: 'knowledge',
    subAbility: 'knowledge.framework',
    knowledgePoint: '响应式原理',
    content: '你在项目里为什么选这个框架？它的响应式更新机制你知道多少？',
    purpose: '评估框架理解与选型理由',
    difficulty: 'mid',
    type: 'concept',
    misconceptions: ['只谈用了什么，说不清选型与机制代价'],
    expectedEvidence: '选型依据、机制说明、性能权衡',
    followupPrompts: ['如果列表渲染大量数据，你会做哪些优化？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,

  // 前端 · 工程能力
  {
    id: 'f-e01',
    abilityDomain: 'engineering',
    subAbility: 'engineering.build',
    knowledgePoint: '构建与拆包',
    content: '你们的构建产物是怎么优化的？拆包、缓存与按需加载分别怎么做的？',
    purpose: '验证工程化实践与量化结果',
    difficulty: 'mid',
    type: 'design',
    misconceptions: ['只说用了工具，说不出决策与收益'],
    expectedEvidence: '拆包策略、缓存方案、体积/加载指标',
    followupPrompts: ['优化后首包体积和加载耗时是多少？'],
    resumeRisk: true,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-e02',
    abilityDomain: 'engineering',
    subAbility: 'engineering.quality',
    knowledgePoint: '测试与评审',
    content: '你们前端的单元测试和代码评审是怎么落地的？你写过哪类测试？',
    purpose: '评估工程质量意识',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只说写了测试，说不出覆盖策略'],
    expectedEvidence: '测试类型、覆盖重点、实际案例',
    followupPrompts: ['哪类逻辑你们最优先覆盖测试？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,

  // 前端 · 系统设计
  {
    id: 'f-a01',
    abilityDomain: 'analysis',
    subAbility: 'analysis.frontend-arch',
    knowledgePoint: '前端架构与权衡',
    content: '如果一个 H5 页面需要兼顾首屏速度和 SEO，你会怎么设计渲染方案？',
    purpose: '评估约束澄清与方案取舍',
    difficulty: 'mid',
    type: 'design',
    misconceptions: ['直接给出 SSR，不做场景与成本权衡'],
    expectedEvidence: '约束、备选方案（直出/SSR/静态化）、取舍',
    followupPrompts: ['如果团队没有 Node 服务，方案会怎么变？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-a02',
    abilityDomain: 'analysis',
    subAbility: 'analysis.problem-analysis',
    knowledgePoint: '线上问题定位',
    content: '线上出现一个只有部分用户复现的白屏问题，你会怎么一步步定位？',
    purpose: '评估排查路径与假设验证',
    difficulty: 'mid',
    type: 'scenario',
    misconceptions: ['直接猜原因，没有排查顺序'],
    expectedEvidence: '采样、复现、假设、验证的分层路径',
    followupPrompts: ['如果只有特定机型出现，你会怎么缩小范围？'],
    resumeRisk: true,
    positionId: 'frontend'
  } as QuestionItem,

  // 前端 · 沟通表达
  {
    id: 'f-c01',
    abilityDomain: 'communication',
    subAbility: 'communication.star',
    knowledgePoint: '结构化解说',
    content: '用结构化方式讲一个你推动前端重构或技术改造落地的例子。',
    purpose: '评估结论先行与证据支撑',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['流水账描述，说不出收益与反思'],
    expectedEvidence: '背景、行动、结果、反思',
    followupPrompts: ['推进过程中遇到阻力了吗？怎么说服的？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-c02',
    abilityDomain: 'communication',
    subAbility: 'communication.star',
    knowledgePoint: '跨方协作',
    content: '讲一次你和后端或产品在需求/接口上意见不一致、最终解决分歧的经历。',
    purpose: '评估结构化表达与协作',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['归因对方，缺少自我反思'],
    expectedEvidence: '冲突点、沟通方式、结果与反思',
    followupPrompts: ['如果重来一次，哪个环节会做得不同？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,

  // 前端 · 学习与复盘
  {
    id: 'f-l01',
    abilityDomain: 'learning',
    subAbility: 'learning.retrospective',
    knowledgePoint: '失败复盘',
    content: '讲一次你在前端项目里判断失误或搞砸过的决定，以及你学到的东西。',
    purpose: '评估复盘深度与诚实度',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['把失败包装成成功，或全部外因'],
    expectedEvidence: '失败案例、纠偏动作、成长路径',
    followupPrompts: ['这个教训后来在哪个场景避免了重蹈覆辙？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-l02',
    abilityDomain: 'learning',
    subAbility: 'learning.retrospective',
    knowledgePoint: '技术学习路径',
    content: '你最近系统学习的一项前端技术或方向是什么？是怎么学并落地的？',
    purpose: '评估学习能力与自驱力',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只列资料，没有实践产出'],
    expectedEvidence: '学习路径、实践产出',
    followupPrompts: ['学完后在项目里用上了吗？效果如何？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,

  // 前端 · 职业动机
  {
    id: 'f-m01',
    abilityDomain: 'motivation',
    subAbility: 'motivation.goal-fit',
    knowledgePoint: '求职动机',
    content: '你为什么考虑在这个阶段换工作？期望下一份工作给你什么？',
    purpose: '评估目标一致性与诚实边界',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['只谈薪资，或与简历矛盾'],
    expectedEvidence: '目标与岗位的一致性',
    followupPrompts: ['你了解我们这个前端岗位的日常工作吗？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem,
  {
    id: 'f-m02',
    abilityDomain: 'motivation',
    subAbility: 'motivation.goal-fit',
    knowledgePoint: '技术方向规划',
    content: '你未来一年的技术成长方向是什么？为什么选这个方向？',
    purpose: '评估目标清晰度与行动力',
    difficulty: 'junior',
    type: 'behavioral',
    misconceptions: ['方向空泛，没有行动路径'],
    expectedEvidence: '方向、理由、计划与已有行动',
    followupPrompts: ['这个方向上你已经做了哪些投入？'],
    resumeRisk: false,
    positionId: 'frontend'
  } as QuestionItem
]

// 收束题：评估学习能力与复盘能力（文档 02 §3.2 规则4：保留至少一道开放题）
export const WRAPUP_QUESTION: QuestionItem = {
  id: 'q-wrapup',
  abilityDomain: 'learning',
  subAbility: 'learning.retrospective',
  knowledgePoint: '开放复盘',
  content: '最后一个问题：回顾这次面试，你觉得自己哪个回答还可以讲得更好？',
  purpose: '开放评估自我认知与复盘能力',
  difficulty: 'junior',
  type: 'behavioral',
  misconceptions: ['完全没有自我反思'],
  expectedEvidence: '自我评估的准确性',
  followupPrompts: [],
  resumeRisk: false,
  positionId: 'java-backend'
} as QuestionItem

// 前端岗位收束题（岗位化收束，避免跨岗位借用 Java 收束题）
export const FRONTEND_WRAPUP_QUESTION: QuestionItem = {
  id: 'q-wrapup-fe',
  abilityDomain: 'learning',
  subAbility: 'learning.retrospective',
  knowledgePoint: '开放复盘',
  content: '最后一个问题：回顾这次面试，你在哪个回答上还能讲得更完整？',
  purpose: '开放评估自我认知与复盘能力',
  difficulty: 'junior',
  type: 'behavioral',
  misconceptions: ['完全没有自我反思'],
  expectedEvidence: '自我评估的准确性',
  followupPrompts: [],
  resumeRisk: false,
  positionId: 'frontend'
} as QuestionItem

// 按岗位取收束题（选择器收束阶段使用；未覆盖岗位回退 Java 收束题）
export function getWrapupForPosition(positionId: PositionId): QuestionItem {
  if (positionId === 'frontend') return FRONTEND_WRAPUP_QUESTION
  return WRAPUP_QUESTION
}

export function getQuestionById(id: string): QuestionItem | null {
  for (let i = 0; i < QUESTION_BANK.length; i++) {
    if (QUESTION_BANK[i].id === id) return QUESTION_BANK[i]
  }
  return null
}
