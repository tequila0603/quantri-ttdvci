import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatRelativeTime,
  formatFieldReportCategory,
  formatFieldReportCategoryTone,
  formatSeverity,
  formatIncidentStatus,
  formatOrderStatus,
  formatOrderType,
  buildRecentActivities,
} from '../src/utils/recentActivities.ts'

test('formatRelativeTime handles null, undefined and invalid dates safely', () => {
  assert.equal(formatRelativeTime(null), 'Chưa có')
  assert.equal(formatRelativeTime(undefined), 'Chưa có')
  assert.equal(formatRelativeTime(''), 'Chưa có')
  assert.equal(formatRelativeTime('invalid-date'), 'invalid-date')
})

test('formatRelativeTime calculates correct Vietnamese relative labels', () => {
  const baseNow = new Date('2026-09-15T15:00:00.000Z').getTime()

  // Future / Clock skew
  assert.equal(formatRelativeTime('2026-09-15T15:01:00.000Z', baseNow), 'Vừa xong')

  // Under 60 seconds
  assert.equal(formatRelativeTime('2026-09-15T14:59:45.000Z', baseNow), 'Vừa xong')

  // Minutes
  assert.equal(formatRelativeTime('2026-09-15T14:45:00.000Z', baseNow), '15 phút trước')
  assert.equal(formatRelativeTime('2026-09-15T14:02:00.000Z', baseNow), '58 phút trước')

  // Hours
  assert.equal(formatRelativeTime('2026-09-15T12:00:00.000Z', baseNow), '3 giờ trước')
  assert.equal(formatRelativeTime('2026-09-14T18:00:00.000Z', baseNow), '21 giờ trước')

  // Yesterday
  assert.equal(formatRelativeTime('2026-09-14T10:00:00.000Z', baseNow), 'Hôm qua')

  // Days (2 - 6 days)
  assert.equal(formatRelativeTime('2026-09-12T10:00:00.000Z', baseNow), '3 ngày trước')
  assert.equal(formatRelativeTime('2026-09-10T10:00:00.000Z', baseNow), '5 ngày trước')

  // Over 7 days -> DD/MM/YYYY
  const olderDate = new Date('2026-09-01T10:00:00.000Z')
  const formatted = formatRelativeTime(olderDate.toISOString(), baseNow)
  assert.match(formatted, /^\d{2}\/\d{2}\/\d{4}$/)
})

test('formatFieldReportCategory and tones match standard Vietnamese domain values', () => {
  assert.equal(formatFieldReportCategory('INCIDENT'), 'Sự cố / Nguy cơ')
  assert.equal(formatFieldReportCategoryTone('INCIDENT'), 'negative')

  assert.equal(formatFieldReportCategory('INSPECTION'), 'Kiểm tra hiện trường')
  assert.equal(formatFieldReportCategoryTone('INSPECTION'), 'info')

  assert.equal(formatFieldReportCategory('OPERATIONS'), 'Vận hành / Bảo dưỡng')
  assert.equal(formatFieldReportCategoryTone('OPERATIONS'), 'positive')

  assert.equal(formatFieldReportCategory('PROGRESS'), 'Tiến độ công việc')
  assert.equal(formatFieldReportCategoryTone('PROGRESS'), 'warning')

  assert.equal(formatFieldReportCategory('ENTERPRISE_ACTIVITY'), 'Hoạt động doanh nghiệp')
  assert.equal(formatFieldReportCategoryTone('ENTERPRISE_ACTIVITY'), 'info')

  assert.equal(formatFieldReportCategory('NOTICE'), 'Thông báo / Chỉ đạo')
  assert.equal(formatFieldReportCategoryTone('NOTICE'), 'warning')

  assert.equal(formatFieldReportCategory('PENDING_CLASSIFICATION'), 'Chờ phân loại')
  assert.equal(formatFieldReportCategoryTone('PENDING_CLASSIFICATION'), 'neutral')

  // Unknown fallback
  assert.equal(formatFieldReportCategory('UNKNOWN_XYZ'), 'Chờ phân loại')
  assert.equal(formatFieldReportCategoryTone('UNKNOWN_XYZ'), 'neutral')
})

test('formatIncidentStatus, formatOrderStatus, formatOrderType return standardized Vietnamese labels', () => {
  assert.equal(formatIncidentStatus('OPEN'), 'Mới ghi nhận')
  assert.equal(formatIncidentStatus('IN_PROGRESS'), 'Đang xử lý')
  assert.equal(formatIncidentStatus('RESOLVED'), 'Đã xử lý')
  assert.equal(formatIncidentStatus('CLOSED'), 'Đã đóng nghiệm thu')

  assert.equal(formatOrderStatus('PENDING'), 'Chờ triển khai')
  assert.equal(formatOrderStatus('IN_PROGRESS'), 'Đang thi công')
  assert.equal(formatOrderStatus('COMPLETED'), 'Đã nghiệm thu')

  assert.equal(formatOrderType('ROUTINE'), 'Bảo dưỡng định kỳ')
  assert.equal(formatOrderType('CORRECTIVE'), 'Sửa chữa khắc phục')
  assert.equal(formatOrderType('EMERGENCY'), 'Ứng phó khẩn cấp')
  assert.equal(formatOrderType('UPGRADE'), 'Cải tạo nâng cấp')
})

test('buildRecentActivities aggregates feeds and sorts strictly descending by timestamp', () => {
  const baseNow = new Date('2026-09-15T15:00:00.000Z').getTime()

  const fieldReports = [
    {
      id: 'rep-1',
      reportCode: 'BC-2026-009',
      title: 'Hệ thống thoát nước mưa Hào Hưng',
      reporterName: 'Huỳnh Hữu Hợp',
      parkName: 'KCN Sông Cầu',
      parkCode: 'KCN_ONG_BAC_SONG_CAU_KV1',
      category: 'INCIDENT',
      reportedAt: '2026-09-15T14:45:00.000Z', // 15 mins ago
    },
    {
      id: 'rep-2',
      reportCode: 'BC-2026-008',
      title: 'Cổng cty Phúc Nguyên bị hỏng',
      reporterName: 'Phạm Văn Cẩm',
      parkName: 'KCN Hòa Hiệp 1',
      parkCode: 'KCN_HOA_HIEP_1',
      category: 'OPERATIONS',
      reportedAt: '2026-09-15T10:00:00.000Z', // 5 hours ago
    },
  ]

  const incidents = [
    {
      id: 'inc-1',
      incidentCode: 'SC-2026-01',
      title: 'Chập điện trạm biến áp An Phú',
      parkName: 'KCN An Phú',
      parkCode: 'KCN_AN_PHU',
      severity: 'CRITICAL',
      currentStatus: 'IN_PROGRESS',
      reportedAt: '2026-09-15T14:55:00.000Z', // 5 mins ago (NEWEST)
    },
  ]

  const orders = [
    {
      id: 'ord-1',
      orderCode: 'WO-2026-88',
      title: 'Bảo dưỡng máy bơm số 2',
      parkName: 'KCN Hòa Hiệp 1',
      parkCode: 'KCN_HOA_HIEP_1',
      orderType: 'ROUTINE',
      assignedTo: 'Anh Tuấn',
      status: 'IN_PROGRESS',
      scheduledStart: '2026-09-15T12:00:00.000Z', // 3 hours ago
    },
  ]

  const projects = [
    {
      id: 'proj-1',
      projectCode: 'DA-2026-03',
      projectName: 'San nền KCN Hòa Hiệp 1',
      parkName: 'KCN Hòa Hiệp 1',
      parkCode: 'KCN_HOA_HIEP_1',
      status: 'IN_PROGRESS',
      startDate: '2026-09-10T08:00:00.000Z', // 5 days ago
      actualCost: 500000000,
      estimatedBudget: 1000000000,
    },
  ]

  const monitoring = {
    source: {
      currentMeasuredAt: '2026-09-15T14:30:00.000Z', // 30 mins ago
    },
  }

  const activities = buildRecentActivities({
    fieldReports,
    incidents,
    orders,
    projects,
    monitoring,
    nowMs: baseNow,
    limit: 6,
  })

  assert.equal(activities.length, 6)

  // 1st: inc-1 (14:55)
  assert.equal(activities[0].id, 'inc-inc-1')
  assert.equal(activities[0].title, 'SC-2026-01: Chập điện trạm biến áp An Phú')
  assert.equal(activities[0].badgeTone, 'info') // in progress

  // 2nd: rep-1 (14:45)
  assert.equal(activities[1].id, 'rep-rep-1')
  assert.equal(activities[1].badgeLabel, 'Sự cố / Nguy cơ')
  assert.equal(activities[1].badgeTone, 'negative')

  // 3rd: monitoring (14:30)
  assert.equal(activities[2].id, 'monitoring-sync')
  assert.equal(activities[2].time, '30 phút trước')

  // 4th: ord-1 (12:00)
  assert.equal(activities[3].id, 'ord-ord-1')
  assert.equal(activities[3].time, '3 giờ trước')

  // 5th: rep-2 (10:00)
  assert.equal(activities[4].id, 'rep-rep-2')
  assert.equal(activities[4].time, '5 giờ trước')

  // 6th: proj-1 (5 days ago)
  assert.equal(activities[5].id, 'proj-proj-1')
  assert.equal(activities[5].time, '5 ngày trước')
})

test('buildRecentActivities filters by parkCode when specified', () => {
  const fieldReports = [
    {
      id: 'rep-1',
      reportCode: 'BC-2026-009',
      title: 'Tin Sông Cầu',
      parkCode: 'KCN_ONG_BAC_SONG_CAU_KV1',
      parkName: 'KCN Sông Cầu',
      reportedAt: '2026-09-15T14:00:00.000Z',
    },
    {
      id: 'rep-2',
      reportCode: 'BC-2026-008',
      title: 'Tin Hòa Hiệp 1',
      parkCode: 'KCN_HOA_HIEP_1',
      parkName: 'KCN Hòa Hiệp 1',
      reportedAt: '2026-09-15T13:00:00.000Z',
    },
  ]

  const incidents = [
    {
      id: 'inc-1',
      incidentCode: 'SC-1',
      title: 'Sự cố Hòa Hiệp 1',
      parkCode: 'KCN_HOA_HIEP_1',
      parkName: 'KCN Hòa Hiệp 1',
      reportedAt: '2026-09-15T12:00:00.000Z',
    },
  ]

  const filtered = buildRecentActivities({
    fieldReports,
    incidents,
    filterParkCode: 'KCN_HOA_HIEP_1',
  })

  assert.equal(filtered.length, 2)
  assert.equal(filtered.some((item) => item.title.includes('Sông Cầu')), false)
  assert.equal(filtered.every((item) => item.location === 'KCN Hòa Hiệp 1'), true)
})
