import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../auth.js'
import type { Database } from '../db.js'
import type { EventHub } from './event-hub.js'

/**
 * Giải pháp hiện phù hợp với một API instance. Nếu triển khai nhiều API replica thì thay event bus bằng PostgreSQL LISTEN/NOTIFY hoặc Redis Pub/Sub.
 */
export async function realtimeRoutes(
  app: FastifyInstance,
  options: { database: Database; eventHub: EventHub },
): Promise<void> {
  const auth = authenticate(options.database)
  const activeStreams = new Set<FastifyReply['raw']>()

  app.addHook('onClose', async () => {
    for (const raw of activeStreams) {
      try {
        if (!raw.writableEnded) {
          raw.end()
        }
      } catch {
        // ignore errors during shutdown
      }
    }
    activeStreams.clear()
  })

  app.get('/events', { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user

    // SSE owns the raw response lifecycle; prevent Fastify from ending it
    // automatically when this async handler resolves after the handshake.
    reply.hijack()

    // Set standard SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    })

    // Establish retry duration and connection handshake comment
    reply.raw.write('retry: 3000\n\n')
    reply.raw.write(': connected\n\n')

    activeStreams.add(reply.raw)

    // Periodic heartbeat to prevent proxy timeouts
    const heartbeatTimer = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(': heartbeat\n\n')
      }
    }, 25000)
    heartbeatTimer.unref()

    // Subscribe to EventHub with role-based filtering
    const unsubscribe = options.eventHub.subscribe(
      (event) => {
        if (reply.raw.writableEnded) return
        reply.raw.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`)
      },
      (event) => {
        // If event specifies targetRoles, ensure current user's role is permitted
        if (event.targetRoles && event.targetRoles.length > 0) {
          return event.targetRoles.includes(user?.roleCode)
        }
        return true
      },
    )

    const cleanup = () => {
      clearInterval(heartbeatTimer)
      unsubscribe()
      activeStreams.delete(reply.raw)
    }

    request.raw.on('close', cleanup)
    reply.raw.on('close', cleanup)
  })
}
