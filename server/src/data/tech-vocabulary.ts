// 技术标签 → 词表 id 对照（服务端镜像）
// 源：桌面端 app/data/techVocabulary.ts（只读复用，避免自造第二套分类）。
// 用途：内容库适配层把中文展示名 tech（如「Kubernetes」）归一到小写 token（如 'k8s'）。
// 词表 id 是 QuestionItem.techStack 的取值域（见 docs/contracts/2026-10-18-question-techstack.freeze.md 附录）。
// 同名不同模块（如「网络」在前端/后端/运维）按 module 分开存。

export const TECH_ID_BY_MODULE: Record<string, Record<string, string>> = {
  frontend: {
    'Web 基础': 'web',
    CSS: 'css',
    JavaScript: 'javascript',
    TypeScript: 'typescript',
    React: 'react',
    Vue: 'vue',
    工程化: 'engineering',
    性能优化: 'performance',
    安全: 'security',
    网络: 'network',
    Flutter: 'flutter',
    'React Native': 'rn',
    iOS: 'ios',
    Android: 'android',
    Electron: 'electron',
    Tauri: 'tauri',
    'uni-app': 'uniapp',
    HarmonyOS: 'harmony',
    小程序: 'miniprogram',
    'Node.js': 'node',
    ECharts: 'echarts',
    D3: 'd3',
    WebGL: 'webgl',
    Canvas: 'canvas',
    可视化基础: 'vizbase',
    综合应用: 'general',
    架构设计: 'arch',
    测试: 'testing'
  },
  backend: {
    Java: 'java',
    Go: 'go',
    Python: 'python',
    Gin: 'gin',
    FastAPI: 'fastapi',
    系统设计: 'system',
    微服务: 'micro',
    消息队列: 'mq',
    MySQL: 'mysql',
    PostgreSQL: 'postgresql',
    Redis: 'redis',
    NoSQL: 'nosql',
    网络: 'network',
    Spark: 'spark',
    Hive: 'hive',
    Kafka: 'kafka',
    Flink: 'flink',
    数仓建模: 'dw',
    调度与集成: 'sched',
    Elasticsearch: 'es',
    数据库原理: 'dbtheory',
    综合应用: 'general',
    自动化测试: 'autotest',
    测试理论: 'testtheory',
    性能压测: 'perftest'
  },
  devops: {
    Linux: 'linux',
    网络: 'network',
    SRE: 'sre',
    '容器/Docker': 'docker',
    'CI/CD': 'cicd',
    Kubernetes: 'k8s',
    云平台: 'cloud',
    云计算: 'compute',
    云存储: 'storage',
    云治理: 'govern',
    安全: 'security',
    综合应用: 'general',
    数据库: 'db',
    缓存: 'cache',
    监控与可观测: 'observability',
    基础设施即代码: 'iac'
  },
  ai: {
    'Prompt 工程': 'prompt',
    RAG: 'rag',
    Agent: 'agent',
    模型与训练: 'train',
    推理与部署: 'infra',
    评估与观测: 'eval',
    数据与标注: 'data',
    '端侧 AI': 'edge',
    CV: 'cv',
    NLP: 'nlp',
    推荐系统: 'rec',
    推理引擎: 'engine',
    服务化架构: 'serving',
    模型压缩: 'compress',
    综合应用: 'general'
  }
}

// 中文展示名 → 词表 id；无对照返回 ''（通用题），并在调用方留痕
export function techIdFor(module: string, name: string): string {
  if (name.length === 0) return ''
  const bucket = TECH_ID_BY_MODULE[module]
  if (bucket == null) return ''
  const id = bucket[name]
  return id != null ? id : ''
}
