import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import type { Database } from '../db.js'
import { cursorMeta, integerParam } from '../http.js'
import { financeImportRoutes } from './finance-import-routes.js'
import { createKyselyInstance } from '../db/kysely.js'
import type { EventHub } from '../realtime/event-hub.js'

type PageQuery = { limit?: string; afterId?: string }

const pageQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
      afterId: { type: 'string', pattern: '^[1-9][0-9]*$' },
    },
  },
} as const

export async function adminRoutes(app: FastifyInstance, options: { database: Database, eventHub?: EventHub }): Promise<void> {
  const adminOnly = [authenticate(options.database), requireRole('DATA_ADMIN')]

  app.get<{ Querystring: PageQuery }>('/imports', { schema: pageQuerySchema, preHandler: adminOnly }, async (request) => {
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: any[] = [limit + 1]
    let where = ''
    if (afterId !== undefined) {
      where = 'WHERE id < $2'
      values.push(afterId)
    }
    const result = await options.database.query(
      `SELECT id, source_file, source_sha256, import_kind, status, imported_by_user_id, created_at, total_rows, accepted_rows, rejected_rows, duplicate_rows, total_amount, reporting_period 
       FROM ingest.import_batches ${where} ORDER BY id DESC LIMIT $1`,
      values,
    )
    const rows = result.rows.map((row: any) => ({
      id: row.id,
      sourceFile: row.source_file,
      sourceSha256: row.source_sha256,
      importKind: row.import_kind,
      status: row.status,
      importedByUserId: row.imported_by_user_id,
      createdAt: row.created_at,
      totalRows: row.total_rows,
      acceptedRows: row.accepted_rows,
      rejectedRows: row.rejected_rows,
      duplicateRows: row.duplicate_rows,
      totalAmount: row.total_amount,
      reportingPeriod: row.reporting_period,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })
  
  app.get<{ Params: { batchId: string } }>('/imports/:batchId', { preHandler: adminOnly }, async (request, reply) => {
    const batchId = request.params.batchId
    const res = await options.database.query(`SELECT * FROM ingest.import_batches WHERE id = $1`, [batchId])
    const batch = res.rows[0]
    if (!batch) return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'Not found' } })
    
    const errRes = await options.database.query(`SELECT * FROM ingest.import_rows WHERE batch_id = $1 AND status != 'VALID'`, [batch.id])
    return { success: true, data: { batch, errors: errRes.rows } }
  })

  app.get<{ Querystring: PageQuery }>('/audit-events', { schema: pageQuerySchema, preHandler: adminOnly }, async (request) => {
    const limit = integerParam(request.query.limit, 'limit', { min: 1, max: 100 }) ?? 50
    const afterId = integerParam(request.query.afterId, 'afterId', { min: 1 })
    const values: any[] = [limit + 1]
    let where = ''
    if (afterId !== undefined) {
      where = 'WHERE id < $2'
      values.push(afterId)
    }
    const result = await options.database.query(
      `SELECT id, actor_user_id, action, entity_type, entity_id, source, payload, created_at FROM audit.events ${where} ORDER BY id DESC LIMIT $1`,
      values,
    )
    const rows = result.rows.map((row: any) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      payload: row.payload,
      createdAt: row.created_at,
    }))
    return { success: true, ...cursorMeta(rows, limit) }
  })
  
  // Register finance routes, create a Kysely instance from the db pool if available. 
  // In tests, pool might be mocked so kysely might not work, but we will pass what we can.
  if (options.eventHub) {
    const kyselyDb = createKyselyInstance(options.database as any)
    await app.register(financeImportRoutes, { database: kyselyDb, authDatabase: options.database, eventHub: options.eventHub })
  }
}
