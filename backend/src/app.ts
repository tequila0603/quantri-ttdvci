import multipart from '@fastify/multipart'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import type { AppConfig } from './config.js'
import { loadConfig } from './config.js'
import { createDatabase, type Database } from './db.js'
import { createKyselyInstance } from './db/kysely.js'
import { registerErrorHandler } from './errors.js'
import { adminRoutes } from './routes/admin-routes.js'
import { authRoutes } from './routes/auth-routes.js'
import { enterpriseRoutes } from './routes/enterprise-routes.js'
import { monitoringRoutes } from './routes/monitoring-routes.js'
import { reportRoutes } from './routes/report-routes.js'
import { workforceRoutes } from './routes/workforce-routes.js'
import { infrastructureRoutes } from './routes/infrastructure-routes.js'
import { maintenanceRoutes } from './routes/maintenance-routes.js'
import { fieldReportRoutes } from './routes/field-report-routes.js'
import { coordinationRoutes } from './routes/coordination-routes.js'
import { wasteRoutes } from './routes/waste-routes.js'
import { createEventHub, type EventHub } from './realtime/event-hub.js'
import { realtimeRoutes } from './realtime/realtime-routes.js'
import { fetchPremierPublicData, type PremierPublicData } from './premier-source.js'

export type AppOptions = {
  config?: AppConfig
  database?: Database
  eventHub?: EventHub
  premierDataProvider?: () => Promise<PremierPublicData | null>
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig()
  const database = options.database ?? createDatabase(config)
  const eventHub = options.eventHub ?? createEventHub(database)
  const ownsDatabase = !options.database
  const app = Fastify({
    logger: { level: config.nodeEnv === 'test' ? 'silent' : 'info' },
    bodyLimit: 1_048_576,
    // ponytail: trust Docker's private bridge range; tighten to proxy IPs if API exposure changes.
    trustProxy: '172.16.0.0/12',
  })

  app.decorateRequest('user', null)
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || origin === 'https://chat.zalo.me' || origin.startsWith('chrome-extension://') || origin === config.corsOrigin) {
        cb(null, true)
        return
      }
      cb(null, true)
    },
    credentials: true,
  })
  // ponytail: one internal API container; use a shared gateway/Redis store before horizontal scaling.
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => `${request.ip}:${request.routeOptions.method}:${request.routeOptions.url}`,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      code: 'rate_limit_exceeded',
      message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
    }),
  })
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'no-referrer')
  })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (typeof body === 'string' && body.trim() === '') {
      done(null, {})
      return
    }
    try {
      const json = JSON.parse(body as string)
      done(null, json)
    } catch (err) {
      done(err as Error, undefined)
    }
  })
  registerErrorHandler(app)

  app.get('/', async () => ({
    success: true,
    data: {
      name: 'center-operations-api',
      version: 'v1',
      status: 'ok',
      endpoints: { health: '/health', readiness: '/ready', api: '/api/v1' },
    },
  }))

  app.get('/health', async () => ({
    success: true,
    data: { status: 'ok', service: 'center-operations-api' },
  }))

  app.get('/ready', async (_request, reply) => {
    try {
      await database.query('SELECT 1')
      return { success: true, data: { status: 'ready' } }
    } catch (error) {
      app.log.error({ err: error }, 'Database readiness check failed')
      return reply.status(503).send({
        success: false,
        error: { code: 'database_unavailable', message: 'Database chưa sẵn sàng' },
      })
    }
  })

  await app.register(authRoutes, { prefix: '/api/v1/auth', database, config })
  await app.register(realtimeRoutes, { prefix: '/api/v1/realtime', database, eventHub })
  await app.register(enterpriseRoutes, { prefix: '/api/v1/enterprises', database })
  const premierDataProvider = options.premierDataProvider ?? (config.nodeEnv === 'test' ? undefined : fetchPremierPublicData)
  await app.register(reportRoutes, { prefix: '/api/v1/reports', database, premierDataProvider })
  await app.register(workforceRoutes, { prefix: '/api/v1/workforce', database })
  await app.register(monitoringRoutes, { prefix: '/api/v1/monitoring', database })
  await app.register(infrastructureRoutes, { prefix: '/api/v1/infrastructure', database, eventHub })
  await app.register(maintenanceRoutes, { prefix: '/api/v1/maintenance', database, eventHub, testMode: config.nodeEnv === 'test' })
  const kyselyDb = createKyselyInstance(database as any);
  await app.register(fieldReportRoutes, { prefix: '/api/v1/maintenance/field-reports', database, kyselyDatabase: kyselyDb, eventHub, testMode: config.nodeEnv === 'test' })
  await app.register(coordinationRoutes, { prefix: '/api/v1/coordination', database })
  await app.register(wasteRoutes, { prefix: '/api/v1/waste', database: kyselyDb as any })
  await app.register(adminRoutes, { prefix: '/api/v1/admin', database, eventHub })

  app.addHook('onClose', async () => {
    eventHub.close()
    if (ownsDatabase && 'end' in database && typeof database.end === 'function') {
      await database.end()
    }
  })
  return app
}
