import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth.js'
import type { Database } from '../db.js'
import { ApiError } from '../errors.js'
import type { PremierPublicData } from '../premier-source.js'
import { integerParam, cursorMeta, textParam } from '../http.js'
import { createAggregateReportDocx } from '../reporting/docx.js'
import {
  aggregateSectionIds,
  buildAggregateReport,
  fingerprintReport,
  type AggregateReportRequest,
} from '../reporting/model.js'

type SummaryQuery = { fromDate?: string; toDate?: string; parkCode?: string }
type LeaseQuery = {
  fromDate?: string
  toDate?: string
  enterpriseId?: string
  parkCode?: string
  limit?: string
  afterId?: string
}
type ReceivablesQuery = {
  fromDate?: string
  toDate?: string
  parkCode?: string
  enterpriseId?: string
  categoryCode?: string
  limit?: string
  afterId?: string
}

async function loadPremierData(
  request: { log: { warn: (context: unknown, message: string) => void } },
  provider: (() => Promise<PremierPublicData | null>) | undefined,
  includeMonitoring: boolean,
): Promise<PremierPublicData | null> {
  if (!includeMonitoring || !provider) return null
  try {
    return await provider()
  } catch (error) {
    request.log.warn({ err: error }, 'Premier monitoring data unavailable for aggregate report')
    return null
  }
}

const yearQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fromDate: { type: 'string', format: 'date' },
      toDate: { type: 'string', format: 'date' },
      parkCode: { type: 'string', maxLength: 80 }
    },
  },
} as const

const leaseQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fromDate: { type: 'string', format: 'date' },
      toDate: { type: 'string', format: 'date' },
      enterpriseId: { type: 'string', pattern: '^[1-9][0-9]*$' },
      parkCode: { type: 'string', maxLength: 80 },
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
    },
  },
} as const

const receivablesQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fromDate: { type: 'string', format: 'date' },
      toDate: { type: 'string', format: 'date' },
      parkCode: { type: 'string', maxLength: 80 },
      enterpriseId: { type: 'string', pattern: '^[1-9][0-9]*$' },
      categoryCode: { type: 'string', maxLength: 80 },
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
    },
  },
} as const

const categoryCodes = new Set([
  'WASTEWATER',
  'WASTE_TREATMENT',
  'WASTE_TRANSPORT',
  'OTHER_SERVICE',
  'INFRASTRUCTURE_SERVICE_LEASE',
  'RAW_LAND_LEASE',
  'INFRASTRUCTURE_ASSET_LEASE',
])

const aggregateBodyProperties = {
  
  periodLabel: { type: 'string', minLength: 1, maxLength: 150 },
  fromDate: { type: 'string', format: 'date' },
  toDate: { type: 'string', format: 'date' },
  parkCode: { anyOf: [{ type: 'string', minLength: 1, maxLength: 80 }, { type: 'null' }] },
  sections: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: aggregateSectionIds } },
} as const

const aggregatePreviewSchema = {
  body: {
    type: 'object', additionalProperties: false,
    required: ['periodLabel', 'fromDate', 'toDate', 'parkCode', 'sections'],
    properties: aggregateBodyProperties,
  },
} as const

const aggregateDocxSchema = {
  body: {
    type: 'object', additionalProperties: false,
    required: ['periodLabel', 'fromDate', 'toDate', 'parkCode', 'sections', 'expectedFingerprint'],
    properties: { ...aggregateBodyProperties, expectedFingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
  },
} as const

function defaultYear(): number {
  return new Date().getUTCFullYear()
}

export async function reportRoutes(app: FastifyInstance, options: { database: Database; premierDataProvider?: () => Promise<PremierPublicData | null> }): Promise<void> {
  const auth = authenticate(options.database)

  app.post<{ Body: AggregateReportRequest }>('/aggregate/preview', { schema: aggregatePreviewSchema, preHandler: auth }, async (request) => {
    const input = validateAggregateRequest(request.body)
    const premierData = await loadPremierData(request, options.premierDataProvider, input.sections.includes('monitoring'))
    const model = await buildAggregateReport(options.database, input, premierData)
    return { success: true, data: { fingerprint: fingerprintReport(model), model } }
  })

  app.post<{ Body: AggregateReportRequest }>('/aggregate/docx', { schema: aggregateDocxSchema, preHandler: auth }, async (request, reply) => {
    const input = validateAggregateRequest(request.body)
    const premierData = await loadPremierData(request, options.premierDataProvider, input.sections.includes('monitoring'))
    const model = await buildAggregateReport(options.database, input, premierData)
    const fingerprint = fingerprintReport(model)
    if (input.expectedFingerprint !== fingerprint) {
      throw new ApiError(409, 'report_data_changed', 'Dữ liệu báo cáo đã thay đổi; vui lòng xem trước lại trước khi tải xuống')
    }
    const content = await createAggregateReportDocx(model)
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .header('Content-Disposition', `attachment; filename="bao-cao-tong-hop.docx"`)
      .header('X-Report-Fingerprint', fingerprint)
      .send(content)
  })

  app.get<{ Querystring: SummaryQuery }>('/summary', { schema: yearQuerySchema, preHandler: auth }, async (request) => {
    const fromDate = request.query.fromDate
    const toDate = request.query.toDate
    const parkCode = request.query.parkCode?.trim() || undefined
    const year = toDate ? parseInt(toDate.substring(0, 4), 10) : defaultYear()

    let parkId: string | null = null
    if (parkCode) {
      const parkCheck = await options.database.query<{ id: string }>(
        'SELECT id::text FROM core.industrial_parks WHERE code = $1 AND is_active = true',
        [parkCode],
      )
      const parkRow = parkCheck.rows[0]
      if (!parkRow) {
        throw new ApiError(404, 'not_found', 'Không tìm thấy khu công nghiệp')
      }
      parkId = parkRow.id
    }

    const [categoryResult, workforceResult, leaseResult, receivableResult, paymentResult] = await Promise.all([
      options.database.query<{ code: string; display_name: string; amount_due: string }>(
        `SELECT sc.code, sc.display_name,
                COALESCE(SUM(
                  CASE
                    WHEN s.reporting_year = $1 AND ($2::bigint IS NULL OR s.industrial_park_id = $2)
                    THEN ac.amount_due
                    ELSE 0
                  END
                ), 0)::text AS amount_due
         FROM finance.service_categories sc
         LEFT JOIN finance.annual_charges ac ON ac.category_code = sc.code
         LEFT JOIN finance.annual_lease_snapshots s ON s.id = ac.snapshot_id
         GROUP BY sc.code, sc.display_name
         ORDER BY sc.code`,
        [year, parkId],
      ),
      options.database.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM workforce.employees e
         WHERE e.is_active = true AND ($1::bigint IS NULL OR e.industrial_park_id = $1)`,
        [parkId],
      ),
      options.database.query<{ total: number; unique_enterprises: number; unique_lots: number; total_amount: string }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT s.enterprise_id)::int AS unique_enterprises,
                COUNT(DISTINCT s.lot_location)::int AS unique_lots,
                COALESCE(SUM(s.source_total_amount), 0)::text AS total_amount
         FROM finance.annual_lease_snapshots s
         WHERE s.reporting_year = $1 AND ($2::bigint IS NULL OR s.industrial_park_id = $2)`,
        [year, parkId],
      ),
      options.database.query<{ total: number; amount_outstanding: string }>(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(b.amount_outstanding), 0)::text AS amount_outstanding
         FROM finance.invoice_line_balances b
         JOIN finance.invoices i ON i.id = b.invoice_id
         WHERE i.status = 'VALID'
           AND ($1::bigint IS NULL OR i.enterprise_id IN (
             SELECT DISTINCT enterprise_id FROM finance.annual_lease_snapshots WHERE industrial_park_id = $1
           ))`,
        [parkId],
      ),
      options.database.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM finance.payments p
         WHERE ($1::bigint IS NULL OR p.enterprise_id IN (
           SELECT DISTINCT enterprise_id FROM finance.annual_lease_snapshots WHERE industrial_park_id = $1
         ))`,
        [parkId],
      ),
    ])

    return {
      success: true,
      data: {
        year,
        workforce: { activeEmployees: workforceResult.rows[0]?.total ?? 0 },
        leaseSnapshots: leaseResult.rows[0]?.total ?? 0,
        uniqueEnterprises: leaseResult.rows[0]?.unique_enterprises ?? 0,
        uniqueLots: leaseResult.rows[0]?.unique_lots ?? 0,
        totalReceivableAmount: leaseResult.rows[0]?.total_amount ?? '0.00',
        revenueByCategory: categoryResult.rows,
        receivables: {
          invoiceLines: receivableResult.rows[0]?.total ?? 0,
          amountOutstanding: receivableResult.rows[0]?.amount_outstanding ?? '0.00',
        },
        dataStatus: {
          actualPaymentsImported: (paymentResult.rows[0]?.total ?? 0) > 0,
          note: 'Bảng đất thuê hiện là dữ liệu phải thu theo nguồn; thanh toán thực tế chỉ hiển thị sau khi có dữ liệu hóa đơn và chứng từ nộp tiền.',
        },
      },
    }
  })

  app.get<{ Querystring: LeaseQuery }>('/lease-annual', { schema: leaseQuerySchema, preHandler: auth }, async (request) => {
    const fromDate = request.query.fromDate; const toDate = request.query.toDate; const parkCode = request.query.parkCode; const year = toDate ? parseInt(toDate.substring(0, 4)) : defaultYear();
    const enterpriseId = integerParam(request.query.enterpriseId, 'enterpriseId', { min: 1 })
    
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: unknown[] = [year]
    const clauses = ['s.reporting_year = $1']

    if (enterpriseId !== undefined) {
      values.push(enterpriseId)
      clauses.push(`s.enterprise_id = $${values.length}`)
    }
    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (afterId !== undefined) {
      values.push(afterId)
      clauses.push(`s.id > $${values.length}`)
    }
    values.push(limit + 1)

    const result = await options.database.query<{
      id: string
      enterprise_id: string
      enterprise_name: string
      park_code: string
      park_name: string
      reporting_year: number
      lot_location: string
      land_area_m2: string
      lease_status: string | null
      source_total_amount: string
      raw_land_lease_amount: string
      infrastructure_asset_lease_amount: string
      infrastructure_service_lease_amount: string
    }>(
      `SELECT s.id::text,
              e.id::text AS enterprise_id,
              e.legal_name AS enterprise_name,
              p.code AS park_code,
              p.name AS park_name,
              s.reporting_year,
              s.lot_location,
              s.land_area_m2::text,
              s.lease_status,
              COALESCE(s.source_total_amount, 0)::text AS source_total_amount,
              COALESCE(MAX(CASE WHEN ac.category_code = 'RAW_LAND_LEASE' THEN ac.amount_due END), 0)::text AS raw_land_lease_amount,
              COALESCE(MAX(CASE WHEN ac.category_code = 'INFRASTRUCTURE_ASSET_LEASE' THEN ac.amount_due END), 0)::text AS infrastructure_asset_lease_amount,
              COALESCE(MAX(CASE WHEN ac.category_code = 'INFRASTRUCTURE_SERVICE_LEASE' THEN ac.amount_due END), 0)::text AS infrastructure_service_lease_amount
       FROM finance.annual_lease_snapshots s
       JOIN core.enterprises e ON e.id = s.enterprise_id
       JOIN core.industrial_parks p ON p.id = s.industrial_park_id
       LEFT JOIN finance.annual_charges ac ON ac.snapshot_id = s.id
       WHERE ${clauses.join(' AND ')}
       GROUP BY s.id, e.id, e.legal_name, p.code, p.name
       ORDER BY s.id ASC
       LIMIT $${values.length}`,
      values,
    )

    const rows = result.rows.map((row) => ({
      id: row.id,
      enterpriseId: row.enterprise_id,
      enterpriseName: row.enterprise_name,
      parkCode: row.park_code,
      parkName: row.park_name,
      year: row.reporting_year,
      lotLocation: row.lot_location,
      landAreaM2: row.land_area_m2,
      leaseStatus: row.lease_status,
      sourceTotalAmount: row.source_total_amount,
      amounts: {
        rawLandLease: row.raw_land_lease_amount,
        infrastructureAssetLease: row.infrastructure_asset_lease_amount,
        infrastructureServiceLease: row.infrastructure_service_lease_amount,
      },
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })

  app.get<{ Querystring: ReceivablesQuery }>('/receivables', { schema: receivablesQuerySchema, preHandler: auth }, async (request) => {
    const enterpriseId = integerParam(request.query.enterpriseId, 'enterpriseId', { min: 1 })
    const categoryCode = textParam(request.query.categoryCode, 'categoryCode', 80)
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: unknown[] = []
    const clauses = ["i.status = 'VALID'"]

    if (enterpriseId !== undefined) {
      values.push(enterpriseId)
      clauses.push(`b.enterprise_id = $${values.length}`)
    }
    if (categoryCode) {
      if (!categoryCodes.has(categoryCode)) {
        return { success: true, data: [], meta: { limit, hasNext: false, nextCursor: null } }
      }
      values.push(categoryCode)
      clauses.push(`b.category_code = $${values.length}`)
    }
    if (afterId !== undefined) {
      values.push(afterId)
      clauses.push(`b.invoice_line_id > $${values.length}`)
    }
    values.push(limit + 1)

    const result = await options.database.query<{
      id: string
      invoice_id: string
      invoice_number: string
      enterprise_id: string
      enterprise_name: string
      category_code: string
      issued_on: string | null
      due_on: string | null
      amount_due: string
      amount_paid: string
      amount_adjusted: string
      amount_outstanding: string
    }>(
      `SELECT b.invoice_line_id::text AS id,
              b.invoice_id::text AS invoice_id,
              i.invoice_number,
              b.enterprise_id::text AS enterprise_id,
              e.legal_name AS enterprise_name,
              b.category_code,
              i.issued_on::text,
              i.due_on::text,
              b.amount_due::text,
              b.amount_paid::text,
              b.amount_adjusted::text,
              b.amount_outstanding::text
       FROM finance.invoice_line_balances b
       JOIN finance.invoices i ON i.id = b.invoice_id
       JOIN core.enterprises e ON e.id = b.enterprise_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY b.invoice_line_id ASC
       LIMIT $${values.length}`,
      values,
    )
    const rows = result.rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      enterpriseId: row.enterprise_id,
      enterpriseName: row.enterprise_name,
      categoryCode: row.category_code,
      issuedOn: row.issued_on,
      dueOn: row.due_on,
      amountDue: row.amount_due,
      amountPaid: row.amount_paid,
      amountAdjusted: row.amount_adjusted,
      amountOutstanding: row.amount_outstanding,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })
}

function validateAggregateRequest(request: AggregateReportRequest): AggregateReportRequest {
  const from = parseIsoDate(request.fromDate)
  const to = parseIsoDate(request.toDate)
  if (from > to) throw new ApiError(400, 'invalid_report_period', 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc')
  if (false) {
    throw new ApiError(400, 'invalid_report_period', 'Khoảng thời gian phải nằm trong năm báo cáo')
  }
  if (!request.periodLabel.trim()) throw new ApiError(400, 'invalid_report_period', 'Kỳ báo cáo không được để trống')
  if (request.parkCode !== null && !request.parkCode.trim()) {
    throw new ApiError(400, 'invalid_park_code', 'Mã khu công nghiệp không được để trống')
  }
  return {
    ...request,
    periodLabel: request.periodLabel.trim(),
    parkCode: request.parkCode?.trim() || null,
  }
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, 'invalid_report_period', 'Ngày báo cáo không hợp lệ')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'invalid_report_period', 'Ngày báo cáo không hợp lệ')
  }
  return date
}
