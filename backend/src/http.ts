import { ApiError } from './errors.js'

export function integerParam(value: unknown, name: string, options: { min?: number; max?: number } = {}): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  const min = options.min ?? Number.MIN_SAFE_INTEGER
  const max = options.max ?? Number.MAX_SAFE_INTEGER
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, 'invalid_parameter', `Tham số ${name} không hợp lệ`)
  }
  return parsed
}

export function textParam(value: unknown, name: string, maxLength = 200): string | undefined {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ApiError(400, 'invalid_parameter', `Tham số ${name} không hợp lệ`)
  }
  return value.trim() || undefined
}

export function cursorMeta<T extends { id: string }>(rows: T[], limit: number) {
  const hasNext = rows.length > limit
  const data = hasNext ? rows.slice(0, limit) : rows
  return {
    data,
    meta: {
      limit,
      hasNext,
      nextCursor: hasNext ? data.at(-1)?.id ?? null : null,
    },
  }
}

export function dateParam(value: unknown, name: string): string | undefined {
  const text = textParam(value, name, 64)
  if (!text) return undefined
  if (Number.isNaN(Date.parse(text))) {
    throw new ApiError(400, 'invalid_parameter', `Tham số ${name} không phải ngày hợp lệ`)
  }
  return text
}
