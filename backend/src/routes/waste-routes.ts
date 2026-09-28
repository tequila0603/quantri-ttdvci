import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import type { Database } from '../db.js'

type WasteQuery = {
  year?: string
  quarter?: string
  parkCode?: string
}

export async function wasteRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const auth = authenticate(options.database)
  const adminOnly = [auth, requireRole('DATA_ADMIN')]

  // 1. Get Enterprise Waste & Wastewater Records
  app.get<{ Querystring: WasteQuery }>('/records', { preHandler: auth }, async (request) => {
    const { year, quarter, parkCode } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (year) {
      values.push(Number(year))
      clauses.push(`w.reporting_year = $${values.length}`)
    }
    if (quarter) {
      values.push(Number(quarter))
      clauses.push(`w.reporting_quarter = $${values.length}`)
    }
    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      enterprise_id: string
      enterprise_name: string
      park_code: string
      park_name: string
      reporting_year: number
      reporting_quarter: number | null
      wastewater_m3: string
      solid_waste_kg: string
      raw_wastewater_value: string | null
      raw_wastewater_unit: string
      raw_waste_value: string | null
      raw_waste_unit: string
      source_type: string
      status: string
      notes: string | null
      created_at: string
    }>(
      `SELECT w.id::text, w.enterprise_id::text, e.legal_name AS enterprise_name,
              p.code AS park_code, p.name AS park_name,
              w.reporting_year, w.reporting_quarter,
              w.wastewater_m3::text, w.solid_waste_kg::text,
              w.raw_wastewater_value::text, w.raw_wastewater_unit,
              w.raw_waste_value::text, w.raw_waste_unit,
              w.source_type, w.status, w.notes, w.created_at::text
       FROM environmental.waste_records w
       JOIN core.enterprises e ON e.id = w.enterprise_id
       JOIN core.industrial_parks p ON p.id = w.industrial_park_id
       ${whereClause}
       ORDER BY w.reporting_year DESC, w.reporting_quarter DESC, e.legal_name ASC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        enterpriseId: r.enterprise_id,
        enterpriseName: r.enterprise_name,
        parkCode: r.park_code,
        parkName: r.park_name,
        reportingYear: r.reporting_year,
        reportingQuarter: r.reporting_quarter,
        wastewaterM3: Number(r.wastewater_m3 || 0),
        solidWasteKg: Number(r.solid_waste_kg || 0),
        rawWastewaterValue: r.raw_wastewater_value ? Number(r.raw_wastewater_value) : null,
        rawWastewaterUnit: r.raw_wastewater_unit,
        rawWasteValue: r.raw_waste_value ? Number(r.raw_waste_value) : null,
        rawWasteUnit: r.raw_waste_unit,
        sourceType: r.source_type,
        status: r.status,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    }
  })

  // 2. Get PDF Ingestion Queue
  app.get('/pdf-queue', { preHandler: auth }, async () => {
    const result = await options.database.query<{
      id: string
      file_name: string
      sha256: string
      enterprise_name: string
      park_name: string
      reporting_period: string
      extracted_wastewater_m3: string | null
      extracted_waste_kg: string | null
      confidence_score: string
      is_scanned: boolean
      status: string
      page_reference: string | null
      notes: string | null
      created_at: string
    }>(
      `SELECT id::text, file_name, sha256, enterprise_name, park_name,
              reporting_period, extracted_wastewater_m3::text,
              extracted_waste_kg::text, confidence_score::text,
              is_scanned, status, page_reference, notes, created_at::text
       FROM environmental.pdf_documents
       ORDER BY created_at DESC`,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        fileName: r.file_name,
        sha256: r.sha256,
        enterpriseName: r.enterprise_name,
        parkName: r.park_name,
        reportingPeriod: r.reporting_period,
        extractedWastewaterM3: r.extracted_wastewater_m3 ? Number(r.extracted_wastewater_m3) : null,
        extractedWasteKg: r.extracted_waste_kg ? Number(r.extracted_waste_kg) : null,
        confidenceScore: Number(r.confidence_score),
        isScanned: r.is_scanned,
        status: r.status,
        pageReference: r.page_reference,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    }
  })

  // 3. Confirm / Reject PDF Document (DATA_ADMIN only)
  app.post<{
    Params: { id: string }
    Body: { status: 'CONFIRMED' | 'REJECTED'; notes?: string }
  }>('/pdf-queue/:id/confirm', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const { status, notes } = request.body

    const user = request.user
    if (!user) throw new Error('Yêu cầu xác thực')

    await options.database.query(
      `UPDATE environmental.pdf_documents
       SET status = $1,
           notes = COALESCE($2, notes),
           verified_by_user_id = $3,
           verified_at = now()
       WHERE id = $4`,
      [status, notes ?? null, user.id, id],
    )

    return { success: true, message: status === 'CONFIRMED' ? 'Đã xác nhận dữ liệu PDF' : 'Đã từ chối tệp PDF' }
  })
}
