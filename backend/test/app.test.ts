import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { QueryResult, QueryResultRow } from 'pg'
import type { AppConfig } from '../src/config.js'
import { buildApp } from '../src/app.js'

class FakeDatabase {
  public deletedFieldReport = false
  public auditValues: unknown[] | null = null

  constructor(private readonly mode: 'empty' | 'director' | 'admin' | 'admin-field-report' = 'empty') {}

  async query<T extends QueryResultRow = QueryResultRow>(text: string, _values?: unknown[]): Promise<QueryResult<T>> {
    if (text.includes('FROM auth.sessions')) {
      const roleCode = this.mode === 'admin' || this.mode === 'admin-field-report' ? 'DATA_ADMIN' : 'DIRECTOR'
      return {
        rows: [{ id: '1', username: 'test', display_name: 'Test', role_code: roleCode }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }
    if (this.mode === 'admin-field-report' && text.includes('DELETE FROM maintenance.field_reports') && text.includes('RETURNING id::text, report_code, title, reporter_name')) {
      this.deletedFieldReport = true
      return {
        rows: [{ id: '1', report_code: 'BC-2026-001', title: 'Báo cáo thử nghiệm', reporter_name: 'Người báo cáo' }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }
    if (this.mode === 'admin-field-report' && text.includes('INSERT INTO audit.events')) {
      this.auditValues = _values ?? null
    }
    return { rows: [] as T[], command: 'SELECT', rowCount: 0, oid: 0, fields: [] }
  }
}

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  host: '127.0.0.1',
  dbHost: 'localhost',
  dbPort: 5432,
  dbName: 'center_ops',
  dbUser: 'center_ops',
  dbPassword: '',
  corsOrigin: 'http://localhost:5173',
  cookieSecure: false,
  sessionTtlSeconds: 3600,
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

test('GET / returns API entrypoint metadata', async () => {
  const app = await buildApp({ config, database: new FakeDatabase() })
  apps.push(app)
  const response = await app.inject({ method: 'GET', url: '/' })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().data.endpoints.api, '/api/v1')
})

test('GET /health returns a public health response', async () => {
  const app = await buildApp({ config, database: new FakeDatabase() })
  apps.push(app)
  const response = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data.status, 'ok')
})

test('rate limits use the forwarded client address and return HTTP 429', async () => {
  const app = await buildApp({ config, database: new FakeDatabase() })
  apps.push(app)
  const requestHealth = (clientAddress: string) => app.inject({
    method: 'GET',
    url: '/health',
    remoteAddress: '172.19.0.3',
    headers: { 'x-forwarded-for': clientAddress },
  })

  for (let i = 0; i < 100; i += 1) {
    const response = await requestHealth('198.51.100.10')
    assert.equal(response.statusCode, 200)
  }

  const limited = await requestHealth('198.51.100.10')
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.json().error.code, 'rate_limit_exceeded')

  const otherClient = await requestHealth('198.51.100.11')
  assert.equal(otherClient.statusCode, 200)

  const otherRoute = await app.inject({
    method: 'GET',
    url: '/',
    remoteAddress: '172.19.0.3',
    headers: { 'x-forwarded-for': '198.51.100.10' },
  })
  assert.equal(otherRoute.statusCode, 200)
})

test('protected reports require a session', async () => {
  const app = await buildApp({ config, database: new FakeDatabase() })
  apps.push(app)
  const response = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?year=2026' })
  assert.equal(response.statusCode, 401)
  assert.equal(response.json().error.code, 'unauthenticated')
})

test('login validates the request body', async () => {
  const app = await buildApp({ config, database: new FakeDatabase() })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username: '', password: '' },
  })
  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'validation_error')
})

test('director cannot access admin imports', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/imports',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('data admin can read import batches', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('admin') })
  apps.push(app)
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/imports',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data, [])
})

test('authenticated users can read enterprises filtered by industrial park', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/enterprises?parkCode=KCN_AN_PHU&year=2026',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data, [])
})

test('authenticated users can read infrastructure assets', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/infrastructure/assets',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data, [])
})

test('director cannot create maintenance incidents', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/incidents',
    cookies: { center_session: 'test-token' },
    payload: {
      title: 'Hỏng máy bơm',
      parkCode: 'KCN_AN_PHU',
      locationDetail: 'Trạm XLNT',
    },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('authenticated users can read maintenance work orders', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/maintenance/orders',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().data, [])
})

test('director cannot create infrastructure assets', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/infrastructure/assets',
    cookies: { center_session: 'test-token' },
    payload: {
      assetCode: 'HT-TEST-01',
      assetName: 'Cống thoát nước thử nghiệm',
      categoryCode: 'RAINWATER_DRAINAGE',
      parkCode: 'KCN_AN_PHU',
      locationDesc: 'Đường D1',
    },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('director cannot update infrastructure assets', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/infrastructure/assets/1',
    cookies: { center_session: 'test-token' },
    payload: { assetName: 'Tên mới' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('director cannot delete infrastructure assets', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'DELETE',
    url: '/api/v1/infrastructure/assets/1',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('director cannot create maintenance work orders', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/orders',
    cookies: { center_session: 'test-token' },
    payload: {
      title: 'Duy tu thử nghiệm',
      assetId: '1',
      assignedTo: 'Đội sửa chữa',
      scheduledStart: '2026-09-01',
      scheduledEnd: '2026-09-10',
    },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('director cannot delete maintenance incidents', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/incidents/1',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('director cannot delete field reports', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('director') })
  apps.push(app)
  const response = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'forbidden')
})

test('data admin can delete field reports', async () => {
  const database = new FakeDatabase('admin-field-report')
  const app = await buildApp({ config, database })
  apps.push(app)
  const response = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'test-token' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().success, true)
  assert.equal(response.json().message, 'Đã xóa báo cáo hiện trường thành công')
  assert.equal(database.deletedFieldReport, true)
  assert.equal(database.auditValues?.[2], 'maintenance.field_reports')
  assert.equal(database.auditValues?.[3], 1)
})

test('data admin validation fails when required fields are missing on POST /assets', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('admin') })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/infrastructure/assets',
    cookies: { center_session: 'test-token' },
    payload: {
      assetCode: '',
      assetName: '',
    },
  })
  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'validation_error')
})

test('data admin validation fails when required fields are missing on POST /orders', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('admin') })
  apps.push(app)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/orders',
    cookies: { center_session: 'test-token' },
    payload: {
      title: '',
    },
  })
  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'validation_error')
})
