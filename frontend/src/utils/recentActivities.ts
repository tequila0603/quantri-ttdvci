export type ActivityTagTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info'

export type RecentActivityItem = {
  id: string
  title: string
  location: string
  time: string
  rawTime: number
  detail: string
  badgeLabel: string
  badgeTone: ActivityTagTone
  dotColor: string
  view: 'overview' | 'finance' | 'enterprises' | 'infrastructure' | 'maintenance' | 'workforce' | 'monitoring' | 'imports'
  context?: { parkCode?: string; tab?: string; targetId?: string }
}

export type RawFieldReport = {
  id: string
  reportCode: string
  title: string
  reporterName?: string | null
  parkName?: string | null
  parkCode?: string | null
  locationDetail?: string | null
  category?: string | null
  severity?: string | null
  reportedAt?: string | null
  createdAt?: string | null
}

export type RawIncident = {
  id: string
  incidentCode: string
  title: string
  parkName?: string | null
  parkCode?: string | null
  locationDetail?: string | null
  severity?: string | null
  currentStatus?: string | null
  reportedAt?: string | null
  createdAt?: string | null
}

export type RawOrder = {
  id: string
  orderCode: string
  title: string
  parkName?: string | null
  parkCode?: string | null
  orderType?: string | null
  priority?: string | null
  assignedTo?: string | null
  status?: string | null
  assetName?: string | null
  assetCode?: string | null
  completedAt?: string | null
  scheduledStart?: string | null
  createdAt?: string | null
}

export type RawProject = {
  id: string
  projectCode: string
  projectName: string
  parkName?: string | null
  parkCode?: string | null
  status?: string | null
  estimatedBudget?: number | null
  actualCost?: number | null
  currentMilestone?: string | null
  startDate?: string | null
  updatedAt?: string | null
}

export type RawMonitoring = {
  source?: {
    currentMeasuredAt?: string | null
    fetchedAt?: string | null
  }
}

export function formatRelativeTime(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  const timeMs = date.getTime()
  if (!Number.isFinite(timeMs)) return value

  const diffMs = nowMs - timeMs
  if (diffMs < 0) {
    return 'Vừa xong'
  }

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Vừa xong'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Hôm qua'
  if (diffDays < 7) return `${diffDays} ngày trước`

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatFieldReportCategory(cat?: string | null): string {
  switch (cat) {
    case 'INCIDENT':
      return 'Sự cố / Nguy cơ'
    case 'INSPECTION':
      return 'Kiểm tra hiện trường'
    case 'OPERATIONS':
      return 'Vận hành / Bảo dưỡng'
    case 'PROGRESS':
      return 'Tiến độ công việc'
    case 'ENTERPRISE_ACTIVITY':
      return 'Hoạt động doanh nghiệp'
    case 'NOTICE':
      return 'Thông báo / Chỉ đạo'
    case 'PENDING_CLASSIFICATION':
      return 'Chờ phân loại'
    default:
      return 'Chờ phân loại'
  }
}

export function formatFieldReportCategoryTone(cat?: string | null): ActivityTagTone {
  switch (cat) {
    case 'INCIDENT':
      return 'negative'
    case 'INSPECTION':
      return 'info'
    case 'OPERATIONS':
      return 'positive'
    case 'PROGRESS':
      return 'warning'
    case 'ENTERPRISE_ACTIVITY':
      return 'info'
    case 'NOTICE':
      return 'warning'
    case 'PENDING_CLASSIFICATION':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function formatSeverity(sev?: string | null): string {
  switch (sev) {
    case 'CRITICAL':
      return 'Khẩn cấp'
    case 'HIGH':
      return 'Cao'
    case 'MEDIUM':
      return 'Trung bình'
    case 'LOW':
      return 'Thấp'
    default:
      return 'Chưa xác định'
  }
}

export function formatIncidentStatus(status?: string | null): string {
  switch (status) {
    case 'OPEN':
      return 'Mới ghi nhận'
    case 'INVESTIGATING':
      return 'Đang khảo sát'
    case 'IN_PROGRESS':
      return 'Đang xử lý'
    case 'RESOLVED':
      return 'Đã xử lý'
    case 'CLOSED':
      return 'Đã đóng nghiệm thu'
    default:
      return status || 'Mới tiếp nhận'
  }
}

export function formatIncidentStatusTone(status?: string | null): ActivityTagTone {
  switch (status) {
    case 'OPEN':
      return 'warning'
    case 'INVESTIGATING':
      return 'info'
    case 'IN_PROGRESS':
      return 'info'
    case 'RESOLVED':
      return 'positive'
    case 'CLOSED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function formatOrderStatus(status?: string | null): string {
  switch (status) {
    case 'COMPLETED':
      return 'Đã nghiệm thu'
    case 'IN_PROGRESS':
      return 'Đang thi công'
    case 'PENDING':
      return 'Chờ triển khai'
    case 'CANCELLED':
      return 'Đã hủy'
    default:
      return status || 'Chờ triển khai'
  }
}

export function formatOrderStatusTone(status?: string | null): ActivityTagTone {
  switch (status) {
    case 'COMPLETED':
      return 'positive'
    case 'IN_PROGRESS':
      return 'info'
    case 'PENDING':
      return 'warning'
    case 'CANCELLED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function formatOrderType(type?: string | null): string {
  switch (type) {
    case 'ROUTINE':
      return 'Bảo dưỡng định kỳ'
    case 'CORRECTIVE':
      return 'Sửa chữa khắc phục'
    case 'EMERGENCY':
      return 'Ứng phó khẩn cấp'
    case 'UPGRADE':
      return 'Cải tạo nâng cấp'
    default:
      return type || 'Bảo dưỡng'
  }
}

export type BuildRecentActivitiesOptions = {
  fieldReports?: RawFieldReport[]
  incidents?: RawIncident[]
  orders?: RawOrder[]
  projects?: RawProject[]
  monitoring?: RawMonitoring | null
  filterParkCode?: string
  filterParkName?: string
  nowMs?: number
  limit?: number
}

export function buildRecentActivities({
  fieldReports = [],
  incidents = [],
  orders = [],
  projects = [],
  monitoring = null,
  filterParkCode,
  filterParkName,
  nowMs = Date.now(),
  limit = 6,
}: BuildRecentActivitiesOptions): RecentActivityItem[] {
  const items: RecentActivityItem[] = []

  // 1. Field Reports (bao gồm tin Zalo quét về)
  for (const rep of fieldReports) {
    if (filterParkCode && rep.parkCode && rep.parkCode !== filterParkCode) continue
    const timeVal = rep.reportedAt || rep.createdAt
    const rawTime = timeVal ? new Date(timeVal).getTime() : 0
    const cat = rep.category || 'PENDING_CLASSIFICATION'
    const isIncidentCat = cat === 'INCIDENT'
    const isOpsCat = cat === 'OPERATIONS'

    items.push({
      id: `rep-${rep.id}`,
      title: rep.title || 'Báo cáo hiện trường',
      location: rep.parkName || 'KCN',
      time: formatRelativeTime(timeVal, nowMs),
      rawTime: Number.isFinite(rawTime) ? rawTime : 0,
      detail: `Báo cáo ${rep.reportCode} · Người báo: ${rep.reporterName || 'Chưa xác định'}${rep.locationDetail ? ` (${rep.locationDetail})` : ''}`,
      badgeLabel: formatFieldReportCategory(cat),
      badgeTone: formatFieldReportCategoryTone(cat),
      dotColor: isIncidentCat ? 'var(--color-negative)' : isOpsCat ? 'var(--color-positive)' : 'var(--color-ink)',
      view: 'maintenance',
      context: { parkCode: rep.parkCode || undefined, tab: 'reports', targetId: rep.id },
    })
  }

  // 2. Incidents
  for (const inc of incidents) {
    if (filterParkCode && inc.parkCode && inc.parkCode !== filterParkCode) continue
    const timeVal = inc.reportedAt || inc.createdAt
    const rawTime = timeVal ? new Date(timeVal).getTime() : 0
    const isHighSev = inc.severity === 'CRITICAL' || inc.severity === 'HIGH'

    items.push({
      id: `inc-${inc.id}`,
      title: `${inc.incidentCode}: ${inc.title}`,
      location: inc.parkName || 'KCN',
      time: formatRelativeTime(timeVal, nowMs),
      rawTime: Number.isFinite(rawTime) ? rawTime : 0,
      detail: `Sự cố kỹ thuật · Mức độ: ${formatSeverity(inc.severity)} · Trạng thái: ${formatIncidentStatus(inc.currentStatus)}${inc.locationDetail ? ` · ${inc.locationDetail}` : ''}`,
      badgeLabel: formatIncidentStatus(inc.currentStatus),
      badgeTone: formatIncidentStatusTone(inc.currentStatus),
      dotColor: isHighSev ? 'var(--color-negative)' : 'var(--color-warning)',
      view: 'maintenance',
      context: { parkCode: inc.parkCode || undefined, tab: 'incidents', targetId: inc.id },
    })
  }

  // 3. Maintenance Orders
  for (const ord of orders) {
    if (filterParkCode && ord.parkCode && ord.parkCode !== filterParkCode) continue
    const timeVal = ord.completedAt || ord.scheduledStart || ord.createdAt
    const rawTime = timeVal ? new Date(timeVal).getTime() : 0

    items.push({
      id: `ord-${ord.id}`,
      title: `${ord.orderCode}: ${ord.title}`,
      location: ord.parkName || 'KCN',
      time: formatRelativeTime(timeVal, nowMs),
      rawTime: Number.isFinite(rawTime) ? rawTime : 0,
      detail: `Lệnh bảo dưỡng (${formatOrderType(ord.orderType)}) · Phụ trách: ${ord.assignedTo || 'Chưa phân công'}${ord.assetName ? ` · ${ord.assetName}` : ''}`,
      badgeLabel: formatOrderStatus(ord.status),
      badgeTone: formatOrderStatusTone(ord.status),
      dotColor: ord.status === 'COMPLETED' ? 'var(--color-positive)' : ord.status === 'IN_PROGRESS' ? 'var(--color-info)' : 'var(--color-warning)',
      view: 'maintenance',
      context: { parkCode: ord.parkCode || undefined, tab: 'orders', targetId: ord.id },
    })
  }

  // 4. Projects
  for (const proj of projects) {
    if (filterParkCode && proj.parkCode && proj.parkCode !== filterParkCode) continue
    const timeVal = proj.startDate || proj.updatedAt
    const rawTime = timeVal ? new Date(timeVal).getTime() : 0
    const est = proj.estimatedBudget || 0
    const act = proj.actualCost || 0
    const rate = est > 0 ? (act / est) * 100 : 0

    items.push({
      id: `proj-${proj.id}`,
      title: `${proj.projectCode}: ${proj.projectName}`,
      location: proj.parkName || 'KCN',
      time: formatRelativeTime(timeVal, nowMs),
      rawTime: Number.isFinite(rawTime) ? rawTime : 0,
      detail: `Dự án hạ tầng · Giải ngân: ${rate.toFixed(1)}% · Giai đoạn: ${proj.currentMilestone || 'Đang thi công'}`,
      badgeLabel: proj.status === 'COMPLETED' ? 'Hoàn thành' : proj.status === 'IN_PROGRESS' ? 'Đang thi công' : 'Chuẩn bị',
      badgeTone: proj.status === 'COMPLETED' ? 'positive' : 'info',
      dotColor: 'var(--color-info)',
      view: 'finance',
      context: { parkCode: proj.parkCode || undefined, tab: 'projects', targetId: proj.id },
    })
  }

  // 5. Automatic Monitoring Data
  if (monitoring?.source?.currentMeasuredAt) {
    const timeVal = monitoring.source.currentMeasuredAt
    const rawTime = new Date(timeVal).getTime()
    items.push({
      id: 'monitoring-sync',
      title: 'Đồng bộ dữ liệu trạm quan trắc tự động Premier',
      location: filterParkName || 'Toàn bộ 3 KCN',
      time: formatRelativeTime(timeVal, nowMs),
      rawTime: Number.isFinite(rawTime) ? rawTime : 0,
      detail: 'Chỉ số COD, TSS, pH tại các trạm quan trắc tự động liên tục đạt chuẩn QCVN 40:2011/BTNMT',
      badgeLabel: 'Quan trắc tự động',
      badgeTone: 'positive',
      dotColor: 'var(--color-positive)',
      view: 'monitoring',
      context: { parkCode: filterParkCode || undefined },
    })
  }

  return items
    .filter((item) => item.rawTime > 0)
    .sort((a, b) => b.rawTime - a.rawTime)
    .slice(0, limit)
}
