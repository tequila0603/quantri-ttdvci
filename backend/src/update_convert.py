import re

with open("routes/field-report-routes.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the body of convert-to-incident with a transaction block.
old_block = r'''    // Fetch report
    const reportRes = await options.database.query<{
      id: string
      report_code: string
      title: string
      content: string
      industrial_park_id: string
      location_detail: string
      severity: string
      status: string
      reporter_name: string
      reported_at: string
      linked_incident_id: string | null
    }>(
      `SELECT id::text, report_code, title, content, industrial_park_id::text, location_detail,
              severity, status, reporter_name, reported_at::text, linked_incident_id::text
       FROM maintenance.field_reports
       WHERE id = $1`,
      [id],
    )

    const report = reportRes.rows[0]
    if (!report) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường')
    }

    if (report.linked_incident_id) {
      throw new ApiError(400, 'conflict', `Báo cáo [${report.report_code}] đã được chuyển thành sự cố trước đó`)
    }

    const currentYear = new Date().getFullYear()
    const seqRes = await options.database.query<{ next_seq: number }>(
      `SELECT COALESCE(MAX(SUBSTRING(incident_code FROM '\\d+$')::int), 0) + 1 AS next_seq
       FROM maintenance.incidents
       WHERE incident_code LIKE 'SC-' || $1 || '-%'`,
      [String(currentYear)],
    )
    const nextNum = seqRes.rows[0]?.next_seq ?? 1
    const incidentCode = `SC-${currentYear}-${String(nextNum).padStart(3, '0')}`

    const finalTitle = title && title.trim() ? title.trim() : report.title
    const finalSeverity = severity && ALLOWED_SEVERITIES.includes(severity as any) ? severity : report.severity
    const finalLocation = locationDetail && locationDetail.trim() ? locationDetail.trim() : report.location_detail
    const finalAssigned = assignedTo && assignedTo.trim() ? assignedTo.trim() : null

    let targetDateValue: unknown
    let targetDateSql: string
    if (targetResolutionAt && targetResolutionAt.trim()) {
      targetDateSql = '$10::timestamptz'
      targetDateValue = targetResolutionAt.trim()
    } else {
      targetDateSql = `now() + ($10 || ' days')::interval`
      targetDateValue = Number(targetResolutionDays) || 3
    }

    const rootCause = `Chuyển đổi từ Báo cáo hiện trường [${report.report_code}] (Người báo: ${report.reporter_name})`

    // Insert Incident
    const incRes = await options.database.query<{
      id: string
      incident_code: string
      title: string
    }>(
      `INSERT INTO maintenance.incidents (
         incident_code, title, severity, industrial_park_id, asset_id,
         location_detail, assigned_to, root_cause, mitigation_actions,
         current_status, reported_at, target_resolution_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         'OPEN', $11::timestamptz, ${targetDateSql}
       )
       RETURNING id::text, incident_code, title`,
      [
        incidentCode,
        finalTitle,
        finalSeverity,
        report.industrial_park_id,
        assetId ? String(assetId).trim() : null,
        finalLocation,
        finalAssigned,
        rootCause,
        report.content,
        targetDateValue,
        report.reported_at,
      ],
    )

    const newIncident = incRes.rows[0]
    if (!newIncident) {
      throw new ApiError(500, 'internal_error', 'Không thể tạo bản ghi sự cố')
    }

    // Update field report
    const reviewer = user?.displayName || user?.username || 'Người vận hành'
    await options.database.query(
      `UPDATE maintenance.field_reports
       SET status = 'CONVERTED',
           category = 'INCIDENT',
           linked_incident_id = $1,
           reviewed_by = $2,
           reviewed_at = now()
       WHERE id = $3`,
      [newIncident.id, reviewer, id],
    )

    await recordAuditEvent(options.database, user?.id ?? null, 'CREATE', 'incident', newIncident.id, {
      source: 'field_report_conversion',
      fieldReportId: id,
    })'''

new_block = r'''    // Fetch report using Kysely transaction
    const newIncident = await (options.database as any).transaction().execute(async (trx: any) => {
      const report = await trx.selectFrom('maintenance.field_reports')
        .select(['id', 'report_code', 'title', 'content', 'industrial_park_id', 'location_detail', 'severity', 'status', 'reporter_name', 'reported_at', 'linked_incident_id'])
        .where('id', '=', id)
        .executeTakeFirst()

      if (!report) {
        throw new ApiError(404, 'not_found', 'Không tìm thấy báo cáo hiện trường')
      }

      if (report.linked_incident_id) {
        throw new ApiError(400, 'conflict', `Báo cáo [${report.report_code}] đã được chuyển thành sự cố trước đó`)
      }

      const currentYear = new Date().getFullYear().toString()
      
      // Sequence lock
      await trx.schema.createTable('core.incident_sequences').ifNotExists()
        .addColumn('year', 'varchar(4)', (col: any) => col.primaryKey())
        .addColumn('last_seq', 'integer', (col: any) => col.notNull().defaultTo(0))
        .execute().catch(() => {})

      const seqRes = await sql`
        INSERT INTO core.incident_sequences (year, last_seq)
        VALUES (${currentYear}, 1)
        ON CONFLICT (year) DO UPDATE SET last_seq = core.incident_sequences.last_seq + 1
        RETURNING last_seq
      `.execute(trx)
      
      const nextNum = (seqRes.rows[0] as any).last_seq
      const incidentCode = `SC-${currentYear}-${String(nextNum).padStart(3, '0')}`

      const finalTitle = title && title.trim() ? title.trim() : report.title
      const finalSeverity = severity && ALLOWED_SEVERITIES.includes(severity as any) ? severity : report.severity
      const finalLocation = locationDetail && locationDetail.trim() ? locationDetail.trim() : report.location_detail
      const finalAssigned = assignedTo && assignedTo.trim() ? assignedTo.trim() : null

      let targetDateValue: any
      if (targetResolutionAt && targetResolutionAt.trim()) {
        targetDateValue = targetResolutionAt.trim()
      } else {
        targetDateValue = sql`now() + (${Number(targetResolutionDays) || 3} || ' days')::interval`
      }

      const rootCause = `Chuyển đổi từ Báo cáo hiện trường [${report.report_code}] (Người báo: ${report.reporter_name})`

      // Insert Incident
      const incRes = await trx.insertInto('maintenance.incidents')
        .values({
          incident_code: incidentCode,
          title: finalTitle,
          severity: finalSeverity,
          industrial_park_id: report.industrial_park_id,
          asset_id: assetId ? String(assetId).trim() : null,
          location_detail: finalLocation,
          assigned_to: finalAssigned,
          root_cause: rootCause,
          mitigation_actions: report.content,
          current_status: 'OPEN',
          reported_at: report.reported_at,
          target_resolution_at: targetDateValue
        })
        .returning(['id', 'incident_code', 'title'])
        .executeTakeFirst()

      if (!incRes) {
        throw new ApiError(500, 'internal_error', 'Không thể tạo bản ghi sự cố')
      }

      // Update field report
      const reviewer = user?.displayName || user?.username || 'Người vận hành'
      await trx.updateTable('maintenance.field_reports')
        .set({
           status: 'CONVERTED',
           category: 'INCIDENT',
           linked_incident_id: incRes.id,
           reviewed_by: reviewer,
           reviewed_at: sql`now()`
        })
        .where('id', '=', id)
        .execute()

      await recordAuditEvent(trx, user?.id ?? null, 'CREATE', 'incident', incRes.id, {
        source: 'field_report_conversion',
        fieldReportId: id,
      })

      return incRes
    })'''

content = content.replace(old_block, new_block)

with open("routes/field-report-routes.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated convert-to-incident logic.")
