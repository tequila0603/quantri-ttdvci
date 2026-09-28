import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { QueryResult, QueryResultRow } from 'pg'
import type { AppConfig } from '../src/config.js'
import { buildApp } from '../src/app.js'
import { createEventHub, type RealtimeEvent } from '../src/realtime/event-hub.js'

class FakeDatabase {
  public deletedFieldReport = false
  public auditValues: unknown[] | null = null

  constructor(private readonly mode: 'empty' | 'director' | 'admin' = 'empty') {}

  async query<T extends QueryResultRow = QueryResultRow>(text: string, _values?: unknown[]): Promise<QueryResult<T>> {
    if (text.includes('FROM auth.sessions')) {
      const roleCode = this.mode === 'admin' ? 'DATA_ADMIN' : 'DIRECTOR'
      return {
        rows: [{ id: '1', username: 'test', display_name: 'Test', role_code: roleCode }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
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

test('EventHub publishes events to multiple subscribers', () => {
  const hub = createEventHub()
  const received1: RealtimeEvent[] = []
  const received2: RealtimeEvent[] = []

  const unsub1 = hub.subscribe((ev) => received1.push(ev))
  const unsub2 = hub.subscribe((ev) => received2.push(ev))

  assert.equal(hub.subscriberCount(), 2)

  const event = hub.publish({
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: '101',
    action: 'CREATE',
    data: { title: 'Test Report', parkCode: 'KCN_AN_PHU' },
  })

  assert.equal(received1.length, 1)
  assert.equal(received2.length, 1)
  assert.equal(received1[0].id, event.id)
  assert.equal(received2[0].data?.title, 'Test Report')

  unsub1()
  assert.equal(hub.subscriberCount(), 1)

  hub.publish({
    type: 'field_report.updated',
    entityType: 'field_report',
    entityId: '101',
    action: 'UPDATE',
    data: { status: 'REVIEWED' },
  })

  assert.equal(received1.length, 1) // Unsubscribed, should not receive
  assert.equal(received2.length, 2) // Still subscribed

  unsub2()
  assert.equal(hub.subscriberCount(), 0)
})

test('EventHub close clears all subscribers', () => {
  const hub = createEventHub()
  hub.subscribe(() => undefined)
  hub.subscribe(() => undefined)
  assert.equal(hub.subscriberCount(), 2)
  hub.close()
  assert.equal(hub.subscriberCount(), 0)
})

test('EventHub subscriber filter respects targetRoles', () => {
  const hub = createEventHub()
  const directorEvents: RealtimeEvent[] = []
  const adminEvents: RealtimeEvent[] = []

  hub.subscribe(
    (ev) => directorEvents.push(ev),
    (ev) => !ev.targetRoles || ev.targetRoles.includes('DIRECTOR'),
  )

  hub.subscribe(
    (ev) => adminEvents.push(ev),
    (ev) => !ev.targetRoles || ev.targetRoles.includes('DATA_ADMIN'),
  )

  // Public event (no targetRoles specified)
  hub.publish({
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: '1',
    action: 'CREATE',
    data: { title: 'Public report' },
  })

  // Admin-only event
  hub.publish(
    {
      type: 'import.completed',
      entityType: 'field_report',
      entityId: '2',
      action: 'UPDATE',
      data: { title: 'Admin only' },
    },
    ['DATA_ADMIN'],
  )

  assert.equal(directorEvents.length, 1)
  assert.equal(directorEvents[0].data?.title, 'Public report')
  assert.equal(adminEvents.length, 2)
})

test('GET /api/v1/realtime/events returns 401 unauthenticated without session', async () => {
  const app = await buildApp({ config, database: new FakeDatabase('empty') })
  apps.push(app)

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/realtime/events',
  })

  assert.equal(response.statusCode, 401)
  assert.equal(response.json().error.code, 'unauthenticated')
})

test('GET /api/v1/realtime/events returns SSE stream with retry and headers for authenticated user', async () => {
  const eventHub = createEventHub()
  const app = await buildApp({ config, database: new FakeDatabase('director'), eventHub } as any)
  apps.push(app)

  const injectPromise = app.inject({
    method: 'GET',
    url: '/api/v1/realtime/events',
    cookies: { center_session: 'valid-session' },
  })

  let responseSettled = false
  void injectPromise.then(() => {
    responseSettled = true
  })

  // Give Fastify a tick to process inject and write headers
  await new Promise((r) => setTimeout(r, 50))

  // Regression guard: an SSE handler must keep the raw response open after
  // the handshake. Without reply.hijack(), Fastify finalizes the response as
  // soon as the async route handler resolves, before an event can be sent.
  assert.equal(responseSettled, false)

  eventHub.publish({
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: '101',
    action: 'CREATE',
    data: { title: 'Báo cáo mới' },
  })

  await new Promise((r) => setTimeout(r, 50))
  await app.close()

  const response = await injectPromise
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['content-type'], 'text/event-stream; charset=utf-8')
  assert.equal(response.headers['cache-control'], 'no-cache, no-transform')
  assert.equal(response.headers['x-accel-buffering'], 'no')
  assert.match(response.body, /retry: 3000/)
  assert.match(response.body, /: connected/)
  assert.match(response.body, /id: \S+/)
  assert.match(response.body, /"type":"field_report\.created"/)
  assert.match(response.body, /Báo cáo mới/)
})

class RealtimeTestDatabase {
  public fieldReports = new Map<string, any>()
  public auditEvents: any[] = []
  public shouldFailQuery = false

  constructor(public roleCode: 'DATA_ADMIN' | 'DIRECTOR' = 'DATA_ADMIN') {
    this.fieldReports.set('1', {
      id: '1',
      report_code: 'BC-2026-001',
      title: 'Báo cáo mẫu',
      reporter_name: 'Chưa xác định',
      status: 'NEW',
      industrial_park_id: '1',
      location_detail: 'Cổng 1',
      category: 'PENDING_CLASSIFICATION',
      severity: 'MEDIUM',
    })
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    if (this.shouldFailQuery) {
      throw new Error('Simulated database error')
    }

    if (text.includes('FROM auth.sessions')) {
      return {
        rows: [{ id: '99', username: 'tester', display_name: 'Tester', role_code: this.roleCode }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }

    if (text.includes('FROM core.industrial_parks')) {
      return {
        rows: [{ id: '1', code: 'KCN_AN_PHU', name: 'KCN An Phú' }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }

    if (text.includes('SELECT COALESCE(MAX(SUBSTRING(report_code')) {
      return {
        rows: [{ next_seq: 10 }] as T[],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }

    if (text.includes('INSERT INTO audit.events')) {
      this.auditEvents.push(values)
      return { rows: [] as T[], command: 'INSERT', rowCount: 1, oid: 0, fields: [] }
    }

    if (text.includes('SELECT') && text.includes('FROM maintenance.field_reports') && text.includes('source_fingerprint = $1')) {
      const isDuplicate = values?.[0] === 'duplicate-fingerprint'
      const isUnknownReporterDup = values?.[0] === 'unknown-reporter-dup'
      if (isDuplicate) {
        return {
          rows: [{
            id: '1',
            report_code: 'BC-2026-001',
            title: 'Trùng lặp',
            reporter_name: 'Nguyễn Văn A',
            status: 'NEW',
            created_at: new Date().toISOString(),
          }] as T[],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        }
      }
      if (isUnknownReporterDup) {
        return {
          rows: [{
            id: '1',
            report_code: 'BC-2026-001',
            title: 'Trùng nhưng cập nhật tên',
            reporter_name: 'Chưa xác định',
            status: 'NEW',
            created_at: new Date().toISOString(),
          }] as T[],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        }
      }
      return { rows: [] as T[], command: 'SELECT', rowCount: 0, oid: 0, fields: [] }
    }

    if (text.includes('INSERT INTO maintenance.field_reports')) {
      const created = {
        id: '2',
        report_code: values?.[0] ?? 'BC-2026-010',
        title: values?.[6] ?? 'Báo cáo mới tạo',
        category: values?.[10] ?? 'PENDING_CLASSIFICATION',
        severity: values?.[11] ?? 'MEDIUM',
        status: 'NEW',
        reported_at: new Date().toISOString(),
      }
      this.fieldReports.set('2', created)
      return { rows: [created] as T[], command: 'INSERT', rowCount: 1, oid: 0, fields: [] }
    }

    if (text.includes('UPDATE maintenance.field_reports')) {
      const report = this.fieldReports.get('1')
      if (report) {
        return {
          rows: [{ id: '1', report_code: 'BC-2026-001', status: 'REVIEWED', notes: 'Ghi chú mới' }] as T[],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: [],
        }
      }
      return { rows: [] as T[], command: 'UPDATE', rowCount: 0, oid: 0, fields: [] }
    }

    if (text.includes('DELETE FROM maintenance.field_reports')) {
      const id = String(values?.[0])
      if (this.fieldReports.has(id)) {
        const item = this.fieldReports.get(id)
        this.fieldReports.delete(id)
        return {
          rows: [{ id: item.id, report_code: item.report_code, title: item.title, reporter_name: item.reporter_name }] as T[],
          command: 'DELETE',
          rowCount: 1,
          oid: 0,
          fields: [],
        }
      }
      return { rows: [] as T[], command: 'DELETE', rowCount: 0, oid: 0, fields: [] }
    }

    return { rows: [] as T[], command: 'SELECT', rowCount: 0, oid: 0, fields: [] }
  }
}

test('quick-ingest creates new report and publishes field_report.created', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Mất điện trạm XLNT',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Huỳnh Hữu Hợp',
      category: 'OPERATIONS',
      severity: 'HIGH',
    },
  })

  assert.equal(res.statusCode, 201)
  assert.equal(published.length, 1)
  assert.equal(published[0].type, 'field_report.created')
  assert.equal(published[0].entityType, 'field_report')
  assert.equal(published[0].action, 'CREATE')
  assert.equal(published[0].data?.title, 'Mất điện trạm XLNT')
  assert.equal(published[0].data?.parkCode, 'KCN_AN_PHU')
  assert.equal(published[0].data?.reporterName, 'Huỳnh Hữu Hợp')
  assert.equal(published[0].data?.severity, 'HIGH')
  // Payload should NOT contain secrets or sensitive tokens
  assert.equal((published[0].data as any)?.apiKey, undefined)
  assert.equal((published[0].data as any)?.session, undefined)
})

test('quick-ingest normalizes OTHER and invalid categories to PENDING_CLASSIFICATION and accepts standard codes', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  // 1. Accepts ENTERPRISE_ACTIVITY
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Vận chuyển hàng',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Huỳnh Hữu Hợp',
      category: 'ENTERPRISE_ACTIVITY',
    },
  })
  assert.equal(res1.statusCode, 201)
  assert.equal(res1.json().data.category, 'ENTERPRISE_ACTIVITY')

  // 2. Normalizes legacy OTHER to PENDING_CLASSIFICATION
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Báo cáo khác từ tool cũ',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Huỳnh Hữu Hợp',
      category: 'OTHER',
    },
  })
  assert.equal(res2.statusCode, 201)
  assert.equal(res2.json().data.category, 'PENDING_CLASSIFICATION')

  // 3. Normalizes unknown/invalid category to PENDING_CLASSIFICATION
  const res3 = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Không rõ loại',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Huỳnh Hữu Hợp',
      category: 'INVALID_CATEGORY',
    },
  })
  assert.equal(res3.statusCode, 201)
  assert.equal(res3.json().data.category, 'PENDING_CLASSIFICATION')
})

test('quick-ingest duplicate without change does not publish any event', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  // Force duplicate fingerprint
  const mockDb = db as any
  const origQuery = mockDb.query.bind(mockDb)
  mockDb.query = async (text: string, values?: unknown[]) => {
    if (text.includes('source_fingerprint = $1')) {
      return {
        rows: [{
          id: '1',
          report_code: 'BC-2026-001',
          title: 'Trùng lặp',
          reporter_name: 'Nguyễn Văn A',
          status: 'NEW',
          created_at: new Date().toISOString(),
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }
    return origQuery(text, values)
  }

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Báo cáo trùng',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Nguyễn Văn A',
    },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.isDuplicate, true)
  assert.equal(published.length, 0) // No event emitted!
})

test('quick-ingest duplicate updating reporter name from Chưa xác định emits field_report.updated', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const mockDb = db as any
  const origQuery = mockDb.query.bind(mockDb)
  mockDb.query = async (text: string, values?: unknown[]) => {
    if (text.includes('source_fingerprint = $1')) {
      return {
        rows: [{
          id: '1',
          report_code: 'BC-2026-001',
          title: 'Báo cáo cũ',
          reporter_name: 'Chưa xác định',
          status: 'NEW',
          created_at: new Date().toISOString(),
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }
    }
    return origQuery(text, values)
  }

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/maintenance/field-reports/quick-ingest',
    headers: { 'x-api-key': 'center_zalo_secret_2026' },
    payload: {
      title: 'Báo cáo cũ',
      parkCode: 'KCN_AN_PHU',
      reporterName: 'Trần Văn B',
    },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(published.length, 1)
  assert.equal(published[0].type, 'field_report.updated')
  assert.equal(published[0].data?.reporterName, 'Trần Văn B')
})

test('PATCH field report emits field_report.updated', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'PATCH',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'admin-token' },
    payload: { status: 'REVIEWED', notes: 'Ghi chú mới' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(published.length, 1)
  assert.equal(published[0].type, 'field_report.updated')
  assert.equal(published[0].data?.status, 'REVIEWED')
})

test('DATA_ADMIN can delete field report: emits field_report.deleted and records audit', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'admin-token' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(published.length, 1)
  assert.equal(published[0].type, 'field_report.deleted')
  assert.equal(published[0].entityId, '1')

  // Check audit log
  assert.equal(db.auditEvents.length, 1)
  assert.equal(db.auditEvents[0][2], 'maintenance.field_reports')
  assert.equal(db.auditEvents[0][3], 1)
})

test('DIRECTOR cannot delete field report: returns 403 and does not emit event', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DIRECTOR')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'director-token' },
  })

  assert.equal(res.statusCode, 403)
  assert.equal(published.length, 0)
})

test('deleting the same report twice: first 200, second 404 without extra event', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  // First delete
  const res1 = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'admin-token' },
  })
  assert.equal(res1.statusCode, 200)
  assert.equal(published.length, 1)

  // Second delete of the same id
  const res2 = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'admin-token' },
  })
  assert.equal(res2.statusCode, 404)
  assert.equal(published.length, 1) // No second event emitted!
})

test('database error prevents event publishing', async () => {
  const eventHub = createEventHub()
  const db = new RealtimeTestDatabase('DATA_ADMIN')
  const app = await buildApp({ config, database: db, eventHub } as any)
  apps.push(app)

  db.shouldFailQuery = true
  const published: RealtimeEvent[] = []
  eventHub.subscribe((ev) => published.push(ev))

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/v1/maintenance/field-reports/1',
    cookies: { center_session: 'admin-token' },
  })

  assert.equal(res.statusCode, 500)
  assert.equal(published.length, 0)
})

