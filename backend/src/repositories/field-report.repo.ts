import { sql, Kysely } from 'kysely'
import type { DB } from '../db/schema.js'

export class FieldReportRepository {
  constructor(private db: Kysely<DB> | any) {}

  async findIndustrialParkByCode(code: string) {
    let q = this.db.selectFrom('core.industrial_parks')
      .select(['id', 'code', 'name'])
      .where((eb: any) => {
        const conditions = [eb('code', '=', code)]
        
        if (code === 'KCN_DONG_BAC_SONG_CAU_KV1') {
          conditions.push(eb('code', '=', 'KCN_ONG_BAC_SONG_CAU_KV1'))
        } else if (code === 'KCN_ONG_BAC_SONG_CAU_KV1') {
          conditions.push(eb('code', '=', 'KCN_DONG_BAC_SONG_CAU_KV1'))
        }
        
        return eb.or(conditions)
      })

    return await q.limit(1).executeTakeFirst()
  }

  async findByFingerprint(fingerprint: string) {
    return await this.db.selectFrom('maintenance.field_reports')
      .select(['id', 'report_code', 'title', 'reporter_name', 'location_detail', 'status', 'created_at', 'source_fingerprint', 'reported_at'])
      .where('source_fingerprint', '=', fingerprint)
      .limit(1)
      .executeTakeFirst()
  }

  async findDuplicate(params: {
    fingerprint?: string
    parkId: string | number
    cleanContent: string
    sourceMessageKey?: string
  }) {
    // 1. Match by source_fingerprint
    if (params.fingerprint) {
      const byFp = await this.findByFingerprint(params.fingerprint)
      if (byFp) return byFp
    }

    // 2. Match by source_message_key
    if (params.sourceMessageKey) {
      const byKey = await this.db.selectFrom('maintenance.field_reports')
        .select(['id', 'report_code', 'title', 'reporter_name', 'location_detail', 'status', 'created_at', 'source_fingerprint', 'reported_at'])
        .where('source_message_key', '=', params.sourceMessageKey)
        .limit(1)
        .executeTakeFirst()
      if (byKey) return byKey
    }

    // 3. Fallback: Match by identical normalized content from ZALO_WEB
    const normContent = params.cleanContent.trim().toLowerCase().replace(/\s+/g, ' ')
    if (normContent.length >= 8) {
      const candidates = await this.db.selectFrom('maintenance.field_reports')
        .select(['id', 'report_code', 'title', 'reporter_name', 'location_detail', 'status', 'created_at', 'content', 'source_fingerprint', 'reported_at', 'industrial_park_id'])
        .where('source', '=', 'ZALO_WEB')
        .execute()

      // First try exact park match
      for (const candidate of candidates) {
        const candNorm = (candidate.content || candidate.title || '').trim().toLowerCase().replace(/\s+/g, ' ')
        if (candNorm === normContent && Number(candidate.industrial_park_id) === Number(params.parkId)) {
          return candidate
        }
      }

      // If content is sufficiently specific (>= 15 chars), match across parks
      if (normContent.length >= 15) {
        for (const candidate of candidates) {
          const candNorm = (candidate.content || candidate.title || '').trim().toLowerCase().replace(/\s+/g, ' ')
          if (candNorm === normContent) {
            return candidate
          }
        }
      }
    }

    return null
  }

  async updateReport(id: string, updates: any) {
    return await this.db.updateTable('maintenance.field_reports')
      .set({ ...updates, updated_at: sql`now()` })
      .where('id', '=', id)
      .execute()
  }

  async getNextReportSequence(year: string) {
    // Generate sequence using a sequence table for concurrency safety
    return await this.db.transaction().execute(async (trx: any) => {
      // Create sequence table if not exists (ideally in migration, but safe here)
      await sql`CREATE TABLE IF NOT EXISTS core.report_sequences (
        year VARCHAR(4) PRIMARY KEY,
        last_seq INT NOT NULL DEFAULT 0
      )`.execute(trx)

      const pattern = 'BC-' + year + '-%'
      const regex = 'BC-' + year + '-([0-9]+)'
      const maxInDb = await sql`
        SELECT COALESCE(MAX(
          NULLIF(SUBSTRING(report_code FROM ${regex}), '')::int
        ), 0) as max_seq
        FROM maintenance.field_reports
        WHERE report_code LIKE ${pattern}
      `.execute(trx)

      const currentMax = Number((maxInDb.rows[0] as any)?.max_seq || 0)

      const res = await sql`
        INSERT INTO core.report_sequences (year, last_seq)
        VALUES (${year}, ${currentMax + 1})
        ON CONFLICT (year) DO UPDATE
          SET last_seq = GREATEST(core.report_sequences.last_seq, ${currentMax}) + 1
        RETURNING last_seq
      `.execute(trx)

      return (res.rows[0] as any).last_seq as number
    })
  }

  async createReport(data: any) {
    return await this.db.insertInto('maintenance.field_reports')
      .values(data)
      .returning(['id', 'report_code', 'title', 'category', 'severity', 'status', 'reported_at'])
      .executeTakeFirst()
  }
}
