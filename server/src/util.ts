// 通用工具：统一响应构造 / 标识生成
import { randomUUID } from 'node:crypto'

export type ApiResponse<T> = { code: number; data: T | null; message: string }

export function okData<T>(data: T): ApiResponse<T> {
  return { code: 0, data, message: '' }
}

export function ok(): ApiResponse<null> {
  return { code: 0, data: null, message: '' }
}

export function fail(code: number, message: string): ApiResponse<null> {
  return { code, data: null, message }
}

export function newId(prefix: string): string {
  return prefix + '_' + randomUUID().replaceAll('-', '').substring(0, 12)
}

export function now(): number {
  return Date.now()
}
