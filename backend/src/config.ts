export type AppConfig = {
  nodeEnv: string
  port: number
  host: string
  dbHost: string
  dbPort: number
  dbName: string
  dbUser: string
  dbPassword: string
  corsOrigin: string
  cookieSecure: boolean
  sessionTtlSeconds: number
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const dbPassword = env.DB_PASSWORD ?? ''

  if (nodeEnv === 'production' && !dbPassword) {
    throw new Error('DB_PASSWORD is required in production')
  }

  return {
    nodeEnv,
    port: integer(env.PORT, 3000),
    host: env.HOST ?? '0.0.0.0',
    dbHost: env.DB_HOST ?? 'localhost',
    dbPort: integer(env.DB_PORT, 5432),
    dbName: env.DB_NAME ?? 'center_ops',
    dbUser: env.DB_USER ?? 'center_ops',
    dbPassword,
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    cookieSecure: env.COOKIE_SECURE === 'true',
    sessionTtlSeconds: integer(env.SESSION_TTL_SECONDS, 8 * 60 * 60),
  }
}
