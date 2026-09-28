import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createDatabase } from '../src/db.js'

describe('Reports Summary with Park Filter', () => {
  const config = loadConfig({
    ...process.env,
    DB_PASSWORD: process.env.DB_PASSWORD || 'LocalCenterOps-ChangeMe-2026!',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || 'center_ops',
    DB_USER: process.env.DB_USER || 'center_ops',
  })

  let database: ReturnType<typeof createDatabase>
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie: string
  let sessionHash: string

  before(async () => {
    database = createDatabase(config)
    app = await buildApp({ config, database })

    sessionCookie = 'test-summary-token-' + Date.now()
    sessionHash = createHash('sha256').update(sessionCookie).digest('hex')

    const adminUser = await database.query<{ id: string }>(
      `SELECT id::text FROM auth.user_accounts WHERE role_code = 'DATA_ADMIN' LIMIT 1`,
    )
    assert.ok(adminUser.rows.length > 0, 'DATA_ADMIN user must exist')

    await database.query(
      `INSERT INTO auth.sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [sessionHash, adminUser.rows[0].id],
    )
  })

  after(async () => {
    if (database && sessionHash) {
      await database.query('DELETE FROM auth.sessions WHERE token_hash = $1', [sessionHash])
    }
    if (app) await app.close()
    if (database) await (database as any).end()
  })

  test('GET /reports/summary without parkCode returns system-wide data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/summary?toDate=2026-12-31',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.year, 2026)
    assert.equal(body.data.workforce.activeEmployees, 39)
    assert.equal(body.data.leaseSnapshots, 105)

    const revenueTotal = body.data.revenueByCategory.reduce(
      (acc: number, r: { amount_due: string }) => acc + Number(r.amount_due),
      0,
    )
    assert.ok(
      Math.abs(revenueTotal - 26302441336.75) < 0.01,
      `Expected total 26302441336.75, got ${revenueTotal}`,
    )
  })

  test('GET /reports/summary for KCN_AN_PHU returns scoped metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/summary?toDate=2026-12-31&parkCode=KCN_AN_PHU',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.workforce.activeEmployees, 8)
    assert.equal(body.data.leaseSnapshots, 40)
    assert.equal(body.data.uniqueEnterprises, 39)
    assert.equal(body.data.uniqueLots, 29)

    const revenueTotal = body.data.revenueByCategory.reduce(
      (acc: number, r: { amount_due: string }) => acc + Number(r.amount_due),
      0,
    )
    assert.ok(
      Math.abs(revenueTotal - 9055334965.95) < 0.01,
      `Expected KCN_AN_PHU total 9055334965.95, got ${revenueTotal}`,
    )
  })

  test('GET /reports/summary for KCN_HOA_HIEP_1 returns scoped metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/summary?toDate=2026-12-31&parkCode=KCN_HOA_HIEP_1',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.workforce.activeEmployees, 8)
    assert.equal(body.data.leaseSnapshots, 38)
    assert.equal(body.data.uniqueEnterprises, 37)

    const revenueTotal = body.data.revenueByCategory.reduce(
      (acc: number, r: { amount_due: string }) => acc + Number(r.amount_due),
      0,
    )
    assert.ok(
      Math.abs(revenueTotal - 7678114298.4) < 0.01,
      `Expected KCN_HOA_HIEP_1 total 7678114298.40, got ${revenueTotal}`,
    )
  })

  test('GET /reports/summary for KCN_ONG_BAC_SONG_CAU_KV1 returns scoped metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/summary?toDate=2026-12-31&parkCode=KCN_ONG_BAC_SONG_CAU_KV1',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.workforce.activeEmployees, 5)
    assert.equal(body.data.leaseSnapshots, 27)
    assert.equal(body.data.uniqueEnterprises, 24)

    const revenueTotal = body.data.revenueByCategory.reduce(
      (acc: number, r: { amount_due: string }) => acc + Number(r.amount_due),
      0,
    )
    assert.ok(
      Math.abs(revenueTotal - 9568992072.4) < 0.01,
      `Expected KCN_ONG_BAC_SONG_CAU_KV1 total 9568992072.40, got ${revenueTotal}`,
    )
  })

  test('GET /reports/summary with invalid parkCode returns 404 not_found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/summary?toDate=2026-12-31&parkCode=INVALID_PARK_CODE_XYZ',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 404)
    const body = res.json()
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'not_found')
  })
})
