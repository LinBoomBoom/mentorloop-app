// 题面生成（服务端镜像，与 engine/question-phrasing.uts 逻辑一致）
// 背景：云题 q 是知识点标题（「DNS 解析过程」）而非完整问句，出题前须包装为面试问句。
// 设计：默认确定性模板（离线、可测、零成本）；LLM 润色为可选增强（批次 A 未接，避免阻塞出题）。

export function phraseQuestion(rawTitle: string, qType: string): string {
  const t = rawTitle.trim()
  if (qType === 'special') {
    return '请结合具体案例，说明你在「' + t + '」上的设计与取舍。'
  }
  return '请说明「' + t + '」的原理，并结合你的项目经历谈谈实际处理方式。'
}
