import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseRealtimeEvent,
  isDuplicateEvent,
  recordEventId,
  mapEventToRefreshTargets,
  mapEventToNotification,
  enqueueNotification,
  getNotificationClickAction,
  formatSeverityLabel,
  formatCategoryLabel,
  formatFieldReportStatusLabel,
} from '../src/realtime/eventHelpers.ts'
import type { RealtimeEvent, NotificationItem } from '../src/realtime/types.ts'

test('parseRealtimeEvent parses valid event JSON', () => {
  const json = JSON.stringify({
    id: 'evt-1',
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: '101',
    action: 'CREATE',
    occurredAt: '2026-09-15T08:00:00.000Z',
    data: { title: 'Báo cáo mới', parkCode: 'KCN_AN_PHU' },
  })
  const event = parseRealtimeEvent(json)
  assert.notEqual(event, null)
  assert.equal(event?.id, 'evt-1')
  assert.equal(event?.type, 'field_report.created')
  assert.equal(event?.data?.title, 'Báo cáo mới')
})

test('parseRealtimeEvent rejects invalid or malformed input', () => {
  assert.equal(parseRealtimeEvent(''), null)
  assert.equal(parseRealtimeEvent('not json'), null)
  assert.equal(parseRealtimeEvent('{}'), null) // missing required fields
  assert.equal(parseRealtimeEvent(JSON.stringify({ id: '1' })), null)
})

test('isDuplicateEvent and recordEventId deduplicate correctly with capped size', () => {
  const seen = new Set<string>()
  assert.equal(isDuplicateEvent('evt-1', seen), false)

  recordEventId('evt-1', seen, 3)
  assert.equal(isDuplicateEvent('evt-1', seen), true)
  assert.equal(isDuplicateEvent('evt-2', seen), false)

  recordEventId('evt-2', seen, 3)
  recordEventId('evt-3', seen, 3)
  assert.equal(seen.size, 3)

  // Adding 4th item when max is 3 should evict the oldest item 'evt-1'
  recordEventId('evt-4', seen, 3)
  assert.equal(seen.size, 3)
  assert.equal(isDuplicateEvent('evt-1', seen), false) // Evicted!
  assert.equal(isDuplicateEvent('evt-4', seen), true)
})

test('mapEventToRefreshTargets returns correct scopes', () => {
  const reportEvent: RealtimeEvent = {
    id: '1',
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: '10',
    action: 'CREATE',
    occurredAt: new Date().toISOString(),
  }
  assert.deepEqual(mapEventToRefreshTargets(reportEvent), ['field_reports'])

  const convertToIncidentEvent: RealtimeEvent = {
    id: '2',
    type: 'field_report.converted',
    entityType: 'field_report',
    entityId: '10',
    action: 'CONVERT',
    occurredAt: new Date().toISOString(),
    data: { linkedIncidentId: '99', linkedIncidentCode: 'SC-2026-001' },
  }
  assert.deepEqual(mapEventToRefreshTargets(convertToIncidentEvent), ['field_reports', 'incidents'])

  const incidentEvent: RealtimeEvent = {
    id: '3',
    type: 'incident.created',
    entityType: 'incident',
    entityId: '20',
    action: 'CREATE',
    occurredAt: new Date().toISOString(),
  }
  assert.deepEqual(mapEventToRefreshTargets(incidentEvent), ['incidents'])

  const woEvent: RealtimeEvent = {
    id: '4',
    type: 'work_order.updated',
    entityType: 'work_order',
    entityId: '30',
    action: 'UPDATE',
    occurredAt: new Date().toISOString(),
  }
  assert.deepEqual(mapEventToRefreshTargets(woEvent), ['work_orders'])

  const assetEvent: RealtimeEvent = {
    id: '5',
    type: 'infrastructure_asset.deleted',
    entityType: 'infrastructure_asset',
    entityId: '40',
    action: 'DELETE',
    occurredAt: new Date().toISOString(),
  }
  assert.deepEqual(mapEventToRefreshTargets(assetEvent), ['infrastructure_assets'])
})

test('mapEventToNotification formats Vietnamese text and detects CRITICAL/HIGH priority', () => {
  const criticalIncident: RealtimeEvent = {
    id: 'crit-1',
    type: 'incident.created',
    entityType: 'incident',
    entityId: '99',
    action: 'CREATE',
    occurredAt: new Date().toISOString(),
    data: {
      code: 'SC-2026-005',
      title: 'Cháy trạm biến áp',
      parkName: 'KCN Hoà Hiệp 1',
      severity: 'CRITICAL',
    },
  }

  const notif = mapEventToNotification(criticalIncident)
  assert.equal(notif.isCritical, true)
  assert.equal(notif.badge, 'Sự cố mới')
  assert.match(notif.title, /SC-2026-005/)
  assert.match(notif.subtitle, /KCN Hoà Hiệp 1/)
  assert.equal(notif.canOpenDetail, true)
  assert.equal(notif.viewTarget, 'maintenance')
  assert.equal(notif.tabTarget, 'incidents')
})

test('mapEventToNotification disables detail opening for DELETE events', () => {
  const deleteReport: RealtimeEvent = {
    id: 'del-1',
    type: 'field_report.deleted',
    entityType: 'field_report',
    entityId: '10',
    action: 'DELETE',
    occurredAt: new Date().toISOString(),
    data: {
      code: 'BC-2026-001',
      title: 'Báo cáo mẫu',
    },
  }

  const notif = mapEventToNotification(deleteReport)
  assert.equal(notif.canOpenDetail, false)
  assert.equal(notif.badge, 'Báo cáo đã xóa')
  assert.match(notif.subtitle, /Admin dữ liệu/)

  const clickAction = getNotificationClickAction(notif)
  assert.equal(clickAction.view, 'maintenance')
  assert.equal(clickAction.tab, 'reports')
  assert.equal(clickAction.openDetailId, null) // Must NOT open detail of deleted record!
})

test('enqueueNotification prioritizes CRITICAL/HIGH and caps queue size', () => {
  let queue: NotificationItem[] = []

  const item1: NotificationItem = {
    id: '1',
    eventId: 'e1',
    entityType: 'field_report',
    entityId: '1',
    action: 'CREATE',
    badge: 'Mới',
    title: 'Báo cáo 1',
    subtitle: '',
    isCritical: false,
    isHigh: false,
    viewTarget: 'maintenance',
    tabTarget: 'reports',
    canOpenDetail: true,
    createdAt: 1,
  }

  const item2: NotificationItem = {
    ...item1,
    id: '2',
    eventId: 'e2',
    title: 'Báo cáo 2',
  }

  const criticalItem: NotificationItem = {
    ...item1,
    id: '3',
    eventId: 'e3',
    title: 'SỰ CỐ KHẨN CẤP',
    isCritical: true,
  }

  queue = enqueueNotification(queue, item1, 3)
  queue = enqueueNotification(queue, item2, 3)
  assert.equal(queue[0].id, '1')
  assert.equal(queue[1].id, '2')

  // Critical item should jump to front
  queue = enqueueNotification(queue, criticalItem, 3)
  assert.equal(queue[0].id, '3')
  assert.equal(queue[1].id, '1')
  assert.equal(queue[2].id, '2')

  // Adding 4th item when max is 3 should cap queue size
  const item4: NotificationItem = { ...item1, id: '4', eventId: 'e4', title: 'Báo cáo 4' }
  queue = enqueueNotification(queue, item4, 3)
  assert.equal(queue.length, 3)
})

test('formatCategoryLabel and formatSeverityLabel standardize Vietnamese labels', () => {
  assert.equal(formatCategoryLabel('INCIDENT'), 'Sự cố / Nguy cơ')
  assert.equal(formatCategoryLabel('INSPECTION'), 'Kiểm tra hiện trường')
  assert.equal(formatCategoryLabel('OPERATIONS'), 'Vận hành / Bảo dưỡng')
  assert.equal(formatCategoryLabel('PROGRESS'), 'Tiến độ công việc')
  assert.equal(formatCategoryLabel('ENTERPRISE_ACTIVITY'), 'Hoạt động doanh nghiệp')
  assert.equal(formatCategoryLabel('NOTICE'), 'Thông báo / Chỉ đạo')
  assert.equal(formatCategoryLabel('PENDING_CLASSIFICATION'), 'Chờ phân loại')
  assert.equal(formatCategoryLabel('UNKNOWN'), 'Chờ phân loại')
  assert.equal(formatCategoryLabel(''), 'Chờ phân loại')

  assert.equal(formatSeverityLabel('LOW'), 'Thấp')
  assert.equal(formatSeverityLabel('MEDIUM'), 'Trung bình')
  assert.equal(formatSeverityLabel('HIGH'), 'Cao')
  assert.equal(formatSeverityLabel('CRITICAL'), 'Khẩn cấp')
  assert.equal(formatSeverityLabel('UNKNOWN'), 'Chưa xác định')
  assert.equal(formatSeverityLabel(''), 'Chưa xác định')
})

test('mapEventToNotification uses Vietnamese labels without leaking English codes', () => {
  const updateEvent: RealtimeEvent = {
    id: 'upd-1',
    type: 'field_report.updated',
    entityType: 'field_report',
    entityId: '10',
    action: 'UPDATE',
    occurredAt: new Date().toISOString(),
    data: {
      code: 'BC-2026-001',
      title: 'Báo cáo sạt lở',
      status: 'REVIEWED',
      parkName: 'KCN An Phú',
    },
  }

  const notif = mapEventToNotification(updateEvent)
  assert.match(notif.subtitle, /Trạng thái: Đã xem/)
  assert.doesNotMatch(notif.subtitle, /REVIEWED/)
})

