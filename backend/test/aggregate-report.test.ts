import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { afterEach, test } from 'node:test'
import type { QueryResult, QueryResultRow } from 'pg'
import { buildApp } from '../src/app.js'
import type { AppConfig } from '../src/config.js'
import type { PremierPublicData } from '../src/premier-source.js'

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] }
}

class ReportDatabase {
  constructor(private readonly role: 'DIRECTOR' | 'DATA_ADMIN', private readonly hasPark = false) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const parameterIndexes = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]))
    const expectedIndexes = Array.from({ length: Math.max(0, ...parameterIndexes) }, (_, index) => index + 1)
    assert.deepEqual([...new Set(parameterIndexes)].sort((left, right) => left - right), expectedIndexes)
    assert.equal(params.length, expectedIndexes.length)
    if (sql.includes('FROM auth.sessions')) return result([{ id: '1', username: 'test', display_name: 'Test', role_code: this.role }] as T[])
    if (sql.includes('SELECT id::text, name FROM core.industrial_parks')) return result((this.hasPark ? [{ id: '15', name: 'KCN An Phú' }] : []) as T[])
    if (sql.includes(' AS parks,') && sql.includes(' AS enterprises,')) return result([{ parks: 3, enterprises: 12, assets: 7 }] as T[])
    if (sql.includes("COALESCE(p.name, 'Chưa xác định')")) return result([{ label: 'KCN An Phú', total: 12 }] as T[])
    if (sql.includes('FROM infrastructure.assets') && sql.includes('GROUP BY status')) return result([{ label: 'DEGRADED', total: 2 }, { label: 'OPERATIONAL', total: 5 }] as T[])
    if (sql.includes('FROM infrastructure.asset_categories')) return result([{ label: 'Hệ thống thoát nước mưa', total: 7 }] as T[])
    if (sql.includes('FROM infrastructure.projects')) return result([{ projects: 2, estimated: '10000000000000000.00', actual: '9007199254740993.25' }] as T[])
    if (sql.includes('FROM maintenance.work_orders')) return result([{ label: 'IN_PROGRESS', total: 2, actual_cost: '123456789.50', overdue: 1 }] as T[])
    if (sql.includes('FROM maintenance.incidents')) return result([{ label: 'OPEN / CRITICAL', total: 1, cause_summary: 'Mất điện nguồn' }] as T[])
    if (sql.includes('FROM monitoring.observations')) return result([{ label: 'pH', unit: null, total: 8, missing: 1 }] as T[])
    if (sql.includes('FROM finance.service_categories')) return result([{ label: 'Thuê đất nguyên thổ', amount: '9007199254740993.25' }] as T[])
    if (sql.includes('FROM finance.payments')) return result(params[2] !== null && sql.includes('AND $3::bigint IS NULL') ? [] as T[] : [{ amount: '0.00', total: 0 }] as T[])
    if (sql.includes('FROM finance.invoice_line_balances')) return result(params[1] !== null && sql.includes('AND $2::bigint IS NULL') ? [] as T[] : [{ total: 1, amount_due: '9007199254740993.25', amount_outstanding: '100.00' }] as T[])
    return result([] as T[])
  }
}

const config: AppConfig = {
  nodeEnv: 'test', port: 3000, host: '127.0.0.1', dbHost: 'localhost', dbPort: 5432,
  dbName: 'center_ops', dbUser: 'center_ops', dbPassword: '', corsOrigin: 'http://localhost:5173',
  cookieSecure: false, sessionTtlSeconds: 3600,
}

const body = {
  year: 2026,
  periodLabel: 'Năm 2026',
  fromDate: '2026-01-01',
  toDate: '2026-12-31',
  parkCode: null,
  sections: ['overview', 'enterprises', 'infrastructure', 'maintenance', 'incidents', 'monitoring', 'finance'],
}

const premierReportFixture: PremierPublicData = {
  source: {
    name: 'Dữ liệu công khai Premier',
    url: 'https://premier.vn/bqlkktpy/cong-bo',
    fetchedAt: '2026-09-15T02:00:00.000Z',
    currentMeasuredAt: '2026-09-15T01:55:00.000Z',
    availableFrom: '2026-08-17',
    availableTo: '2026-09-15',
  },
  stations: [
    { code: 'KCN_AN_PHU', name: 'KCN An Phú' },
    { code: 'KCN_DONG_BAC_SONG_CAU_KV1', name: 'KCN Đông Bắc Sông Cầu – KV1' },
    { code: 'KCN_HOA_HIEP_1', name: 'KCN Hòa Hiệp 1' },
  ],
  parameters: [],
  current: [
    { stationCode: 'KCN_AN_PHU', stationName: 'KCN An Phú', observedOn: '2026-09-15', measuredAt: '2026-09-15T08:55:00+07:00', readingMode: 'CURRENT', metrics: [
      { code: 'FLOW_IN', displayName: 'Lưu lượng đầu vào', unit: 'm3/h', value: 10.5, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT', displayName: 'Lưu lượng đầu ra', unit: 'm3/h', value: 2.5, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_IN_DAY', displayName: 'Lưu lượng đầu vào trong ngày', unit: 'm3/ngày', value: 100, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT_DAY', displayName: 'Lưu lượng đầu ra trong ngày', unit: 'm3/ngày', value: 25, limitText: null, status: 'NO_LIMIT' },
    ] },
    { stationCode: 'KCN_DONG_BAC_SONG_CAU_KV1', stationName: 'KCN Đông Bắc Sông Cầu – KV1', observedOn: '2026-09-15', measuredAt: '2026-09-15T08:55:00+07:00', readingMode: 'CURRENT', metrics: [
      { code: 'FLOW_IN', displayName: 'Lưu lượng đầu vào', unit: 'm3/h', value: 20, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT', displayName: 'Lưu lượng đầu ra', unit: 'm3/h', value: 4, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_IN_DAY', displayName: 'Lưu lượng đầu vào trong ngày', unit: 'm3/ngày', value: 200, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT_DAY', displayName: 'Lưu lượng đầu ra trong ngày', unit: 'm3/ngày', value: 40, limitText: null, status: 'NO_LIMIT' },
    ] },
    { stationCode: 'KCN_HOA_HIEP_1', stationName: 'KCN Hòa Hiệp 1', observedOn: '2026-09-15', measuredAt: '2026-09-15T08:55:00+07:00', readingMode: 'CURRENT', metrics: [
      { code: 'FLOW_IN', displayName: 'Lưu lượng đầu vào', unit: 'm3/h', value: 30, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT', displayName: 'Lưu lượng đầu ra', unit: 'm3/h', value: 6, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_IN_DAY', displayName: 'Lưu lượng đầu vào trong ngày', unit: 'm3/ngày', value: 300, limitText: null, status: 'NO_LIMIT' },
      { code: 'FLOW_OUT_DAY', displayName: 'Lưu lượng đầu ra trong ngày', unit: 'm3/ngày', value: 60, limitText: null, status: 'NO_LIMIT' },
    ] },
  ],
  history: [],
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())))

function documentXml(archive: Buffer): string {
  for (let offset = 0; offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50;) {
    const compression = archive.readUInt16LE(offset + 8)
    const compressedSize = archive.readUInt32LE(offset + 18)
    const nameLength = archive.readUInt16LE(offset + 26)
    const extraLength = archive.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const name = archive.toString('utf8', nameStart, nameStart + nameLength)
    const dataStart = nameStart + nameLength + extraLength
    const data = archive.subarray(dataStart, dataStart + compressedSize)
    if (name === 'word/document.xml') return (compression === 0 ? data : inflateRawSync(data)).toString('utf8')
    offset = dataStart + compressedSize
  }
  throw new Error('DOCX document.xml entry not found')
}

test('aggregate report preview and DOCX are available to data admins', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DATA_ADMIN') })
  apps.push(app)
  const preview = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: body })
  assert.equal(preview.statusCode, 200)
  const fingerprint = preview.json().data.fingerprint
  const download = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/docx', cookies: { center_session: 'token' }, payload: { ...body, expectedFingerprint: fingerprint } })
  assert.equal(download.statusCode, 200)
  assert.equal(download.headers['content-type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
})

test('aggregate preview preserves exact money and distinguishes missing monitoring units', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR') })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: body })
  assert.equal(response.statusCode, 200)
  const payload = response.json().data
  assert.match(payload.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(payload.model.overview.find((item: { label: string }) => item.label === 'Số phải thu').value, '9.007.199.254.740.993,25')
  const monitoring = payload.model.sections.find((section: { id: string }) => section.id === 'monitoring')
  assert.equal(monitoring.tables[0].rows[0].unit, 'Chưa có dữ liệu')
  assert.equal(payload.model.findings.find((item: { id: string }) => item.id === 'critical-incidents').cause, 'Mất điện nguồn')
  assert.equal(payload.model.administrative, undefined)
  const prose = JSON.stringify({ sections: payload.model.sections, findings: payload.model.findings, recommendations: payload.model.recommendations })
  assert.doesNotMatch(prose, /amount_due|actual_cost|CRITICAL|2026-01-01|2026-12-31|tổng hợp xác định nguyên nhân/)
})

test('aggregate monitoring report includes Premier flows and all station statuses', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR'), premierDataProvider: async () => premierReportFixture })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: { ...body, sections: ['monitoring'] } })
  assert.equal(response.statusCode, 200)
  const model = response.json().data.model
  const monitoring = model.sections.find((section: { id: string }) => section.id === 'monitoring')
  assert.equal(monitoring.tables[1].rows.length, 3)
  assert.equal(monitoring.tables[1].rows[0].station, 'KCN An Phú')
  assert.match(monitoring.tables[1].rows[0].measuredAt, /2026|\d{1,2}\/\d{1,2}/)
  const flowRows = monitoring.tables[2].rows
  assert.equal(flowRows.find((row: { station: string; metric: string }) => row.station === 'KCN An Phú' && row.metric === 'Lưu lượng thu trong ngày').value, '100')
  assert.equal(flowRows.find((row: { station: string; metric: string }) => row.station === 'KCN Hòa Hiệp 1' && row.metric === 'Lưu lượng xả trong ngày').value, '60')
  assert.equal(model.overview.find((item: { label: string }) => item.label === 'Lưu lượng thu trong ngày').value, '600')
  assert.equal(model.overview.find((item: { label: string }) => item.label === 'Lưu lượng xả trong ngày').value, '125')
})

test('aggregate preview keeps selected sections without chapter numbering', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR') })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: { ...body, sections: ['finance'] } })
  assert.equal(response.statusCode, 200)
  const model = response.json().data.model
  assert.deepEqual(model.sections.map((section: { title: string }) => section.title), ['TÀI CHÍNH'])
  assert.deepEqual(model.overview.map((item: { label: string }) => item.label), ['Số phải thu', 'Thanh toán thực tế trong kỳ'])
  assert.deepEqual(model.sourceCoverage.map((item: { label: string }) => item.label), ['Tài chính', 'Hóa đơn, công nợ và thanh toán', 'Giải ngân vốn đầu tư'])
  assert.equal(model.sections[0].tables[1].totalRow, undefined)
})

test('KCN-scoped finance report does not attribute enterprise-level invoices and payments to that park', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR', true) })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: { ...body, parkCode: 'AN_PHU', sections: ['finance'] } })
  assert.equal(response.statusCode, 200)
  const model = response.json().data.model
  assert.match(JSON.stringify(model.overview), /Không thể phân bổ theo khu công nghiệp/)
  assert.doesNotMatch(JSON.stringify(model.overview), /9\.007\.199\.254\.740\.993,25|100,00/)
  assert.doesNotMatch(JSON.stringify(model.sections.find((section: { id: string }) => section.id === 'finance')), /Số phải thu theo hóa đơn|Số còn phải thu|Thanh toán thực tế trong kỳ/)
  assert.match(JSON.stringify(model), /không thể phân bổ.*khu công nghiệp/i)
  assert.ok(model.findings.some((finding: { id: string }) => finding.id === 'finance-park-attribution'))
})

test('aggregate preview rejects an empty section selection', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR') })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: { ...body, sections: [] } })
  assert.equal(response.statusCode, 400)
})

test('aggregate DOCX rejects a stale preview fingerprint', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR') })
  apps.push(app)
  const response = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/docx', cookies: { center_session: 'token' }, payload: { ...body, expectedFingerprint: '0'.repeat(64) } })
  assert.equal(response.statusCode, 409)
  assert.equal(response.json().error.code, 'report_data_changed')
})

test('aggregate DOCX is generated from the accepted preview', async () => {
  const app = await buildApp({ config, database: new ReportDatabase('DIRECTOR') })
  apps.push(app)
  const request = { ...body, sections: ['finance'] }
  const preview = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/preview', cookies: { center_session: 'token' }, payload: request })
  const fingerprint = preview.json().data.fingerprint
  const download = await app.inject({ method: 'POST', url: '/api/v1/reports/aggregate/docx', cookies: { center_session: 'token' }, payload: { ...request, expectedFingerprint: fingerprint } })
  assert.equal(download.statusCode, 200)
  assert.equal(download.headers['content-type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.equal(download.headers['x-report-fingerprint'], fingerprint)
  assert.equal(download.rawPayload.subarray(0, 2).toString(), 'PK')
  const xml = documentXml(download.rawPayload)
  assert.match(xml, /Chỉ tiêu/)
  assert.match(xml, /BÁO CÁO/)
  assert.match(xml, /Tình hình hoạt động trong Năm 2026 tại Tất cả khu công nghiệp/)
  assert.doesNotMatch(xml, /Kỳ báo cáo:|Thời gian thống kê từ ngày|Khu công nghiệp:|Doanh nghiệp:|Hạ tầng:|Duy tu, bảo dưỡng:|Sự cố:|Quan trắc:|Tài chính:|Hóa đơn, công nợ và thanh toán:|Giải ngân vốn đầu tư:/)
  assert.doesNotMatch(xml, /CƠ QUAN CHỦ QUẢN|CƠ QUAN BAN HÀNH|Số: 01\/BC-CQ|Nơi nhận:|Nguyễn Văn A|CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM|Độc lập - Tự do - Hạnh phúc/)
  assert.doesNotMatch(xml, /I\. CĂN CỨ VÀ PHẠM VI|II\. TÌNH HÌNH CHUNG|III\. KẾT QUẢ THEO|IV\. TỒN TẠI|V\. ĐỀ XUẤT/)
  assert.match(xml, /Bảng 1\./)
})
