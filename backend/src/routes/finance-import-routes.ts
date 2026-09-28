import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import { Kysely, sql } from 'kysely'
import type { Database } from '../db.js'
import type { DB } from '../db/schema.js'
import type { EventHub } from '../realtime/event-hub.js'
import * as xlsx from 'xlsx'
import crypto from 'crypto'
import { parseFinanceImport } from '../services/import-parser.js'

export async function financeImportRoutes(app: FastifyInstance, options: { database: Kysely<DB>, authDatabase: Database, eventHub: EventHub }): Promise<void> {
  const adminOnly = [authenticate(options.authDatabase), requireRole('DATA_ADMIN')]
  
  app.get<{ Params: { kind: string } }>('/imports/finance/templates/:kind', async (request, reply) => {
    const kind = request.params.kind
    const wb = xlsx.utils.book_new()
    let headers: string[] = []
    let examples: any[] = []
    
    if (kind === 'annual_lease') {
      headers = ['enterprise_code', 'park_code', 'reporting_year', 'lot_location', 'land_area_m2', 'lease_status', 'raw_land_lease_amount', 'infrastructure_asset_lease_amount', 'infrastructure_service_lease_amount', 'source_reference']
      examples = [{ enterprise_code: 'DN-001', park_code: 'KCN_AN_PHU', reporting_year: 2026, lot_location: 'Lô A1', land_area_m2: 5000, lease_status: 'ACTIVE', raw_land_lease_amount: 10000000, infrastructure_asset_lease_amount: 5000000, infrastructure_service_lease_amount: 2000000, source_reference: 'HD01' }]
    } else if (kind === 'invoice') {
      headers = ['enterprise_code', 'invoice_series', 'invoice_number', 'issued_on', 'due_on', 'category_code', 'description', 'line_amount', 'total_amount', 'status', 'source_reference']
      examples = [{ enterprise_code: 'DN-001', invoice_series: 'AA/21E', invoice_number: '0001234', issued_on: '2026-09-01', due_on: '2026-09-15', category_code: 'WATER', description: 'Tiền nước tháng 9', line_amount: 5000000, total_amount: 5000000, status: 'ISSUED', source_reference: 'REF01' }]
    } else if (kind === 'payment') {
      headers = ['payment_reference', 'enterprise_code', 'payment_date', 'amount', 'invoice_series', 'invoice_number', 'category_code', 'allocated_amount', 'source_reference']
      examples = [{ payment_reference: 'PAY-001', enterprise_code: 'DN-001', payment_date: '2026-09-10', amount: 5000000, invoice_series: 'AA/21E', invoice_number: '0001234', category_code: 'WATER', allocated_amount: 5000000, source_reference: 'UNC01' }]
    } else if (kind === 'project_disbursement') {
      headers = ['project_code', 'reporting_year', 'approved_budget', 'allocated_budget', 'disbursement_date', 'disbursed_amount', 'voucher_reference', 'funding_source', 'notes']
      examples = [{ project_code: 'PRJ-001', reporting_year: 2026, approved_budget: 1000000000, allocated_budget: 500000000, disbursement_date: '2026-09-15', disbursed_amount: 100000000, voucher_reference: 'UNC-PRJ-01', funding_source: 'Vốn CSH', notes: 'Giai đoạn 1' }]
    } else {
      return reply.status(400).send({ success: false, error: { code: 'invalid_kind', message: 'Loại dữ liệu không hợp lệ' } })
    }
    
    const ws = xlsx.utils.json_to_sheet(examples, { header: headers })
    xlsx.utils.book_append_sheet(wb, ws, 'Dữ liệu')
    
    const guideWs = xlsx.utils.aoa_to_sheet([['Hướng dẫn nhập liệu'], ['Vui lòng không đổi tên cột. Nhập đúng định dạng ngày YYYY-MM-DD. Số tiền là số nguyên không âm.']])
    xlsx.utils.book_append_sheet(wb, guideWs, 'Hướng dẫn')
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
    reply.header('Content-Disposition', `attachment; filename="template_${kind}.xlsx"`)
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return buffer
  })

  app.post('/imports/finance/preview', { preHandler: adminOnly }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ success: false, error: { message: 'Missing file' } })
    
    const buffer = await data.toBuffer()
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    
    const fields = (data.fields as any)
    const importKind = fields.importKind?.value
    const reportingPeriod = fields.reportingYear?.value || fields.reportingPeriod?.value
    
    if (!importKind) return reply.status(400).send({ success: false, error: { message: 'Missing importKind' } })
    
    // Check if same file already confirmed
    const existing = await options.database.selectFrom('ingest.import_batches' as any)
      .selectAll()
      .where('source_sha256', '=', sha256)
      .where('import_kind', '=', importKind)
      .where('status', '=', 'CONFIRMED')
      .executeTakeFirst()
      
    if (existing) {
      return reply.status(400).send({ success: false, error: { code: 'duplicate_file', message: 'Tệp này đã được import thành công trước đó' } })
    }
    
    // Parse
    let wb: xlsx.WorkBook
    try {
      wb = xlsx.read(buffer, { type: 'buffer' })
    } catch (err) {
      return reply.status(400).send({ success: false, error: { message: 'Không thể đọc tệp. Vui lòng đảm bảo đây là tệp XLSX hoặc CSV hợp lệ.' } })
    }
    
    const sheetName = wb.SheetNames[0] as string; const ws = wb.Sheets['Dữ liệu'] || wb.Sheets[sheetName];
    if (!ws) return reply.status(400).send({ success: false, error: { message: 'Không tìm thấy sheet dữ liệu' } });
    const rawData = xlsx.utils.sheet_to_json(ws, { defval: null }) as any[]
    
    // Validate rows
    const result = await parseFinanceImport(options.database, importKind, rawData, reportingPeriod)
    
    // Insert PREVIEW batch
    const batch = await options.database.insertInto('ingest.import_batches' as any)
      .values({
        source_file: data.filename,
        source_sha256: sha256,
        import_kind: importKind,
        status: 'PREVIEWED',
        imported_by_user_id: (request as any).user.id,
        reporting_period: reportingPeriod as any,
        total_rows: result.totalRows,
        accepted_rows: result.acceptedRows,
        rejected_rows: result.rejectedRows,
        duplicate_rows: result.duplicateRows,
        total_amount: result.totalAmount
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      
    // Insert rows
    if (result.rows.length > 0) {
        const insertRows = result.rows.map(r => ({
            batch_id: batch.id,
            source_row: r.sourceRow,
            status: r.status,
            raw_payload: JSON.stringify(r.rawPayload),
            error_code: r.errorCode,
            error_field: r.errorField,
            error_message: r.message
        }))
        // Chunk inserts to avoid query limits
        for (let i = 0; i < insertRows.length; i += 1000) {
            await options.database.insertInto('ingest.import_rows' as any).values(insertRows.slice(i, i + 1000)).execute()
        }
    }
    
    return {
      success: true,
      data: {
        batchId: batch.id,
        sourceFile: batch.source_file,
        sourceSha256: batch.source_sha256,
        importKind: batch.import_kind,
        status: batch.status,
        totalRows: (batch as any).total_rows,
        acceptedRows: (batch as any).accepted_rows,
        rejectedRows: (batch as any).rejected_rows,
        duplicateRows: (batch as any).duplicate_rows,
        totalAmount: (batch as any).total_amount,
        previewRows: result.rows.slice(0, 50),
        errors: result.rows.filter(r => r.status === 'ERROR')
      }
    }
  })

  app.post<{ Params: { batchId: string } }>('/imports/finance/:batchId/confirm', { preHandler: adminOnly }, async (request, reply) => {
    const batchId = request.params.batchId
    
    const batch = await options.database.selectFrom('ingest.import_batches' as any)
      .selectAll()
      .where('id', '=', batchId as any)
      .executeTakeFirst()
      
    if (!batch) return reply.status(404).send({ success: false, error: { message: 'Không tìm thấy lô dữ liệu' } })
    if (batch.status !== 'PREVIEWED') return reply.status(400).send({ success: false, error: { message: 'Lô dữ liệu không ở trạng thái chờ xác nhận' } })
    if (batch.rejected_rows! > 0) return reply.status(400).send({ success: false, error: { message: 'Tệp còn chứa lỗi, không thể xác nhận' } })
    
    const rows = await options.database.selectFrom('ingest.import_rows' as any)
      .selectAll()
      .where('batch_id', '=', batch.id)
      .where('status', '=', 'VALID')
      .execute()
      
    // Execute write transaction
    try {
        await options.database.transaction().execute(async (trx) => {
            const { persistFinanceImport } = await import('../services/import-parser.js')
            await persistFinanceImport(trx, batch.import_kind, rows, batch)
            
            await trx.updateTable('ingest.import_batches' as any)
              .set({ status: 'CONFIRMED', confirmed_at: new Date() as any })
              .where('id', '=', batch.id)
              .execute()
              
            await trx.insertInto('audit.events')
              .values({
                  actor_user_id: (request as any).user.id,
                  action: 'IMPORT_FINANCE_CONFIRMED',
                  entity_type: 'import_batch',
                  entity_id: batch.id.toString(),
                  source: 'admin_web',
                  payload: JSON.stringify({
                      import_kind: batch.import_kind,
                      source_file: batch.source_file,
                      source_sha256: batch.source_sha256,
                      total_rows: batch.accepted_rows,
                      total_amount: (batch as any).total_amount
                  })
              })
              .execute()
        })
    } catch (err: any) {
        return reply.status(500).send({ success: false, error: { message: 'Lỗi ghi dữ liệu: ' + err.message } })
    }
    
    // Notify
    options.eventHub.publish({ type: 'FINANCE_IMPORT_CONFIRMED', entityType: 'infrastructure_project', entityId: batch.id.toString(), action: 'UPDATE', data: { parkCode: 'all', action: 'refresh' } })
    
    return { success: true, data: { status: 'CONFIRMED' } }
  })
  
  app.post<{ Params: { batchId: string } }>('/imports/finance/:batchId/cancel', { preHandler: adminOnly }, async (request, reply) => {
    const batchId = request.params.batchId
    
    await options.database.updateTable('ingest.import_batches' as any)
      .set({ status: 'CANCELLED' })
      .where('id', '=', batchId as any)
      .where('status', '=', 'PREVIEWED')
      .execute()
      
    return { success: true }
  })
}
