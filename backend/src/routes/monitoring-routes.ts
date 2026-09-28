import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth.js'
import type { Database } from '../db.js'
import { cursorMeta, dateParam, integerParam, textParam } from '../http.js'
import { fetchPremierPublicData } from '../premier-source.js'

type ObservationQuery = {
  deviceId?: string
  parameterCode?: string
  fromDate?: string
  toDate?: string
  parkCode?: string
  limit?: string
  afterId?: string
}

const observationQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      deviceId: { type: 'string', pattern: '^[1-9][0-9]*$' },
      parameterCode: { type: 'string', maxLength: 80 },
      fromDate: { type: 'string', maxLength: 64 },
      toDate: { type: 'string', maxLength: 64 },
      parkCode: { type: 'string', maxLength: 80 },
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
    },
  },
} as const

export async function monitoringRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const auth = authenticate(options.database)

  app.get('/public', { preHandler: auth }, async (request, reply) => {
    try {
      const data = await fetchPremierPublicData()
      return { success: true, data }
    } catch (error) {
      request.log.error({ err: error }, 'Premier public monitoring data unavailable')
      return reply.status(502).send({
        success: false,
        error: { code: 'premier_unavailable', message: 'Không thể đọc dữ liệu công khai từ Premier' },
      })
    }
  })

  app.get<{ Querystring: ObservationQuery }>('/observations', { schema: observationQuerySchema, preHandler: auth }, async (request) => {
    const deviceId = integerParam(request.query.deviceId, 'deviceId', { min: 1 })
    const parameterCode = textParam(request.query.parameterCode, 'parameterCode', 80)
    const from = dateParam(request.query.fromDate, 'fromDate')
    const to = dateParam(request.query.toDate, 'toDate')
    const parkCode = textParam(request.query.parkCode, 'parkCode', 80)
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 100
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: unknown[] = []
    const clauses: string[] = []

    if (deviceId !== undefined) {
      values.push(deviceId)
      clauses.push(`o.device_id = $${values.length}`)
    }
    if (parameterCode) {
      values.push(parameterCode)
      clauses.push(`p.code = $${values.length}`)
    }
    if (from) {
      values.push(from)
      clauses.push(`o.measured_at >= $${values.length}`)
    }
    if (to) {
      values.push(to)
      clauses.push(`o.measured_at <= $${values.length}`)
    }
    if (parkCode) {
      values.push(parkCode)
      clauses.push(`s.industrial_park_id = (SELECT id FROM core.industrial_parks WHERE code = $${values.length})`)
    }
    if (afterId !== undefined) {
      values.push(afterId)
      clauses.push(`o.id > $${values.length}`)
    }
    values.push(limit + 1)

    const result = await options.database.query<{
      id: string
      station_code: string
      station_name: string
      device_code: string
      parameter_code: string
      parameter_name: string
      unit: string | null
      measured_at: string
      value: string | null
      quality_code: string | null
      provider_record_key: string | null
    }>(
      `SELECT o.id::text,
              s.code AS station_code,
              s.name AS station_name,
              d.external_code AS device_code,
              p.code AS parameter_code,
              p.display_name AS parameter_name,
              p.unit,
              o.measured_at::text,
              o.value::text,
              o.quality_code,
              o.provider_record_key
       FROM monitoring.observations o
       JOIN monitoring.devices d ON d.id = o.device_id
       JOIN monitoring.stations s ON s.id = d.station_id
       JOIN monitoring.parameters p ON p.id = o.parameter_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY o.id ASC
       LIMIT $${values.length}`,
      values,
    )
    const rows = result.rows.map((row) => ({
      id: row.id,
      stationCode: row.station_code,
      stationName: row.station_name,
      deviceCode: row.device_code,
      parameterCode: row.parameter_code,
      parameterName: row.parameter_name,
      unit: row.unit,
      measuredAt: row.measured_at,
      value: row.value,
      qualityCode: row.quality_code,
      providerRecordKey: row.provider_record_key,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })

  app.get('/sync-runs', { preHandler: auth }, async () => {
    const result = await options.database.query<{
      id: string
      provider: string
      status: string
      checkpoint: string | null
      records_received: number
      records_saved: number
      error_message: string | null
      started_at: string
      finished_at: string | null
    }>(
      `SELECT id::text, provider, status, checkpoint, records_received,
              records_saved, error_message, started_at::text, finished_at::text
       FROM monitoring.sync_runs
       ORDER BY id DESC
       LIMIT 50`,
    )
    return {
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        status: row.status,
        checkpoint: row.checkpoint,
        recordsReceived: row.records_received,
        recordsSaved: row.records_saved,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
    }
  })
}
