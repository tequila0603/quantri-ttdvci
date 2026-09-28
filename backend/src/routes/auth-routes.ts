import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { authenticate, login, logout } from '../auth.js'

type LoginBody = {
  username: string
  password: string
}

const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    additionalProperties: false,
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 160 },
      password: { type: 'string', minLength: 1, maxLength: 256 },
    },
  },
} as const

export async function authRoutes(
  app: FastifyInstance,
  options: { database: Database; config: AppConfig },
): Promise<void> {
  app.post<{ Body: LoginBody }>('/login', { schema: loginSchema }, async (request, reply) => {
    const user = await login(
      options.database,
      options.config,
      request.body.username.trim(),
      request.body.password,
      reply,
    )
    return reply.send({ success: true, data: user })
  })

  app.post('/logout', async (request, reply) => {
    await logout(options.database, request, reply)
    return reply.send({ success: true, data: null })
  })

  app.get('/me', { preHandler: authenticate(options.database) }, async (request) => ({
    success: true,
    data: request.user,
  }))
}
