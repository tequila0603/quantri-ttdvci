import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import type { Database } from '../db.js'
import { ApiError } from '../errors.js'
import { recordAuditEvent } from '../audit.js'
import type { EventHub } from '../realtime/event-hub.js'

type AssetQuery = {
  parkCode?: string
  categoryCode?: string
  status?: string
}

type ProjectQuery = {
  parkCode?: string
  status?: string
  projectType?: string
  fromDate?: string
  toDate?: string
}

const ALLOWED_ASSET_STATUSES = ['OPERATIONAL', 'DEGRADED', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE'] as const

export async function infrastructureRoutes(app: FastifyInstance, options: { database: Database; eventHub?: EventHub }): Promise<void> {
  const auth = authenticate(options.database)
  const adminOnly = [auth, requireRole('DATA_ADMIN')]

  // ==========================================
  // 1. Categories
  // ==========================================
  app.get('/categories', { preHandler: auth }, async () => {
    const result = await options.database.query<{
      code: string
      display_name: string
      icon_name: string | null
      description: string | null
    }>(
      `SELECT code, display_name, icon_name, description
       FROM infrastructure.asset_categories
       ORDER BY code ASC`,
    )
    return {
      success: true,
      data: result.rows.map((r) => ({
        code: r.code,
        displayName: r.display_name,
        iconName: r.icon_name,
        description: r.description,
      })),
    }
  })

  // Create Category (DATA_ADMIN only)
  app.post<{
    Body: {
      code: string
      displayName: string
      iconName?: string
      description?: string
    }
  }>('/categories', { preHandler: adminOnly }, async (request) => {
    const { code, displayName, iconName, description } = request.body ?? {}
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
    const cleanName = typeof displayName === 'string' ? displayName.trim() : ''

    if (!cleanCode) {
      throw new ApiError(400, 'validation_error', 'Mã phân loại không được để trống')
    }
    if (!cleanName) {
      throw new ApiError(400, 'validation_error', 'Tên phân loại không được để trống')
    }

    const existing = await options.database.query(
      `SELECT code FROM infrastructure.asset_categories WHERE code = $1`,
      [cleanCode],
    )
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'conflict', `Mã phân loại ${cleanCode} đã tồn tại`)
    }

    const result = await options.database.query<{
      code: string
      display_name: string
      icon_name: string | null
      description: string | null
    }>(
      `INSERT INTO infrastructure.asset_categories (code, display_name, icon_name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING code, display_name, icon_name, description`,
      [cleanCode, cleanName, iconName?.trim() || null, description?.trim() || null],
    )

    const created = result.rows[0]
    if (!created) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo phân loại')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'CREATE', 'infrastructure_category', null, {
      code: cleanCode,
      displayName: cleanName,
    })

    return {
      success: true,
      data: {
        code: created.code,
        displayName: created.display_name,
        iconName: created.icon_name,
        description: created.description,
      },
    }
  })

  // Update Category (DATA_ADMIN only)
  app.patch<{
    Params: { code: string }
    Body: {
      displayName?: string
      iconName?: string
      description?: string
    }
  }>('/categories/:code', { preHandler: adminOnly }, async (request) => {
    const code = request.params.code?.trim().toUpperCase()
    const { displayName, iconName, description } = request.body ?? {}

    const existing = await options.database.query<{ code: string; display_name: string }>(
      `SELECT code, display_name FROM infrastructure.asset_categories WHERE code = $1`,
      [code],
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'not_found', `Không tìm thấy phân loại hạ tầng với mã ${code}`)
    }

    if (displayName !== undefined && !displayName.trim()) {
      throw new ApiError(400, 'validation_error', 'Tên phân loại không được để trống')
    }

    const result = await options.database.query<{
      code: string
      display_name: string
      icon_name: string | null
      description: string | null
    }>(
      `UPDATE infrastructure.asset_categories
       SET display_name = COALESCE($1, display_name),
           icon_name = COALESCE($2, icon_name),
           description = COALESCE($3, description)
       WHERE code = $4
       RETURNING code, display_name, icon_name, description`,
      [
        displayName !== undefined ? displayName.trim() : null,
        iconName !== undefined ? iconName.trim() || null : null,
        description !== undefined ? description.trim() || null : null,
        code,
      ],
    )

    const updated = result.rows[0]
    if (!updated) {
      throw new ApiError(500, 'internal_error', 'Không thể cập nhật phân loại')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'UPDATE', 'infrastructure_category', null, {
      code,
      ...request.body,
    })

    return {
      success: true,
      data: {
        code: updated.code,
        displayName: updated.display_name,
        iconName: updated.icon_name,
        description: updated.description,
      },
    }
  })

  // Delete Category (DATA_ADMIN only)
  app.delete<{
    Params: { code: string }
  }>('/categories/:code', { preHandler: adminOnly }, async (request) => {
    const code = request.params.code?.trim().toUpperCase()
    const existing = await options.database.query<{ code: string; display_name: string }>(
      `SELECT code, display_name FROM infrastructure.asset_categories WHERE code = $1`,
      [code],
    )
    const existingCategory = existing.rows[0]
    if (!existingCategory) {
      throw new ApiError(404, 'not_found', `Không tìm thấy phân loại hạ tầng với mã ${code}`)
    }

    const refCheck = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM infrastructure.assets WHERE category_code = $1`,
      [code],
    )
    const refCount = Number(refCheck.rows[0]?.count ?? 0)
    if (refCount > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa phân loại "${existingCategory.display_name}" (${code}) vì đang có ${refCount} công trình trực thuộc`,
      )
    }

    await options.database.query(`DELETE FROM infrastructure.asset_categories WHERE code = $1`, [code])

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'infrastructure_category', null, {
      code,
      displayName: existingCategory.display_name,
    })

    return { success: true, message: 'Đã xóa phân loại hạ tầng thành công' }
  })

  // ==========================================
  // 2. Assets
  // ==========================================
  app.get<{ Querystring: AssetQuery }>('/assets', { preHandler: auth }, async (request) => {
    const { parkCode, categoryCode, status } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (categoryCode) {
      values.push(categoryCode)
      clauses.push(`a.category_code = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`a.status = $${values.length}`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      asset_code: string
      asset_name: string
      category_code: string
      category_name: string
      category_icon: string | null
      park_code: string
      park_name: string
      location_desc: string
      managing_unit: string
      commissioning_year: number | null
      status: string
      specs: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(
      `SELECT a.id::text, a.asset_code, a.asset_name, a.category_code,
              c.display_name AS category_name, c.icon_name AS category_icon,
              p.code AS park_code, p.name AS park_name, a.location_desc,
              a.managing_unit, a.commissioning_year, a.status, a.specs,
              a.created_at::text, a.updated_at::text
       FROM infrastructure.assets a
       JOIN infrastructure.asset_categories c ON c.code = a.category_code
       JOIN core.industrial_parks p ON p.id = a.industrial_park_id
       ${whereClause}
       ORDER BY a.asset_code ASC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        assetCode: r.asset_code,
        assetName: r.asset_name,
        categoryCode: r.category_code,
        categoryName: r.category_name,
        categoryIcon: r.category_icon,
        parkCode: r.park_code,
        parkName: r.park_name,
        locationDesc: r.location_desc,
        managingUnit: r.managing_unit,
        commissioningYear: r.commissioning_year,
        status: r.status,
        specs: r.specs,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }
  })

  // Single Asset Details
  app.get<{ Params: { id: string } }>('/assets/:id', { preHandler: auth }, async (request) => {
    const { id } = request.params
    const result = await options.database.query<{
      id: string
      asset_code: string
      asset_name: string
      category_code: string
      category_name: string
      category_icon: string | null
      park_code: string
      park_name: string
      location_desc: string
      managing_unit: string
      commissioning_year: number | null
      status: string
      specs: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(
      `SELECT a.id::text, a.asset_code, a.asset_name, a.category_code,
              c.display_name AS category_name, c.icon_name AS category_icon,
              p.code AS park_code, p.name AS park_name, a.location_desc,
              a.managing_unit, a.commissioning_year, a.status, a.specs,
              a.created_at::text, a.updated_at::text
       FROM infrastructure.assets a
       JOIN infrastructure.asset_categories c ON c.code = a.category_code
       JOIN core.industrial_parks p ON p.id = a.industrial_park_id
       WHERE a.id = $1`,
      [id],
    )

    const row = result.rows[0]
    if (!row) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy công trình hạ tầng')
    }

    return {
      success: true,
      data: {
        id: row.id,
        assetCode: row.asset_code,
        assetName: row.asset_name,
        categoryCode: row.category_code,
        categoryName: row.category_name,
        categoryIcon: row.category_icon,
        parkCode: row.park_code,
        parkName: row.park_name,
        locationDesc: row.location_desc,
        managingUnit: row.managing_unit,
        commissioningYear: row.commissioning_year,
        status: row.status,
        specs: row.specs,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }
  })

  // Create Asset (DATA_ADMIN only)
  app.post<{
    Body: {
      assetCode: string
      assetName: string
      categoryCode: string
      parkCode: string
      locationDesc: string
      managingUnit?: string
      commissioningYear?: number
      status?: string
      specs?: Record<string, unknown>
    }
  }>('/assets', { preHandler: adminOnly }, async (request) => {
    const {
      assetCode,
      assetName,
      categoryCode,
      parkCode,
      locationDesc,
      managingUnit = 'Tổ Quản lý Vận hành Hạ tầng',
      commissioningYear,
      status = 'OPERATIONAL',
      specs = {},
    } = request.body ?? {}

    const cleanCode = typeof assetCode === 'string' ? assetCode.trim().toUpperCase() : ''
    const cleanName = typeof assetName === 'string' ? assetName.trim() : ''
    const cleanCategory = typeof categoryCode === 'string' ? categoryCode.trim() : ''
    const cleanPark = typeof parkCode === 'string' ? parkCode.trim() : ''
    const cleanLocation = typeof locationDesc === 'string' ? locationDesc.trim() : ''
    const cleanUnit = typeof managingUnit === 'string' && managingUnit.trim() ? managingUnit.trim() : 'Tổ Quản lý Vận hành Hạ tầng'

    if (!cleanCode) {
      throw new ApiError(400, 'validation_error', 'Mã công trình không được để trống')
    }
    if (!cleanName) {
      throw new ApiError(400, 'validation_error', 'Tên công trình không được để trống')
    }
    if (!cleanCategory) {
      throw new ApiError(400, 'validation_error', 'Vui lòng chọn phân loại hạ tầng')
    }
    if (!cleanPark) {
      throw new ApiError(400, 'validation_error', 'Vui lòng chọn khu công nghiệp')
    }
    if (!cleanLocation) {
      throw new ApiError(400, 'validation_error', 'Vị trí công trình không được để trống')
    }

    if (status && !ALLOWED_ASSET_STATUSES.includes(status as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái công trình không hợp lệ')
    }

    const parkResult = await options.database.query<{ id: string }>(
      `SELECT id::text FROM core.industrial_parks WHERE code = $1`,
      [cleanPark],
    )
    const parkId = parkResult.rows[0]?.id
    if (!parkId) {
      throw new ApiError(400, 'validation_error', 'Khu công nghiệp không hợp lệ')
    }

    const catResult = await options.database.query<{ code: string }>(
      `SELECT code FROM infrastructure.asset_categories WHERE code = $1`,
      [cleanCategory],
    )
    if (!catResult.rows.length) {
      throw new ApiError(400, 'validation_error', 'Phân loại hạ tầng không hợp lệ')
    }

    const codeExisting = await options.database.query<{ id: string }>(
      `SELECT id::text FROM infrastructure.assets WHERE asset_code = $1`,
      [cleanCode],
    )
    if (codeExisting.rows.length > 0) {
      throw new ApiError(409, 'conflict', `Mã công trình "${cleanCode}" đã tồn tại trên hệ thống`)
    }

    const result = await options.database.query<{ id: string; asset_code: string; asset_name: string }>(
      `INSERT INTO infrastructure.assets
        (asset_code, asset_name, category_code, industrial_park_id, location_desc, managing_unit, commissioning_year, status, specs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id::text, asset_code, asset_name`,
      [
        cleanCode,
        cleanName,
        cleanCategory,
        parkId,
        cleanLocation,
        cleanUnit,
        commissioningYear ? Number(commissioningYear) : null,
        status || 'OPERATIONAL',
        JSON.stringify(typeof specs === 'object' && specs !== null ? specs : {}),
      ],
    )

    const created = result.rows[0]
    if (!created) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo mới công trình')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'CREATE', 'infrastructure_asset', created.id, {
      assetCode: created.asset_code,
      assetName: created.asset_name,
      parkCode: cleanPark,
      categoryCode: cleanCategory,
    })

    options.eventHub?.publish({
      type: 'infrastructure_asset.created',
      entityType: 'infrastructure_asset',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.asset_code,
        title: created.asset_name,
        parkCode: cleanPark,
        status: status || 'OPERATIONAL',
      },
    })

    return {
      success: true,
      data: {
        id: created.id,
        assetCode: created.asset_code,
        assetName: created.asset_name,
      },
    }
  })

  // Update Asset (DATA_ADMIN only)
  app.patch<{
    Params: { id: string }
    Body: {
      assetName?: string
      categoryCode?: string
      parkCode?: string
      locationDesc?: string
      managingUnit?: string
      commissioningYear?: number | null
      status?: string
      specs?: Record<string, unknown>
    }
  }>('/assets/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; asset_code: string; asset_name: string }>(
      `SELECT id::text, asset_code, asset_name FROM infrastructure.assets WHERE id = $1`,
      [id],
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy công trình hạ tầng')
    }

    const {
      assetName,
      categoryCode,
      parkCode,
      locationDesc,
      managingUnit,
      commissioningYear,
      status,
      specs,
    } = request.body ?? {}

    let parkId: string | undefined = undefined
    if (parkCode !== undefined) {
      const parkResult = await options.database.query<{ id: string }>(
        `SELECT id::text FROM core.industrial_parks WHERE code = $1`,
        [parkCode.trim()],
      )
      const foundPark = parkResult.rows[0]
      if (!foundPark) {
        throw new ApiError(400, 'validation_error', 'Khu công nghiệp không hợp lệ')
      }
      parkId = foundPark.id
    }

    if (categoryCode !== undefined) {
      const catResult = await options.database.query<{ code: string }>(
        `SELECT code FROM infrastructure.asset_categories WHERE code = $1`,
        [categoryCode.trim()],
      )
      if (!catResult.rows.length) {
        throw new ApiError(400, 'validation_error', 'Phân loại hạ tầng không hợp lệ')
      }
    }

    if (status !== undefined && !ALLOWED_ASSET_STATUSES.includes(status as any)) {
      throw new ApiError(400, 'validation_error', 'Trạng thái công trình không hợp lệ')
    }

    const setClauses: string[] = ['updated_at = now()']
    const values: unknown[] = []

    if (assetName !== undefined) {
      if (!assetName.trim()) throw new ApiError(400, 'validation_error', 'Tên công trình không được để trống')
      values.push(assetName.trim())
      setClauses.push(`asset_name = $${values.length}`)
    }
    if (categoryCode !== undefined) {
      values.push(categoryCode.trim())
      setClauses.push(`category_code = $${values.length}`)
    }
    if (parkId !== undefined) {
      values.push(parkId)
      setClauses.push(`industrial_park_id = $${values.length}`)
    }
    if (locationDesc !== undefined) {
      if (!locationDesc.trim()) throw new ApiError(400, 'validation_error', 'Vị trí công trình không được để trống')
      values.push(locationDesc.trim())
      setClauses.push(`location_desc = $${values.length}`)
    }
    if (managingUnit !== undefined) {
      values.push(managingUnit.trim() || 'Tổ Quản lý Vận hành Hạ tầng')
      setClauses.push(`managing_unit = $${values.length}`)
    }
    if (commissioningYear !== undefined) {
      values.push(commissioningYear ? Number(commissioningYear) : null)
      setClauses.push(`commissioning_year = $${values.length}`)
    }
    if (status !== undefined) {
      values.push(status)
      setClauses.push(`status = $${values.length}`)
    }
    if (specs !== undefined) {
      values.push(JSON.stringify(specs ?? {}))
      setClauses.push(`specs = $${values.length}`)
    }

    values.push(id)
    await options.database.query(
      `UPDATE infrastructure.assets
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}`,
      values,
    )

    await recordAuditEvent(options.database, request.user?.id ?? null, 'UPDATE', 'infrastructure_asset', id, {
      ...request.body,
    })

    options.eventHub?.publish({
      type: 'infrastructure_asset.updated',
      entityType: 'infrastructure_asset',
      entityId: id,
      action: 'UPDATE',
      data: {
        title: assetName,
        status,
      },
    })

    return { success: true, message: 'Đã cập nhật thông tin công trình' }
  })

  // Delete Asset (DATA_ADMIN only)
  app.delete<{ Params: { id: string } }>('/assets/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; asset_code: string; asset_name: string }>(
      `SELECT id::text, asset_code, asset_name FROM infrastructure.assets WHERE id = $1`,
      [id],
    )
    const asset = existing.rows[0]
    if (!asset) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy công trình hạ tầng')
    }

    // Check references in maintenance.work_orders
    const ordersRef = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.work_orders WHERE asset_id = $1`,
      [id],
    )
    if (Number(ordersRef.rows[0]?.count ?? 0) > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa công trình "${asset.asset_name}" (${asset.asset_code}) vì đang có lệnh công tác duy tu bảo dưỡng liên kết`,
      )
    }

    // Check references in maintenance.incidents
    const incidentsRef = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.incidents WHERE asset_id = $1`,
      [id],
    )
    if (Number(incidentsRef.rows[0]?.count ?? 0) > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa công trình "${asset.asset_name}" (${asset.asset_code}) vì đang có hồ sơ sự cố kỹ thuật liên kết`,
      )
    }

    // Check references in infrastructure.handovers
    const handoversRef = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM infrastructure.handovers WHERE asset_id = $1`,
      [id],
    )
    if (Number(handoversRef.rows[0]?.count ?? 0) > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa công trình "${asset.asset_name}" (${asset.asset_code}) vì đang có biên bản bàn giao liên kết`,
      )
    }

    // Check references in maintenance.inspections
    const inspectionsRef = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM maintenance.inspections WHERE asset_id = $1`,
      [id],
    )
    if (Number(inspectionsRef.rows[0]?.count ?? 0) > 0) {
      throw new ApiError(
        409,
        'conflict',
        `Không thể xóa công trình "${asset.asset_name}" (${asset.asset_code}) vì đang có phiếu kiểm tra hiện trạng liên kết`,
      )
    }

    await options.database.query(`DELETE FROM infrastructure.assets WHERE id = $1`, [id])

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'infrastructure_asset', id, {
      assetCode: asset.asset_code,
      assetName: asset.asset_name,
    })

    options.eventHub?.publish({
      type: 'infrastructure_asset.deleted',
      entityType: 'infrastructure_asset',
      entityId: id,
      action: 'DELETE',
      data: {
        code: asset.asset_code,
        title: asset.asset_name,
      },
    })

    return { success: true, message: 'Đã xóa công trình hạ tầng thành công' }
  })

  // ==========================================
  // 3. Projects (Read-only overview)
  // ==========================================
  app.get<{ Querystring: ProjectQuery }>('/projects', { preHandler: auth }, async (request) => {
    const { parkCode, status, projectType, fromDate, toDate } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`pr.status = $${values.length}`)
    }
    if (projectType) {
      values.push(projectType)
      clauses.push(`pr.project_type = $${values.length}`)
    }
    if (fromDate) {
      values.push(fromDate)
      clauses.push(`(pr.completion_date IS NULL OR pr.completion_date >= $${values.length}::date)`)
    }
    if (toDate) {
      values.push(toDate)
      clauses.push(`(pr.start_date IS NULL OR pr.start_date <= $${values.length}::date)`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      project_code: string
      project_name: string
      park_code: string
      park_name: string
      project_type: string
      estimated_budget: string
      actual_cost: string
      current_milestone: string
      status: string
      start_date: string | null
      completion_date: string | null
      notes: string | null
    }>(
      `SELECT pr.id::text, pr.project_code, pr.project_name,
              p.code AS park_code, p.name AS park_name,
              pr.project_type, pr.estimated_budget::text, pr.actual_cost::text,
              pr.current_milestone, pr.status, pr.start_date::text,
              pr.completion_date::text, pr.notes
       FROM infrastructure.projects pr
       JOIN core.industrial_parks p ON p.id = pr.industrial_park_id
       ${whereClause}
       ORDER BY pr.project_code ASC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        projectCode: r.project_code,
        projectName: r.project_name,
        parkCode: r.park_code,
        parkName: r.park_name,
        projectType: r.project_type,
        estimatedBudget: Number(r.estimated_budget),
        actualCost: Number(r.actual_cost),
        currentMilestone: r.current_milestone,
        status: r.status,
        startDate: r.start_date,
        completionDate: r.completion_date,
        notes: r.notes,
      })),
    }
  })

  // Create Project (DATA_ADMIN only)
  app.post<{
    Body: {
      projectCode?: string
      projectName: string
      parkCode: string
      projectType: string
      estimatedBudget: number | string
      actualCost?: number | string
      currentMilestone: string
      status?: string
      startDate?: string | null
      completionDate?: string | null
      notes?: string | null
    }
  }>('/projects', { preHandler: adminOnly }, async (request) => {
    const {
      projectCode,
      projectName,
      parkCode,
      projectType,
      estimatedBudget,
      actualCost,
      currentMilestone,
      status,
      startDate,
      completionDate,
      notes,
    } = request.body ?? {}

    const cleanName = typeof projectName === 'string' ? projectName.trim() : ''
    if (!cleanName) {
      throw new ApiError(400, 'validation_error', 'Tên dự án không được để trống')
    }

    const cleanMilestone = typeof currentMilestone === 'string' ? currentMilestone.trim() : ''
    if (!cleanMilestone) {
      throw new ApiError(400, 'validation_error', 'Mốc tiến độ hiện tại không được để trống')
    }

    const cleanParkCode = typeof parkCode === 'string' ? parkCode.trim().toUpperCase() : ''
    const parkRes = await options.database.query<{ id: string; name: string }>(
      `SELECT id::text, name FROM core.industrial_parks WHERE code = $1`,
      [cleanParkCode],
    )
    const park = parkRes.rows[0]
    if (!park) {
      throw new ApiError(400, 'validation_error', `Khu công nghiệp không hợp lệ: ${cleanParkCode}`)
    }

    const allowedTypes = ['NEW_BUILD', 'UPGRADE', 'REPAIR', 'EMERGENCY']
    const cleanType = typeof projectType === 'string' ? projectType.trim().toUpperCase() : 'UPGRADE'
    if (!allowedTypes.includes(cleanType)) {
      throw new ApiError(400, 'validation_error', `Loại dự án không hợp lệ. Cho phép: ${allowedTypes.join(', ')}`)
    }

    const allowedStatuses = ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']
    const cleanStatus = typeof status === 'string' ? status.trim().toUpperCase() : 'PLANNING'
    if (!allowedStatuses.includes(cleanStatus)) {
      throw new ApiError(400, 'validation_error', `Trạng thái không hợp lệ. Cho phép: ${allowedStatuses.join(', ')}`)
    }

    const numBudget = Number(estimatedBudget ?? 0)
    if (isNaN(numBudget) || numBudget < 0) {
      throw new ApiError(400, 'validation_error', 'Dự toán kinh phí phải là số không âm')
    }

    const numActual = Number(actualCost ?? 0)
    if (isNaN(numActual) || numActual < 0) {
      throw new ApiError(400, 'validation_error', 'Kinh phí giải ngân phải là số không âm')
    }

    let cleanCode = typeof projectCode === 'string' ? projectCode.trim().toUpperCase() : ''
    if (!cleanCode) {
      const year = new Date().getFullYear()
      const countRes = await options.database.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM infrastructure.projects WHERE project_code LIKE $1`,
        [`DA-${year}-%`],
      )
      const nextSeq = Number(countRes.rows[0]?.count ?? 0) + 1
      cleanCode = `DA-${year}-${String(nextSeq).padStart(2, '0')}`
    } else {
      const dupRes = await options.database.query(
        `SELECT id FROM infrastructure.projects WHERE project_code = $1`,
        [cleanCode],
      )
      if (dupRes.rows.length) {
        throw new ApiError(409, 'conflict', `Mã dự án "${cleanCode}" đã tồn tại trên hệ thống`)
      }
    }

    const result = await options.database.query<{
      id: string
      project_code: string
      project_name: string
      industrial_park_id: string
      project_type: string
      estimated_budget: string
      actual_cost: string
      current_milestone: string
      status: string
      start_date: string | null
      completion_date: string | null
      notes: string | null
    }>(
      `INSERT INTO infrastructure.projects
       (project_code, project_name, industrial_park_id, project_type,
        estimated_budget, actual_cost, current_milestone, status,
        start_date, completion_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id::text, project_code, project_name, industrial_park_id::text,
                 project_type, estimated_budget::text, actual_cost::text,
                 current_milestone, status, start_date::text, completion_date::text, notes`,
      [
        cleanCode,
        cleanName,
        park.id,
        cleanType,
        numBudget,
        numActual,
        cleanMilestone,
        cleanStatus,
        startDate || null,
        completionDate || null,
        notes?.trim() || null,
      ],
    )

    const created = result.rows[0]
    if (!created) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo dự án hạ tầng')
    }

    await recordAuditEvent(options.database, request.user?.id ?? null, 'CREATE', 'infrastructure_project', created.id, {
      projectCode: cleanCode,
      projectName: cleanName,
    })

    options.eventHub?.publish({
      type: 'infrastructure_project.created',
      entityType: 'infrastructure_project',
      entityId: created.id,
      action: 'CREATE',
      data: {
        code: created.project_code,
        title: created.project_name,
        parkCode: cleanParkCode,
        status: created.status,
      },
    })

    return {
      success: true,
      data: {
        id: created.id,
        projectCode: created.project_code,
        projectName: created.project_name,
        parkCode: cleanParkCode,
        parkName: park.name,
        projectType: created.project_type,
        estimatedBudget: Number(created.estimated_budget),
        actualCost: Number(created.actual_cost),
        currentMilestone: created.current_milestone,
        status: created.status,
        startDate: created.start_date,
        completionDate: created.completion_date,
        notes: created.notes,
      },
    }
  })

  // Update Project (DATA_ADMIN only)
  app.put<{
    Params: { id: string }
    Body: {
      projectName?: string
      parkCode?: string
      projectType?: string
      estimatedBudget?: number | string
      actualCost?: number | string
      currentMilestone?: string
      status?: string
      startDate?: string | null
      completionDate?: string | null
      notes?: string | null
    }
  }>('/projects/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; project_code: string; project_name: string }>(
      `SELECT id::text, project_code, project_name FROM infrastructure.projects WHERE id = $1`,
      [id],
    )
    if (!existing.rows.length) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy dự án hạ tầng')
    }

    const {
      projectName,
      parkCode,
      projectType,
      estimatedBudget,
      actualCost,
      currentMilestone,
      status,
      startDate,
      completionDate,
      notes,
    } = request.body ?? {}

    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []

    if (projectName !== undefined) {
      const cleanName = projectName.trim()
      if (!cleanName) throw new ApiError(400, 'validation_error', 'Tên dự án không được để trống')
      values.push(cleanName)
      setClauses.push(`project_name = $${values.length}`)
    }

    if (parkCode !== undefined) {
      const cleanParkCode = parkCode.trim().toUpperCase()
      const parkRes = await options.database.query<{ id: string }>(
        `SELECT id::text FROM core.industrial_parks WHERE code = $1`,
        [cleanParkCode],
      )
      const targetPark = parkRes.rows[0]
      if (!targetPark) throw new ApiError(400, 'validation_error', `Khu công nghiệp không hợp lệ: ${cleanParkCode}`)
      values.push(targetPark.id)
      setClauses.push(`industrial_park_id = $${values.length}`)
    }

    if (projectType !== undefined) {
      const allowedTypes = ['NEW_BUILD', 'UPGRADE', 'REPAIR', 'EMERGENCY']
      const cleanType = projectType.trim().toUpperCase()
      if (!allowedTypes.includes(cleanType)) throw new ApiError(400, 'validation_error', 'Loại hình không hợp lệ')
      values.push(cleanType)
      setClauses.push(`project_type = $${values.length}`)
    }

    if (estimatedBudget !== undefined) {
      const num = Number(estimatedBudget)
      if (isNaN(num) || num < 0) throw new ApiError(400, 'validation_error', 'Dự toán kinh phí phải là số không âm')
      values.push(num)
      setClauses.push(`estimated_budget = $${values.length}`)
    }

    if (actualCost !== undefined) {
      const num = Number(actualCost)
      if (isNaN(num) || num < 0) throw new ApiError(400, 'validation_error', 'Kinh phí giải ngân phải là số không âm')
      values.push(num)
      setClauses.push(`actual_cost = $${values.length}`)
    }

    if (currentMilestone !== undefined) {
      const cleanMilestone = currentMilestone.trim()
      if (!cleanMilestone) throw new ApiError(400, 'validation_error', 'Mốc tiến độ không được để trống')
      values.push(cleanMilestone)
      setClauses.push(`current_milestone = $${values.length}`)
    }

    if (status !== undefined) {
      const allowedStatuses = ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']
      const cleanStatus = status.trim().toUpperCase()
      if (!allowedStatuses.includes(cleanStatus)) throw new ApiError(400, 'validation_error', 'Trạng thái không hợp lệ')
      values.push(cleanStatus)
      setClauses.push(`status = $${values.length}`)
    }

    if (startDate !== undefined) {
      values.push(startDate || null)
      setClauses.push(`start_date = $${values.length}`)
    }

    if (completionDate !== undefined) {
      values.push(completionDate || null)
      setClauses.push(`completion_date = $${values.length}`)
    }

    if (notes !== undefined) {
      values.push(notes ? notes.trim() : null)
      setClauses.push(`notes = $${values.length}`)
    }

    values.push(id)
    const updated = await options.database.query<{
      id: string
      project_code: string
      project_name: string
      industrial_park_id: string
      project_type: string
      estimated_budget: string
      actual_cost: string
      current_milestone: string
      status: string
      start_date: string | null
      completion_date: string | null
      notes: string | null
    }>(
      `UPDATE infrastructure.projects
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}
       RETURNING id::text, project_code, project_name, industrial_park_id::text,
                 project_type, estimated_budget, actual_cost, current_milestone,
                 status, start_date, completion_date, notes`,
      values,
    )

    await recordAuditEvent(options.database, request.user?.id ?? null, 'UPDATE', 'infrastructure_project', id, {
      ...request.body,
    })

    const row = updated.rows[0]
    options.eventHub?.publish({
      type: 'infrastructure_project.updated',
      entityType: 'infrastructure_project',
      entityId: id,
      action: 'UPDATE',
      data: {
        code: row?.project_code,
        title: row?.project_name,
        status: row?.status,
      },
    })

    return {
      success: true,
      message: 'Đã cập nhật thông tin dự án thành công',
      data: row
        ? {
            id: row.id,
            projectCode: row.project_code,
            projectName: row.project_name,
            parkId: row.industrial_park_id,
            projectType: row.project_type,
            estimatedBudget: Number(row.estimated_budget),
            actualCost: Number(row.actual_cost),
            currentMilestone: row.current_milestone,
            status: row.status,
            startDate: row.start_date,
            completionDate: row.completion_date,
            notes: row.notes,
          }
        : undefined,
    }
  })

  // Delete Project (DATA_ADMIN only)
  app.delete<{ Params: { id: string } }>('/projects/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const existing = await options.database.query<{ id: string; project_code: string; project_name: string }>(
      `SELECT id::text, project_code, project_name FROM infrastructure.projects WHERE id = $1`,
      [id],
    )
    const proj = existing.rows[0]
    if (!proj) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy dự án hạ tầng')
    }

    await options.database.query(`DELETE FROM infrastructure.projects WHERE id = $1`, [id])

    await recordAuditEvent(options.database, request.user?.id ?? null, 'DELETE', 'infrastructure_project', id, {
      projectCode: proj.project_code,
      projectName: proj.project_name,
    })

    options.eventHub?.publish({
      type: 'infrastructure_project.deleted',
      entityType: 'infrastructure_project',
      entityId: id,
      action: 'DELETE',
      data: {
        code: proj.project_code,
        title: proj.project_name,
      },
    })

    return { success: true, message: 'Đã xóa dự án thành công' }
  })
}
