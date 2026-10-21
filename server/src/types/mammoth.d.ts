// mammoth 无官方类型包（@types/mammoth 不在 registry），最小声明满足 extractRawText 用法
declare module 'mammoth' {
  export type MammothResult = { value: string; messages: unknown[] }
  export function extractRawText(input: { buffer: Buffer }): Promise<MammothResult>
  const mammoth: { extractRawText: typeof extractRawText }
  export default mammoth
}
