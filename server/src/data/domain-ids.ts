// 能力域 id 集合（服务端选题器覆盖率判断使用）
// 与前端 data/java-backend-map.uts 的 getDomainIds 等价：六域对任意岗位通用。
// 各岗位的能力图谱/子能力为内容资产，见前端 data/java-backend-map.uts / data/frontend-map.uts。

export function getDomainIds(): string[] {
  return ['knowledge', 'engineering', 'analysis', 'communication', 'learning', 'motivation']
}
