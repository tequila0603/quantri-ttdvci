import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth.js'
import type { Database } from '../db.js'
import { cursorMeta, integerParam, textParam } from '../http.js'

type ParkQuery = { year?: string }
type EnterpriseQuery = { parkCode?: string; year?: string; limit?: string; afterId?: string; search?: string }

const parkQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { year: { type: 'string', pattern: '^20[0-9]{2}$' } },
  },
} as const

const enterpriseQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    required: ['parkCode'],
    properties: {
      parkCode: { type: 'string', minLength: 1, maxLength: 80 },
      year: { type: 'string', pattern: '^20[0-9]{2}$' },
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
      search: { type: 'string', maxLength: 120 },
    },
  },
} as const

function defaultYear(): number {
  return new Date().getUTCFullYear()
}

export async function enterpriseRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const auth = authenticate(options.database)

  app.get<{ Querystring: ParkQuery }>('/parks', { schema: parkQuerySchema, preHandler: auth }, async (request) => {
    const year = integerParam(request.query.year, 'year', { min: 2000, max: 2200 }) ?? defaultYear()
    const result = await options.database.query<{ id: string; code: string; name: string; enterprise_count: number }>(
      `SELECT p.id::text,
              p.code,
              p.name,
              COUNT(DISTINCT s.enterprise_id)::int AS enterprise_count
       FROM core.industrial_parks p
       LEFT JOIN finance.annual_lease_snapshots s
         ON s.industrial_park_id = p.id
        AND s.reporting_year = $1
       WHERE p.is_active = true
       GROUP BY p.id, p.code, p.name
       ORDER BY p.name`,
      [year],
    )
    return {
      success: true,
      data: result.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, enterpriseCount: row.enterprise_count })),
    }
  })

  app.get<{ Querystring: EnterpriseQuery }>('/', { schema: enterpriseQuerySchema, preHandler: auth }, async (request) => {
    const parkCode = textParam(request.query.parkCode, 'parkCode', 80)
    const year = integerParam(request.query.year, 'year', { min: 2000, max: 2200 }) ?? defaultYear()
    const search = textParam(request.query.search, 'search', 120)?.trim()
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: unknown[] = [parkCode, year]
    const clauses = ['e.is_active = true', 'p.code = $1', 's.reporting_year = $2']

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&')
      values.push(`%${sanitized}%`)
      const pIdx = values.length
      clauses.push(`(
        e.legal_name ILIKE $${pIdx} OR
        e.normalized_name ILIKE $${pIdx} OR
        COALESCE(e.tax_code, '') ILIKE $${pIdx} OR
        COALESCE(s.lot_location, '') ILIKE $${pIdx} OR
        e.id::text ILIKE $${pIdx}
      )`)
    }

    if (afterId !== undefined) {
      values.push(afterId)
      clauses.push(`e.id > $${values.length}`)
    }
    values.push(limit + 1)

    const result = await options.database.query<{
      id: string
      legal_name: string
      tax_code: string | null
      is_active: boolean
      park_code: string
      park_name: string
      lot_location: string
      land_area_m2: string
      source_total_amount: string
      lease_status: string | null
    }>(
      `SELECT e.id::text,
              e.legal_name,
              e.tax_code,
              e.is_active,
              p.code AS park_code,
              p.name AS park_name,
              STRING_AGG(DISTINCT BTRIM(s.lot_location), ' · ' ORDER BY BTRIM(s.lot_location)) AS lot_location,
              COALESCE(SUM(s.land_area_m2), 0)::text AS land_area_m2,
              COALESCE(SUM(s.source_total_amount), 0)::text AS source_total_amount,
              MAX(s.lease_status) AS lease_status
       FROM core.enterprises e
       JOIN finance.annual_lease_snapshots s ON s.enterprise_id = e.id
       JOIN core.industrial_parks p ON p.id = s.industrial_park_id
       WHERE ${clauses.join(' AND ')}
       GROUP BY e.id, e.legal_name, e.tax_code, e.is_active, p.code, p.name
       ORDER BY e.legal_name ASC, e.id ASC
       LIMIT $${values.length}`,
      values,
    )

    const rows = result.rows.map((row) => ({
      id: row.id,
      legalName: row.legal_name,
      taxCode: row.tax_code,
      isActive: row.is_active,
      parkCode: row.park_code,
      parkName: row.park_name,
      lotLocation: row.lot_location,
      landAreaM2: row.land_area_m2,
      sourceTotalAmount: row.source_total_amount,
      leaseStatus: row.lease_status,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })
}
