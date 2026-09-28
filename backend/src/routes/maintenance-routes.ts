import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import type { Database } from '../db.js'
import { ApiError } from '../errors.js'
import { recordAuditEvent } from '../audit.js'
import type { EventHub } from '../realtime/event-hub.js'

type IncidentQuery = {
  parkCode?: string
  severity?: string
  status?: string
  fromDate?: string
  toDate?: string
}

type OrderQuery = {
  status?: string
  priority?: string
  parkCode?: string
  fromDate?: string
  toDate?: string
}

const ALLOWED_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const ALLOWED_INCIDENT_STATUSES = ['OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
const ALLOWED_ORDER_TYPES = ['ROUTINE', 'CORRECTIVE', 'EMERGENCY', 'UPGRADE'] as const
const ALLOWED_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const ALLOWED_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const

export async function maintenanceRoutes(app: FastifyInstance, options: { database: Database; eventHub?: EventHub; testMode?: boolean }): Promise<void> {
  const auth = authenticate(options.database)
  const adminOnly = [auth, requireRole('DATA_ADMIN')]

  // ==========================================
  // 1. Incidents (Sự cố & Nguy cơ an toàn)
  // ==========================================
  app.get<{ Querystring: IncidentQuery }>('/incidents', { preHandler: auth }, async (request) => {
    const { parkCode, severity, status, fromDate, toDate } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (severity) {
      values.push(severity)
      clauses.push(`i.severity = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`i.current_status = $${values.length}`)
    }
    if (fromDate) {
      values.push(fromDate)
      clauses.push(`COALESCE(i.resolved_at, 'infinity') >= $${values.length}::date`)
    }
    if (toDate) {
      values.push(toDate)
      clauses.push(`i.reported_at < ($${values.length}::date + interval '1 day')`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      incident_code: string
      title: string
      severity: string
      park_code: string
      park_name: string
      location_detail: string
      reported_at: string
      target_resolution_at: string | null
      resolved_at: string | null
      current_status: string
      assigned_to: string | null
      root_cause: string | null
      mitigation_actions: string | null
      asset_id: string | null
      asset_code: string | null
      asset_name: string | null
    }>(
      `SELECT i.id::text, i.incident_code, i.title, i.severity,
              p.code AS park_code, p.name AS park_name,
              i.location_detail, i.reported_at::text,
              i.target_resolution_at::text, i.resolved_at::text,
              i.current_status, i.assigned_to, i.root_cause,
              i.mitigation_actions, i.asset_id::text, a.asset_code, a.asset_name
       FROM maintenance.incidents i
       JOIN core.industrial_parks p ON p.id = i.industrial_park_id
       LEFT JOIN infrastructure.assets a ON a.id = i.asset_id
       ${whereClause}
       ORDER BY i.reported_at DESC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        incidentCode: r.incident_code,
        title: r.title,
        severity: r.severity,
        parkCode: r.park_code,
        parkName: r.park_name,
        locationDetail: r.location_detail,
        reportedAt: r.reported_at,
        targetResolutionAt: r.target_resolution_at,
        resolvedAt: r.resolved_at,
        currentStatus: r.current_status,
        assignedTo: r.assigned_to,
        rootCause: r.root_cause,
        mitigationActions: r.mitigation_actions,
        assetId: r.asset_id,
        assetCode: r.asset_code,
        assetName: r.asset_name,
      })),
    }
  })

  // Single Incident Detail
  app.get<{ Params: { id: string } }>('/incidents/:id', { preHandler: auth }, async (request) => {
    const { id } = request.params
    const result = await options.database.query<{
      id: string
      incident_code: string
      title: string
      severity: string
      park_code: string
      park_name: string
      location_detail: string
      reported_at: string
      target_resolution_at: string | null
      resolved_at: string | null
      current_status: string
      assigned_to: string | null
      root_cause: string | null
      mitigation_actions: string | null
      asset_id: string | null
      asset_code: string | null
      asset_name: string | null
    }>(
      `SELECT i.id::text, i.incident_code, i.title, i.severity,
              p.code AS park_code, p.name AS park_name,
              i.location_detail, i.reported_at::text,
              i.target_resolution_at::text, i.resolved_at::text,
              i.current_status, i.assigned_to, i.root_cause,
              i.mitigation_actions, i.asset_id::text, a.asset_code, a.asset_name
       FROM maintenance.incidents i
       JOIN core.industrial_parks p ON p.id = i.industrial_park_id
       LEFT JOIN infrastructure.assets a ON a.id = i.asset_id
       WHERE i.id = $1`,
      [id],
    )

    const row = result.rows[0]
    if (!row) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy sự cố kỹ thuật hạ tầng')
    }

    return {
      success: true,
      data: {
        id: row.id,
        incidentCode: row.incident_code,
        title: row.title,
        severity: row.severity,
        parkCode: row.park_code,
        parkName: row.park_name,
        locationDetail: row.location_detail,
        reportedAt: row.reported_at,
        targetResolutionAt: row.target_resolution_at,
        resolvedAt: row.resolved_at,
        currentStatus: row.current_status,
        assignedTo: row.assigned_to,
        rootCause: row.root_cause,
        mitigationActions: row.mitigation_actions,
        assetId: row.asset_id,
        assetCode: row.asset_code,
        assetName: row.asset_name,
      },
    }
  })

  // Create Incident (DATA_ADMIN only)
  app.post<{
    Body: {
      title: string
      severity?: string
      parkCode: string
      locationDetail: string
      assetId?: string | number
      assetCode?: string
      assignedTo?: string
      targetResolutionAt?: string
      targetResolutionDays?: number
      currentStatus?: string
      rootCause?: string
      mitigationActions?: string
    }
  }>('/incidents', { preHandler: adminOnly }, async (request) => {
    const {
      title,
      severity = 'MEDIUM',
      parkCode,
      locationDetail,
      assetId,
      assetCode,
      assignedTo,
      targetResolutionAt,
      targetResolutionDays = 3,
      currentStatus = 'OPEN',
      rootCause,
      mitigationActions,
    } = request.body ?? {}

    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    const cleanPark = typeof parkCode === 'string' ? parkCode.trim() : ''
    const cleanLocation = typeof locationDetail === 'string' ? locationDetail.trim() : ''

    if (!cleanTitle) {
      throw new ApiError(400, 'validation_error', 'Tiêu đề sự cố không được để trống')
    }
    if (!cleanPark) {
      throw new ApiError(400, 'validation_error', 'Vui lòng chọn khu công nghiệp')
    }
    if (!cleanLocation) {
      throw new ApiError(400, 'validation_error', 'Vị trí sự cố không được để trống')
    }
    if (severity && !ALLOWED_SEVERITIES.includes(severity as any)) {
      throw new ApiError(400, 'validation_error', 'Mức độ nghiêm trọng không hợp lệ')
    }
    if (currentStatus && !ALLOWED_INCIDENT_STATUSES.includes(currentStatus as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái sự cố không hợp lệ')
    }

    const parkRes = await options.database.query<{ id: string }>(
      `SELECT id::text FROM core.industrial_parks WHERE code = $1`,
      [cleanPark],
    )
    const parkRow = parkRes.rows[0]
    if (!parkRow) throw new ApiError(400, 'validation_error', 'Khu công nghiệp không hợp lệ')
    const parkId = parkRow.id

    let resolvedAssetId: string | null = null
    if (assetId !== undefined && assetId !== null && String(assetId).trim()) {
      const assetRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE id = $1`,
        [String(assetId).trim()],
      )
      const foundAsset = assetRes.rows[0]
      if (foundAsset) {
        resolvedAssetId = foundAsset.id
      } else {
        throw new ApiError(400, 'validation_error', 'Công trình liên quan không tồn tại')
      }
    } else if (assetCode) {
      const assetRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE asset_code = $1`,
        [assetCode.trim()],
      )
      const foundAsset = assetRes.rows[0]
      if (foundAsset) {
        resolvedAssetId = foundAsset.id
      }
    }

    const codeRes = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.incidents`,
    )
    const nextNum = Number(codeRes.rows[0]?.count ?? 0) + 1
    const incidentCode = `SC-2026-${String(nextNum).padStart(3, '0')}`

    let targetDateValue: unknown
    let targetDateSql: string
    if (targetResolutionAt && targetResolutionAt.trim()) {
      targetDateSql = '$10::timestamptz'
      targetDateValue = targetResolutionAt.trim()
    } else {
      targetDateSql = `now() + ($10 || ' days')::interval`
      targetDateValue = Number(targetResolutionDays) || 3
    }

    const result = await options.database.query<{ id: string; incident_code: string; title: string }>(
      `INSERT INTO maintenance.incidents
        (incident_code, title, severity, industrial_park_id, asset_id, location_detail, assigned_to, root_cause, mitigation_actions, current_status, target_resolution_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $11, ${targetDateSql})
       RETURNING id::text, incident_code, title`,
      [
        incidentCode,
        cleanTitle,
        severity,
        parkId,
        resolvedAssetId,
        cleanLocation,
        assignedTo?.trim() || null,
        rootCause?.trim() || null,
        mitigationActions?.trim() || null,
        targetDateValue,
        currentStatus || 'OPEN',
      ],
    )

    const created = result.rows[0]
    if (!created) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo mới sự cố')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'CREATE', 'maintenance_incident', created.id, {
      incidentCode: created.incident_code,
      title: created.title,
      severity,
      parkCode: cleanPark,
    })

    options.eventHub?.publish({
      type: 'incident.created',
      entityType: 'incident',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.incident_code,
        title: created.title,
        severity,
        parkCode: cleanPark,
        status: currentStatus || 'OPEN',
      },
    })

    return { success: true, data: { id: created.id, incidentCode: created.incident_code } }
  })

  // Quick Ingest for Chrome Extension / Integrations (Zalo Web, etc.)
  app.post<{
    Body: {
      title: string
      parkCode: string
      locationDetail?: string
      severity?: string
      reportedBy?: string
      assetCode?: string
      rootCause?: string
    }
  }>('/incidents/quick-ingest', async (request, reply) => {
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
      title,
      parkCode,
      locationDetail,
      severity = 'MEDIUM',
      reportedBy,
      assetCode,
      rootCause,
    } = request.body ?? {}

    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    const cleanPark = typeof parkCode === 'string' ? parkCode.trim() : ''
    const cleanLocation = typeof locationDetail === 'string' ? locationDetail.trim() : ''

    if (!cleanTitle) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: 'Tiêu đề sự cố không được để trống' },
      })
    }
    if (!cleanPark) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: 'Vui lòng chọn hoặc nhập mã khu công nghiệp' },
      })
    }

    const parkRes = await options.database.query<{ id: string; name: string }>(
      `SELECT id::text, name FROM core.industrial_parks 
       WHERE code = $1 
          OR ($1 = 'KCN_DONG_BAC_SONG_CAU_KV1' AND code = 'KCN_ONG_BAC_SONG_CAU_KV1')
          OR ($1 = 'KCN_ONG_BAC_SONG_CAU_KV1' AND code = 'KCN_DONG_BAC_SONG_CAU_KV1')`,
      [cleanPark],
    )
    const parkRow = parkRes.rows[0]
    if (!parkRow) {
      return reply.status(400).send({
        success: false,
        error: { code: 'validation_error', message: 'Khu công nghiệp không hợp lệ' },
      })
    }

    let resolvedAssetId: string | null = null
    if (assetCode) {
      const assetRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE asset_code = $1`,
        [assetCode.trim()],
      )
      if (assetRes.rows[0]) {
        resolvedAssetId = assetRes.rows[0].id
      }
    }

    const validSeverity = ALLOWED_SEVERITIES.includes(severity as any) ? severity : 'MEDIUM'

    // Kiểm tra trùng lặp dữ liệu: Nếu đã tồn tại sự cố cùng KCN và cùng nội dung/tiêu đề thì không tạo mới
    const dupCheck = await options.database.query<{
      id: string
      incident_code: string
      title: string
      current_status: string
      assigned_to: string | null
    }>(
      `SELECT id::text, incident_code, title, current_status, assigned_to
       FROM maintenance.incidents
       WHERE industrial_park_id = $1
         AND (
           TRIM(LOWER(location_detail)) = TRIM(LOWER($2))
           OR TRIM(LOWER(title)) = TRIM(LOWER($3))
           OR (LENGTH(TRIM($2)) >= 20 AND location_detail ILIKE '%' || TRIM($2) || '%')
           OR (LENGTH(TRIM($2)) >= 20 AND TRIM($2) ILIKE '%' || location_detail || '%')
         )
       ORDER BY id DESC
       LIMIT 1`,
      [parkRow.id, cleanLocation || cleanTitle, cleanTitle],
    )

    const existing = dupCheck.rows[0]
    if (existing) {
      return {
        success: true,
        data: {
          id: existing.id,
          incidentCode: existing.incident_code,
          title: existing.title,
          parkCode: cleanPark,
          parkName: parkRow.name,
          severity: validSeverity,
          currentStatus: existing.current_status,
          reportedBy: existing.assigned_to,
          isDuplicate: true,
        },
        message: `Sự cố [${existing.incident_code}] có nội dung trùng khớp đã tồn tại trên hệ thống, không tạo mới.`,
      }
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

    const assignedPerson = reportedBy ? reportedBy.trim() : null
    const noteSource = reportedBy ? `Tiếp nhận từ Zalo Web (Người báo: ${reportedBy.trim()})` : 'Tiếp nhận từ Zalo Web'
    const finalRootCause = rootCause ? `${noteSource}. ${rootCause.trim()}` : noteSource

    const result = await options.database.query<{ id: string; incident_code: string; title: string; current_status: string; assigned_to: string | null }>(
      `INSERT INTO maintenance.incidents
        (incident_code, title, severity, industrial_park_id, asset_id, location_detail, root_cause, current_status, target_resolution_at, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', now() + '3 days'::interval, $8)
       RETURNING id::text, incident_code, title, current_status, assigned_to`,
      [
        incidentCode,
        cleanTitle,
        validSeverity,
        parkRow.id,
        resolvedAssetId,
        cleanLocation || cleanTitle,
        finalRootCause,
        assignedPerson,
      ],
    )

    const created = result.rows[0]
    if (!created) {
      return reply.status(500).send({
        success: false,
        error: { code: 'database_error', message: 'Không thể tạo mới sự cố' },
      })
    }

    await recordAuditEvent(options.database, null, 'CREATE', 'maintenance_incident', created.id, {
      incidentCode: created.incident_code,
      title: created.title,
      severity: validSeverity,
      parkCode: cleanPark,
      reportedBy: assignedPerson,
      source: 'zalo_web_extension',
    })

    options.eventHub?.publish({
      type: 'incident.created',
      entityType: 'incident',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.incident_code,
        title: created.title,
        severity: validSeverity,
        parkCode: cleanPark,
        parkName: parkRow.name,
        reporterName: assignedPerson ?? undefined,
        status: created.current_status,
      },
    })

    return {
      success: true,
      data: {
        id: created.id,
        incidentCode: created.incident_code,
        title: created.title,
        parkCode: cleanPark,
        parkName: parkRow.name,
        severity: validSeverity,
        currentStatus: created.current_status,
        reportedBy: created.assigned_to,
      },
      message: `Đã tạo sự cố ${created.incident_code} thành công từ Zalo Web`,
    }
  })

  // Update Incident (DATA_ADMIN only)
  app.patch<{
    Params: { id: string }
    Body: {
      title?: string
      severity?: string
      parkCode?: string
      locationDetail?: string
      assetId?: string | number | null
      assignedTo?: string | null
      targetResolutionAt?: string | null
      currentStatus?: string
      rootCause?: string | null
      mitigationActions?: string | null
      resolvedAt?: string | null
    }
  }>('/incidents/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; incident_code: string; title: string; current_status: string }>(
      `SELECT id::text, incident_code, title, current_status FROM maintenance.incidents WHERE id = $1`,
      [id],
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy sự cố kỹ thuật hạ tầng')
    }

    const {
      title,
      severity,
      parkCode,
      locationDetail,
      assetId,
      assignedTo,
      targetResolutionAt,
      currentStatus,
      rootCause,
      mitigationActions,
      resolvedAt,
    } = request.body ?? {}

    let parkId: string | undefined = undefined
    if (parkCode !== undefined) {
      const parkResult = await options.database.query<{ id: string }>(
        `SELECT id::text FROM core.industrial_parks WHERE code = $1`,
        [parkCode.trim()],
      )
      const foundPark = parkResult.rows[0]
      if (!foundPark) throw new ApiError(400, 'validation_error', 'Khu công nghiệp không hợp lệ')
      parkId = foundPark.id
    }

    if (assetId !== undefined && assetId !== null && String(assetId).trim()) {
      const assetRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM infrastructure.assets WHERE id = $1`,
        [String(assetId).trim()],
      )
      if (!assetRes.rows.length) throw new ApiError(400, 'validation_error', 'Công trình liên quan không hợp lệ')
    }

    if (severity !== undefined && !ALLOWED_SEVERITIES.includes(severity as any)) {
      throw new ApiError(400, 'validation_error', 'Mức độ nghiêm trọng không hợp lệ')
    }

    if (currentStatus !== undefined && !ALLOWED_INCIDENT_STATUSES.includes(currentStatus as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái sự cố không hợp lệ')
    }

    const setClauses: string[] = ['updated_at = now()']
    const values: unknown[] = []

    if (title !== undefined) {
      if (!title.trim()) throw new ApiError(400, 'validation_error', 'Tiêu đề sự cố không được để trống')
      values.push(title.trim())
      setClauses.push(`title = $${values.length}`)
    }
    if (severity !== undefined) {
      values.push(severity)
      setClauses.push(`severity = $${values.length}`)
    }
    if (parkId !== undefined) {
      values.push(parkId)
      setClauses.push(`industrial_park_id = $${values.length}`)
    }
    if (locationDetail !== undefined) {
      if (!locationDetail.trim()) throw new ApiError(400, 'validation_error', 'Vị trí sự cố không được để trống')
      values.push(locationDetail.trim())
      setClauses.push(`location_detail = $${values.length}`)
    }
    if (assetId !== undefined) {
      values.push(assetId ? String(assetId).trim() : null)
      setClauses.push(`asset_id = $${values.length}`)
    }
    if (assignedTo !== undefined) {
      values.push(assignedTo?.trim() || null)
      setClauses.push(`assigned_to = $${values.length}`)
    }
    if (targetResolutionAt !== undefined) {
      values.push(targetResolutionAt ? targetResolutionAt.trim() : null)
      setClauses.push(`target_resolution_at = $${values.length}::timestamptz`)
    }
    if (rootCause !== undefined) {
      values.push(rootCause?.trim() || null)
      setClauses.push(`root_cause = $${values.length}`)
    }
    if (mitigationActions !== undefined) {
      values.push(mitigationActions?.trim() || null)
      setClauses.push(`mitigation_actions = $${values.length}`)
    }

    if (currentStatus !== undefined) {
      values.push(currentStatus)
      setClauses.push(`current_status = $${values.length}`)

      // Auto-populate resolved_at if status becomes RESOLVED or CLOSED and no explicit resolvedAt is given
      if (['RESOLVED', 'CLOSED'].includes(currentStatus) && resolvedAt === undefined) {
        setClauses.push(`resolved_at = COALESCE(resolved_at, now())`)
      }
    }

    if (resolvedAt !== undefined) {
      values.push(resolvedAt ? resolvedAt.trim() : null)
      setClauses.push(`resolved_at = $${values.length}::timestamptz`)
    }

    values.push(id)
    await options.database.query(
      `UPDATE maintenance.incidents
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}`,
      values,
    )

    await recordAuditEvent(options.database, request.user?.id ?? null, 'UPDATE', 'maintenance_incident', id, {
      ...request.body,
    })

    options.eventHub?.publish({
      type: 'incident.updated',
      entityType: 'incident',
      entityId: id,
      action: 'UPDATE',
      data: {
        severity,
        status: currentStatus,
      },
    })

    return { success: true, message: 'Đã cập nhật thông tin sự cố' }
  })

  // Delete Incident (DATA_ADMIN only)
  app.delete<{ Params: { id: string } }>('/incidents/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; incident_code: string; title: string }>(
      `SELECT id::text, incident_code, title FROM maintenance.incidents WHERE id = $1`,
      [id],
    )
    const incident = existing.rows[0]
    if (!incident) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy sự cố kỹ thuật hạ tầng')
    }

    // Check references in maintenance.work_orders
    const ordersRef = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.work_orders WHERE incident_id = $1`,
      [id],
    )
    const refCount = Number(ordersRef.rows[0]?.count ?? 0)
    if (refCount > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa sự cố "${incident.title}" (${incident.incident_code}) vì đang có ${refCount} lệnh công việc duy tu tham chiếu`,
      )
    }

    await options.database.query(`DELETE FROM maintenance.incidents WHERE id = $1`, [id])

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'maintenance_incident', id, {
      incidentCode: incident.incident_code,
      title: incident.title,
    })

    options.eventHub?.publish({
      type: 'incident.deleted',
      entityType: 'incident',
      entityId: id,
      action: 'DELETE',
      data: {
        code: incident.incident_code,
        title: incident.title,
      },
    })

    return { success: true, message: 'Đã xóa sự cố thành công' }
  })

  // ==========================================
  // 2. Work Orders (Lệnh duy tu, bảo dưỡng)
  // ==========================================
  app.get<{ Querystring: OrderQuery }>('/orders', { preHandler: auth }, async (request) => {
    const { status, priority, parkCode, fromDate, toDate } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`w.status = $${values.length}`)
    }
    if (priority) {
      values.push(priority)
      clauses.push(`w.priority = $${values.length}`)
    }
    if (fromDate) {
      values.push(fromDate)
      clauses.push(`w.scheduled_end >= $${values.length}::date`)
    }
    if (toDate) {
      values.push(toDate)
      clauses.push(`w.scheduled_start <= $${values.length}::date`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      incident_id: string | null
      order_code: string
      title: string
      order_type: string
      priority: string
      assigned_to: string
      scheduled_start: string
      scheduled_end: string
      completed_at: string | null
      actual_cost: string
      status: string
      notes: string | null
      asset_id: string
      asset_code: string
      asset_name: string
      park_code: string
      park_name: string
      is_overdue: boolean
    }>(
      `SELECT w.id::text, w.incident_id::text, w.order_code, w.title, w.order_type, w.priority,
              w.assigned_to, w.scheduled_start::text, w.scheduled_end::text,
              w.completed_at::text, w.actual_cost::text, w.status, w.notes,
              w.asset_id::text, a.asset_code, a.asset_name,
              p.code AS park_code, p.name AS park_name,
              (w.scheduled_end < CURRENT_DATE AND w.status != 'COMPLETED' AND w.status != 'CANCELLED') AS is_overdue
       FROM maintenance.work_orders w
       JOIN infrastructure.assets a ON a.id = w.asset_id
       JOIN core.industrial_parks p ON p.id = a.industrial_park_id
       ${whereClause}
       ORDER BY w.scheduled_end ASC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        incidentId: r.incident_id,
        orderCode: r.order_code,
        title: r.title,
        orderType: r.order_type,
        priority: r.priority,
        assignedTo: r.assigned_to,
        scheduledStart: r.scheduled_start,
        scheduledEnd: r.scheduled_end,
        completedAt: r.completed_at,
        actualCost: Number(r.actual_cost),
        status: r.status,
        notes: r.notes,
        assetId: r.asset_id,
        assetCode: r.asset_code,
        assetName: r.asset_name,
        parkCode: r.park_code,
        parkName: r.park_name,
        isOverdue: r.is_overdue,
      })),
    }
  })

  // Single Work Order Detail
  app.get<{ Params: { id: string } }>('/orders/:id', { preHandler: auth }, async (request) => {
    const { id } = request.params
    const result = await options.database.query<{
      id: string
      incident_id: string | null
      order_code: string
      title: string
      order_type: string
      priority: string
      assigned_to: string
      scheduled_start: string
      scheduled_end: string
      completed_at: string | null
      actual_cost: string
      status: string
      notes: string | null
      asset_id: string
      asset_code: string
      asset_name: string
      is_overdue: boolean
    }>(
      `SELECT w.id::text, w.incident_id::text, w.order_code, w.title, w.order_type, w.priority,
              w.assigned_to, w.scheduled_start::text, w.scheduled_end::text,
              w.completed_at::text, w.actual_cost::text, w.status, w.notes,
              w.asset_id::text, a.asset_code, a.asset_name,
              (w.scheduled_end < CURRENT_DATE AND w.status != 'COMPLETED' AND w.status != 'CANCELLED') AS is_overdue
       FROM maintenance.work_orders w
       JOIN infrastructure.assets a ON a.id = w.asset_id
       WHERE w.id = $1`,
      [id],
    )

    const row = result.rows[0]
    if (!row) throw new ApiError(404, 'not_found', 'Không tìm thấy lệnh công việc duy tu')

    return {
      success: true,
      data: {
        id: row.id,
        incidentId: row.incident_id,
        orderCode: row.order_code,
        title: row.title,
        orderType: row.order_type,
        priority: row.priority,
        assignedTo: row.assigned_to,
        scheduledStart: row.scheduled_start,
        scheduledEnd: row.scheduled_end,
        completedAt: row.completed_at,
        actualCost: Number(row.actual_cost),
        status: row.status,
        notes: row.notes,
        assetId: row.asset_id,
        assetCode: row.asset_code,
        assetName: row.asset_name,
        isOverdue: row.is_overdue,
      },
    }
  })

  // Create Work Order (DATA_ADMIN only)
  app.post<{
    Body: {
      title: string
      assetId: string | number
      incidentId?: string | number | null
      orderType?: string
      priority?: string
      assignedTo: string
      scheduledStart: string
      scheduledEnd: string
      actualCost?: number
      status?: string
      notes?: string
    }
  }>('/orders', { preHandler: adminOnly }, async (request) => {
    const {
      title,
      assetId,
      incidentId,
      orderType = 'ROUTINE',
      priority = 'NORMAL',
      assignedTo,
      scheduledStart,
      scheduledEnd,
      actualCost = 0,
      status = 'PENDING',
      notes,
    } = request.body ?? {}

    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    const cleanAssigned = typeof assignedTo === 'string' ? assignedTo.trim() : ''
    const cleanStart = typeof scheduledStart === 'string' ? scheduledStart.trim() : ''
    const cleanEnd = typeof scheduledEnd === 'string' ? scheduledEnd.trim() : ''

    if (!cleanTitle) {
      throw new ApiError(400, 'validation_error', 'Nội dung công việc không được để trống')
    }
    if (!assetId || !String(assetId).trim()) {
      throw new ApiError(400, 'validation_error', 'Vui lòng chọn công trình liên quan')
    }
    if (!cleanAssigned) {
      throw new ApiError(400, 'validation_error', 'Đơn vị hoặc người thực hiện không được để trống')
    }
    if (!cleanStart) {
      throw new ApiError(400, 'validation_error', 'Ngày thực hiện không được để trống')
    }
    if (!cleanEnd) {
      throw new ApiError(400, 'validation_error', 'Ngày hoàn thành dự kiến không được để trống')
    }

    if (orderType && !ALLOWED_ORDER_TYPES.includes(orderType as any)) {
      throw new ApiError(400, 'validation_error', 'Loại hình duy tu không hợp lệ')
    }
    if (priority && !ALLOWED_ORDER_PRIORITIES.includes(priority as any)) {
      throw new ApiError(400, 'validation_error', 'Mức độ ưu tiên không hợp lệ')
    }
    if (status && !ALLOWED_ORDER_STATUSES.includes(status as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái lệnh công việc không hợp lệ')
    }

    const assetRes = await options.database.query<{ id: string; asset_code: string }>(
      `SELECT id::text, asset_code FROM infrastructure.assets WHERE id = $1`,
      [String(assetId).trim()],
    )
    const foundAsset = assetRes.rows[0]
    if (!foundAsset) {
      throw new ApiError(400, 'validation_error', 'Công trình được chọn không tồn tại')
    }

    let resolvedIncidentId: string | null = null
    if (incidentId !== undefined && incidentId !== null && String(incidentId).trim()) {
      const incRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM maintenance.incidents WHERE id = $1`,
        [String(incidentId).trim()],
      )
      const foundIncident = incRes.rows[0]
      if (foundIncident) {
        resolvedIncidentId = foundIncident.id
      } else {
        throw new ApiError(400, 'validation_error', 'Sự cố liên quan không tồn tại')
      }
    }

    const countRes = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.work_orders`,
    )
    const nextNum = Number(countRes.rows[0]?.count ?? 0) + 1
    const orderCode = `WO-2026-${String(nextNum).padStart(3, '0')}`

    const result = await options.database.query<{ id: string; order_code: string; title: string }>(
      `INSERT INTO maintenance.work_orders
        (order_code, title, asset_id, incident_id, order_type, priority, assigned_to, scheduled_start, scheduled_end, actual_cost, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id::text, order_code, title`,
      [
        orderCode,
        cleanTitle,
        foundAsset.id,
        resolvedIncidentId,
        orderType || 'ROUTINE',
        priority || 'NORMAL',
        cleanAssigned,
        cleanStart,
        cleanEnd,
        Number(actualCost) || 0,
        status || 'PENDING',
        notes?.trim() || null,
      ],
    )

    const created = result.rows[0]
    if (!created) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo lệnh công việc duy tu')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'CREATE', 'maintenance_work_order', created.id, {
      orderCode: created.order_code,
      title: created.title,
      assetId: foundAsset.id,
    })

    options.eventHub?.publish({
      type: 'work_order.created',
      entityType: 'work_order',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.order_code,
        title: created.title,
        priority: priority || 'NORMAL',
        status: status || 'PENDING',
      },
    })

    return { success: true, data: { id: created.id, orderCode: created.order_code } }
  })

  // Update Work Order (DATA_ADMIN only)
  app.patch<{
    Params: { id: string }
    Body: {
      title?: string
      assetId?: string | number
      incidentId?: string | number | null
      orderType?: string
      priority?: string
      assignedTo?: string
      scheduledStart?: string
      scheduledEnd?: string
      completedAt?: string | null
      actualCost?: number
      status?: string
      notes?: string | null
    }
  }>('/orders/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; order_code: string; title: string; status: string }>(
      `SELECT id::text, order_code, title, status FROM maintenance.work_orders WHERE id = $1`,
      [id],
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy lệnh công việc duy tu')
    }

    const {
      title,
      assetId,
      incidentId,
      orderType,
      priority,
      assignedTo,
      scheduledStart,
      scheduledEnd,
      completedAt,
      actualCost,
      status,
      notes,
    } = request.body ?? {}

    if (assetId !== undefined) {
      const assetRes = await options.database.query(
        `SELECT id FROM infrastructure.assets WHERE id = $1`,
        [String(assetId).trim()],
      )
      if (!assetRes.rows.length) throw new ApiError(400, 'validation_error', 'Công trình liên quan không tồn tại')
    }

    if (incidentId !== undefined && incidentId !== null && String(incidentId).trim()) {
      const incRes = await options.database.query(
        `SELECT id FROM maintenance.incidents WHERE id = $1`,
        [String(incidentId).trim()],
      )
      if (!incRes.rows.length) throw new ApiError(400, 'validation_error', 'Sự cố liên quan không tồn tại')
    }

    if (orderType !== undefined && !ALLOWED_ORDER_TYPES.includes(orderType as any)) {
      throw new ApiError(400, 'validation_error', 'Loại hình duy tu không hợp lệ')
    }
    if (priority !== undefined && !ALLOWED_ORDER_PRIORITIES.includes(priority as any)) {
      throw new ApiError(400, 'validation_error', 'Mức độ ưu tiên không hợp lệ')
    }
    if (status !== undefined && !ALLOWED_ORDER_STATUSES.includes(status as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái lệnh công việc không hợp lệ')
    }

    const setClauses: string[] = ['updated_at = now()']
    const values: unknown[] = []

    if (title !== undefined) {
      if (!title.trim()) throw new ApiError(400, 'validation_error', 'Nội dung công việc không được để trống')
      values.push(title.trim())
      setClauses.push(`title = $${values.length}`)
    }
    if (assetId !== undefined) {
      values.push(String(assetId).trim())
      setClauses.push(`asset_id = $${values.length}`)
    }
    if (incidentId !== undefined) {
      values.push(incidentId ? String(incidentId).trim() : null)
      setClauses.push(`incident_id = $${values.length}`)
    }
    if (orderType !== undefined) {
      values.push(orderType)
      setClauses.push(`order_type = $${values.length}`)
    }
    if (priority !== undefined) {
      values.push(priority)
      setClauses.push(`priority = $${values.length}`)
    }
    if (assignedTo !== undefined) {
      if (!assignedTo.trim()) throw new ApiError(400, 'validation_error', 'Người thực hiện không được để trống')
      values.push(assignedTo.trim())
      setClauses.push(`assigned_to = $${values.length}`)
    }
    if (scheduledStart !== undefined) {
      values.push(scheduledStart.trim())
      setClauses.push(`scheduled_start = $${values.length}`)
    }
    if (scheduledEnd !== undefined) {
      values.push(scheduledEnd.trim())
      setClauses.push(`scheduled_end = $${values.length}`)
    }
    if (actualCost !== undefined) {
      values.push(Number(actualCost) || 0)
      setClauses.push(`actual_cost = $${values.length}`)
    }
    if (notes !== undefined) {
      values.push(notes?.trim() || null)
      setClauses.push(`notes = $${values.length}`)
    }

    if (status !== undefined) {
      values.push(status)
      setClauses.push(`status = $${values.length}`)

      if (status === 'COMPLETED' && completedAt === undefined) {
        setClauses.push(`completed_at = COALESCE(completed_at, now())`)
      }
    }

    if (completedAt !== undefined) {
      values.push(completedAt ? completedAt.trim() : null)
      setClauses.push(`completed_at = $${values.length}::timestamptz`)
    }

    values.push(id)
    await options.database.query(
      `UPDATE maintenance.work_orders
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}`,
      values,
    )

    await recordAuditEvent(options.database, request.user?.id ?? null, 'UPDATE', 'maintenance_work_order', id, {
      ...request.body,
    })

    options.eventHub?.publish({
      type: 'work_order.updated',
      entityType: 'work_order',
      entityId: id,
      action: 'UPDATE',
      data: {
        status,
        priority,
      },
    })

    return { success: true, message: 'Đã cập nhật lệnh công việc' }
  })

  // Delete Work Order (DATA_ADMIN only)
  app.delete<{ Params: { id: string } }>('/orders/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; order_code: string; title: string }>(
      `SELECT id::text, order_code, title FROM maintenance.work_orders WHERE id = $1`,
      [id],
    )
    const order = existing.rows[0]
    if (!order) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy lệnh công việc duy tu')
    }

    await options.database.query(`DELETE FROM maintenance.work_orders WHERE id = $1`, [id])

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'maintenance_work_order', id, {
      orderCode: order.order_code,
      title: order.title,
    })

    options.eventHub?.publish({
      type: 'work_order.deleted',
      entityType: 'work_order',
      entityId: id,
      action: 'DELETE',
      data: {
        code: order.order_code,
        title: order.title,
      },
    })

    return { success: true, message: 'Đã xóa lệnh công việc thành công' }
  })
}
