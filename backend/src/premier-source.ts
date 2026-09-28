import fs from 'node:fs'

export type PremierMetricStatus = 'NORMAL' | 'EXCEEDED' | 'NO_LIMIT' | 'MISSING'

export type PremierMetric = {
  code: string
  displayName: string
  unit: string | null
  value: number | null
  limitText: string | null
  status: PremierMetricStatus
}

export type PremierStation = {
  code: string
  name: string
}

export type PremierSnapshot = {
  stationCode: string
  stationName: string
  observedOn: string
  measuredAt: string
  readingMode: 'CURRENT' | 'LATEST_30D'
  metrics: PremierMetric[]
}

export type PremierPublicData = {
  source: {
    name: string
    url: string
    fetchedAt: string
    currentMeasuredAt: string | null
    availableFrom: string | null
    availableTo: string | null
  }
  stations: PremierStation[]
  parameters: Array<{ code: string; displayName: string; unit: string | null }>
  current: PremierSnapshot[]
  history: PremierSnapshot[]
}

type MetricDefinition = {
  code: string
  sourceKey: string
  displayName: string
  unit: string | null
  limitKey: string
}

type PremierStationRef = PremierStation & { sourceId: string }

type PremierLimitRecord = {
  StationId?: string
  ShowLimitValue?: string
  TypeNameOrder?: { TypeName?: string }
}

type PremierCurrentResponse = {
  timeStr?: string
  dataItems?: Array<{
    sensorData?: {
      typeName?: string
      typeNameRaw?: string
      value?: number | string | null
    }
  }>
}

type PremierTotalFlowRecord = {
  StationId?: string
  TypeName?: string
  Value?: number | string | null
}

type LimitRule =
  | { type: 'range'; min: number; max: number }
  | { type: 'upper'; max: number }
  | { type: 'lower'; min: number }
  | { type: 'none' }

const PREMIER_PUBLIC_URL = 'https://premier.vn/bqlkktpy/cong-bo'
const PREMIER_CACHE_TTL_MS = 600_000
const MAX_SOURCE_HTML_LENGTH = 10_000_000

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { code: 'PH', sourceKey: 'pH', displayName: 'pH', unit: null, limitKey: 'pH' },
  { code: 'COD', sourceKey: 'COD', displayName: 'COD', unit: 'mg/L', limitKey: 'COD' },
  { code: 'TSS', sourceKey: 'TSS', displayName: 'TSS', unit: 'mg/L', limitKey: 'TSS' },
  { code: 'NH4', sourceKey: 'NH4', displayName: 'Amoni', unit: 'mg/L', limitKey: 'NH4' },
  { code: 'TEMP', sourceKey: 'Temp', displayName: 'Nhiệt độ', unit: 'oC', limitKey: 'Temp' },
  { code: 'FLOW_IN', sourceKey: 'Flow_In', displayName: 'Lưu lượng đầu vào', unit: 'm3/h', limitKey: 'Flow_In' },
  { code: 'FLOW_OUT', sourceKey: 'Flow_Out', displayName: 'Lưu lượng đầu ra', unit: 'm3/h', limitKey: 'Flow_Out' },
  { code: 'FLOW_IN_DAY', sourceKey: 'Flow_In_TotalFlowPerDay', displayName: 'Lưu lượng đầu vào trong ngày', unit: 'm3/ngày', limitKey: 'Flow_In_TotalFlowPerDay' },
  { code: 'FLOW_OUT_DAY', sourceKey: 'Flow_Out_TotalFlowPerDay', displayName: 'Lưu lượng đầu ra trong ngày', unit: 'm3/ngày', limitKey: 'Flow_Out_TotalFlowPerDay' },
]

let cachedPremierData: { expiresAt: number; data: PremierPublicData } | null = null
let lastKnownPremierData: PremierPublicData | null = null
let inFlightFetchPromise: Promise<PremierPublicData> | null = null

function loadFallbackData(): PremierPublicData | null {
  try {
    const candidates = [
      new URL('./premier-fallback.json', import.meta.url),
      new URL('../src/premier-fallback.json', import.meta.url),
      new URL('../dist/premier-fallback.json', import.meta.url),
      new URL('../../src/premier-fallback.json', import.meta.url),
      '/app/dist/premier-fallback.json',
      '/app/src/premier-fallback.json',
      './dist/premier-fallback.json',
      './src/premier-fallback.json',
    ]
    for (const p of candidates) {
      if (typeof p === 'string' ? fs.existsSync(p) : fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as PremierPublicData
      }
    }
  } catch {
    // fallback not available
  }
  return null
}

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function textContent(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractTags(source: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  return Array.from(source.matchAll(pattern), (match) => match[1] ?? '')
}

function extractTagRecords(source: string, tag: string): Array<{ attributes: string; content: string }> {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  return Array.from(source.matchAll(pattern), (match) => ({ attributes: match[1] ?? '', content: match[2] ?? '' }))
}

function attributeValue(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return match?.[1] ?? null
}

function slugStation(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseNumber(value: string): number | null {
  const raw = value.trim()
  if (!raw) return null
  const normalized = raw.replace(/\s/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '')
  const withDecimal = normalized.includes('.') ? normalized : normalized.replace(',', '.')
  const numeric = withDecimal.replace(/[^\d.+-]/g, '')
  if (!numeric) return null
  const parsed = Number(numeric)
  return Number.isFinite(parsed) ? parsed : null
}

function parseLimit(value: string | null): LimitRule {
  const normalized = textContent(value ?? '').replace(/−/g, '-')
  if (!normalized || /không giới hạn/i.test(normalized)) return { type: 'none' }
  const range = normalized.match(/(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)/)
  if (range) {
    const min = parseNumber(range[1] ?? '')
    const max = parseNumber(range[2] ?? '')
    if (min !== null && max !== null) return { type: 'range', min, max }
  }
  const upper = normalized.match(/(?:<=|<)\s*(-?\d+(?:[.,]\d+)?)/)
  if (upper) {
    const max = parseNumber(upper[1] ?? '')
    if (max !== null) return { type: 'upper', max }
  }
  const lower = normalized.match(/(?:>=|>)\s*(-?\d+(?:[.,]\d+)?)/)
  if (lower) {
    const min = parseNumber(lower[1] ?? '')
    if (min !== null) return { type: 'lower', min }
  }
  return { type: 'none' }
}

function statusFor(value: number | null, limitText: string | null): PremierMetricStatus {
  if (value === null) return 'MISSING'
  const limit = parseLimit(limitText)
  if (limit.type === 'none') return 'NO_LIMIT'
  if (limit.type === 'range') return value >= limit.min && value <= limit.max ? 'NORMAL' : 'EXCEEDED'
  if (limit.type === 'upper') return value < limit.max ? 'NORMAL' : 'EXCEEDED'
  return value > limit.min ? 'NORMAL' : 'EXCEEDED'
}

function metricFrom(definition: MetricDefinition, rawValue: string, limitText: string | null): PremierMetric {
  return {
    code: definition.code,
    displayName: definition.displayName,
    unit: definition.unit,
    value: parseNumber(rawValue),
    limitText: limitText ? textContent(limitText) : null,
    status: statusFor(parseNumber(rawValue), limitText),
  }
}

function parseLimitTexts(historyTable: string): Record<string, string> {
  return extractTagRecords(historyTable, 'th').reduce<Record<string, string>>((limits, cell) => {
    const name = attributeValue(cell.attributes, 'data-name')
    const value = textContent(cell.content)
    return name && value ? { ...limits, [name]: value } : limits
  }, {})
}

function normalizeSourceKey(value: string | null | undefined): string {
  return (value ?? '').replace(/[*'",_&#^@+\-\s]/g, '').toLowerCase()
}

function parseEmbeddedJsonArray<T>(html: string, variableName: string, nextVariableName?: string): T[] {
  const suffix = nextVariableName ? `\\s*;\\s*(?:var|let|const)\\s+${nextVariableName}\\s*=` : '\\s*;'
  const match = html.match(new RegExp(`(?:var|let|const)\\s+${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\])${suffix}`, 'i'))
  if (!match?.[1]) return []
  try {
    const value: unknown = JSON.parse(match[1])
    return Array.isArray(value) ? value as T[] : []
  } catch {
    return []
  }
}

function parseEmbeddedLimits(html: string): PremierLimitRecord[] {
  return parseEmbeddedJsonArray<PremierLimitRecord>(html, 'limit', 'totalFlowJson')
}

function parseEmbeddedTotalFlows(html: string): PremierTotalFlowRecord[] {
  return parseEmbeddedJsonArray<PremierTotalFlowRecord>(html, 'totalFlowJson')
}

function parseStationOptions(html: string): PremierStationRef[] {
  const select = extractTagRecords(html, 'select').find((record) => /station-select/i.test(record.attributes))
  if (!select) return []
  return extractTagRecords(select.content, 'option')
    .map((option) => ({
      sourceId: attributeValue(option.attributes, 'value') ?? '',
      name: textContent(option.content),
    }))
    .filter((option) => option.sourceId && option.name)
    .map(({ sourceId, name }) => ({ sourceId, code: slugStation(name), name }))
}

function limitTextFor(
  definition: MetricDefinition,
  stationId: string | null,
  embeddedLimits: PremierLimitRecord[],
  fallback: string | null,
): string | null {
  const record = embeddedLimits.find((item) => item.StationId === stationId && normalizeSourceKey(item.TypeNameOrder?.TypeName) === normalizeSourceKey(definition.sourceKey))
  return record?.ShowLimitValue ?? fallback
}

function parsePremierTimestamp(html: string): string | null {
  const source = textContent(html)
  const match = source.match(/Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2}):(\d{2})/i)
  if (!match) return null
  const [, day, month, year, hour, minute, second] = match
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${second}+07:00`
}

function parseCurrentStation(html: string): string | null {
  const select = extractTagRecords(html, 'select').find((record) => /station-select/i.test(record.attributes))
  const option = select && extractTagRecords(select.content, 'option')[0]
  return option ? textContent(option.content) : null
}

function parseOrganizationId(html: string): string | null {
  const openingTag = html.match(/<div\b[^>]*class=["'][^"']*\brealtime-data\b[^"']*["'][^>]*>/i)?.[0] ?? ''
  return attributeValue(openingTag, 'data-organizationid')
}

function parsePremierApiTimestamp(value: string | undefined): string | null {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/)
  return match ? `${match[1]}T${match[2]}+07:00` : null
}

function parseCurrentMetrics(
  table: string,
  limits: Record<string, string>,
  stationId: string | null,
  embeddedLimits: PremierLimitRecord[],
): PremierMetric[] {
  const cells = extractTags(table, 'td')
  return cells.flatMap((cell) => {
    const valueRecord = extractTagRecords(cell, 'span').find((record) => /value-text/i.test(record.attributes))
    const sourceKey = valueRecord && attributeValue(valueRecord.attributes, 'data-name')
    const definition = METRIC_DEFINITIONS.find((item) => normalizeSourceKey(item.sourceKey) === normalizeSourceKey(sourceKey) || normalizeSourceKey(item.displayName) === normalizeSourceKey(sourceKey))
    if (!definition || !valueRecord) return []
    const limitRecord = extractTagRecords(cell, 'div').find((record) => /limit/i.test(record.attributes))
    const limitText = limitRecord ? textContent(limitRecord.content) : limitTextFor(definition, stationId, embeddedLimits, limits[definition.limitKey] ?? null)
    return [metricFrom(definition, textContent(valueRecord.content), limitText)]
  })
}

function parseHistoryRows(
  historyTable: string,
  limits: Record<string, string>,
  stationIds: Map<string, string>,
  embeddedLimits: PremierLimitRecord[],
): PremierSnapshot[] {
  const body = historyTable.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
  let activeDate: string | null = null
  const cells = extractTagRecords(body, 'td').map((cell) => textContent(cell.content))
  const rows: PremierSnapshot[] = []
  let index = 0
  while (index < cells.length) {
    const value = cells[index] ?? ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      activeDate = value
      index += 1
      continue
    }
    if (!activeDate || !value || index + METRIC_DEFINITIONS.length >= cells.length) {
      index += 1
      continue
    }
    const stationName = value
    const stationId = stationIds.get(stationName) ?? null
    const metrics = METRIC_DEFINITIONS.map((definition, metricIndex) => metricFrom(definition, cells[index + metricIndex + 1] ?? '', limitTextFor(definition, stationId, embeddedLimits, limits[definition.limitKey] ?? null)))
    rows.push({
      stationCode: slugStation(stationName),
      stationName,
      observedOn: activeDate,
      measuredAt: `${activeDate}T23:59:00+07:00`,
      readingMode: 'LATEST_30D',
      metrics,
    })
    index += 1 + METRIC_DEFINITIONS.length
  }
  return rows
}

function mergeStations(options: PremierStationRef[], history: PremierSnapshot[]): PremierStation[] {
  const stations = options.map(({ code, name }) => ({ code, name }))
  return history.reduce((current, row) => current.some((station) => station.code === row.stationCode)
    ? current
    : [...current, { code: row.stationCode, name: row.stationName }], stations)
}

function latestSnapshotFor(station: PremierStation, history: PremierSnapshot[], current: PremierSnapshot[]): PremierSnapshot | null {
  const exact = current.find((row) => row.stationCode === station.code)
  if (exact) return exact
  const latest = history.filter((row) => row.stationCode === station.code).reduce<PremierSnapshot | null>((found, row) => !found || row.observedOn > found.observedOn ? row : found, null)
  return latest ? { ...latest, readingMode: 'LATEST_30D' } : null
}

function valueForCurrentMetric(definition: MetricDefinition, stationId: string, response: PremierCurrentResponse, totalFlows: PremierTotalFlowRecord[]): string {
  if (definition.code === 'FLOW_IN_DAY' || definition.code === 'FLOW_OUT_DAY') {
    const totalFlow = totalFlows.find((item) => item.StationId === stationId && normalizeSourceKey(item.TypeName) === normalizeSourceKey(definition.sourceKey))
    return totalFlow?.Value === null || totalFlow?.Value === undefined ? '' : String(totalFlow.Value)
  }
  const item = (response.dataItems ?? []).find((candidate) => {
    const sensorData = candidate.sensorData
    return [sensorData?.typeNameRaw, sensorData?.typeName].some((key) => normalizeSourceKey(key) === normalizeSourceKey(definition.sourceKey) || normalizeSourceKey(key) === normalizeSourceKey(definition.displayName))
  })
  return item?.sensorData?.value === null || item?.sensorData?.value === undefined ? '' : String(item.sensorData.value)
}

function currentSnapshotFor(
  station: PremierStationRef,
  response: PremierCurrentResponse,
  totalFlows: PremierTotalFlowRecord[],
  embeddedLimits: PremierLimitRecord[],
  fallbackLimits: Record<string, string>,
): PremierSnapshot | null {
  if (!response.dataItems?.length) return null
  const measuredAt = parsePremierApiTimestamp(response.timeStr)
  if (!measuredAt) return null
  const metrics = METRIC_DEFINITIONS.map((definition) => metricFrom(
    definition,
    valueForCurrentMetric(definition, station.sourceId, response, totalFlows),
    limitTextFor(definition, station.sourceId, embeddedLimits, fallbackLimits[definition.limitKey] ?? null),
  ))
  return {
    stationCode: station.code,
    stationName: station.name,
    observedOn: measuredAt.slice(0, 10),
    measuredAt,
    readingMode: 'CURRENT',
    metrics,
  }
}

async function requestPremierText(url: string, timeoutMs = 35_000): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': PREMIER_PUBLIC_URL,
      },
    })
    if (!response.ok) throw new Error(`Premier trả về HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_SOURCE_HTML_LENGTH) throw new Error('Dữ liệu Premier vượt giới hạn an toàn')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function loadCurrentSnapshots(html: string, sourceUrl: string, data: PremierPublicData): Promise<PremierSnapshot[]> {
  const organizationId = parseOrganizationId(html)
  const stationRefs = parseStationOptions(html)
  if (!organizationId || !stationRefs.length) return data.current.filter((row) => row.metrics.some((metric) => metric.value !== null))
  const limits = parseEmbeddedLimits(html)
  const totalFlows = parseEmbeddedTotalFlows(html)
  const fallbackLimits = data.history[0]?.metrics.reduce<Record<string, string>>((result, metric) => metric.limitText ? { ...result, [metric.code]: metric.limitText } : result, {}) ?? {}
  const baseUrl = new URL(sourceUrl)
  const results = await Promise.all(stationRefs.map(async (station) => {
    const url = new URL('/get-latest-data-json/WasteWater', baseUrl.origin)
    url.searchParams.set('orgId', organizationId)
    url.searchParams.set('stationid', station.sourceId)
    url.searchParams.set('substationid', '')
    try {
      const payload = JSON.parse(await requestPremierText(url.toString(), 6_000)) as PremierCurrentResponse
      return currentSnapshotFor(station, payload, totalFlows, limits, fallbackLimits)
    } catch {
      return null
    }
  }))
  const current = results.flatMap((row) => row ? [row] : [])
  const fallbackCurrent = data.current.filter((row) => row.metrics.some((metric) => metric.value !== null))
  const available = [...current, ...fallbackCurrent]
  return data.stations.flatMap((station) => {
    const snapshot = latestSnapshotFor(station, data.history, available)
    return snapshot ? [snapshot] : []
  })
}

export function parsePremierHtml(html: string, sourceUrl = PREMIER_PUBLIC_URL, fetchedAt = new Date()): PremierPublicData {
  const tables = extractTags(html, 'table')
  const historyTable = tables.find((table) => /Thời gian/i.test(textContent(table)) && /Điểm quan trắc/i.test(textContent(table)))
  if (!historyTable) throw new Error('Premier không trả về bảng dữ liệu quan trắc 30 ngày')

  const limits = parseLimitTexts(historyTable)
  const stationRefs = parseStationOptions(html)
  const stationIds = new Map(stationRefs.map((station) => [station.name, station.sourceId]))
  const embeddedLimits = parseEmbeddedLimits(html)
  const history = parseHistoryRows(historyTable, limits, stationIds, embeddedLimits)
  if (!history.length) throw new Error('Premier không có bản ghi quan trắc hợp lệ')

  const currentTable = tables.find((table) => /value-text/i.test(table) && /type-name-wrapper/i.test(table))
  const currentStationName = parseCurrentStation(html)
  const currentMetrics = currentTable ? parseCurrentMetrics(currentTable, limits, stationIds.get(currentStationName ?? '') ?? null, embeddedLimits) : []
  const currentMeasuredAt = parsePremierTimestamp(html)
  const current = currentStationName && currentMetrics.length ? [{
    stationCode: slugStation(currentStationName),
    stationName: currentStationName,
    observedOn: currentMeasuredAt?.slice(0, 10) ?? history[0]?.observedOn ?? '',
    measuredAt: currentMeasuredAt ?? `${history[0]?.observedOn ?? ''}T23:59:00+07:00`,
    readingMode: 'CURRENT' as const,
    metrics: currentMetrics,
  }] : []
  const stations = mergeStations(stationRefs, history)
  const latestRows = stations.flatMap((station) => {
    const snapshot = latestSnapshotFor(station, history, current)
    return snapshot ? [snapshot] : []
  })
  const dates = history.map((row) => row.observedOn).sort()

  return {
    source: {
      name: 'Dữ liệu công khai Premier',
      url: sourceUrl,
      fetchedAt: fetchedAt.toISOString(),
      currentMeasuredAt,
      availableFrom: dates[0] ?? null,
      availableTo: dates.at(-1) ?? null,
    },
    stations,
    parameters: METRIC_DEFINITIONS.map(({ code, displayName, unit }) => ({ code, displayName, unit })),
    current: latestRows,
    history,
  }
}

async function executeFetchPremier(sourceUrl: string): Promise<PremierPublicData> {
  const html = await requestPremierText(sourceUrl, 35_000)
  const parsed = parsePremierHtml(html, sourceUrl, new Date())
  const current = await loadCurrentSnapshots(html, sourceUrl, parsed)
  const currentMeasuredAt = current.map((row) => row.measuredAt).sort().at(-1) ?? parsed.source.currentMeasuredAt
  const data: PremierPublicData = {
    ...parsed,
    source: { ...parsed.source, currentMeasuredAt },
    current,
  }
  cachedPremierData = { expiresAt: Date.now() + PREMIER_CACHE_TTL_MS, data }
  lastKnownPremierData = data
  return data
}

export async function fetchPremierPublicData(sourceUrl = PREMIER_PUBLIC_URL): Promise<PremierPublicData> {
  const now = Date.now()
  if (cachedPremierData && cachedPremierData.expiresAt > now) {
    return cachedPremierData.data
  }

  // Stale-while-revalidate: if we already have lastKnownPremierData, return it immediately and refresh in background
  if (lastKnownPremierData) {
    if (!inFlightFetchPromise) {
      inFlightFetchPromise = executeFetchPremier(sourceUrl)
        .catch((err) => {
          console.warn('Background refresh from Premier failed, retaining last known data:', err?.message || err)
          return lastKnownPremierData!
        })
        .finally(() => {
          inFlightFetchPromise = null
        })
    }
    return lastKnownPremierData
  }

  // Initial fetch: wait for response, fallback if error
  if (!inFlightFetchPromise) {
    inFlightFetchPromise = executeFetchPremier(sourceUrl)
      .catch((error) => {
        console.warn('Fetch from Premier failed, using fallback data:', error?.message || error)
        const fallback = loadFallbackData()
        if (fallback) {
          lastKnownPremierData = fallback
          return fallback
        }
        throw error
      })
      .finally(() => {
        inFlightFetchPromise = null
      })
  }

  return inFlightFetchPromise
}
