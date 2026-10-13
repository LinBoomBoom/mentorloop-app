// 换一种说法（服务端移植，与前端 engine/rephrase.uts 一致）
// 只读取 knowledgePoint / purpose，绝不引用 expectedEvidence / misconceptions（防泄题）；
// 不改变题目难度、知识点与提问目标。任何一侧修改都必须同步另一侧（rules-consistency 守卫）。
export type RephraseInput = {
  knowledgePoint: string
  purpose: string
}

export function rephraseQuestion(input: RephraseInput): string {
  const kp = input.knowledgePoint.trim()
  const purpose = input.purpose.trim()
  if (kp.length > 0 && purpose.length > 0) {
    return (
      '换个角度说：这道题想了解你在「' +
      kp +
      '」上的思路，' +
      purpose +
      '。可以结合项目经历，先给结论，再补充依据和结果。'
    )
  }
  if (kp.length > 0) {
    return '换个角度说：这道题聚焦「' + kp + '」，可以结合项目经历，说说你的做法、取舍和结果。'
  }
  return '换个角度说：可以先用一句话给出结论，再补充原因和具体例子。'
}
