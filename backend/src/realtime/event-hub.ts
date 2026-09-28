import crypto from 'node:crypto'

export type RealtimeEntityType =
  | 'field_report'
  | 'incident'
  | 'work_order'
  | 'infrastructure_asset'
  | 'infrastructure_project'

export type RealtimeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CONVERT'

export type RealtimeEventPayload = {
  title?: string
  code?: string
  parkCode?: string
  parkName?: string
  reporterName?: string
  severity?: string
  priority?: string
  status?: string
  category?: string
  actorName?: string
  [key: string]: unknown
}

export type RealtimeEvent = {
  id: string
  type: string
  entityType: RealtimeEntityType
  entityId: string
  action: RealtimeAction
  occurredAt: string
  targetRoles?: ('DATA_ADMIN' | 'DIRECTOR')[]
  data?: RealtimeEventPayload
}

export type EventSubscriber = {
  id: string
  listener: (event: RealtimeEvent) => void
  filter?: (event: RealtimeEvent) => boolean
}

/**
 * Giải pháp hiện phù hợp với một API instance. Nếu triển khai nhiều API replica thì thay event bus bằng PostgreSQL LISTEN/NOTIFY hoặc Redis Pub/Sub.
 */
import type { Database } from '../db.js'
import type { PoolClient } from 'pg'

export class EventHub {
  private dbClient: PoolClient | null = null
  private subscribers = new Map<string, EventSubscriber>()

  constructor(private pool?: Database) {
    if (pool) this.initListen().catch(console.error)
  }

  private async initListen() {
    if (!this.pool) return;
    if (typeof (this.pool as any).connect === "function") {
      this.dbClient = await (this.pool as any).connect()
    } else return;
    this.dbClient?.on('notification', (msg) => {
      if (msg.channel === 'app_events' && msg.payload) {
        try {
          const event = JSON.parse(msg.payload)
          for (const sub of this.subscribers.values()) {
            try {
              if (!sub.filter || sub.filter(event)) {
                sub.listener(event)
              }
            } catch (err) {
              console.error('Error dispatching realtime event to subscriber:', err)
            }
          }
        } catch (e) {
          console.error('Error parsing notification', e)
        }
      }
    })
    await this.dbClient?.query('LISTEN app_events')
  }

  publish(
    event: Omit<RealtimeEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string },
    targetRoles?: ('DATA_ADMIN' | 'DIRECTOR')[],
  ): RealtimeEvent {
    const fullEvent: RealtimeEvent = {
      id: event.id ?? crypto.randomUUID(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      type: event.type,
      entityType: event.entityType,
      entityId: String(event.entityId),
      action: event.action,
      targetRoles: targetRoles ?? event.targetRoles,
      data: event.data,
    }

    if (this.pool) {
      this.pool.query('SELECT pg_notify($1, $2)', ['app_events', JSON.stringify(fullEvent)]).catch(console.error)
    } else {
      for (const sub of this.subscribers.values()) {
        try {
          if (!sub.filter || sub.filter(fullEvent)) {
            sub.listener(fullEvent)
          }
        } catch (err) {
          console.error('Error dispatching realtime event to subscriber:', err)
        }
      }
    }

    return fullEvent
  }

  subscribe(
    listener: (event: RealtimeEvent) => void,
    filter?: (event: RealtimeEvent) => boolean,
  ): () => void {
    const subId = crypto.randomUUID()
    this.subscribers.set(subId, { id: subId, listener, filter })

    return () => {
      this.subscribers.delete(subId)
    }
  }

  subscriberCount(): number {
    return this.subscribers.size
  }

  close(): void {
    this.subscribers.clear()
    if (this.dbClient) {
      this.dbClient.release()
      this.dbClient = null
    }
  }
}

export function createEventHub(database?: Database): EventHub {
  return new EventHub(database)
}
