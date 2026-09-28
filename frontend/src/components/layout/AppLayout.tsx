import { useState, useMemo, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Icon } from '../ui/Icon'
import { GlassSelect } from '../ui/GlassSelect'
import { OverviewPage } from '../../pages/OverviewPage'
import { FinancePage } from '../../pages/FinancePage'
import { EnterprisesPage } from '../../pages/EnterprisesPage'
import { WorkforcePage } from '../../pages/WorkforcePage'
import { InfrastructurePage } from '../../pages/InfrastructurePage'
import { MaintenancePage } from '../../pages/MaintenancePage'
import { MonitoringPage } from '../../pages/MonitoringPage'
import { ImportsPage } from '../../pages/ImportsPage'
import { RealtimeNotificationPill } from '../../components/RealtimeNotificationPill'
import { useRealtimeEvents } from '../../realtime/useRealtimeEvents'
import { getNotificationClickAction } from '../../realtime/eventHelpers'
import type { NotificationItem } from '../../realtime/types'
import { User, View, API_ROOT, NAV_ITEMS } from '../../utils/shared'
import { GlobalTimeFilter, loadSavedTimeFilter, saveTimeFilter, getAvailableYears } from '../../utils/timeFilter'
import type { RefreshScope } from '../../realtime/types'

export function AppLayout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  // We map pathname to activeView
  const pathView = location.pathname.split('/')[1] || 'overview'
  const activeView = pathView as View

  // For navigation context, we will extract it from location.state if it exists
  const navContext = (location.state as any) || {}

  const [timeFilter, setTimeFilter] = useState<GlobalTimeFilter>(() => loadSavedTimeFilter())
  const [mobileMenu, setMobileMenu] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const canImport = user.roleCode === 'DATA_ADMIN'
  const safeView = activeView === 'imports' && !canImport ? 'overview' : activeView
  const availableYears = useMemo(() => getAvailableYears(), [])
  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || canImport),
    [canImport]
  )

  const [realtimeRefreshSignal, setRealtimeRefreshSignal] = useState<{ scopes: RefreshScope[]; tick: number }>({
    scopes: [],
    tick: 0,
  })
  const [deletedRecord, setDeletedRecord] = useState<{ entityType: string; entityId: string; tick: number } | null>(null)

  const handleRefreshScopes = useCallback((scopes: RefreshScope[]) => {
    setRealtimeRefreshSignal((prev) => ({ scopes, tick: prev.tick + 1 }))
  }, [])

  const handleRecordDeleted = useCallback((event: any) => {
    setDeletedRecord({ entityType: event.entityType, entityId: event.entityId, tick: Date.now() })
  }, [])

  const { currentNotification, dismissCurrentNotification } = useRealtimeEvents({
    user,
    apiRoot: API_ROOT,
    onRefreshScopes: handleRefreshScopes,
    onRecordDeleted: handleRecordDeleted,
  })

  const updateTimeFilter = useCallback((next: GlobalTimeFilter) => {
    setTimeFilter(next)
    saveTimeFilter(next)
  }, [])

  async function logout() {
    await fetch(`${API_ROOT}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined)
    onLogout()
  }

  function changeView(view: View, context?: { parkCode?: string; tab?: string; targetId?: string }) {
    navigate(`/${view}`, { state: context })
    setMobileMenu(false)
  }

  const handlePillNavigate = (item: NotificationItem) => {
    const action = getNotificationClickAction(item)
    changeView(action.view as View, {
      tab: action.tab,
      targetId: action.openDetailId ?? undefined,
    })
    dismissCurrentNotification()
  }

  return (
    <div className="app-shell">
      <RealtimeNotificationPill
        item={currentNotification}
        onDismiss={dismissCurrentNotification}
        onNavigate={handlePillNavigate}
      />
      <Sidebar
        activeView={safeView}
        onChange={(v) => changeView(v)}
        user={user}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((value) => !value)}
      />
      <main className="app-main">
        <header className="topbar glass-pill">
          <div className="topbar-title">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenu ? 'Đóng danh sách module' : 'Mở danh sách module'}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu((value) => !value)}
            >
              <Icon name={mobileMenu ? 'close' : 'menu'} />
            </button>
            <div className="topbar-brand">
              <span className="brand-mark topbar-brand-mark">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <strong>{user.displayName}</strong>
            </div>
          </div>

          {mobileMenu && (
            <nav className="mobile-nav glass-panel" aria-label="Điều hướng module">
              {visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={safeView === item.id ? 'mobile-nav-active' : ''}
                  onClick={() => changeView(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          <div className="topbar-actions">
            <GlassSelect
              value={String(timeFilter.year)}
              onChange={(value) => updateTimeFilter({ ...timeFilter, year: Number(value) })}
              options={availableYears.map((year) => ({ value: String(year), label: `Năm ${year}` }))}
              label=""
              icon="calendar"
              ariaLabel="Chọn năm tài chính"
              className="topbar-select-year"
            />
            <span className="status-badge status-neutral">
              {user.roleCode === 'DATA_ADMIN' ? 'Admin dữ liệu' : 'Giám đốc'}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={logout}
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route
              path="/overview"
              element={
                <OverviewPage
                  user={user}
                  timeFilter={timeFilter}
                  onTimeFilterChange={updateTimeFilter}
                  onNavigate={changeView}
                  realtimeSignal={realtimeRefreshSignal}
                />
              }
            />
            <Route
              path="/finance"
              element={
                <FinancePage
                  user={user}
                  timeFilter={timeFilter}
                  initialPark={navContext.parkCode}
                  initialTab={navContext.tab as any}
                  realtimeSignal={realtimeRefreshSignal}
                />
              }
            />
            <Route
              path="/enterprises"
              element={<EnterprisesPage user={user} timeFilter={timeFilter} initialPark={navContext.parkCode} />}
            />
            <Route
              path="/workforce"
              element={<WorkforcePage user={user} timeFilter={timeFilter} initialPark={navContext.parkCode} />}
            />
            <Route
              path="/infrastructure"
              element={
                <InfrastructurePage
                  user={user}
                  timeFilter={timeFilter}
                  initialPark={navContext.parkCode}
                  initialTab={navContext.tab as any}
                  initialTargetId={navContext.targetId}
                  realtimeSignal={realtimeRefreshSignal}
                  deletedRecord={deletedRecord}
                />
              }
            />
            <Route
              path="/maintenance"
              element={
                <MaintenancePage
                  user={user}
                  timeFilter={timeFilter}
                  initialPark={navContext.parkCode}
                  initialTab={navContext.tab as any}
                  initialTargetId={navContext.targetId}
                  realtimeSignal={realtimeRefreshSignal}
                  deletedRecord={deletedRecord}
                />
              }
            />
            <Route
              path="/monitoring"
              element={<MonitoringPage user={user} timeFilter={timeFilter} initialPark={navContext.parkCode} />}
            />
            {canImport && <Route path="/imports" element={<ImportsPage user={user} />} />}
            <Route path="*" element={<Navigate to={`/${safeView}`} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
