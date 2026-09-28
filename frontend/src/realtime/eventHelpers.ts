import type {
  NotificationItem,
  RealtimeEvent,
  RefreshScope,
} from './types.js'

export function parseRealtimeEvent(raw: string): RealtimeEvent | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.id === 'string' &&
      typeof parsed.type === 'string' &&
      typeof parsed.entityType === 'string' &&
      typeof parsed.action === 'string'
    ) {
      return parsed as RealtimeEvent
    }
  } catch {
    // Malformed JSON
  }
  return null
}

export function isDuplicateEvent(eventId: string, seenSet: Set<string>): boolean {
  if (!eventId) return false
  return seenSet.has(eventId)
}

export function recordEventId(eventId: string, seenSet: Set<string>, maxSize = 100): void {
  if (!eventId) return
  if (seenSet.size >= maxSize) {
    const firstItem = seenSet.values().next().value
    if (firstItem !== undefined) {
      seenSet.delete(firstItem)
    }
  }
  seenSet.add(eventId)
}

export function mapEventToRefreshTargets(event: RealtimeEvent): RefreshScope[] {
  const scopes: RefreshScope[] = []

  switch (event.entityType) {
    case 'field_report':
      scopes.push('field_reports')
      if (event.action === 'CONVERT') {
        if (event.data?.linkedIncidentId || event.data?.linkedIncidentCode) {
          scopes.push('incidents')
        }
        if (event.data?.linkedOrderId || event.data?.linkedOrderCode) {
          scopes.push('work_orders')
        }
      }
      break
    case 'incident':
      scopes.push('incidents')
      break
    case 'work_order':
      scopes.push('work_orders')
      break
    case 'infrastructure_asset':
      scopes.push('infrastructure_assets')
      break
    case 'infrastructure_project':
      scopes.push('infrastructure_projects')
      break
  }

  return scopes
}

export function formatSeverityLabel(sev?: string): string {
  switch (String(sev || '').toUpperCase()) {
    case 'CRITICAL': return 'Khẩn cấp'
    case 'HIGH': return 'Cao'
    case 'MEDIUM': return 'Trung bình'
    case 'LOW': return 'Thấp'
    default: return 'Chưa xác định'
  }
}

export function formatCategoryLabel(cat?: string): string {
  switch (String(cat || '').toUpperCase()) {
    case 'INCIDENT': return 'Sự cố / Nguy cơ'
    case 'INSPECTION': return 'Kiểm tra hiện trường'
    case 'OPERATIONS': return 'Vận hành / Bảo dưỡng'
    case 'PROGRESS': return 'Tiến độ công việc'
    case 'ENTERPRISE_ACTIVITY': return 'Hoạt động doanh nghiệp'
    case 'NOTICE': return 'Thông báo / Chỉ đạo'
    case 'PENDING_CLASSIFICATION': return 'Chờ phân loại'
    default: return 'Chờ phân loại'
  }
}

export function formatFieldReportStatusLabel(status?: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'NEW': return 'Mới tiếp nhận'
    case 'REVIEWED': return 'Đã xem'
    case 'CONVERTED': return 'Đã chuyển đổi'
    case 'ARCHIVED': return 'Lưu trữ'
    default: return status || ''
  }
}

export function formatIncidentStatusLabel(status?: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'OPEN': return 'Mới ghi nhận'
    case 'INVESTIGATING': return 'Đang khảo sát'
    case 'IN_PROGRESS': return 'Đang xử lý'
    case 'RESOLVED': return 'Đã xử lý'
    case 'CLOSED': return 'Đã đóng nghiệm thu'
    default: return status || ''
  }
}

export function formatWorkOrderStatusLabel(status?: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED': return 'Đã nghiệm thu'
    case 'IN_PROGRESS': return 'Đang thi công'
    case 'PENDING': return 'Chờ triển khai'
    case 'CANCELLED': return 'Đã hủy'
    default: return status || ''
  }
}

export function formatPriorityLabel(priority?: string): string {
  switch (String(priority || '').toUpperCase()) {
    case 'URGENT': return 'Khẩn'
    case 'HIGH': return 'Cao'
    case 'NORMAL': return 'Bình thường'
    case 'LOW': return 'Thấp'
    default: return priority || ''
  }
}

export function mapEventToNotification(event: RealtimeEvent): NotificationItem {
  const d = event.data ?? {}
  const rawSeverity = String(d.severity || '').toUpperCase()
  const severity = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawSeverity)
    ? rawSeverity
    : undefined) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined

  const isCritical = severity === 'CRITICAL' || d.priority === 'URGENT'
  const isHigh = severity === 'HIGH' || d.priority === 'HIGH'

  let badge = 'Cập nhật'
  let title = d.title || (d.code ? `Bản ghi ${d.code}` : 'Thông tin mới')
  let subtitle = ''
  let viewTarget: 'maintenance' | 'infrastructure' = 'maintenance'
  let tabTarget = 'reports'
  let canOpenDetail = event.action !== 'DELETE'

  const parkLabel = d.parkName || d.parkCode || ''
  const reporter = d.reporterName ? `Người báo: ${d.reporterName}` : ''

  switch (event.type) {
    case 'field_report.created':
      badge = 'Báo cáo mới'
      title = d.title ? String(d.title) : 'Báo cáo hiện trường mới'
      subtitle = [parkLabel, reporter].filter(Boolean).join(' · ')
      viewTarget = 'maintenance'
      tabTarget = 'reports'
      break

    case 'field_report.updated':
      badge = 'Cập nhật báo cáo'
      title = d.code ? `${d.code} · ${d.title || 'Đã cập nhật trạng thái'}` : (d.title ? String(d.title) : 'Cập nhật báo cáo')
      subtitle = [parkLabel, d.status ? `Trạng thái: ${formatFieldReportStatusLabel(d.status)}` : ''].filter(Boolean).join(' · ')
      viewTarget = 'maintenance'
      tabTarget = 'reports'
      break

    case 'field_report.deleted':
      badge = 'Báo cáo đã xóa'
      title = d.code ? `${d.code} · ${d.title || 'Đã xóa'}` : (d.title ? String(d.title) : 'Báo cáo đã bị xóa')
      subtitle = 'Thao tác bởi Admin dữ liệu'
      viewTarget = 'maintenance'
      tabTarget = 'reports'
      canOpenDetail = false
      break

    case 'field_report.converted':
      badge = 'Đã chuyển đổi'
      title = d.code ? `${d.code} đã được chuyển đổi` : 'Báo cáo đã chuyển đổi'
      if (d.linkedIncidentCode) {
        subtitle = `Chuyển thành Sự cố ${d.linkedIncidentCode}`
        viewTarget = 'maintenance'
        tabTarget = 'incidents'
      } else if (d.linkedOrderCode) {
        subtitle = `Chuyển thành Lệnh bảo dưỡng ${d.linkedOrderCode}`
        viewTarget = 'maintenance'
        tabTarget = 'orders'
      } else {
        subtitle = 'Đã hoàn tất chuyển đổi xử lý'
        viewTarget = 'maintenance'
        tabTarget = 'reports'
      }
      break

    case 'incident.created':
      badge = 'Sự cố mới'
      title = d.code ? `${d.code} · ${d.title || 'Sự cố mới'}` : (d.title ? String(d.title) : 'Sự cố hạ tầng mới')
      subtitle = [parkLabel, severity ? `Mức: ${formatSeverityLabel(severity)}` : ''].filter(Boolean).join(' · ')
      viewTarget = 'maintenance'
      tabTarget = 'incidents'
      break

    case 'incident.updated':
      badge = 'Cập nhật sự cố'
      title = d.code ? `${d.code} · ${d.title || 'Đã cập nhật'}` : (d.title ? String(d.title) : 'Cập nhật sự cố')
      subtitle = d.status ? `Trạng thái: ${formatIncidentStatusLabel(d.status)}` : (parkLabel || '')
      viewTarget = 'maintenance'
      tabTarget = 'incidents'
      break

    case 'incident.deleted':
      badge = 'Sự cố đã xóa'
      title = d.code ? `${d.code} · ${d.title || 'Đã xóa'}` : 'Sự cố đã bị xóa'
      subtitle = 'Đã cập nhật danh mục sự cố'
      viewTarget = 'maintenance'
      tabTarget = 'incidents'
      canOpenDetail = false
      break

    case 'work_order.created':
      badge = 'Lệnh bảo dưỡng mới'
      title = d.code ? `${d.code} · ${d.title || 'Lệnh mới'}` : (d.title ? String(d.title) : 'Lệnh duy tu bảo dưỡng mới')
      subtitle = [d.priority ? `Ưu tiên: ${formatPriorityLabel(d.priority)}` : '', d.status ? `TT: ${formatWorkOrderStatusLabel(d.status)}` : ''].filter(Boolean).join(' · ')
      viewTarget = 'maintenance'
      tabTarget = 'orders'
      break

    case 'work_order.updated':
      badge = 'Cập nhật lệnh bảo dưỡng'
      title = d.code ? `${d.code} · ${d.title || 'Đã cập nhật'}` : (d.title ? String(d.title) : 'Cập nhật lệnh bảo dưỡng')
      subtitle = d.status ? `Trạng thái: ${formatWorkOrderStatusLabel(d.status)}` : ''
      viewTarget = 'maintenance'
      tabTarget = 'orders'
      break

    case 'work_order.deleted':
      badge = 'Lệnh bảo dưỡng đã xóa'
      title = d.code ? `${d.code} · ${d.title || 'Đã xóa'}` : 'Lệnh bảo dưỡng đã bị xóa'
      subtitle = 'Đã cập nhật danh mục lệnh công việc'
      viewTarget = 'maintenance'
      tabTarget = 'orders'
      canOpenDetail = false
      break

    case 'infrastructure_asset.created':
    case 'infrastructure_asset.updated':
      badge = event.type === 'infrastructure_asset.created' ? 'Hạ tầng mới' : 'Cập nhật hạ tầng'
      title = d.code ? `${d.code} · ${d.title || 'Công trình hạ tầng'}` : (d.title ? String(d.title) : 'Công trình hạ tầng')
      subtitle = parkLabel || ''
      viewTarget = 'infrastructure'
      tabTarget = 'assets'
      break

    case 'infrastructure_asset.deleted':
      badge = 'Hạ tầng đã xóa'
      title = d.code ? `${d.code} · ${d.title || 'Đã xóa'}` : 'Công trình hạ tầng đã bị xóa'
      subtitle = 'Đã cập nhật danh mục công trình'
      viewTarget = 'infrastructure'
      tabTarget = 'assets'
      canOpenDetail = false
      break

    case 'infrastructure_project.created':
    case 'infrastructure_project.updated':
      badge = event.type === 'infrastructure_project.created' ? 'Dự án mới' : 'Cập nhật dự án'
      title = d.code ? `${d.code} · ${d.title || 'Dự án hạ tầng'}` : (d.title ? String(d.title) : 'Dự án hạ tầng')
      subtitle = parkLabel || ''
      viewTarget = 'infrastructure'
      tabTarget = 'projects'
      break

    case 'infrastructure_project.deleted':
      badge = 'Dự án đã xóa'
      title = d.code ? `${d.code} · ${d.title || 'Đã xóa'}` : 'Dự án hạ tầng đã bị xóa'
      subtitle = 'Đã cập nhật danh mục dự án'
      viewTarget = 'infrastructure'
      tabTarget = 'projects'
      canOpenDetail = false
      break
  }

  return {
    id: `notif-${event.id}`,
    eventId: event.id,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    badge,
    title,
    subtitle: subtitle || 'Thông tin vừa cập nhật',
    severity,
    isCritical: !!isCritical,
    isHigh: !!isHigh,
    viewTarget,
    tabTarget,
    canOpenDetail,
    createdAt: Date.now(),
  }
}

export function enqueueNotification(
  queue: NotificationItem[],
  newItem: NotificationItem,
  maxQueueSize = 5,
): NotificationItem[] {
  // Deduplicate
  const filtered = queue.filter((item) => item.eventId !== newItem.eventId)

  let updated: NotificationItem[]
  if (newItem.isCritical || newItem.isHigh) {
    // Put critical/high priority items at the beginning
    updated = [newItem, ...filtered]
  } else {
    // Standard FIFO append
    updated = [...filtered, newItem]
  }

  return updated.slice(0, maxQueueSize)
}

export function getNotificationClickAction(item: NotificationItem): {
  view: 'maintenance' | 'infrastructure'
  tab: string
  openDetailId: string | null
} {
  return {
    view: item.viewTarget,
    tab: item.tabTarget,
    openDetailId: item.canOpenDetail ? item.entityId : null,
  }
}
