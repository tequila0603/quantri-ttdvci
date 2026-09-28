import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createDatabase } from '../src/db.js'

describe('Enterprises Instant Search API', () => {
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

    sessionCookie = 'test-ent-search-token-' + Date.now()
    sessionHash = createHash('sha256').update(sessionCookie).digest('hex')

    const user = await database.query<{ id: string }>(
      `SELECT id::text FROM auth.user_accounts WHERE is_active = true LIMIT 1`,
    )
    assert.ok(user.rows.length > 0, 'Active user must exist')

    await database.query(
      `INSERT INTO auth.sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [sessionHash, user.rows[0]?.id],
    )
  })

  after(async () => {
    if (database && sessionHash) {
      await database.query('DELETE FROM auth.sessions WHERE token_hash = $1', [sessionHash])
    }
    if (app) await app.close()
    if (database) await (database as any).end()
  })

  test('GET /enterprises without search returns all enterprises for park', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.ok(body.data.length > 0)
  })

  test('GET /enterprises with name substring returns matching enterprises', async () => {
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=10',
      cookies: { center_session: sessionCookie },
    })
    const first = allRes.json().data[0]
    assert.ok(first, 'Should have at least one enterprise')

    const searchTerm = first.legalName.substring(0, 5)
    const searchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100&search=${encodeURIComponent(searchTerm)}`,
      cookies: { center_session: sessionCookie },
    })

    assert.equal(searchRes.statusCode, 200)
    const body = searchRes.json()
    assert.equal(body.success, true)
    assert.ok(body.data.length > 0)
    const matches = body.data.some((e: any) => e.id === first.id)
    assert.ok(matches, 'First enterprise should be in search results')
  })

  test('GET /enterprises search is case-insensitive and trims whitespace', async () => {
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=10',
      cookies: { center_session: sessionCookie },
    })
    const first = allRes.json().data[0]
    const word = first.legalName.split(' ')[0] || 'A'

    const lowerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100&search=${encodeURIComponent('  ' + word.toLowerCase() + '  ')}`,
      cookies: { center_session: sessionCookie },
    })

    const upperRes = await app.inject({
      method: 'GET',
      url: `/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100&search=${encodeURIComponent(word.toUpperCase())}`,
      cookies: { center_session: sessionCookie },
    })

    assert.equal(lowerRes.statusCode, 200)
    assert.equal(upperRes.statusCode, 200)
    assert.equal(lowerRes.json().data.length, upperRes.json().data.length)
  })

  test('GET /enterprises search by tax_code works', async () => {
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=10',
      cookies: { center_session: sessionCookie },
    })
    const withTax = allRes.json().data.find((e: any) => e.taxCode)
    if (withTax) {
      const searchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100&search=${encodeURIComponent(withTax.taxCode)}`,
        cookies: { center_session: sessionCookie },
      })
      assert.equal(searchRes.statusCode, 200)
      const data = searchRes.json().data
      assert.ok(data.length > 0)
      assert.ok(data.some((e: any) => e.taxCode === withTax.taxCode))
    }
  })

  test('GET /enterprises returns empty data for non-matching search term', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026&limit=100&search=KHONG_TON_TAI_XYZ_9999',
      cookies: { center_session: sessionCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.length, 0)
  })
})
