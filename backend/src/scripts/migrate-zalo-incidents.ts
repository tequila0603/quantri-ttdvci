import pg from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const ROSTER_ENTRIES: Array<{ full: string; aliases: string[] }> = [
  { full: 'A Huỳnh Hữu Hợp', aliases: ['huynh huu hop', 'a huynh huu hop', 'ahuynh huu hop', 'anh huynh huu hop', 'anh hop', 'a hop'] },
  { full: 'A Kiên', aliases: ['kien', 'a kien', 'akien', 'anh kien'] },
  { full: 'A Thọ', aliases: ['tho', 'a tho', 'atho', 'anh tho'] },
  { full: 'A Tiến', aliases: ['tien', 'a tien', 'atien', 'anh tien'] },
  { full: 'Chị Hà', aliases: ['ha', 'chi ha', 'chiha'] },
  { full: 'Chị Loan', aliases: ['loan', 'chi loan', 'chiloan'] },
  { full: 'Đông', aliases: ['dong', 'nguyen van dong', 'a dong', 'anh dong'] },
  { full: 'Duy', aliases: ['duy', 'a duy', 'anh duy'] },
  { full: 'Hiếu', aliases: ['hieu', 'a hieu', 'anh hieu'] },
  { full: 'Kế', aliases: ['ke', 'a ke', 'anh ke'] },
  { full: 'Minh', aliases: ['minh', 'a minh', 'anh minh'] },
  { full: 'Nghĩa', aliases: ['nghia', 'a nghia', 'anh nghia'] },
  { full: 'Ngọc', aliases: ['ngoc', 'a ngoc', 'anh ngoc'] },
  { full: 'Phúc', aliases: ['phuc', 'a phuc', 'anh phuc'] },
  { full: 'Sếp Ánh', aliases: ['sep anh', 'anh anh', 'a anh', 'sep'] },
  { full: 'Toàn', aliases: ['toan', 'a toan', 'anh toan'] },
  { full: 'Tú', aliases: ['tu', 'a tu', 'anh tu'] },
  { full: 'Tuấn', aliases: ['tuan', 'a tuan', 'anh tuan'] },
  { full: 'Vinh', aliases: ['vinh', 'a vinh', 'anh vinh'] },
]

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

function resolveReporter(raw: string): string {
  if (!raw) return 'Chưa xác định'
  const normalized = removeAccents(raw).replace(/\s+/g, ' ')
  for (const entry of ROSTER_ENTRIES) {
    for (const alias of entry.aliases) {
      if (normalized === alias || normalized.startsWith(alias + ' ') || normalized.endsWith(' ' + alias)) {
        return entry.full
      }
    }
  }
  return raw.trim()
}

function separateGluedSender(text: string): { sender: string | null; cleanedText: string } {
  for (const entry of ROSTER_ENTRIES) {
    for (const alias of entry.aliases) {
      const normAlias = removeAccents(alias)
      const normText = removeAccents(text)
      if (normText.startsWith(normAlias)) {
        let afterAlias = text.slice(alias.length).trim()
        afterAlias = afterAlias.replace(/^[ :\-–—]+/, '')
        const cleaned = afterAlias.replace(/^(?:th[oốô]ng\s*b[aá]o|bc|b[aá]o\s*c[aá]o)\s*[:\-–—]?\s*/i, '').trim()
        return { sender: entry.full, cleanedText: cleaned || afterAlias || text }
      }
    }
  }
  const cleaned = text.replace(/^(?:th[oốô]ng\s*b[aá]o|bc|b[aá]o\s*c[aá]o)\s*[:\-–—]?\s*/i, '').trim()
  return { sender: null, cleanedText: cleaned || text }
}

function detectCategory(text: string): 'INCIDENT' | 'INSPECTION' | 'OPERATIONS' | 'PROGRESS' | 'NOTICE' | 'OTHER' {
  const norm = removeAccents(text)
  if (norm.includes('thong bao') || norm.includes('kinh gui')) return 'NOTICE'
  if (norm.includes('su co') || norm.includes('hong') || norm.includes('chay') || norm.includes('roi') || norm.includes('be') || norm.includes('chap')) return 'INCIDENT'
  if (norm.includes('kiem tra') || norm.includes('khao sat') || norm.includes('hien truong') || norm.includes('tinh trang')) return 'INSPECTION'
  if (norm.includes('bom') || norm.includes('van hanh') || norm.includes('tram xlnt') || norm.includes('dien') || norm.includes('ap luc')) return 'OPERATIONS'
  if (norm.includes('hoan thanh') || norm.includes('dang thi cong') || norm.includes('tien do') || norm.includes('da xu ly')) return 'PROGRESS'
  return 'OTHER'
}

async function run() {
  const isLive = process.argv.includes('--live')
  console.log(`=== MIGRATION SCRIPT: Zalo Incidents to Field Reports ===`)
  console.log(`Mode: ${isLive ? 'LIVE RUN (Writing to Database)' : 'DRY RUN (Preview Only - No DB modifications)'}`)
  console.log(`To execute changes, re-run with: npx tsx src/scripts/migrate-zalo-incidents.ts --live\n`)

  const connectionString = process.env.DATABASE_URL || `postgresql://center_ops:${encodeURIComponent('LocalCenterOps-ChangeMe-2026!')}@localhost:5432/center_ops`
  const pool = new Pool({ connectionString })

  const client = await pool.connect()
  try {
    const incidentsRes = await client.query(`
      SELECT 
        i.id,
        i.incident_code,
        i.title,
        i.severity,
        i.current_status,
        i.industrial_park_id,
        i.location_detail,
        i.assigned_to,
        i.root_cause,
        i.mitigation_actions,
        i.created_at,
        p.code AS park_code,
        p.name AS park_name
      FROM maintenance.incidents i
      JOIN core.industrial_parks p ON i.industrial_park_id = p.id
      ORDER BY i.created_at ASC;
    `)

    console.log(`Found ${incidentsRes.rows.length} total incidents in maintenance.incidents.`)

    if (incidentsRes.rows.length === 0) {
      console.log('No legacy incidents found to migrate. Exiting.')
      return
    }

    if (isLive) {
      await client.query('BEGIN')
    }

    let migratedCount = 0
    let skippedCount = 0

    for (const inc of incidentsRes.rows) {
      // Check if already linked to a field report
      const existingReportRes = await client.query(
        'SELECT id, report_code FROM maintenance.field_reports WHERE linked_incident_id = $1 LIMIT 1',
        [inc.id],
      )

      if (existingReportRes.rows.length > 0) {
        console.log(`[SKIPPED] Incident ${inc.incident_code} already linked to Field Report ${existingReportRes.rows[0].report_code}`)
        skippedCount++
        continue
      }

      // Detect if glued sender
      const titleSeparation = separateGluedSender(inc.title)
      const rawSenderCandidate = titleSeparation.sender || (inc.assigned_to && inc.assigned_to !== 'Chưa xác định' ? inc.assigned_to : null) || 'Chưa xác định'
      const resolvedReporter = resolveReporter(rawSenderCandidate)
      const cleanedTitle = titleSeparation.cleanedText || inc.title
      const fullContent = `${cleanedTitle}\n${inc.mitigation_actions || ''}\n${inc.root_cause || ''}`.trim()
      const category = detectCategory(fullContent)

      // Calculate fingerprint
      const rawPayload = `LEGACY_MIGRATION:${inc.id}:${cleanedTitle}`
      const fingerprint = crypto.createHash('sha256').update(rawPayload).digest('hex')

      const year = new Date(inc.created_at || Date.now()).getFullYear()

      console.log(`\n--------------------------------------------------`)
      console.log(`Candidate Incident: ${inc.incident_code} (ID: ${inc.id})`)
      console.log(`  - Original Title: "${inc.title}"`)
      console.log(`  - Original AssignedTo: "${inc.assigned_to}"`)
      console.log(`  - Cleaned Title: "${cleanedTitle}"`)
      console.log(`  - Recovered Reporter: "${resolvedReporter}"`)
      console.log(`  - Detected Category: ${category}`)
      console.log(`  - Action: Create Field Report (Status: CONVERTED) linked to ${inc.incident_code}`)

      if (isLive) {
        // Generate next code
        const seqRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM maintenance.field_reports WHERE report_code LIKE $1`,
          [`BC-${year}-%`],
        )
        const nextNum = (seqRes.rows[0]?.count || 0) + 1
        const reportCode = `BC-${year}-${String(nextNum).padStart(3, '0')}`

        await client.query(`
          INSERT INTO maintenance.field_reports (
            report_code,
            source,
            source_message_key,
            source_fingerprint,
            raw_reporter_name,
            reporter_name,
            title,
            content,
            industrial_park_id,
            location_detail,
            category,
            severity,
            status,
            reported_at,
            linked_incident_id,
            notes,
            created_at,
            updated_at
          ) VALUES ($1, 'ZALO', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CONVERTED', $12, $13, $14, $12, NOW())
        `, [
          reportCode,
          `legacy-incident-${inc.id}`,
          fingerprint,
          rawSenderCandidate,
          resolvedReporter,
          cleanedTitle,
          fullContent,
          inc.industrial_park_id,
          inc.location_detail,
          category,
          inc.severity,
          inc.created_at,
          inc.id,
          `Migrated from legacy incident ${inc.incident_code}`,
        ])

        console.log(`  -> Successfully created Field Report ${reportCode}`)
      }

      migratedCount++
    }

    if (isLive) {
      await client.query('COMMIT')
      console.log(`\n=== LIVE RUN COMPLETED: ${migratedCount} incidents migrated to field reports, ${skippedCount} skipped. ===`)
    } else {
      console.log(`\n=== DRY RUN FINISHED: ${migratedCount} candidates identified for migration, ${skippedCount} skipped. (No changes made) ===`)
    }
  } catch (err) {
    if (isLive) {
      await client.query('ROLLBACK')
    }
    console.error('Migration error:', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()
