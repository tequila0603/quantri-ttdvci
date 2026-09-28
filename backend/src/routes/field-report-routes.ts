import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { authenticate, requireRole } from '../auth.js'
import type { Kysely } from 'kysely'
import type { Database } from '../db.js'
import type { DB } from '../db/schema.js'
import { ApiError } from '../errors.js'
import { recordAuditEvent } from '../audit.js'
import type { EventHub } from '../realtime/event-hub.js'
import { FieldReportRepository } from '../repositories/field-report.repo.js'

const ALLOWED_CATEGORIES = [
  'INCIDENT',
  'INSPECTION',
  'OPERATIONS',
  'PROGRESS',
  'ENTERPRISE_ACTIVITY',
  'NOTICE',
  'PENDING_CLASSIFICATION',
] as const
type FieldReportCategory = typeof ALLOWED_CATEGORIES[number]

const ALLOWED_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
type FieldReportSeverity = typeof ALLOWED_SEVERITIES[number]

const ALLOWED_STATUSES = ['NEW', 'REVIEWED', 'CONVERTED', 'ARCHIVED'] as const
type FieldReportStatus = typeof ALLOWED_STATUSES[number]

type FieldReportQuery = {
  parkCode?: string
  industrialParkId?: string
  category?: string
  severity?: string
  status?: string
  reporterName?: string
  search?: string
  fromDate?: string
  toDate?: string
  limit?: string
  afterId?: string
}

function computeFingerprint(params: {
  source: string
  parkId: string | number
  content: string
  reportedAt?: string
  sourceMessageKey?: string
}): string {
  const normContent = params.content.trim().toLowerCase().replace(/\s+/g, ' ')
  // Only include datePart if reportedAt is valid and non-empty. Never fall back to current scan time!
  const datePart = params.reportedAt && params.reportedAt.trim().length >= 10
    ? params.reportedAt.trim().substring(0, 10)
    : ''
  const keyPart = params.sourceMessageKey ? params.sourceMessageKey.trim() : ''
  const payload = `${params.source.trim().toUpperCase()}|${params.parkId}|${datePart}|${keyPart}|${normContent}`
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

export async function fieldReportRoutes(app: FastifyInstance, options: { database: Database; kyselyDatabase: Kysely<DB>; eventHub?: EventHub; testMode?: boolean }): Promise<void> {
  const auth = authenticate(options.database)
  const adminOnly = [auth, requireRole('DATA_ADMIN')]

  // ==========================================
  // 1. Quick Ingest (Dành cho Tool quét Zalo & Webhooks)
  // ==========================================
  app.post<{
    Body: {
      source?: string
      sourceMessageKey?: string
      rawReporter?: string
      reporterName?: string
      title: string
      content?: string
      parkCode: string
      locationDetail?: string
      category?: string
      severity?: string
      reportedAt?: string
    }
  }>('/quick-ingest', async (request, reply) => {
    const repo = new FieldReportRepository(options.kyselyDatabase);
    const apiKey = request.headers['x-api-key']
    const configuredKey = process.env.EXTENSION_API_KEY?.trim() || ''
    if (!configuredKey && !options.testMode) {
      return reply.status(503).send({
        success: false,
        error: { code: 'integration_not_configured', message: 'EXTENSION_API_KEY chưa được cấu hình trên máy chủ' },
      })
    }
    if (configuredKey && apiKey !== configuredKey) {
      return reply.status(401).send({
        success: false,
        error: { code: 'unauthorized', message: 'API Key không hợp lệ hoặc chưa được cấu hình' },
      })
    }

    const {
      source = 'ZALO_WEB',
      sourceMessageKey,
      rawReporter,
      reporterName,
      title,
      content,
      parkCode,
      locationDetail,
      category = 'OTHER',
      severity = 'MEDIUM',
      reportedAt,
    } = request.body ?? {}

    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    const cleanContent = typeof content === 'string' && content.trim() ? content.trim() : cleanTitle
    const cleanPark = typeof parkCode === 'string' ? parkCode.trim() : ''
    const cleanReporter = typeof reporterName === 'string' && reporterName.trim() ? reporterName.trim() : 'Chưa xác định'
    const cleanRawReporter = typeof rawReporter === 'string' && rawReporter.trim() ? rawReporter.trim() : null

    if (!cleanTitle) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: 'Tiêu đề báo cáo không được để trống' },
      })
    }

    const parkRow = await repo.findIndustrialParkByCode(cleanPark)
    if (!parkRow) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: `Khu công nghiệp [${cleanPark}] không tồn tại trong hệ thống` },
      })
    }
    const rawCategory = typeof category === 'string' ? category.trim() : ''
    const normalizedCategory = rawCategory === 'OTHER' ? 'PENDING_CLASSIFICATION' : rawCategory
    const validCategory: FieldReportCategory = ALLOWED_CATEGORIES.includes(normalizedCategory as any)
      ? (normalizedCategory as FieldReportCategory)
      : 'PENDING_CLASSIFICATION'
    const validSeverity: FieldReportSeverity = ALLOWED_SEVERITIES.includes(severity as any)
      ? (severity as FieldReportSeverity)
      : 'MEDIUM'

    const cleanLocation = typeof locationDetail === 'string' && locationDetail.trim() ? locationDetail.trim() : parkRow.name

    const fingerprint = computeFingerprint({
      source,
      parkId: parkRow.id,
      content: cleanContent,
      reportedAt,
      sourceMessageKey: sourceMessageKey ? String(sourceMessageKey) : undefined,
    })

    // Check duplicate by SHA-256 fingerprint and content fallback
    const existing = await repo.findDuplicate({
      fingerprint,
      parkId: parkRow.id,
      cleanContent,
      sourceMessageKey: sourceMessageKey ? String(sourceMessageKey) : undefined,
    })
    if (existing) {
      let needsUpdate = false
      const updateObj: any = {}

      // Backfill or synchronize source_fingerprint if missing or outdated
      if (!existing.source_fingerprint || existing.source_fingerprint !== fingerprint) {
        updateObj.source_fingerprint = fingerprint
        needsUpdate = true
      }

      // If valid historical reportedAt is provided and previous was missing, backfill reported_at
      if (reportedAt && typeof reportedAt === 'string' && reportedAt.trim().length >= 10) {
        if (!existing.reported_at) {
          updateObj.reported_at = reportedAt.trim()
          needsUpdate = true
        }
      }

      // If previous report had 'Chưa xác định' or 'Bạn' and now we have a real reporter name, backfill in-place
      const isCorruptedReporter = existing.reporter_name === 'Chưa xác định' || existing.reporter_name.toLowerCase() === 'bạn'
      const isValidNewReporter = cleanReporter !== 'Chưa xác định' && cleanReporter.toLowerCase() !== 'bạn'

      if (isCorruptedReporter && isValidNewReporter) {
        updateObj.reporter_name = cleanReporter
        if (cleanRawReporter && cleanRawReporter.toLowerCase() !== 'bạn') {
          updateObj.raw_reporter_name = cleanRawReporter
        }
        const isCorruptedTitle = existing.title.startsWith('Ahuỳnh') || existing.title.startsWith('AVăn') || existing.title.startsWith('Nguyễn Văn ĐôngTrạm')
        if (cleanTitle && isCorruptedTitle) {
          updateObj.title = cleanTitle
        }
        needsUpdate = true
      }

      if (needsUpdate && Object.keys(updateObj).length > 0) {
        await repo.updateReport(existing.id, updateObj)

        options.eventHub?.publish({
          type: 'field_report.updated',
          entityType: 'field_report',
          entityId: existing.id,
          action: 'UPDATE',
          data: {
            code: existing.report_code,
            title: updateObj.title || existing.title,
            parkCode: parkRow.code,
            parkName: parkRow.name,
            reporterName: updateObj.reporter_name || (isValidNewReporter ? cleanReporter : existing.reporter_name),
            status: existing.status,
          },
        })
      }

      return reply.status(200).send({
        success: true,
        data: {
          id: existing.id,
          reportCode: existing.report_code,
          title: cleanTitle || existing.title,
          parkCode: parkRow.code,
          parkName: parkRow.name,
          reporterName: isValidNewReporter ? cleanReporter : existing.reporter_name,
          status: existing.status,
          isDuplicate: true,
        },
        message: `Báo cáo [${existing.report_code}] có nội dung trùng khớp đã tồn tại trên hệ thống, không tạo mới.`,
      })
    }

    // Auto-generate report_code: BC-YYYY-NNN
    const currentYear = new Date().getFullYear()
    const nextNum = await repo.getNextReportSequence(String(currentYear))
    const reportCode = `BC-${currentYear}-${String(nextNum).padStart(3, '0')}`

    const created = await repo.createReport({
      report_code: reportCode,
      source,
      source_message_key: sourceMessageKey ? String(sourceMessageKey).trim() : null,
      source_fingerprint: fingerprint,
      raw_reporter_name: cleanRawReporter,
      reporter_name: cleanReporter,
      title: cleanTitle,
      content: cleanContent,
      industrial_park_id: parkRow.id,
      location_detail: cleanLocation,
      category: validCategory,
      severity: validSeverity,
      status: 'NEW',
      reported_at: reportedAt ? reportedAt.trim() : new Date().toISOString()
    })
    if (!created) {
      return reply.status(500).send({
        success: false,
        error: { code: 'insert_failed', message: 'Không thể khởi tạo bản ghi báo cáo hiện trường' },
      })
    }

    options.eventHub?.publish({
      type: 'field_report.created',
      entityType: 'field_report',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.report_code,
        title: created.title,
        parkCode: parkRow.code,
        parkName: parkRow.name,
        reporterName: cleanReporter,
        category: created.category,
        severity: created.severity,
        status: created.status,
      },
    })

    return reply.status(201).send({
      success: true,
      data: {
        id: created.id,
        reportCode: created.report_code,
        title: created.title,
        category: created.category,
        severity: created.severity,
        status: created.status,
        parkCode: parkRow.code,
        parkName: parkRow.name,
        reporterName: cleanReporter,
        reportedAt: created.reported_at,
        isDuplicate: false,
      },
      message: 'Tiếp nhận báo cáo hiện trường thành công',
    })
  })

  // ==========================================
  // 2. Danh sách Báo cáo hiện trường (GET /)
  // ==========================================
  app.get<{ Querystring: FieldReportQuery }>('/', { preHandler: auth }, async (request) => {
    const {
      parkCode,
      industrialParkId,
      category,
      severity,
      status,
      reporterName,
      search,
      fromDate,
      toDate,
      limit = '50',
      afterId,
      
    } = request.query

    const clauses: string[] = []
    const values: unknown[] = []

    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (industrialParkId) {
      values.push(industrialParkId)
      clauses.push(`r.industrial_park_id = $${values.length}`)
    }
    if (category) {
      values.push(category)
      clauses.push(`r.category = $${values.length}`)
    }
    if (severity) {
      values.push(severity)
      clauses.push(`r.severity = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`r.status = $${values.length}`)
    }
    if (reporterName) {
      values.push(`%${reporterName.trim()}%`)
      clauses.push(`r.reporter_name ILIKE $${values.length}`)
    }
    if (search && search.trim()) {
      values.push(`%${search.trim()}%`)
      const idx = values.length
      clauses.push(`(r.title ILIKE $${idx} OR r.content ILIKE $${idx} OR r.reporter_name ILIKE $${idx} OR r.report_code ILIKE $${idx})`)
    }
    if (fromDate) {
      values.push(fromDate)
      clauses.push(`r.reported_at >= $${values.length}::timestamptz`)
    }
    if (toDate) {
      values.push(toDate)
      clauses.push(`r.reported_at < ($${values.length}::date + interval '1 day')`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
    const parsedAfterId = afterId ? Number(afterId) : undefined

    // Query stats
    const statsRes = await options.database.query<{
      total_count: string
      new_count: string
      reviewed_count: string
      converted_count: string
      archived_count: string
    }>(
      `SELECT
         COUNT(*)::text AS total_count,
         COUNT(*) FILTER (WHERE status = 'NEW')::text AS new_count,
         COUNT(*) FILTER (WHERE status = 'REVIEWED')::text AS reviewed_count,
         COUNT(*) FILTER (WHERE status = 'CONVERTED')::text AS converted_count,
         COUNT(*) FILTER (WHERE status = 'ARCHIVED')::text AS archived_count
       FROM maintenance.field_reports r
       JOIN core.industrial_parks p ON p.id = r.industrial_park_id
       ${whereClause}`,
      values,
    )

    const statsRow = statsRes.rows[0]
    const totalCount = Number(statsRow?.total_count ?? 0)

    // Query data list
    values.push(parsedLimit)
    const limitParam = values.length

    const listRes = await options.database.query<{
      id: string
      report_code: string
      source: string
      source_message_key: string | null
      raw_reporter_name: string | null
      reporter_name: string
      title: string
      content: string
      park_id: string
      park_code: string
      park_name: string
      location_detail: string
      category: string
      severity: string
      status: string
      reported_at: string
      linked_incident_id: string | null
      linked_incident_code: string | null
      linked_work_order_id: string | null
      linked_work_order_code: string | null
      reviewed_by: string | null
      reviewed_at: string | null
      notes: string | null
      created_at: string
    }>(
      `SELECT
         r.id::text,
         r.report_code,
         r.source,
         r.source_message_key,
         r.raw_reporter_name,
         r.reporter_name,
         r.title,
         r.content,
         p.id::text AS park_id,
         p.code AS park_code,
         p.name AS park_name,
         r.location_detail,
         r.category,
         r.severity,
         r.status,
         r.reported_at::text,
         r.linked_incident_id::text,
         inc.incident_code AS linked_incident_code,
         r.linked_work_order_id::text,
         wo.order_code AS linked_work_order_code,
         r.reviewed_by,
         r.reviewed_at::text,
         r.notes,
         r.created_at::text
       FROM maintenance.field_reports r
       JOIN core.industrial_parks p ON p.id = r.industrial_park_id
       LEFT JOIN maintenance.incidents inc ON inc.id = r.linked_incident_id
       LEFT JOIN maintenance.work_orders wo ON wo.id = r.linked_work_order_id
       ${whereClause}
       ORDER BY r.id DESC
       LIMIT $${limitParam}`,
      values,
    )

    return {
      success: true,
      data: listRes.rows.map((row) => ({
        id: row.id,
        reportCode: row.report_code,
        source: row.source,
        sourceMessageKey: row.source_message_key,
        rawReporterName: row.raw_reporter_name,
        reporterName: row.reporter_name,
        title: row.title,
        content: row.content,
        parkId: row.park_id,
        parkCode: row.park_code,
        parkName: row.park_name,
        locationDetail: row.location_detail,
        category: row.category,
        severity: row.severity,
        status: row.status,
        reportedAt: row.reported_at,
        linkedIncidentId: row.linked_incident_id,
        linkedIncidentCode: row.linked_incident_code,
        linkedWorkOrderId: row.linked_work_order_id,
        linkedWorkOrderCode: row.linked_work_order_code,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      pagination: {
        total: totalCount,
        limit: parsedLimit,
        afterId: parsedAfterId,
      },
      stats: {
        total: totalCount,
        new: Number(statsRow?.new_count ?? 0),
        reviewed: Number(statsRow?.reviewed_count ?? 0),
        converted: Number(statsRow?.converted_count ?? 0),
        archived: Number(statsRow?.archived_count ?? 0),
      },
    }
  })

  // ==========================================
  // 3. Chi tiết 1 Báo cáo hiện trường (GET /:id)
  // ==========================================
  app.get<{ Params: { id: string } }>('/:id', { preHandler: auth }, async (request) => {
    const { id } = request.params
    const res = await options.database.query<{
      id: string
      report_code: string
      source: string
      source_message_key: string | null
      raw_reporter_name: string | null
      reporter_name: string
      title: string
      content: string
      park_id: string
      park_code: string
      park_name: string
      location_detail: string
      category: string
      severity: string
      status: string
      reported_at: string
      linked_incident_id: string | null
      linked_incident_code: string | null
      linked_work_order_id: string | null
      linked_work_order_code: string | null
      reviewed_by: string | null
      reviewed_at: string | null
      notes: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT
         r.id::text,
         r.report_code,
         r.source,
         r.source_message_key,
         r.raw_reporter_name,
         r.reporter_name,
         r.title,
         r.content,
         p.id::text AS park_id,
         p.code AS park_code,
         p.name AS park_name,
         r.location_detail,
         r.category,
         r.severity,
         r.status,
         r.reported_at::text,
         r.linked_incident_id::text,
         inc.incident_code AS linked_incident_code,
         r.linked_work_order_id::text,
         wo.order_code AS linked_work_order_code,
         r.reviewed_by,
         r.reviewed_at::text,
         r.notes,
         r.created_at::text,
         r.updated_at::text
       FROM maintenance.field_reports r
       JOIN core.industrial_parks p ON p.id = r.industrial_park_id
       LEFT JOIN maintenance.incidents inc ON inc.id = r.linked_incident_id
       LEFT JOIN maintenance.work_orders wo ON wo.id = r.linked_work_order_id
       WHERE r.id = $1`,
      [id],
    )

    const row = res.rows[0]
    if (!row) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường')
    }

    return {
      success: true,
      data: {
        id: row.id,
        reportCode: row.report_code,
        source: row.source,
        sourceMessageKey: row.source_message_key,
        rawReporterName: row.raw_reporter_name,
        reporterName: row.reporter_name,
        title: row.title,
        content: row.content,
        parkId: row.park_id,
        parkCode: row.park_code,
        parkName: row.park_name,
        locationDetail: row.location_detail,
        category: row.category,
        severity: row.severity,
        status: row.status,
        reportedAt: row.reported_at,
        linkedIncidentId: row.linked_incident_id,
        linkedIncidentCode: row.linked_incident_code,
        linkedWorkOrderId: row.linked_work_order_id,
        linkedWorkOrderCode: row.linked_work_order_code,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }
  })

  // ==========================================
  // 4. Cập nhật ghi chú / trạng thái (PATCH /:id)
  // ==========================================
  app.patch<{
    Params: { id: string }
    Body: {
      notes?: string
      status?: string
      category?: string
      severity?: string
    }
  }>('/:id', { preHandler: auth }, async (request) => {
    const { id } = request.params
    const { notes, status, category, severity } = request.body ?? {}
    const user = (request as any).user

    const setClauses: string[] = ['updated_at = now()']
    const values: unknown[] = []

    if (notes !== undefined) {
      values.push(notes ? notes.trim() : null)
      setClauses.push(`notes = $${values.length}`)
    }

    if (category !== undefined) {
      if (user?.roleCode !== 'DATA_ADMIN') {
        throw new ApiError(403, 'forbidden', 'Chỉ Quản trị viên (Admin) mới có quyền cập nhật phân loại báo cáo')
      }
      const rawCategory = typeof category === 'string' ? category.trim() : ''
      const normalizedCategory = rawCategory === 'OTHER' ? 'PENDING_CLASSIFICATION' : rawCategory
      if (!ALLOWED_CATEGORIES.includes(normalizedCategory as any)) {
        throw new ApiError(400, 'validation_error', 'Phân loại báo cáo không hợp lệ')
      }
      values.push(normalizedCategory)
      setClauses.push(`category = $${values.length}`)
    }

    if (severity !== undefined) {
      if (!ALLOWED_SEVERITIES.includes(severity as any)) {
        throw new ApiError(400, 'validation_error', 'Mức độ nghiêm trọng không hợp lệ')
      }
      values.push(severity)
      setClauses.push(`severity = $${values.length}`)
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status as any)) {
        throw new ApiError(400, 'validation_error', 'Trạng thái báo cáo không hợp lệ')
      }
      values.push(status)
      setClauses.push(`status = $${values.length}`)

      if (status === 'REVIEWED') {
        const reviewer = user?.displayName || user?.username || 'Người vận hành'
        values.push(reviewer)
        setClauses.push(`reviewed_by = $${values.length}`)
        setClauses.push(`reviewed_at = now()`)
      }
    }

    values.push(id)
    const updateRes = await options.database.query(
      `UPDATE maintenance.field_reports
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}
       RETURNING id::text, report_code, category, severity, status, notes, updated_at::text`,
      values,
    )

    if (!updateRes.rows[0]) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường để cập nhật')
    }

    const updated = updateRes.rows[0]
    options.eventHub?.publish({
      type: 'field_report.updated',
      entityType: 'field_report',
      entityId: updated.id,
      action: 'UPDATE',
      data: {
        code: updated.report_code,
        category: updated.category,
        severity: updated.severity,
        status: updated.status,
        notes: updated.notes,
      },
    })

    return {
      success: true,
      data: updated,
      message: 'Cập nhật báo cáo hiện trường thành công',
    }
  })

  // Delete Field Report (DATA_ADMIN only)
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const deleted = await options.database.query<{
      id: string
      report_code: string
      title: string
      reporter_name: string
    }>(
      `DELETE FROM maintenance.field_reports
       WHERE id = $1
       RETURNING id::text, report_code, title, reporter_name`,
      [id],
    )
    const report = deleted.rows[0]
    if (!report) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường để xóa')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'maintenance.field_reports', id, {
      reportCode: report.report_code,
      title: report.title,
      reporterName: report.reporter_name,
    })

    options.eventHub?.publish({
      type: 'field_report.deleted',
      entityType: 'field_report',
      entityId: id,
      action: 'DELETE',
      data: {
        code: report.report_code,
        title: report.title,
        reporterName: report.reporter_name,
      },
    })

    return { success: true, message: 'Đã xóa báo cáo hiện trường thành công' }
  })

  // ==========================================
  // 5. Chuyển thành Sự cố (POST /:id/convert-to-incident)
  // ==========================================
  app.post<{
    Params: { id: string }
    Body: {
      title?: string
      severity?: string
      locationDetail?: string
      assignedTo?: string
      targetResolutionDays?: number
      targetResolutionAt?: string
      assetId?: string | number
    }
  }>('/:id/convert-to-incident', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const {
      title,
      severity,
      locationDetail,
      assignedTo,
      targetResolutionDays = 3,
      targetResolutionAt,
      assetId,
    } = request.body ?? {}
    const user = (request as any).user

    // Fetch report
    const reportRes = await options.database.query<{
      id: string
      report_code: string
      title: string
      content: string
      industrial_park_id: string
      location_detail: string
      severity: string
      status: string
      reporter_name: string
      reported_at: string
      linked_incident_id: string | null
    }>(
      `SELECT id::text, report_code, title, content, industrial_park_id::text, location_detail,
              severity, status, reporter_name, reported_at::text, linked_incident_id::text
       FROM maintenance.field_reports
       WHERE id = $1`,
      [id],
    )

    const report = reportRes.rows[0]
    if (!report) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường')
    }

    if (report.linked_incident_id) {
      throw new ApiError(400, 'conflict', `Báo cáo [${report.report_code}] đã được chuyển thành sự cố trước đó`)
    }

    const currentYear = new Date().getFullYear()
    const seqRes = await options.database.query<{ next_seq: number }>(
      `SELECT COALESCE(MAX(SUBSTRING(incident_code FROM '\\d+$')::int), 0) + 1 AS next_seq
       FROM maintenance.incidents
       WHERE incident_code LIKE 'SC-' || $1 || '-%'`,
      [String(currentYear)],
    )
    const nextNum = seqRes.rows[0]?.next_seq ?? 1
    const incidentCode = `SC-${currentYear}-${String(nextNum).padStart(3, '0')}`

    const finalTitle = title && title.trim() ? title.trim() : report.title
    const finalSeverity = severity && ALLOWED_SEVERITIES.includes(severity as any) ? severity : report.severity
    const finalLocation = locationDetail && locationDetail.trim() ? locationDetail.trim() : report.location_detail
    const finalAssigned = assignedTo && assignedTo.trim() ? assignedTo.trim() : null

    let targetDateValue: unknown
    let targetDateSql: string
    if (targetResolutionAt && targetResolutionAt.trim()) {
      targetDateSql = '$10::timestamptz'
      targetDateValue = targetResolutionAt.trim()
    } else {
      targetDateSql = `now() + ($10 || ' days')::interval`
      targetDateValue = Number(targetResolutionDays) || 3
    }

    const rootCause = `Chuyển đổi từ Báo cáo hiện trường [${report.report_code}] (Người báo: ${report.reporter_name})`

    // Insert Incident
    const incRes = await options.database.query<{
      id: string
      incident_code: string
      title: string
    }>(
      `INSERT INTO maintenance.incidents (
         incident_code, title, severity, industrial_park_id, asset_id,
         location_detail, assigned_to, root_cause, mitigation_actions,
         current_status, reported_at, target_resolution_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         'OPEN', $11::timestamptz, ${targetDateSql}
       )
       RETURNING id::text, incident_code, title`,
      [
        incidentCode,
        finalTitle,
        finalSeverity,
        report.industrial_park_id,
        assetId ? String(assetId).trim() : null,
        finalLocation,
        finalAssigned,
        rootCause,
        report.content,
        targetDateValue,
        report.reported_at,
      ],
    )

    const newIncident = incRes.rows[0]
    if (!newIncident) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo bản ghi sự cố')
    }

    // Update field report
    const reviewer = user?.displayName || user?.username || 'Người vận hành'
    await options.database.query(
      `UPDATE maintenance.field_reports
       SET status = 'CONVERTED',
           category = 'INCIDENT',
           linked_incident_id = $1,
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3`,
      [newIncident.id, reviewer, id],
    )

    await recordAuditEvent(
      options.database,
      user?.id ? String(user.id) : null,
      'UPDATE',
      'maintenance.field_reports',
      id,
      { incidentCode: newIncident.incident_code, reportCode: report.report_code },
    )

    options.eventHub?.publish({
      type: 'incident.created',
      entityType: 'incident',
      entityId: newIncident.id,
      action: 'CREATE',
      data: {
        code: newIncident.incident_code,
        title: newIncident.title,
        severity: finalSeverity,
        status: 'OPEN',
      },
    })

    options.eventHub?.publish({
      type: 'field_report.converted',
      entityType: 'field_report',
      entityId: id,
      action: 'CONVERT',
      data: {
        code: report.report_code,
        title: report.title,
        linkedIncidentCode: newIncident.incident_code,
        linkedIncidentId: newIncident.id,
        status: 'CONVERTED',
      },
    })

    return {
      success: true,
      data: {
        incidentId: newIncident.id,
        incidentCode: newIncident.incident_code,
        title: newIncident.title,
        reportId: id,
        reportCode: report.report_code,
        reportStatus: 'CONVERTED',
      },
      message: `Đã chuyển đổi báo cáo [${report.report_code}] thành Sự cố [${newIncident.incident_code}] thành công`,
    }
  })

  // ==========================================
  // 6. Chuyển thành Lệnh bảo dưỡng (POST /:id/convert-to-work-order)
  // ==========================================
  app.post<{
    Params: { id: string }
    Body: {
      title?: string
      priority?: string
      orderType?: string
      assignedTo: string
      assetId?: string | number
      scheduledStart?: string
      scheduledEnd?: string
      notes?: string
    }
  }>('/:id/convert-to-work-order', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const {
      title,
      priority = 'NORMAL',
      orderType = 'CORRECTIVE',
      assignedTo,
      assetId,
      scheduledStart,
      scheduledEnd,
      notes,
    } = request.body ?? {}
    const user = (request as any).user

    if (!assignedTo || !assignedTo.trim()) {
      throw new ApiError(400, 'validation_error', 'Vui lòng chỉ định người hoặc đội phụ trách thực hiện')
    }

    // Fetch report
    const reportRes = await options.database.query<{
      id: string
      report_code: string
      title: string
      content: string
      industrial_park_id: string
      location_detail: string
      severity: string
      status: string
      reporter_name: string
      linked_work_order_id: string | null
    }>(
      `SELECT id::text, report_code, title, content, industrial_park_id::text, location_detail,
              severity, status, reporter_name, linked_work_order_id::text
       FROM maintenance.field_reports
       WHERE id = $1`,
      [id],
    )

    const report = reportRes.rows[0]
    if (!report) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường')
    }

    if (report.linked_work_order_id) {
      throw new ApiError(400, 'conflict', `Báo cáo [${report.report_code}] đã được chuyển thành lệnh bảo dưỡng trước đó`)
    }

    // Resolve Asset
    let resolvedAssetId: string | null = null
    if (assetId) {
      const assetCheck = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE id = $1`,
        [String(assetId).trim()],
      )
      if (assetCheck.rows[0]) {
        resolvedAssetId = assetCheck.rows[0].id
      }
    }

    if (!resolvedAssetId) {
      // Find first asset in this industrial park
      const fallbackAsset = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE industrial_park_id = $1 ORDER BY id ASC LIMIT 1`,
        [report.industrial_park_id],
      )
      if (fallbackAsset.rows[0]) {
        resolvedAssetId = fallbackAsset.rows[0].id
      } else {
        throw new ApiError(400, 'validation_error', 'Không tìm thấy tài sản hạ tầng nào thuộc KCN này để gán lệnh bảo dưỡng')
      }
    }

    const currentYear = new Date().getFullYear()
    const seqRes = await options.database.query<{ next_seq: number }>(
      `SELECT COALESCE(MAX(SUBSTRING(order_code FROM '\\d+$')::int), 0) + 1 AS next_seq
       FROM maintenance.work_orders
       WHERE order_code LIKE 'WO-' || $1 || '-%'`,
      [String(currentYear)],
    )
    const nextNum = seqRes.rows[0]?.next_seq ?? 1
    const orderCode = `WO-${currentYear}-${String(nextNum).padStart(3, '0')}`

    const finalTitle = title && title.trim() ? title.trim() : `Xử lý: ${report.title}`
    const finalNotes = notes
      ? `${notes}\n[Nguồn]: Chuyển đổi từ Báo cáo hiện trường ${report.report_code} (Người báo: ${report.reporter_name}). Nội dung: ${report.content}`
      : `[Nguồn]: Chuyển đổi từ Báo cáo hiện trường ${report.report_code} (Người báo: ${report.reporter_name}). Nội dung: ${report.content}`

    const startDate = scheduledStart && scheduledStart.trim() ? scheduledStart.trim() : new Date().toISOString().substring(0, 10)
    const endDate = scheduledEnd && scheduledEnd.trim() ? scheduledEnd.trim() : new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10)

    const woRes = await options.database.query<{
      id: string
      order_code: string
      title: string
    }>(
      `INSERT INTO maintenance.work_orders (
         order_code, title, order_type, priority, assigned_to,
         asset_id, scheduled_start, scheduled_end, status, notes
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7::date, $8::date, 'PENDING', $9
       )
       RETURNING id::text, order_code, title`,
      [
        orderCode,
        finalTitle,
        orderType,
        priority,
        assignedTo.trim(),
        resolvedAssetId,
        startDate,
        endDate,
        finalNotes,
      ],
    )

    const newWo = woRes.rows[0]
    if (!newWo) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo bản ghi lệnh bảo dưỡng')
    }

    // Update field report
    const reviewer = user?.displayName || user?.username || 'Người vận hành'
    await options.database.query(
      `UPDATE maintenance.field_reports
       SET status = 'CONVERTED',
           linked_work_order_id = $1,
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3`,
      [newWo.id, reviewer, id],
    )

    await recordAuditEvent(
      options.database,
      user?.id ? String(user.id) : null,
      'UPDATE',
      'maintenance.field_reports',
      id,
      { orderCode: newWo.order_code, reportCode: report.report_code },
    )

    options.eventHub?.publish({
      type: 'work_order.created',
      entityType: 'work_order',
      entityId: newWo.id,
      action: 'CREATE',
      data: {
        code: newWo.order_code,
        title: newWo.title,
        priority: priority,
        status: 'PENDING',
      },
    })

    options.eventHub?.publish({
      type: 'field_report.converted',
      entityType: 'field_report',
      entityId: id,
      action: 'CONVERT',
      data: {
        code: report.report_code,
        title: report.title,
        linkedOrderCode: newWo.order_code,
        linkedOrderId: newWo.id,
        status: 'CONVERTED',
      },
    })

    return {
      success: true,
      data: {
        workOrderId: newWo.id,
        orderCode: newWo.order_code,
        title: newWo.title,
        reportId: id,
        reportCode: report.report_code,
        reportStatus: 'CONVERTED',
      },
      message: `Đã chuyển đổi báo cáo [${report.report_code}] thành Lệnh bảo dưỡng [${newWo.order_code}] thành công`,
    }
  })
}
