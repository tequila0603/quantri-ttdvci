import type { Database } from './db.js'

export async function recordAuditEvent(
  database: any,
  actorUserId: string | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string | number | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const numericEntityId = entityId !== null && !Number.isNaN(Number(entityId)) ? Number(entityId) : null
    
    if (database.insertInto) {
      await database.insertInto('audit.events')
        .values({
           actor_user_id: actorUserId ? Number(actorUserId) : null,
           action,
           entity_type: entityType,
           entity_id: numericEntityId,
           source: 'api',
           payload: JSON.stringify(payload)
        })
        .execute()
    } else {
      await database.query(
        `INSERT INTO audit.events (actor_user_id, action, entity_type, entity_id, source, payload)
         VALUES ($1, $2, $3, $4, 'api', $5)`,
        [
          actorUserId ? Number(actorUserId) : null,
          action,
          entityType,
          numericEntityId,
          JSON.stringify(payload),
        ],
      )
    }
  } catch (err) {
    console.error('Failed to record audit event:', err)
  }
}
