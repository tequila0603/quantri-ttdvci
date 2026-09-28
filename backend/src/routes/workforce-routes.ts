import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth.js'
import type { Database } from '../db.js'
import { cursorMeta, integerParam, textParam } from '../http.js'

type EmployeeQuery = {
  search?: string
  unitId?: string
  parkCode?: string
  teamName?: string
  scope?: 'ALL' | 'OFFICE' | 'FIELD'
  limit?: string
  afterId?: string
}

const employeeQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 120 },
      unitId: { type: 'string', pattern: '^[1-9][0-9]*$' },
      parkCode: { type: 'string', maxLength: 60 },
      teamName: { type: 'string', maxLength: 120 },
      scope: { type: 'string', enum: ['ALL', 'OFFICE', 'FIELD'] },
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
    },
  },
} as const

export async function workforceRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const auth = authenticate(options.database)

  app.get('/units', { preHandler: auth }, async () => {
    const result = await options.database.query<{ id: string; name: string; parent_id: string | null }>(
      `SELECT id::text, name, parent_id::text
       FROM core.organizational_units
       WHERE is_active = true
       ORDER BY id ASC`,
    )
    return {
      success: true,
      data: result.rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id })),
    }
  })

  app.get('/parks', { preHandler: auth }, async () => {
    const result = await options.database.query<{ id: string; code: string; name: string }>(
      `SELECT id::text, code, name
       FROM core.industrial_parks
       WHERE is_active = true
       ORDER BY id ASC`,
    )
    return {
      success: true,
      data: result.rows.map((row) => ({ id: row.id, code: row.code, name: row.name })),
    }
  })

  app.get('/teams', { preHandler: auth }, async () => {
    const result = await options.database.query<{ team_name: string }>(
      `SELECT DISTINCT team_name
       FROM workforce.employees
       WHERE is_active = true AND team_name IS NOT NULL
       ORDER BY team_name ASC`,
    )
    return {
      success: true,
      data: result.rows.map((row) => row.team_name),
    }
  })

  app.get<{ Querystring: EmployeeQuery }>('/employees', { schema: employeeQuerySchema, preHandler: auth }, async (request) => {
    const search = textParam(request.query.search, 'search', 120)
    const unitId = integerParam(request.query.unitId, 'unitId', { min: 1 })
    const parkCode = textParam(request.query.parkCode, 'parkCode', 60)
    const teamName = textParam(request.query.teamName, 'teamName', 120)
    const scope = request.query.scope
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: unknown[] = []
    const clauses = ['e.is_active = true']

    if (search) {
      values.push(`%${search}%`)
      clauses.push(`(e.full_name ILIKE $${values.length} OR e.employee_code ILIKE $${values.length} OR e.work_position ILIKE $${values.length} OR e.notes ILIKE $${values.length})`)
    }
    if (unitId !== undefined) {
      values.push(unitId)
      clauses.push(`e.organizational_unit_id = $${values.length}`)
    }
    if (parkCode) {
      values.push(parkCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (teamName) {
      values.push(teamName)
      clauses.push(`e.team_name = $${values.length}`)
    }
    if (scope === 'OFFICE') {
      clauses.push(`e.industrial_park_id IS NULL`)
    } else if (scope === 'FIELD') {
      clauses.push(`e.industrial_park_id IS NOT NULL`)
    }
    if (afterId !== undefined) {
      values.push(afterId)
      clauses.push(`e.id > $${values.length}`)
    }
    values.push(limit + 1)

    const result = await options.database.query<{
      id: string
      employee_code: string | null
      full_name: string
      birth_date: string | null
      unit_id: string | null
      unit_name: string | null
      park_code: string | null
      park_name: string | null
      team_name: string | null
      decision_number: string | null
      notes: string | null
      professional_qualification: string | null
      political_theory: string | null
      state_management: string | null
      foreign_language: string | null
      informatics: string | null
      work_position: string | null
      party_position: string | null
      employment_type: string | null
    }>(
      `SELECT e.id::text,
              e.employee_code,
              e.full_name,
              e.birth_date::text,
              u.id::text AS unit_id,
              u.name AS unit_name,
              p.code AS park_code,
              p.name AS park_name,
              e.team_name,
              e.decision_number,
              e.notes,
              e.professional_qualification,
              e.political_theory,
              e.state_management,
              e.foreign_language,
              e.informatics,
              e.work_position,
              e.party_position,
              e.employment_type
       FROM workforce.employees e
       LEFT JOIN core.organizational_units u ON u.id = e.organizational_unit_id
       LEFT JOIN core.industrial_parks p ON p.id = e.industrial_park_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY e.id ASC
       LIMIT $${values.length}`,
      values,
    )
    const rows = result.rows.map((row) => ({
      id: row.id,
      employeeCode: row.employee_code,
      fullName: row.full_name,
      birthDate: row.birth_date,
      unitId: row.unit_id,
      organizationalUnit: row.unit_name,
      parkCode: row.park_code,
      parkName: row.park_name,
      teamName: row.team_name,
      decisionNumber: row.decision_number,
      notes: row.notes,
      professionalQualification: row.professional_qualification,
      politicalTheory: row.political_theory,
      stateManagement: row.state_management,
      foreignLanguage: row.foreign_language,
      informatics: row.informatics,
      workPosition: row.work_position,
      partyPosition: row.party_position,
      employmentType: row.employment_type,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })
}
