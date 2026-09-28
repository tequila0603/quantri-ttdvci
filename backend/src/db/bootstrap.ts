import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

type BootstrapAccount = {
  username: string
  displayName: string
  roleCode: 'DIRECTOR' | 'DATA_ADMIN'
  roleDisplayName: string
  passwordHash: string
}

const schemaPath = fileURLToPath(new URL('./recovered-local-schema.sql', import.meta.url))
const appliedMigrations = [
  '001_initial_schema.sql',
  '002_fix_annual_lease_snapshot_key.sql',
  '003_seed_initial_accounts.sql',
  '004_infrastructure_and_maintenance.sql',
  '005_coordination_tasks_and_waste.sql',
  '006_workforce_kcn_and_teams.sql',
  '007_workforce_employee_notes.sql',
  '008_field_reports.sql',
  '009_standardize_field_report_categories.sql',
  '010_financial_imports.sql',
  '011_finance_import_runtime_columns.sql',
]

function readBootstrapAccount(value: string | undefined): BootstrapAccount | null {
  if (!value) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('CENTER_INITIAL_ACCOUNT_JSON must contain valid JSON')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('CENTER_INITIAL_ACCOUNT_JSON has an invalid shape')
  }

  const account = parsed as Record<string, unknown>
  const roleCode = account.roleCode
  if (
    typeof account.username !== 'string' || !/^[^\s]{1,64}$/.test(account.username) ||
    typeof account.displayName !== 'string' || !account.displayName.trim() || account.displayName.length > 160 ||
    (roleCode !== 'DIRECTOR' && roleCode !== 'DATA_ADMIN') ||
    typeof account.roleDisplayName !== 'string' || !account.roleDisplayName.trim() || account.roleDisplayName.length > 160 ||
    typeof account.passwordHash !== 'string' || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(account.passwordHash)
  ) {
    throw new Error('CENTER_INITIAL_ACCOUNT_JSON has invalid account fields')
  }

  return {
    username: account.username,
    displayName: account.displayName,
    roleCode,
    roleDisplayName: account.roleDisplayName,
    passwordHash: account.passwordHash,
  }
}

export async function bootstrapDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('center-operations-schema-init')::bigint)")

    const { rows: [state] } = await client.query<{
      hasUserAccounts: boolean
      applicationObjectCount: string
      applicationSchemaCount: string
    }>(`
      SELECT
        to_regclass('auth.user_accounts') IS NOT NULL AS "hasUserAccounts",
        (
          SELECT count(*)::text
          FROM pg_class AS c
          JOIN pg_namespace AS n ON n.oid = c.relnamespace
          WHERE left(n.nspname, 3) <> 'pg_'
            AND n.nspname <> 'information_schema'
            AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        ) AS "applicationObjectCount",
        (
          SELECT count(*)::text
          FROM pg_namespace
          WHERE left(nspname, 3) <> 'pg_'
            AND nspname NOT IN ('information_schema', 'public')
        ) AS "applicationSchemaCount"
    `)

    if (!state) throw new Error('Database state query returned no result')
    if (!state.hasUserAccounts) {
      if (Number(state.applicationObjectCount) !== 0 || Number(state.applicationSchemaCount) !== 0) {
        throw new Error('Database has application objects but no auth.user_accounts table; refusing automatic schema restore')
      }

      const schemaSql = await readFile(schemaPath, 'utf8')
      await client.query(schemaSql)
      await client.query(
        `INSERT INTO core.schema_migrations (filename)
         SELECT filename FROM unnest($1::text[]) AS migrations(filename)
         ON CONFLICT (filename) DO NOTHING`,
        [appliedMigrations],
      )
      await client.query('RESET ALL')
    }

    const account = readBootstrapAccount(process.env.CENTER_INITIAL_ACCOUNT_JSON)
    if (account) {
      await client.query(
        `INSERT INTO auth.roles (code, display_name)
         VALUES ($1, $2)
         ON CONFLICT (code) DO NOTHING`,
        [account.roleCode, account.roleDisplayName],
      )

      const { rows: [existing] } = await client.query<{ password_hash: string | null }>(
        'SELECT password_hash FROM auth.user_accounts WHERE username = $1',
        [account.username],
      )
      if (existing && existing.password_hash !== account.passwordHash) {
        throw new Error('Bootstrap username already exists with a different password hash; refusing to overwrite it')
      }

      if (!existing) {
        await client.query(
          `INSERT INTO auth.user_accounts (username, display_name, role_code, password_hash)
           VALUES ($1, $2, $3, $4)`,
          [account.username, account.displayName, account.roleCode, account.passwordHash],
        )
      }
    }

    await client.query('COMMIT')
    if (account) delete process.env.CENTER_INITIAL_ACCOUNT_JSON
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
