type ApiPayload<T> = {
  data: T
  meta?: unknown
  pagination?: unknown
  stats?: unknown
}

export function unwrapApiData<T>(envelope: ApiPayload<T>): T {
  const { data, meta, pagination, stats } = envelope
  if (!Array.isArray(data) || [meta, pagination, stats].every((value) => value === undefined)) return data

  return {
    data,
    ...(meta !== undefined ? { meta } : {}),
    ...(pagination !== undefined ? { pagination } : {}),
    ...(stats !== undefined ? { stats } : {}),
  } as T
}
