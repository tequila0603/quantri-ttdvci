export type RealtimeEntityType =
  | 'field_report'
  | 'incident'
  | 'work_order'
  | 'infrastructure_asset'
  | 'infrastructure_project'

export type RealtimeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CONVERT'

export type RealtimeEventPayload = {
  title?: string
  code?: string
  parkCode?: string
  parkName?: string
  reporterName?: string
  severity?: string
  priority?: string
  status?: string
  category?: string
  actorName?: string
  linkedIncidentCode?: string
  linkedIncidentId?: string
  linkedOrderCode?: string
  linkedOrderId?: string
  [key: string]: unknown
}

export type RealtimeEvent = {
  id: string
  type: string
  entityType: RealtimeEntityType
  entityId: string
  action: RealtimeAction
  occurredAt: string
  targetRoles?: ('DATA_ADMIN' | 'DIRECTOR')[]
  data?: RealtimeEventPayload
}

export type RefreshScope =
  | 'field_reports'
  | 'incidents'
  | 'work_orders'
  | 'infrastructure_assets'
  | 'infrastructure_projects'

export type NotificationItem = {
  id: string
  eventId: string
  entityType: RealtimeEntityType
  entityId: string
  action: RealtimeAction
  badge: string
  title: string
  subtitle: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  isCritical: boolean
  isHigh: boolean
  viewTarget: 'maintenance' | 'infrastructure'
  tabTarget: string
  canOpenDetail: boolean
  createdAt: number
}
