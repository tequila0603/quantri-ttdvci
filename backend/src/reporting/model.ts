import { createHash } from 'node:crypto'
import type { Database } from '../db.js'
import { ApiError } from '../errors.js'
import type { PremierMetric, PremierPublicData, PremierSnapshot, PremierStation } from '../premier-source.js'

export const aggregateSectionIds = [
  'overview',
  'enterprises',
  'infrastructure',
  'maintenance',
  'incidents',
  'monitoring',
  'finance',
] as const

export type AggregateSectionId = (typeof aggregateSectionIds)[number]

export type AggregateReportRequest = {
  periodLabel: string
  fromDate: string
  toDate: string
  parkCode: string | null
  sections: AggregateSectionId[]
  expectedFingerprint?: string
}

export type ReportColumn = { key: string; label: string; align?: 'left' | 'center' | 'right' }
export type ReportTable = {
  title: string
  unit: string
  columns: ReportColumn[]
  rows: Record<string, string>[]
  totalRow?: Record<string, string>
}
export type ReportSection = { id: AggregateSectionId; title: string; paragraphs: string[]; tables: ReportTable[] }

export type AggregateReportModel = {
  scope: {
    periodLabel: string
    fromDate: string
    toDate: string
    parkName: string
    generatedAt: string
  }
  sourceCoverage: Array<{ label: string; status: 'available' | 'missing' | 'unavailable'; detail: string }>
  overview: Array<{ label: string; value: string; unit: string }>
  sections: ReportSection[]
  findings: Array<{ id: string; title: string; evidence: string; cause: string }>
  recommendations: Array<{ findingId: string; text: string }>
}

type CountRow = { label: string; total: number }
type MoneyRow = { label: string; amount: string | null }

const assetStatusLabels: Record<string, string> = {
  OPERATIONAL: 'Đang hoạt động', DEGRADED: 'Suy giảm chất lượng',
  UNDER_MAINTENANCE: 'Đang bảo trì', OUT_OF_SERVICE: 'Ngừng hoạt động',
}
const orderStatusLabels: Record<string, string> = {
  PENDING: 'Chờ thực hiện', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy',
}
const incidentStatusLabels: Record<string, string> = {
  OPEN: 'Đang mở', INVESTIGATING: 'Đang xác minh', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý', CLOSED: 'Đã đóng',
}
const severityLabels: Record<string, string> = {
  LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Nghiêm trọng',
}

function translatedRows(rows: CountRow[], labels: Record<string, string>): CountRow[] {
  return rows.map((row) => ({ ...row, label: labels[row.label] ?? row.label }))
}

function formatInteger(value: number | string): string {
  return BigInt(String(value)).toLocaleString('vi-VN')
}

function formatReportDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `ngày ${Number(day)} tháng ${Number(month)} năm ${year}`
}

export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(`Invalid money value: ${value}`)
  const [, sign, integer, fraction = ''] = match
  const grouped = BigInt(integer!).toLocaleString('vi-VN')
  const exactFraction = fraction.replace(/0+$/, '')
  return `${sign}${grouped}${exactFraction ? `,${exactFraction}` : ''}`
}

function countTable(title: string, rows: CountRow[], itemLabel: string, includeTotal = true): ReportTable {
  return {
    title,
    unit: itemLabel,
    columns: [
      { key: 'label', label: 'Nhóm', align: 'left' },
      { key: 'value', label: 'Số lượng', align: 'right' },
    ],
    rows: rows.map((row) => ({ label: row.label, value: formatInteger(row.total) })),
    ...(includeTotal ? { totalRow: { label: 'Tổng cộng', value: formatInteger(rows.reduce((sum, row) => sum + row.total, 0)) } } : {}),
  }
}

function moneyTable(title: string, rows: MoneyRow[], includeTotal = true): ReportTable {
  const allValuesAvailable = rows.length > 0 && rows.every((row) => row.amount !== null)
  return {
    title,
    unit: 'đồng',
    columns: [
      { key: 'label', label: 'Nội dung', align: 'left' },
      { key: 'value', label: 'Giá trị', align: 'right' },
    ],
    rows: rows.map((row) => ({ label: row.label, value: row.amount === null ? 'Chưa có dữ liệu' : formatMoney(row.amount) })),
    ...(includeTotal && allValuesAvailable ? { totalRow: { label: 'Tổng cộng', value: formatMoney(sumMoney(rows.map((row) => row.amount!))) } } : {}),
  }
}

function sumMoney(values: string[]): string {
  let cents = 0n
  for (const value of values) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
    if (!match) throw new Error(`Invalid non-negative money value: ${value}`)
    cents += BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  }
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

function byLabel(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.label, row.total]))
}

function selected(request: AggregateReportRequest, id: AggregateSectionId): boolean {
  return request.sections.includes(id)
}

function stationMatchesPark(station: PremierStation, parkCode: string | null): boolean {
  if (!parkCode) return true
  const normalizedPark = parkCode.toUpperCase().replace(/^KCN_/, '')
  const normalizedStation = station.code.toUpperCase().replace(/^KCN_/, '')
  return normalizedStation === normalizedPark || normalizedStation.includes(normalizedPark)
}

function latestPublicSnapshot(data: PremierPublicData, station: PremierStation): PremierSnapshot | null {
  const current = data.current.find((row) => row.stationCode === station.code)
  if (current) return current
  return data.history
    .filter((row) => row.stationCode === station.code)
    .sort((left, right) => right.observedOn.localeCompare(left.observedOn))[0] ?? null
}

function publicMetric(snapshot: PremierSnapshot | null, code: string): PremierMetric | null {
  return snapshot?.metrics.find((metric) => metric.code === code) ?? null
}

function formatMeasurement(value: number | null): string {
  return value === null ? 'Chưa có dữ liệu' : value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

function formatMonitoringTimestamp(value: string | null): string {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
    : value
}

function sumPublicMetric(data: PremierPublicData, stations: PremierStation[], code: string): number | null {
  const values = stations
    .map((station) => publicMetric(latestPublicSnapshot(data, station), code)?.value ?? null)
    .filter((value): value is number => value !== null)
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
}

export async function buildAggregateReport(database: Database, request: AggregateReportRequest, premierData: PremierPublicData | null = null): Promise<AggregateReportModel> {
  const parkResult = await database.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM core.industrial_parks WHERE code = $1 AND is_active = true`,
    [request.parkCode],
  )
  if (request.parkCode && !parkResult.rows[0]) {
    throw new ApiError(404, 'industrial_park_not_found', 'Không tìm thấy khu công nghiệp đã chọn')
  }
  const parkId = parkResult.rows[0]?.id ?? null
  const parkName = parkResult.rows[0]?.name ?? 'Tất cả khu công nghiệp'
  const publicStations = premierData?.stations.filter((station) => stationMatchesPark(station, request.parkCode)) ?? []
  const publicStationRows = publicStations.map((station) => {
    const snapshot = premierData ? latestPublicSnapshot(premierData, station) : null
    return {
      station: station.name,
      measuredAt: formatMonitoringTimestamp(snapshot?.measuredAt ?? null),
    }
  })
  const publicFlowRows = publicStations.flatMap((station) => {
    const snapshot = premierData ? latestPublicSnapshot(premierData, station) : null
    return [
      { station: station.name, metric: 'Lưu lượng thu', value: formatMeasurement(publicMetric(snapshot, 'FLOW_IN')?.value ?? null), unit: 'm³/h' },
      { station: station.name, metric: 'Lưu lượng xả', value: formatMeasurement(publicMetric(snapshot, 'FLOW_OUT')?.value ?? null), unit: 'm³/h' },
      { station: station.name, metric: 'Lưu lượng thu trong ngày', value: formatMeasurement(publicMetric(snapshot, 'FLOW_IN_DAY')?.value ?? null), unit: 'm³/ngày' },
      { station: station.name, metric: 'Lưu lượng xả trong ngày', value: formatMeasurement(publicMetric(snapshot, 'FLOW_OUT_DAY')?.value ?? null), unit: 'm³/ngày' },
    ]
  })
  const reportYear = new Date(request.toDate).getFullYear();
  const yearParkParams = [reportYear, parkId]
  const parkParams = [parkId]
  const dateParkParams = [request.fromDate, request.toDate, parkId]
  const receivableParams = [request.toDate, parkId]

  const [overviewResult, enterpriseResult, assetResult, assetCategoryResult, projectResult, orderResult, incidentResult, monitoringResult, chargeResult, paymentResult, receivableResult] = await Promise.all([
    database.query<{ parks: number; enterprises: number; assets: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM core.industrial_parks p WHERE p.is_active = true AND ($2::bigint IS NULL OR p.id = $2)) AS parks,
         (SELECT COUNT(DISTINCT s.enterprise_id)::int FROM finance.annual_lease_snapshots s
           JOIN core.enterprises e ON e.id = s.enterprise_id AND e.is_active = true
           WHERE s.reporting_year = $1 AND ($2::bigint IS NULL OR s.industrial_park_id = $2)) AS enterprises,
         (SELECT COUNT(*)::int FROM infrastructure.assets a WHERE $2::bigint IS NULL OR a.industrial_park_id = $2) AS assets`, yearParkParams),
    database.query<CountRow>(
      `SELECT COALESCE(p.name, 'Chưa xác định') AS label, COUNT(DISTINCT e.id)::int AS total
       FROM finance.annual_lease_snapshots s
       JOIN core.enterprises e ON e.id = s.enterprise_id AND e.is_active = true
       JOIN core.industrial_parks p ON p.id = s.industrial_park_id
       WHERE s.reporting_year = $1 AND ($2::bigint IS NULL OR s.industrial_park_id = $2)
       GROUP BY p.name ORDER BY p.name`, yearParkParams),
    database.query<CountRow>(
      `SELECT status AS label, COUNT(*)::int AS total FROM infrastructure.assets
       WHERE $1::bigint IS NULL OR industrial_park_id = $1 GROUP BY status ORDER BY status`, parkParams),
    database.query<CountRow>(
      `SELECT c.display_name AS label, COUNT(a.id)::int AS total
       FROM infrastructure.asset_categories c
       LEFT JOIN infrastructure.assets a ON a.category_code = c.code AND ($1::bigint IS NULL OR a.industrial_park_id = $1)
       GROUP BY c.code, c.display_name ORDER BY c.display_name`, parkParams),
    database.query<{ projects: number; estimated: string | null; actual: string | null }>(
      `SELECT COUNT(*)::int AS projects, SUM(estimated_budget)::text AS estimated,
              SUM(actual_cost)::text AS actual
       FROM infrastructure.projects
       WHERE ($3::bigint IS NULL OR industrial_park_id = $3)
         AND (start_date IS NULL OR start_date <= $2::date)
         AND (completion_date IS NULL OR completion_date >= $1::date)`, dateParkParams),
    database.query<CountRow & { actual_cost: string | null; overdue: number }>(
      `SELECT w.status AS label, COUNT(*)::int AS total, SUM(w.actual_cost)::text AS actual_cost,
              COUNT(*) FILTER (WHERE w.status NOT IN ('COMPLETED', 'CANCELLED') AND w.scheduled_end < $2::date)::int AS overdue
       FROM maintenance.work_orders w JOIN infrastructure.assets a ON a.id = w.asset_id
       WHERE w.scheduled_start <= $2::date AND w.scheduled_end >= $1::date
         AND ($3::bigint IS NULL OR a.industrial_park_id = $3)
       GROUP BY w.status ORDER BY w.status`, dateParkParams),
    database.query<CountRow & { cause_summary: string | null }>(
      `SELECT i.current_status || ' / ' || i.severity AS label, COUNT(*)::int AS total,
              STRING_AGG(DISTINCT NULLIF(BTRIM(i.root_cause), ''), '; ') AS cause_summary
       FROM maintenance.incidents i
       WHERE i.reported_at < ($2::date + interval '1 day') AND COALESCE(i.resolved_at, 'infinity') >= $1::date
         AND ($3::bigint IS NULL OR i.industrial_park_id = $3)
       GROUP BY i.current_status, i.severity ORDER BY i.current_status, i.severity`, dateParkParams),
    database.query<{ label: string; unit: string | null; total: number; missing: number }>(
      `SELECT p.display_name AS label, p.unit, COUNT(o.id)::int AS total,
              COUNT(*) FILTER (WHERE o.value IS NULL)::int AS missing
       FROM monitoring.observations o
       JOIN monitoring.parameters p ON p.id = o.parameter_id
       JOIN monitoring.devices d ON d.id = o.device_id
       JOIN monitoring.stations s ON s.id = d.station_id
       WHERE o.measured_at >= $1::date AND o.measured_at < ($2::date + interval '1 day')
         AND ($3::bigint IS NULL OR s.industrial_park_id = $3)
       GROUP BY p.id, p.display_name, p.unit ORDER BY p.display_name`, dateParkParams),
    database.query<MoneyRow>(
      `SELECT sc.display_name AS label,
              (SUM(ac.amount_due) FILTER (WHERE s.id IS NOT NULL))::text AS amount
       FROM finance.service_categories sc
       LEFT JOIN finance.annual_charges ac ON ac.category_code = sc.code
       LEFT JOIN finance.annual_lease_snapshots s ON s.id = ac.snapshot_id AND s.reporting_year = $1
         AND ($2::bigint IS NULL OR s.industrial_park_id = $2)
       GROUP BY sc.code, sc.display_name ORDER BY sc.display_name`, yearParkParams),
    database.query<{ amount: string; total: number }>(
      `SELECT COALESCE(SUM(p.amount), 0)::text AS amount, COUNT(*)::int AS total
       FROM finance.payments p WHERE p.paid_on BETWEEN $1::date AND $2::date
         AND $3::bigint IS NULL`, dateParkParams),
    database.query<{ total: number; amount_due: string | null; amount_outstanding: string | null }>(
      `SELECT COUNT(*)::int AS total, SUM(b.amount_due)::text AS amount_due,
              SUM(b.amount_outstanding)::text AS amount_outstanding
       FROM finance.invoice_line_balances b JOIN finance.invoices i ON i.id = b.invoice_id
       WHERE i.status = 'VALID' AND (i.issued_on IS NULL OR i.issued_on <= $1::date)
         AND $2::bigint IS NULL`, receivableParams),
  ])

  const overview = overviewResult.rows[0] ?? { parks: 0, enterprises: 0, assets: 0 }
  const project = projectResult.rows[0] ?? { projects: 0, estimated: null, actual: null }
  const paymentRow = paymentResult.rows[0] ?? { amount: '0', total: 0 }
  const payment = { ...paymentRow, amount: paymentRow.total > 0 ? paymentRow.amount : null }
  const receivable = receivableResult.rows[0] ?? { total: 0, amount_due: null, amount_outstanding: null }
  const financeParkScopeNote = 'Không thể phân bổ số phải thu theo hóa đơn, số còn phải thu và thanh toán thực tế cho riêng khu công nghiệp đã chọn vì dữ liệu nguồn chỉ liên kết các chứng từ này với doanh nghiệp.'
  const orderCosts = orderResult.rows.map((row) => ({ label: row.label, amount: row.actual_cost }))
  const overdueOrders = orderResult.rows.reduce((sum, row) => sum + row.overdue, 0)
  const incidentCounts = byLabel(incidentResult.rows)
  const openCritical = [...incidentCounts].filter(([key]) => !key.startsWith('RESOLVED') && !key.startsWith('CLOSED') && key.endsWith('/ CRITICAL')).reduce((sum, [, value]) => sum + value, 0)
  const assetCounts = byLabel(assetResult.rows)
  const problemAssets = (assetCounts.get('DEGRADED') ?? 0) + (assetCounts.get('OUT_OF_SERVICE') ?? 0)
  const missingObservations = monitoringResult.rows.reduce((sum, row) => sum + row.missing, 0)
  const totalOrders = orderResult.rows.reduce((sum, row) => sum + row.total, 0)
  const totalIncidents = incidentResult.rows.reduce((sum, row) => sum + row.total, 0)
  const totalObservations = monitoringResult.rows.reduce((sum, row) => sum + row.total, 0)
  const publicMonitoringAvailable = publicStations.length > 0
  const monitoringParagraphs = [
    ...(monitoringResult.rows.length ? [`Có ${formatInteger(totalObservations)} bản ghi quan trắc trong kỳ.`] : []),
    ...(publicMonitoringAvailable ? [`Nguồn Premier cung cấp dữ liệu của ${formatInteger(publicStations.length)} trạm; thời điểm cập nhật gần nhất: ${formatMonitoringTimestamp(premierData?.source.currentMeasuredAt ?? premierData?.source.fetchedAt ?? null)}.`] : []),
  ]
  if (!monitoringParagraphs.length) monitoringParagraphs.push('Chưa có dữ liệu quan trắc trong phạm vi báo cáo. Hệ thống chưa có cấu hình ngưỡng để kết luận vượt ngưỡng.')
  const publicMonitoringTables: ReportTable[] = publicMonitoringAvailable ? [
    {
      title: 'Bảng 8. Ba trạm quan trắc và thời điểm đo gần nhất',
      unit: 'trạm',
      columns: [
        { key: 'station', label: 'Trạm/KCN' },
        { key: 'measuredAt', label: 'Thời điểm đo gần nhất', align: 'center' },
      ],
      rows: publicStationRows,
    },
    {
      title: 'Bảng 9. Lưu lượng thu và lưu lượng xả theo trạm',
      unit: 'm³/h và m³/ngày',
      columns: [
        { key: 'station', label: 'Trạm/KCN' },
        { key: 'metric', label: 'Thông số' },
        { key: 'value', label: 'Giá trị', align: 'right' },
        { key: 'unit', label: 'Đơn vị', align: 'center' },
      ],
      rows: publicFlowRows,
    },
  ] : []
  const criticalCauses = incidentResult.rows
    .filter((row) => !row.label.startsWith('RESOLVED') && !row.label.startsWith('CLOSED') && row.label.endsWith('/ CRITICAL') && row.cause_summary)
    .map((row) => row.cause_summary as string)
  const displayAssetRows = translatedRows(assetResult.rows, assetStatusLabels)
  const displayOrderRows = translatedRows(orderResult.rows, orderStatusLabels)
  const displayOrderCosts = orderCosts.map((row) => ({ ...row, label: orderStatusLabels[row.label] ?? row.label }))
  const displayIncidentRows = incidentResult.rows.map((row) => {
    const [status = row.label, severity = ''] = row.label.split(' / ')
    return { label: `${incidentStatusLabels[status] ?? status} / ${severityLabels[severity] ?? severity}`, total: row.total }
  })

  const findings: AggregateReportModel['findings'] = []
  if (selected(request, 'incidents') && openCritical > 0) findings.push({ id: 'critical-incidents', title: 'Sự cố mức độ nghiêm trọng chưa kết thúc', evidence: `Có ${formatInteger(openCritical)} sự cố mức nghiêm trọng chưa ở trạng thái đã xử lý hoặc đã đóng.`, cause: criticalCauses.length ? [...new Set(criticalCauses)].join('; ') : 'Chưa có dữ liệu xác định nguyên nhân.' })
  if (selected(request, 'maintenance') && overdueOrders > 0) findings.push({ id: 'overdue-orders', title: 'Lệnh duy tu, bảo dưỡng quá hạn', evidence: `Có ${formatInteger(overdueOrders)} lệnh chưa hoàn thành có ngày kết thúc kế hoạch trước ${formatReportDate(request.toDate)}.`, cause: 'Chưa có dữ liệu xác định nguyên nhân.' })
  if (selected(request, 'infrastructure') && problemAssets > 0) findings.push({ id: 'problem-assets', title: 'Công trình có trạng thái cần xử lý', evidence: `Có ${formatInteger(problemAssets)} công trình suy giảm chất lượng hoặc ngừng hoạt động.`, cause: 'Chưa có dữ liệu xác định nguyên nhân.' })
  if (selected(request, 'monitoring') && missingObservations > 0) findings.push({ id: 'missing-observations', title: 'Quan trắc thiếu giá trị đo', evidence: `Có ${formatInteger(missingObservations)} bản ghi quan trắc không có giá trị.`, cause: 'Chưa có dữ liệu xác định nguyên nhân.' })
  if (selected(request, 'finance') && request.parkCode) findings.push({ id: 'finance-park-attribution', title: 'Chưa đủ căn cứ phân bổ công nợ và thanh toán theo khu công nghiệp', evidence: financeParkScopeNote, cause: 'Dữ liệu nguồn hiện chỉ liên kết hóa đơn và thanh toán với doanh nghiệp.' })
  if (selected(request, 'finance') && !request.parkCode && payment.total === 0) findings.push({ id: 'missing-payments', title: 'Chưa có dữ liệu thanh toán thực tế trong kỳ', evidence: `Không có chứng từ thanh toán trong phạm vi từ ${formatReportDate(request.fromDate)} đến ${formatReportDate(request.toDate)}.`, cause: 'Chưa có dữ liệu xác định nguyên nhân.' })

  const allSections: ReportSection[] = [
    { id: 'overview', title: 'II. TÌNH HÌNH CHUNG', paragraphs: [`Báo cáo ghi nhận ${formatInteger(overview.parks)} khu công nghiệp, ${formatInteger(overview.enterprises)} doanh nghiệp đang hoạt động và ${formatInteger(overview.assets)} công trình hạ tầng trong phạm vi thống kê.`], tables: [] },
    { id: 'enterprises', title: 'III.1. DOANH NGHIỆP', paragraphs: [`Có ${formatInteger(overview.enterprises)} doanh nghiệp đang hoạt động có hồ sơ thuê trong năm ${reportYear}. Một doanh nghiệp có hồ sơ tại nhiều khu công nghiệp được tính tại từng dòng của bảng, chỉ tiêu tổng quan chỉ tính một lần cho mỗi doanh nghiệp.`], tables: [countTable('Bảng 1. Doanh nghiệp theo khu công nghiệp', enterpriseResult.rows, 'doanh nghiệp', Boolean(request.parkCode))] },
    { id: 'infrastructure', title: 'III.2. HẠ TẦNG', paragraphs: [`Có ${formatInteger(overview.assets)} công trình hạ tầng; trong đó ${formatInteger(problemAssets)} công trình suy giảm chất lượng hoặc ngừng hoạt động.`], tables: [countTable('Bảng 2. Công trình theo phân loại', assetCategoryResult.rows, 'công trình'), countTable('Bảng 3. Công trình theo trạng thái', displayAssetRows, 'công trình')] },
    { id: 'maintenance', title: 'III.3. DUY TU, BẢO DƯỠNG', paragraphs: [`Có ${formatInteger(overdueOrders)} lệnh chưa hoàn thành có ngày kết thúc kế hoạch trước ${formatReportDate(request.toDate)}. Chi phí thực tế được tổng hợp từ lệnh công việc; số liệu này không được diễn giải là giá trị giải ngân.`], tables: [countTable('Bảng 4. Lệnh công việc theo trạng thái', displayOrderRows, 'lệnh'), moneyTable('Bảng 5. Chi phí thực tế của lệnh công việc theo trạng thái', displayOrderCosts)] },
    { id: 'incidents', title: 'III.4. SỰ CỐ', paragraphs: [`Có ${formatInteger(incidentResult.rows.reduce((sum, row) => sum + row.total, 0))} sự cố giao với kỳ báo cáo.`], tables: [countTable('Bảng 6. Sự cố theo trạng thái và mức độ', displayIncidentRows, 'sự cố')] },
    { id: 'monitoring', title: 'III.5. QUAN TRẮC', paragraphs: monitoringParagraphs, tables: [{ title: 'Bảng 7. Bản ghi quan trắc theo thông số', unit: 'bản ghi', columns: [{ key: 'label', label: 'Thông số' }, { key: 'unit', label: 'Đơn vị đo', align: 'center' }, { key: 'total', label: 'Số bản ghi', align: 'right' }, { key: 'missing', label: 'Thiếu giá trị', align: 'right' }], rows: monitoringResult.rows.map((row) => ({ label: row.label, unit: row.unit ?? 'Chưa có dữ liệu', total: formatInteger(row.total), missing: formatInteger(row.missing) })), }, ...publicMonitoringTables] },
    { id: 'finance', title: 'III.6. TÀI CHÍNH', paragraphs: [request.parkCode
      ? `${financeParkScopeNote} ${moneySentence('Chi phí thực tế dự án', project.actual)} Chi phí thực tế không được diễn giải là giải ngân.`
      : `${moneySentence('Tổng số phải thu', receivable.amount_due)} ${moneySentence('Số tiền còn phải thu', receivable.amount_outstanding)} ${moneySentence('Chi phí thực tế dự án', project.actual)} Chi phí thực tế không được diễn giải là giải ngân.`], tables: [
        moneyTable('Bảng 8. Số phải thu theo nhóm dịch vụ', chargeResult.rows),
        moneyTable('Bảng 9. Tổng hợp tài chính và chi phí dự án', [
          ...(!request.parkCode ? [
            { label: 'Số phải thu theo hóa đơn', amount: receivable.amount_due },
            { label: 'Số còn phải thu', amount: receivable.amount_outstanding },
            { label: 'Thanh toán thực tế trong kỳ', amount: payment.amount },
          ] : []),
          { label: 'Dự toán dự án hạ tầng', amount: project.estimated },
          { label: 'Chi phí thực tế dự án hạ tầng', amount: project.actual },
        ], false),
      ] },
  ]

  const coverageBySection: Array<{ section: AggregateSectionId; item: AggregateReportModel['sourceCoverage'][number] }> = [
    { section: 'overview', item: { label: 'Khu công nghiệp', status: 'available', detail: 'Dữ liệu danh mục khu công nghiệp tại thời điểm xuất báo cáo.' } },
    { section: 'enterprises', item: { label: 'Doanh nghiệp', status: 'available', detail: `Dữ liệu doanh nghiệp có hồ sơ thuê trong năm ${reportYear}.` } },
    { section: 'infrastructure', item: { label: 'Hạ tầng', status: 'available', detail: 'Dữ liệu công trình và dự án hạ tầng tại thời điểm xuất báo cáo.' } },
    { section: 'maintenance', item: { label: 'Duy tu, bảo dưỡng', status: 'available', detail: 'Dữ liệu lệnh công việc giao với khoảng thời gian được chọn.' } },
    { section: 'incidents', item: { label: 'Sự cố', status: 'available', detail: 'Dữ liệu sự cố giao với khoảng thời gian được chọn.' } },
    { section: 'monitoring', item: { label: 'Quan trắc', status: monitoringResult.rows.length || publicMonitoringAvailable ? 'available' : 'missing', detail: [monitoringResult.rows.length ? 'Có dữ liệu quan trắc trong kỳ.' : '', publicMonitoringAvailable ? `Có dữ liệu Premier của ${formatInteger(publicStations.length)} trạm.` : ''].filter(Boolean).join(' ') || 'Chưa có dữ liệu quan trắc trong kỳ.' } },
    { section: 'finance', item: { label: 'Tài chính', status: chargeResult.rows.some((row) => row.amount !== null) || payment.total > 0 || receivable.total > 0 || project.projects > 0 ? 'available' : 'missing', detail: request.parkCode ? 'Số phải thu theo nhóm dịch vụ và chi phí dự án được tổng hợp từ nguồn có liên kết với khu công nghiệp.' : payment.total ? 'Có dữ liệu phải thu, thanh toán và chi phí.' : 'Chưa có dữ liệu thanh toán thực tế trong kỳ; các chỉ tiêu còn lại được thể hiện theo dữ liệu nguồn hiện có.' } },
    { section: 'finance', item: { label: 'Hóa đơn, công nợ và thanh toán', status: request.parkCode ? 'unavailable' : payment.total > 0 || receivable.total > 0 ? 'available' : 'missing', detail: request.parkCode ? financeParkScopeNote : payment.total > 0 || receivable.total > 0 ? 'Số liệu được tổng hợp trên phạm vi tất cả khu công nghiệp.' : 'Chưa có dữ liệu hóa đơn hoặc thanh toán trong phạm vi báo cáo.' } },
    { section: 'finance', item: { label: 'Giải ngân vốn đầu tư', status: 'missing', detail: 'Nguồn dữ liệu hiện có chưa có chỉ tiêu hoặc chứng từ giải ngân; không sử dụng số phải thu hoặc chi phí thực tế để thay thế.' } },
  ]
  const sourceCoverage = coverageBySection.filter(({ section }) => selected(request, section)).map(({ item }) => item)

  const selectedSections = allSections.filter((section) => selected(request, section.id))
  let tableNumber = 0
  const displaySections = selectedSections.map((section) => ({
    ...section,
    title: section.id === 'overview' ? 'TÌNH HÌNH CHUNG' : section.title.replace(/^III\.\d+\.\s*/, ''),
    tables: section.tables.map((table) => ({ ...table, title: `Bảng ${++tableNumber}. ${table.title.replace(/^Bảng \d+\.\s*/, '')}` })),
  }))

  const overviewMetrics = [
    ...(selected(request, 'overview') ? [{ label: 'Khu công nghiệp', value: formatInteger(overview.parks), unit: 'KCN' }] : []),
    ...(selected(request, 'enterprises') ? [{ label: 'Doanh nghiệp đang hoạt động', value: formatInteger(overview.enterprises), unit: 'doanh nghiệp' }] : []),
    ...(selected(request, 'infrastructure') ? [{ label: 'Công trình hạ tầng', value: formatInteger(overview.assets), unit: 'công trình' }, { label: 'Dự án hạ tầng', value: formatInteger(project.projects), unit: 'dự án' }] : []),
    ...(selected(request, 'maintenance') ? [{ label: 'Lệnh duy tu, bảo dưỡng trong kỳ', value: formatInteger(totalOrders), unit: 'lệnh' }] : []),
    ...(selected(request, 'incidents') ? [{ label: 'Sự cố giao với kỳ báo cáo', value: formatInteger(totalIncidents), unit: 'sự cố' }] : []),
    ...(selected(request, 'monitoring') ? [
      { label: 'Bản ghi quan trắc trong kỳ', value: formatInteger(totalObservations), unit: 'bản ghi' },
      ...(publicMonitoringAvailable ? [
        { label: 'Trạm quan trắc công khai', value: formatInteger(publicStations.length), unit: 'trạm' },
        { label: 'Lưu lượng thu trong ngày', value: formatMeasurement(sumPublicMetric(premierData!, publicStations, 'FLOW_IN_DAY')), unit: 'm³/ngày' },
        { label: 'Lưu lượng xả trong ngày', value: formatMeasurement(sumPublicMetric(premierData!, publicStations, 'FLOW_OUT_DAY')), unit: 'm³/ngày' },
      ] : []),
    ] : []),
    ...(selected(request, 'finance') ? (request.parkCode ? [
      { label: 'Số phải thu theo hóa đơn', value: 'Không thể phân bổ theo khu công nghiệp', unit: 'đồng' },
      { label: 'Số còn phải thu', value: 'Không thể phân bổ theo khu công nghiệp', unit: 'đồng' },
      { label: 'Thanh toán thực tế trong kỳ', value: 'Không thể phân bổ theo khu công nghiệp', unit: 'đồng' },
    ] : [
      { label: 'Số phải thu', value: receivable.amount_due === null ? 'Chưa có dữ liệu' : formatMoney(receivable.amount_due), unit: 'đồng' },
      { label: 'Thanh toán thực tế trong kỳ', value: payment.amount === null ? 'Chưa có dữ liệu' : formatMoney(payment.amount), unit: 'đồng' },
    ]) : []),
  ]

  return {
    scope: { periodLabel: request.periodLabel, fromDate: request.fromDate, toDate: request.toDate, parkName, generatedAt: new Date().toISOString() },
    sourceCoverage,
    overview: overviewMetrics,
    sections: displaySections,
    findings,
    recommendations: findings.map((finding) => ({ findingId: finding.id, text: recommendationFor(finding.id) })),
  }
}

function recommendationFor(findingId: string): string {
  if (findingId === 'critical-incidents') return 'Rà soát từng sự cố mức nghiêm trọng chưa kết thúc, xác định đơn vị xử lý và thời hạn hoàn thành trên hồ sơ nghiệp vụ.'
  if (findingId === 'overdue-orders') return 'Rà soát từng lệnh duy tu, bảo dưỡng quá hạn, cập nhật tiến độ và xác định thời hạn hoàn thành trên hồ sơ nghiệp vụ.'
  if (findingId === 'problem-assets') return 'Kiểm tra hiện trạng từng công trình suy giảm chất lượng hoặc ngừng hoạt động và lập lệnh duy tu khi có căn cứ kỹ thuật.'
  if (findingId === 'missing-observations') return 'Kiểm tra thiết bị và luồng đồng bộ đối với các bản ghi quan trắc thiếu giá trị.'
  if (findingId === 'finance-park-attribution') return 'Bổ sung mối liên kết xác định giữa chứng từ hóa đơn, thanh toán và khu công nghiệp trước khi tổng hợp công nợ theo từng khu công nghiệp.'
  return 'Đối chiếu nguồn chứng từ và cập nhật dữ liệu thanh toán thực tế cho kỳ báo cáo.'
}

function moneySentence(label: string, value: string | null): string {
  return value === null ? `${label}: chưa có dữ liệu.` : `${label} là ${formatMoney(value)} đồng.`
}

export function fingerprintReport(model: AggregateReportModel): string {
  const stable = { ...model, scope: { ...model.scope, generatedAt: '' } }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}
