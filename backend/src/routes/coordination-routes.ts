import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../auth.js'
import type { Database } from '../db.js'

type CoordinationTaskQuery = {
  category?: string
  status?: string
  priority?: string
  fromDate?: string
  toDate?: string
}

export async function coordinationRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const auth = authenticate(options.database)
  const adminOnly = [auth, requireRole('DATA_ADMIN')]

  // 1. Get Tasks
  app.get<{ Querystring: CoordinationTaskQuery }>('/tasks', { preHandler: auth }, async (request) => {
    const { category, status, priority, fromDate, toDate } = request.query
    const clauses: string[] = []
    const values: unknown[] = []

    if (category) {
      values.push(category)
      clauses.push(`t.task_category = $${values.length}`)
    }
    if (status) {
      values.push(status)
      clauses.push(`t.status = $${values.length}`)
    }
    if (priority) {
      values.push(priority)
      clauses.push(`t.priority = $${values.length}`)
    }
    if (fromDate) {
      values.push(fromDate)
      clauses.push(`(t.due_date IS NULL OR t.due_date >= $${values.length}::date)`)
    }
    if (toDate) {
      values.push(toDate)
      clauses.push(`t.assigned_date <= $${values.length}::date`)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const result = await options.database.query<{
      id: string
      task_code: string
      title: string
      task_category: string
      requesting_agency: string
      coordinator_name: string | null
      assigned_date: string
      due_date: string | null
      priority: string
      status: string
      progress_percent: number
      completion_evidence: string | null
      notes: string | null
      is_overdue: boolean
      created_at: string
      updated_at: string
    }>(
      `SELECT t.id::text, t.task_code, t.title, t.task_category,
              t.requesting_agency, t.coordinator_name,
              t.assigned_date::text, t.due_date::text,
              t.priority, t.status, t.progress_percent,
              t.completion_evidence, t.notes,
              (t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status != 'COMPLETED' AND t.status != 'CANCELLED') AS is_overdue,
              t.created_at::text, t.updated_at::text
       FROM coordination.tasks t
       ${whereClause}
       ORDER BY t.created_at DESC`,
      values,
    )

    return {
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        taskCode: r.task_code,
        title: r.title,
        taskCategory: r.task_category,
        requestingAgency: r.requesting_agency,
        coordinatorName: r.coordinator_name,
        assignedDate: r.assigned_date,
        dueDate: r.due_date,
        priority: r.priority,
        status: r.status,
        progressPercent: r.progress_percent,
        completionEvidence: r.completion_evidence,
        notes: r.notes,
        isOverdue: r.is_overdue,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }
  })

  // 2. Create Task (DATA_ADMIN only)
  app.post<{
    Body: {
      title: string
      taskCategory: string
      requestingAgency: string
      coordinatorName?: string
      dueDate?: string
      priority?: string
      notes?: string
    }
  }>('/tasks', { preHandler: adminOnly }, async (request) => {
    const {
      title,
      taskCategory,
      requestingAgency,
      coordinatorName,
      dueDate,
      priority = 'NORMAL',
      notes,
    } = request.body

    const countRes = await options.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM coordination.tasks`,
    )
    const nextNum = Number(countRes.rows[0]?.count ?? 0) + 1
    const prefixMap: Record<string, string> = {
      FIRE_SAFETY: 'PCCC',
      DISASTER_PREVENTION: 'TT',
      OCCUPATIONAL_SAFETY: 'AT',
      PUBLIC_SERVICE: 'SNC',
      ENVIRONMENTAL_INSPECTION: 'MT',
      OTHER: 'PH',
    }
    const prefix = prefixMap[taskCategory] ?? 'NV'
    const taskCode = `NV-${prefix}-2026-${String(nextNum).padStart(2, '0')}`

    const result = await options.database.query<{ id: string }>(
      `INSERT INTO coordination.tasks
        (task_code, title, task_category, requesting_agency, coordinator_name, due_date, priority, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [
        taskCode,
        title,
        taskCategory,
        requestingAgency,
        coordinatorName ?? null,
        dueDate ?? null,
        priority,
        notes ?? null,
      ],
    )

    return { success: true, data: { id: result.rows[0]?.id, taskCode } }
  })

  // 3. Update Task Status & Progress (DATA_ADMIN only)
  app.patch<{
    Params: { id: string }
    Body: {
      status?: string
      progressPercent?: number
      completionEvidence?: string
      notes?: string
    }
  }>('/tasks/:id', { preHandler: adminOnly }, async (request) => {
    const { id } = request.params
    const { status, progressPercent, completionEvidence, notes } = request.body

    await options.database.query(
      `UPDATE coordination.tasks
       SET status = COALESCE($1, status),
           progress_percent = COALESCE($2, progress_percent),
           completion_evidence = COALESCE($3, completion_evidence),
           notes = COALESCE($4, notes),
           updated_at = now()
       WHERE id = $5`,
      [status ?? null, progressPercent ?? null, completionEvidence ?? null, notes ?? null, id],
    )

    return { success: true, message: 'Đã cập nhật nhiệm vụ' }
  })
}
