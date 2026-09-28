import { Kysely, PostgresDialect } from 'kysely'
import type { DB } from './schema.js'
import pkg from 'pg'
const { Pool } = pkg

export function createKyselyInstance(pool: any) {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool
    })
  })
}

// Fallback for migrate.ts
export const kyselyDb = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'center_ops',
      user: process.env.DB_USER || 'center_ops',
      password: process.env.DB_PASSWORD,
    })
  })
})
