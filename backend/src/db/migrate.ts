import { kyselyDb } from './kysely.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../../db/migrations')

  const { rows: [state] } = await sql<{
    hasLedger: boolean
    hasApplicationSchemas: boolean
  }>`
    SELECT
      to_regclass('core.schema_migrations') IS NOT NULL AS "hasLedger",
      EXISTS (
        SELECT 1 FROM pg_namespace
        WHERE left(nspname, 3) <> 'pg_'
          AND nspname NOT IN ('information_schema', 'public')
      ) AS "hasApplicationSchemas"
  `.execute(kyselyDb)

  if (!state?.hasLedger && state?.hasApplicationSchemas) {
    throw new Error('Application schemas exist without a migration ledger; refusing to replay the initial schema')
  }

  let hasLedger = state?.hasLedger ?? false
  
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const applied = hasLedger
      ? await kyselyDb.selectFrom('core.schema_migrations' as any)
        .select('filename')
        .where('filename', '=', file)
        .executeTakeFirst()
      : undefined

    if (!applied) {
      console.log(`Running migration: ${file}`)
      const filePath = path.join(migrationsDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      
      try {
        await sql.raw(content).execute(kyselyDb)
        await kyselyDb.insertInto('core.schema_migrations' as any)
          .values({ filename: file })
          .onConflict((conflict) => conflict.column('filename').doNothing())
          .execute()
        hasLedger = true
        console.log(`Successfully applied: ${file}`)
      } catch (err) {
        console.error(`Error applying migration ${file}:`, err)
        process.exit(1)
      }
    }
  }
  
  console.log('All migrations applied successfully.')
  process.exit(0)
}

runMigrations()
