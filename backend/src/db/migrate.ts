import { kyselyDb } from './kysely.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../../db/migrations')
  
  // Create migrations table if not exists
  await sql`
    CREATE SCHEMA IF NOT EXISTS core;
    CREATE TABLE IF NOT EXISTS core.schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.execute(kyselyDb)
  
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  
  for (const file of files) {
    const applied = await kyselyDb.selectFrom('core.schema_migrations' as any)
      .select('filename')
      .where('filename', '=', file)
      .executeTakeFirst()
      
    if (!applied) {
      console.log(`Running migration: ${file}`)
      const filePath = path.join(migrationsDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      
      try {
        await sql.raw(content).execute(kyselyDb)
        await kyselyDb.insertInto('core.schema_migrations' as any)
          .values({ filename: file })
          .execute()
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
