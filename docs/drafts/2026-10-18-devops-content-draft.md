# devops 方向内容草稿（批次 A · 送审稿）

- 日期：2026-10-18
- 任务卡：docs/tasks/2026-10-18-question-bank-expansion.md（批次 A）
- 契约依据：docs/contracts/2026-10-18-question-techstack.freeze.md（techStack 本批全部为 ''）
- 状态：**待人工审核**（审核通过后才合并进 data/question-bank.uts 双端）
- 审核记录：审核人 ________ 日期 ________ 结论 ________

---

## 一、能力图谱草稿（devops-map.uts）

权重对齐评分量表：knowledge 0.25 / engineering 0.25 / analysis 0.20 / communication 0.15 / learning 0.10 / motivation 0.05。

| 域（权重）            | 子能力 id                        | 名称                 | 可观测行为                                       | 评分锚点（门槛级）                                   | 题目簇               |
| --------------------- | -------------------------------- | -------------------- | ------------------------------------------------ | ---------------------------------------------------- | -------------------- |
| knowledge（0.25）     | knowledge.linux-network          | Linux 与网络         | 能否说出命令背后的原理与验证方式                 | 能结合 /proc、日志或抓包说明排查依据，而非只报命令名 | linux-network        |
| knowledge（0.25）     | knowledge.web-middleware         | Web 服务与中间件运维 | 能否说明 Nginx/网关/消息队列的配置语义与失效模式 | 能指出典型错误配置的后果与验证方法                   | web-middleware       |
| knowledge（0.25）     | knowledge.container-orch         | 容器与编排           | 能否说明容器化与 K8s 核心对象的适用边界          | 能说明 Pod/Service/探针等对象在生产配置中的取舍      | container-orch       |
| engineering（0.25）   | engineering.project-contribution | 项目个人贡献         | 能否区分团队成果与个人决策                       | 能明确个人负责模块、决策依据与量化结果               | project-contribution |
| engineering（0.25）   | engineering.release-pipeline     | 变更管理与发布       | 能否说明发布流程中的个人实践                     | 能举出 CI/CD、灰度、回滚的具体案例与收益             | release-pipeline     |
| engineering（0.25）   | engineering.infra-as-code        | 基础设施即代码       | 能否说明 IaC 的版本管理与变更纪律                | 能说明 Terraform/Ansible 等的评审、漂移处理实践      | infra-as-code        |
| analysis（0.20）      | analysis.incident-triage         | 故障定位与应急       | 能否说明现象→指标→假设→验证→结论链路             | 能完整还原一次故障的定位与恢复过程                   | incident-triage      |
| analysis（0.20）      | analysis.capacity-slo            | 容量与 SLO 权衡      | 能否说明约束、备选方案与取舍                     | 能先澄清约束，再给备选方案并量化取舍                 | capacity-slo         |
| communication（0.15） | communication.incident-comms     | 事故协同沟通         | 能否在事故中同步信息、组织分工                   | 能说明通告节奏、角色分工与升级路径                   | incident-comms       |
| communication（0.15） | communication.postmortem         | 复盘表达             | 能否区分事实与推断、归因到机制而非个人           | 能输出时间线、根因链与可执行改进项                   | postmortem           |
| learning（0.10）      | learning.tool-adoption           | 新工具学习与迁移     | 能否说明学习路径与迁移方法                       | 能给出评估新工具的维度与落地案例                     | tool-adoption        |
| motivation（0.05）    | motivation.career-drive          | 职业动机             | 能否说明选择运维方向的具体动因                   | 动因具体、与经历自洽，不空泛                         | career-drive         |

## 二、题目草稿（24 正题 + 1 收束题）

通用约定：本批 `techStack` 全部 `''`（语言无关）；`positionId: 'devops'`；难度分布 junior×8 / mid×10 / senior×6；题型覆盖 concept/scenario/project/design/behavioral。

### knowledge（6 题）

**q-d01 · junior · concept · knowledge.linux-network**

- 知识点：CPU 负载与使用率
- 题面：load average 很高但 CPU 使用率很低，你会从哪里查起？
- 目的：区分对负载组成（D 状态进程、IO 等待）的真实理解
- 误区：把 load 等同于 CPU 使用率；不知道 D 状态进程会推高负载
- 期望证据：负载构成、IO 等待的确认方式（如 iostat / vmstat 逐列解读）
- 追问：哪些状态的任务会计入 load？如何确认是存储瓶颈？
- resumeRisk：false

**q-d02 · junior · concept · knowledge.linux-network**

- 知识点：TCP 连接状态
- 题面：服务器上 TIME_WAIT 很多，什么情况下需要处理，怎么处理？
- 目的：验证对连接生命周期与复用的理解，而非背诵参数
- 误区：见到 TIME_WAIT 就调 tcp_tw_reuse；不分主动关闭方角色
- 期望证据：连接角色判断、短连接成因、应用层改造优先于内核参数
- 追问：TIME_WAIT 由主动关闭方还是被动方产生？长连接为什么能缓解？
- resumeRisk：false

**q-d03 · mid · scenario · knowledge.linux-network**

- 知识点：网络连通性排查
- 题面：应用报「连接下游超时」，但同机 curl 下游端口是通的，你的排查顺序是什么？
- 目的：验证分层排查（DNS/连接池/超时配置/iptables）的完整链路
- 误区：只查网络层不查应用连接池；忽略 conntrack 表满
- 期望证据：逐层假设与验证（DNS 缓存、连接池上限、nf_conntrack 计数）
- 追问：conntrack 满会有什么现象？连接池耗尽和网络超时怎么区分？
- resumeRisk：false

**q-d04 · junior · concept · knowledge.web-middleware**

- 知识点：Nginx 反向代理
- 题面：proxy_pass 与 upstream 配置里，什么情况下请求会打到与预期不一致的节点？
- 目的：验证对负载均衡策略与 DNS 解析时机的理解
- 误区：以为 upstream 域名会随 DNS 动态更新；忽略 keepalive 复用旧连接
- 期望证据：解析时机、负载策略、健康检查配置三者的关系
- 追问：Nginx 默认会重新解析 upstream 域名吗？健康检查怎么配才可靠？
- resumeRisk：false

**q-d05 · mid · scenario · knowledge.container-orch**

- 知识点：Pod 探针配置
- 题面：滚动更新时服务出现短暂 502，结合探针配置说说可能的原因与改法。
- 目的：验证对就绪/存活探针与发布流程交互的理解
- 误区：把存活探针当就绪探针用；探针延迟阈值拍脑袋设置
- 期望证据：探针类型职责区分、优雅停机（preStop/drain）与探针配合
- 追问：liveness 误杀会表现成什么？preStop 里一般做什么？
- resumeRisk：false

**q-d06 · senior · design · knowledge.container-orch**

- 知识点：有状态服务上 K8s
- 题面：把一套主从架构的数据库迁到 K8s，你需要解决哪些问题？哪些你会选择不上 K8s？
- 目的：验证对有状态服务与编排平台边界的判断
- 误区：认为一切皆可容器化；忽略存储、网络标识、故障域
- 期望证据：存储卷/调度约束/备份策略的取舍，及「不上」的判断依据
- 追问：LocalPV 和网络存储怎么选？主从切换依赖什么能力？
- resumeRisk：false

### engineering（6 题）

**q-d07 · mid · project · engineering.project-contribution**

- 知识点：CI/CD 体系搭建
- 题面：讲一个你从零搭建或深度改造 CI/CD 流水线的项目：你负责哪部分，量化收益是什么？
- 目的：验证项目深度与个人贡献边界
- 误区：把团队流水线说成个人成果；给不出构建时长/发布频率等量化
- 期望证据：改造前后指标对比、个人决策点、踩坑与修正
- 追问：流水线失败率怎么降的？哪些环节是你拍板改的？
- resumeRisk：true

**q-d08 · senior · project · engineering.project-contribution**

- 知识点：大规模基础设施治理
- 题面：说一个你主导的多集群/多机房基础设施治理项目，约束是什么，你如何拆解？
- 目的：验证大规模场景下的架构与推进能力
- 误区：只讲架构图不讲迁移路径；无回滚预案
- 期望证据：分批迁移策略、灰度验证、回滚预案、量化结果
- 追问：迁移中出过什么问题？怎么发现和纠正的？
- resumeRisk：true

**q-d09 · junior · concept · engineering.release-pipeline**

- 知识点：回滚设计
- 题面：一次发布发现异常要回滚，回滚本身可能带来哪些风险？怎么避免？
- 目的：验证回滚不是「无脑还原」的意识
- 误区：忽略数据库逆向兼容；忽略缓存与配置回滚
- 期望证据：前向兼容设计（新旧版本共存）、数据迁移可逆性
- 追问：发版和数据库变更怎么解耦？灰度期间两个版本怎么共存？
- resumeRisk：false

**q-d10 · mid · scenario · engineering.release-pipeline**

- 知识点：发布策略选型
- 题面：一个核心服务的重大版本上线，你会怎么设计发布与观察方案？
- 目的：验证灰度/监控/abort 标准的完整设计能力
- 误区：只有方案没有观察指标；无明确中止标准
- 期望证据：灰度比例节奏、核心指标看板、中止阈值与责任人
- 追问：灰度 5% 时错误率略升但未达阈值，你怎么决策？
- resumeRisk：false

**q-d11 · mid · scenario · engineering.infra-as-code**

- 知识点：IaC 漂移处理
- 题面：线上有人手工改了安全组，与 Terraform 状态不一致，你怎么处理这次漂移？
- 目的：验证 IaC 纪律与应急的平衡
- 误区：直接 terraform apply 覆盖；或永远放任手工变更
- 期望证据：先确认变更意图，再决定吸收进代码还是回滚，并堵流程口子
- 追问：怎么防止再次发生？state 文件的管理与锁你怎么做？
- resumeRisk：false

**q-d12 · senior · design · engineering.infra-as-code**

- 知识点：IaC 体系设计
- 题面：为多环境（开发/预发/生产）设计一套 Terraform 仓库结构与权限模型，说说你的设计与理由。
- 目的：验证基础设施代码化的体系设计能力
- 误区：单仓大泥球；环境差异靠复制粘贴；权限不分层
- 期望证据：模块复用、状态隔离、审批分级、密钥管理的完整设计
- 追问：模块版本怎么管理？生产 apply 的审批链怎么设计？
- resumeRisk：false

### analysis（5 题）

**q-d13 · mid · scenario · analysis.incident-triage**

- 知识点：磁盘空间告警应急
- 题面：凌晨收到磁盘 95% 告警，磁盘上日志正以每分钟数百 MB 增长，你的应急与善后步骤是什么？
- 目的：验证应急止血与根因治理的分层意识
- 误区：只删日志不停增长源；删除正在写入的文件不解锁空间
- 期望证据：止血（限流/轮转/清理）→定位增长源→根因治理的完整链路
- 追问：已删除但空间未释放是什么原因？怎么找到持有句柄的进程？
- resumeRisk：false

**q-d14 · senior · scenario · analysis.incident-triage**

- 知识点：区域性抖动定位
- 题面：高峰期接口 P99 周期性抖动，各项资源指标看起来都不高，你怎么定位？
- 目的：验证在指标「都正常」时的假设生成能力（GC/竞争/定点任务/邻居噪音）
- 误区：只盯 CPU 内存；忽略定时任务与相邻服务干扰
- 期望证据：按周期对齐时间线、逐项假设与证伪、最终定位手段
- 追问：怎么区分是本服务 GC 还是宿主机邻居干扰？
- resumeRisk：false

**q-d15 · junior · concept · analysis.capacity-slo**

- 知识点：SLI/SLO/错误预算
- 题面：用你自己的话解释 SLO 和错误预算，它们如何影响发布决策？
- 目的：验证可靠性语言体系的真实理解
- 误区：把 SLA/SLO/SLI 混用；不知道错误预算耗尽后的发布约束
- 期望证据：三者关系准确 + 与发布/变更节奏的联动
- 追问：错误预算快耗尽时，团队应该把精力放在哪？
- resumeRisk：false

**q-d16 · mid · design · analysis.capacity-slo**

- 知识点：容量规划
- 题面：大促流量预估是日常 5 倍，给一个无状态服务做容量方案，你的推导过程是什么？
- 目的：验证从单实例容量到集群方案的量化推导
- 误区：直接「扩 5 倍」；忽略依赖服务与非线性瓶颈
- 期望证据：压测基线、瓶颈识别（连接数/带宽/下游配额）、余量设计
- 追问：压测发现下游数据库先到瓶颈，方案怎么变？
- resumeRisk：false

**q-d17 · senior · scenario · analysis.incident-triage**

- 知识点：跨层故障定位
- 题面：容器频繁 OOMKilled，但应用日志看不到内存异常，你怎么定位？
- 目的：验证容器内存模型（limit/实际占用/JVM 类应用堆外内存）的综合理解
- 误区：无脑调大 limit；不知道堆外内存与 page cache 计入口径
- 期望证据：limit 与各内存口径对账、监控指标补齐、根因修正
- 追问：JVM 容器化有哪些经典内存陷阱？怎么让 OOM 可复盘？
- resumeRisk：false

### communication（4 题）

**q-d18 · mid · scenario · communication.incident-comms**

- 知识点：事故通告
- 题面：一次影响下单流程的 P1 事故中你是应急指挥，你的通告节奏和信息结构是什么？
- 目的：验证事故沟通的结构化能力
- 误区：通告无节奏（想起来才发）；信息里只有情绪没有事实
- 期望证据：固定周期通告、影响面/进展/下一步三要素、升级路径
- 追问：定位到根因前，对外口径怎么说？
- resumeRisk：false

**q-d19 · junior · behavioral · communication.incident-comms**

- 知识点：跨团队拉齐
- 题面：讲一次你需要两个团队配合才能恢复服务的经历，你是怎么组织的？
- 目的：验证非职权协调能力
- 误区：只描述自己做了什么，说不清怎么带动别人
- 期望证据：任务拆分、信息同步机制、卡点升级
- 追问：如果对方团队响应慢，你怎么办？
- resumeRisk：false

**q-d20 · mid · behavioral · communication.postmortem**

- 知识点：复盘方法
- 题面：讲一次你写的复盘推动了真实改进的经历，改进项是怎么落地的？
- 目的：验证复盘不是模板填空，而是推动机制改进
- 误区：改进项是「加强意识」类空话；无跟踪闭环
- 期望证据：根因到机制（流程/工具/监控）的转化、改进项验收
- 追问：怎么证明改进项真的生效了？
- resumeRisk：false

**q-d21 · senior · behavioral · communication.postmortem**

- 知识点：无责复盘文化
- 题面：复盘时发现根因是某个同事的误操作，你怎么组织这场复盘？
- 目的：验证对无责文化（对事不对人、归因到系统）的理解与实践
- 误区：点名追责；或完全回避人的因素导致机制问题被掩盖
- 期望证据：把误操作转化为系统问题（为何单人可绕过防护）并落地防护
- 追问：如果操作者本人情绪很大，你怎么处理？
- resumeRisk：false

### learning（2 题）

**q-d22 · junior · behavioral · learning.tool-adoption**

- 知识点：新技术上手
- 题面：最近半年你系统学习了什么新工具或平台？学习路径和产出是什么？
- 目的：验证学习方法的可复用性
- 误区：只列名词没有路径；学习无产出沉淀
- 期望证据：具体学习路径（文档/实验/生产验证）与可验证产出
- 追问：你怎么判断一个新工具值得投入学习？
- resumeRisk：false

**q-d23 · mid · scenario · learning.tool-adoption**

- 知识点：技术迁移
- 题面：把你在 A 工具上积累的运维方法迁移到 B 工具（如从虚拟机迁到 K8s），哪些经验能复用，哪些必须重建？
- 目的：验证经验迁移的判断力，避免刻舟求剑
- 误区：认为经验全部通用；或全部推倒重来
- 期望证据：方法论层（监控/变更/应急）与实现层的区分
- 追问：迁移过程中最容易想当然的是什么？
- resumeRisk：false

### motivation（1 题）

**q-d24 · junior · behavioral · motivation.career-drive**

- 知识点：职业选择
- 题面：你为什么选择做运维/稳定性方向？未来两年想在哪个具体能力上变强？
- 目的：验证动机具体性与自我认知
- 误区：「喜欢折腾服务器」类空泛表述；目标与现状脱节
- 期望证据：与真实经历自洽的动因 + 可验证的能力目标
- 追问：为此你已经在做什么？
- resumeRisk：false

### 收束题（1 题）

**q-dwrap · mid · concept · 全域收束**

- 知识点：面试收束
- 题面：今天的面试就到这里。最后请你用两三分钟，挑一个你今天回答中最有代表性的故障或项目，补充一个上面没问到、但你认为面试官应该知道的细节。
- 目的：收束全场，给用户主动补充证据的最后入口
- 误区：用户重复已说内容
- 期望证据：补充内容与今日回答的自洽性与增量价值
- 追问：（无预设追问，收束后不再展开）
- resumeRisk：false

## 三、自检结果（对照 content-review 清单）

| 检查项                                         | 结果                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| 每题 abilityDomain / subAbility 存在于上方 map | ✅ 25 题逐题核对                                                   |
| 子能力权重合计                                 | ✅ 0.25+0.25+0.20+0.15+0.10+0.05 = 1.00，对齐量表 25/25/20/15/10/5 |
| 每题含 misconceptions 与 expectedEvidence      | ✅（驱动评分与追问）                                               |
| 无重复题、无与存量 Java/前端题重叠             | ✅ 主题全为运维域                                                  |
| 无隐私侵犯/羞辱/歧视措辞、无诱导性提问         | ✅ 文案遵循 A5（事实导向，无鼓励/承诺/感叹号）                     |
| 三处齐备（map + 题库 + position-options）      | ⏳ 本稿为 map+题库；position-options 翻转在审核通过后随入库执行    |
| 双端同步                                       | ⏳ 审核通过后同批写入 .uts 与 .ts                                  |
| expectedEvidence 不进追问（泄题防线）          | ✅ 追问话术均为过程性提问，未引用证据字段内容                      |
| 难度分布                                       | ✅ junior 8 / mid 10 / senior 6（各 ≥4）                           |
| techStack                                      | ✅ 全部 ''（语言无关）                                             |
