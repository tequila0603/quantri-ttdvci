import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Activity, ArrowRight, Building2, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, CircleAlert, CircleDollarSign, Database, Droplets, ExternalLink, Eye, EyeOff, Flame, Gauge, LandPlot, LayoutDashboard, LockKeyhole, LogOut, Menu, Network, Pencil, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, TrendingUp, Upload, User as UserIcon, UsersRound, Wrench, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { AggregateReportDialog } from "../reporting/AggregateReportDialog";
import { type GlobalTimeFilter, type PeriodType, PERIOD_TYPE_LABELS, getAvailableYears, getAvailablePeriodTypes, getPeriodOptions, handleYearChange, handlePeriodTypeChange, handlePeriodSelect, loadSavedTimeFilter, saveTimeFilter, getTodayVietnam } from "../utils/timeFilter";
import { unwrapApiData } from "../utils/apiResponse";
import { buildRecentActivities, type RecentActivityItem } from "../utils/recentActivities";
import { useRealtimeEvents } from "../realtime/useRealtimeEvents";
import { RealtimeNotificationPill } from "../components/RealtimeNotificationPill";
import type { RefreshScope, NotificationItem } from "../realtime/types";
import { getNotificationClickAction } from "../realtime/eventHelpers";
import { RoleCode, User, PageMeta, ApiEnvelope, Page, Summary, LeaseRow, ReceivableRow, Employee, WorkforceUnit, WorkforcePark, Observation, PremierMetricStatus, PremierMetric, PremierStation, PremierSnapshot, PremierPublicData, SyncRun, ImportBatch, EnterprisePark, EnterpriseRow, View, IconName, GlassSelectOption, LimitRuleInfo, NavItem, FinanceBarRow, AgingKey, FinanceAgingRow, InfrastructureProject, CoordinationTask, AssetCategory, InfrastructureAsset, MaintenanceIncident, MaintenanceOrder, FieldReport, TrendPoint, WasteRecord, PdfDocument, API_ROOT, YEARS, CATEGORY_LABELS, CENTER_DUTIES, ICONS, NAV_ITEMS, FINANCE_BAR_COLORS, fetchApi, useApiData, formatCurrency, formatDate, shortDate, displayCategory, monitoringStatusLabel, monitoringStatusTone, formatMonitoringValue, parseLimitInfo, numberValue, compactCurrency, agingKey, projectStatusLabel, projectStatusTone, projectTypeLabel, taskCategoryLabel, taskStatusLabel, taskStatusTone, assetStatusLabel, assetStatusTone, formatSpecs, fieldReportCategoryLabel, fieldReportCategoryTone, fieldReportSeverityLabel, fieldReportSeverityTone, fieldReportStatusLabel, fieldReportStatusTone, incidentSeverityLabel, incidentSeverityTone, incidentStatusLabel, incidentStatusTone, orderStatusLabel, orderStatusTone, orderTypeLabel } from "../utils/shared";
import { Icon } from "../components/ui/Icon";
import { GlassSelect } from "../components/ui/GlassSelect";
import { Badge } from "../components/ui/Badge";
import { LoadingBlock } from "../components/ui/LoadingBlock";
import { EmptyBlock } from "../components/ui/EmptyBlock";
import { ErrorBlock } from "../components/ui/ErrorBlock";
import { PageTitle } from "../components/ui/PageTitle";
import { PanelHeading } from "../components/ui/PanelHeading";
import { MetricCard } from "../components/ui/MetricCard";
import { DataTable } from "../components/ui/DataTable";

export function OverviewDisbursementChart({
      projects,
      parks,
      selectedPark,
      onNavigate,
    }: {
          projects: InfrastructureProject[]
          parks: EnterprisePark[]
          selectedPark: string
          onNavigate?: (view: View, context?: { parkCode?: string; tab?: string }) => void
        }) {
    const targetParks = selectedPark ? parks.filter((p) => p.code === selectedPark) : parks;
    const parkStats = targetParks.map((park) => {
            const parkProjects = projects.filter((p) => p.parkCode === park.code)
            const budget = parkProjects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0)
            const disbursed = parkProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0)
            const rate = budget > 0 ? (disbursed / budget) * 100 : 0
            return {
              parkCode: park.code,
              parkName: park.name,
              projectCount: parkProjects.length,
              budget,
              disbursed,
              rate,
            }
          });
    const maxBudget = Math.max(...parkStats.map((p) => p.budget), 1);
    if (!projects.length) {
    return <EmptyBlock label="Không có dự án đầu tư hạ tầng trong phạm vi này" />
    }

    return (
    <div className="dashboard-dual-bars">
      {parkStats.map((item) => {
        const budgetWidth = (item.budget / maxBudget) * 100
        const disbursedWidth = (item.disbursed / maxBudget) * 100
        const rateTone = item.rate >= 60 ? 'var(--color-positive)' : item.rate >= 40 ? 'var(--color-accent)' : 'var(--color-warning)'
        return (
          <div
            key={item.parkCode}
            className="dashboard-dual-bar-item"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate?.('finance', { parkCode: item.parkCode, tab: 'projects' })}
            title={`Bấm để xem danh sách và số liệu giải ngân dự án tại ${item.parkName}`}
          >
            <div className="dashboard-dual-bar-header">
              <strong>{item.parkName} <small style={{ fontWeight: 400, color: 'var(--color-muted)' }}>({item.projectCount} DA)</small></strong>
              <span className="dashboard-dual-bar-pct" style={{ color: rateTone }}>
                {item.budget > 0 ? `${item.rate.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="dashboard-dual-bar-track-group">
              <div className="dashboard-dual-bar-track" title={`Vốn kế hoạch: ${formatCurrency(item.budget)}`}>
                <div className="dashboard-dual-bar-fill" style={{ width: `${budgetWidth}%`, background: '#191919' }} />
              </div>
              <div className="dashboard-dual-bar-track" title={`Đã giải ngân: ${formatCurrency(item.disbursed)} (${item.rate.toFixed(1)}%)`}>
                <div className="dashboard-dual-bar-fill" style={{ width: `${disbursedWidth}%`, background: rateTone }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
              <span>Dự toán: <strong>{compactCurrency(item.budget)}</strong></span>
              <span>Đã giải ngân: <strong>{compactCurrency(item.disbursed)}</strong></span>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#191919' }} /> Kế hoạch vốn duyệt</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-positive)' }} /> Đã giải ngân thực tế</span>
      </div>
    </div>
    )
}

export function OverviewAssetStatusChart({
      assets,
      onNavigate,
    }: {
          assets: InfrastructureAsset[]
          onNavigate?: (view: View, context?: { tab?: string }) => void
        }) {
    const total = assets.length;
    const rows = [
            { label: 'Đang vận hành', value: assets.filter((a) => a.status === 'OPERATIONAL').length, color: '#278366' },
            { label: 'Xuống cấp', value: assets.filter((a) => a.status === 'DEGRADED').length, color: '#b78028' },
            { label: 'Đang bảo trì', value: assets.filter((a) => a.status === 'UNDER_MAINTENANCE').length, color: '#507eaa' },
            { label: 'Ngừng vận hành', value: assets.filter((a) => a.status === 'OUT_OF_SERVICE').length, color: '#bf5b50' },
          ];
    if (!total) return <EmptyBlock label="Chưa có dữ liệu công trình trong phạm vi lọc" />
    return (
    <div
      className="dashboard-ring-layout"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate?.('infrastructure', { tab: 'assets' })}
      style={{ cursor: 'pointer' }}
      title="Bấm để mở danh mục công trình hạ tầng kỹ thuật"
    >
      <div className="dashboard-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(', ')}>
          {rows.map((row, index) => {
            const pct = (row.value / total) * 100
            const offset = (rows.slice(0, index).reduce((sum, prev) => sum + prev.value, 0) / total) * 100
            return (
              <circle
                key={row.label}
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke={row.color}
                strokeWidth="14"
                pathLength="100"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              >
                <title>{row.label}: {row.value} ({Math.round(pct)}%)</title>
              </circle>
            )
          })}
        </svg>
        <div>
          <strong>{total}</strong>
          <span>công trình</span>
        </div>
      </div>
      <div className="dashboard-legend">
        {rows.map((row) => (
          <div key={row.label}>
            <span>
              <i style={{ background: row.color }} />
              {row.label}
            </span>
            <strong>
              {row.value} <small>{total > 0 ? `${Math.round((row.value / total) * 100)}%` : '0%'}</small>
            </strong>
          </div>
        ))}
      </div>
    </div>
    )
}

export function OverviewParkEnterprisesChart({
      parks,
      selectedPark,
      onNavigate,
    }: {
          parks: EnterprisePark[]
          selectedPark: string
          onNavigate?: (view: View, context?: { parkCode?: string }) => void
        }) {
    const total = parks.reduce((sum, p) => sum + p.enterpriseCount, 0);
    const max = Math.max(1, ...parks.map((p) => p.enterpriseCount));
    const sorted = [...parks].sort((a, b) => b.enterpriseCount - a.enterpriseCount);
    if (!sorted.length) return <EmptyBlock label="Chưa có dữ liệu doanh nghiệp" />
    return (
    <div className="dashboard-bars">
      <div className="dashboard-scale">
        <span>0</span>
        <span>{max} DN</span>
      </div>
      {sorted.map((park) => {
        const isSelected = selectedPark === park.code
        const pct = total > 0 ? Math.round((park.enterpriseCount / total) * 100) : 0
        return (
          <div
            className="dashboard-bar-row"
            key={park.code}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate?.('enterprises', { parkCode: park.code })}
            style={{
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              borderRadius: '6px',
              background: isSelected ? 'var(--color-paper)' : 'transparent',
            }}
            title={`Bấm để xem danh sách ${park.enterpriseCount} doanh nghiệp tại ${park.name}`}
          >
            <div className="dashboard-bar-label">
              <span>{park.name} {isSelected && '✓'}</span>
              <strong>{park.enterpriseCount} <small>DN ({pct}%)</small></strong>
            </div>
            <div className="dashboard-bar-track">
              <span style={{ width: `${(park.enterpriseCount / max) * 100}%`, background: isSelected ? 'var(--color-ink)' : '#507eaa' }} />
            </div>
          </div>
        )
      })}
    </div>
    )
}

export function OverviewMaintenanceOrdersChart({
      orders,
      onNavigate,
    }: {
          orders: MaintenanceOrder[]
          onNavigate?: (view: View, context?: { tab?: string }) => void
        }) {
    const overdueCount = orders.filter((o) => o.isOverdue && !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
    const orderRows = [
            { label: 'Chờ triển khai', value: orders.filter((o) => o.status === 'PENDING').length, color: '#b78028' },
            { label: 'Đang thực hiện', value: orders.filter((o) => o.status === 'IN_PROGRESS').length, color: '#507eaa' },
            { label: 'Đã nghiệm thu', value: orders.filter((o) => o.status === 'COMPLETED').length, color: '#278366' },
          ];
    const max = Math.max(1, ...orderRows.map((r) => r.value));
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="dashboard-bars">
        <div className="dashboard-scale">
          <span>0</span>
          <span>{max} lệnh</span>
        </div>
        {orderRows.map((row) => (
          <div
            className="dashboard-bar-row"
            key={row.label}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate?.('maintenance', { tab: 'orders' })}
            style={{ cursor: 'pointer' }}
          >
            <div className="dashboard-bar-label">
              <span>{row.label}</span>
              <strong>{row.value} <small>lệnh</small></strong>
            </div>
            <div className="dashboard-bar-track">
              <span style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>
      <div
        className="dashboard-callout"
        role="button"
        tabIndex={0}
        onClick={() => onNavigate?.('maintenance', { tab: 'orders' })}
        style={{ cursor: 'pointer' }}
      >
        <Icon name={overdueCount > 0 ? 'alert' : 'check'} size={17} />
        <span>
          {overdueCount > 0 ? (
            <strong style={{ color: 'var(--color-negative)' }}>{overdueCount} lệnh quá hạn tiến độ</strong>
          ) : (
            <strong>Tiến độ bảo trì ổn định</strong>
          )} · {orders.filter((o) => o.status === 'IN_PROGRESS').length} lệnh đang triển khai thực địa
        </span>
      </div>
    </div>
    )
}

export function OverviewWastewaterFlowChart({
      monitoring,
      selectedPark,
      onNavigate,
    }: {
          monitoring: PremierPublicData | null
          selectedPark: string
          onNavigate?: (view: View, context?: { parkCode?: string }) => void
        }) {
    const [flowCode, setFlowCode] = useState<'FLOW_OUT_DAY' | 'FLOW_IN_DAY'>('FLOW_OUT_DAY');
    const stations = monitoring?.stations ?? [];
    const currentSnapshots = monitoring?.current ?? [];
    const filteredSnapshots = currentSnapshots.filter((sn) => {
            if (!selectedPark) return true
            if (selectedPark === 'KCN_AN_PHU') return sn.stationCode.includes('AP') || sn.stationName.includes('An Phú')
            if (selectedPark === 'KCN_HOA_HIEP_1') return sn.stationCode.includes('HH') || sn.stationName.includes('Hòa Hiệp')
            if (selectedPark === 'KCN_DONG_BAC_SONG_CAU_KV1') return sn.stationCode.includes('DBSC') || sn.stationName.includes('Sông Cầu')
            return true
          });
    const flowRows = filteredSnapshots.flatMap((snapshot) => {
            const metric = snapshot.metrics.find((m) => m.code === flowCode)
            return metric?.value != null ? [{ label: snapshot.stationName, value: metric.value, color: '#278366', stationCode: snapshot.stationCode }] : []
          });
    const max = Math.max(1, ...flowRows.map((r) => r.value));
    return (
    <div>
      <div className="segmented-control dashboard-flow-filter" aria-label="Chọn lưu lượng quan trắc">
        <button
          type="button"
          aria-pressed={flowCode === 'FLOW_OUT_DAY'}
          className={flowCode === 'FLOW_OUT_DAY' ? 'segment-active' : ''}
          onClick={() => setFlowCode('FLOW_OUT_DAY')}
        >
          Đầu ra xả thải
        </button>
        <button
          type="button"
          aria-pressed={flowCode === 'FLOW_IN_DAY'}
          className={flowCode === 'FLOW_IN_DAY' ? 'segment-active' : ''}
          onClick={() => setFlowCode('FLOW_IN_DAY')}
        >
          Đầu vào thu gom
        </button>
      </div>
      {flowRows.length > 0 ? (
        <div className="dashboard-bars" style={{ marginTop: '0.75rem' }}>
          <div className="dashboard-scale">
            <span>0</span>
            <span>{new Intl.NumberFormat('vi-VN').format(max)} m³/ngày</span>
          </div>
          {flowRows.map((row) => (
            <div
              className="dashboard-bar-row"
              key={row.label}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate?.('monitoring', { parkCode: selectedPark })}
              style={{ cursor: 'pointer' }}
              title="Bấm để xem chi tiết trạm quan trắc"
            >
              <div className="dashboard-bar-label">
                <span>{row.label}</span>
                <strong>{new Intl.NumberFormat('vi-VN').format(row.value)} <small>m³</small></strong>
              </div>
              <div className="dashboard-bar-track">
                <span style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock label="Không có số liệu lưu lượng tại thời điểm này" />
      )}
      <p className="dashboard-source">
        Premier · {monitoring?.source.currentMeasuredAt ? formatDate(monitoring.source.currentMeasuredAt) : 'Thời gian thực'}. {flowRows.length}/{stations.length} trạm truyền dữ liệu. 
      </p>
    </div>
    )
}

export function OverviewActionableAlerts({
      alerts,
    }: {
          alerts: Array<{
            id: string
            severity: 'critical' | 'warning' | 'info'
            badgeLabel: string
            badgeTone: 'negative' | 'warning' | 'info'
            title: string
            parkName: string
            description: string
            actionLabel: string
            onAction: () => void
          }>
        }) {
    if (!alerts.length) {
    return <EmptyBlock label="Không có sự cố hoặc cảnh báo khẩn cấp trong phạm vi lọc hiện tại" />
    }

    return (
    <div className="dashboard-alert-list">
      {alerts.slice(0, 5).map((item) => (
        <div key={item.id} className={`dashboard-alert-item dashboard-alert-item-${item.severity}`}>
          <div className="dashboard-alert-content">
            <div className="dashboard-alert-head">
              <Badge tone={item.badgeTone}>{item.badgeLabel}</Badge>
              <span className="dashboard-alert-title">{item.title}</span>
            </div>
            <p className="dashboard-alert-desc">{item.description}</p>
            <div className="dashboard-alert-meta">
              <span><strong>Địa điểm:</strong> {item.parkName}</span>
            </div>
          </div>
          <button type="button" className="dashboard-alert-action-btn" onClick={item.onAction}>
            <span>{item.actionLabel}</span>
            <Icon name="arrow" size={13} />
          </button>
        </div>
      ))}
      {alerts.length > 5 && (
        <p className="dashboard-caption" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          Đang hiển thị 5 trên tổng số {alerts.length} vấn đề cần theo dõi.
        </p>
      )}
    </div>
    )
}

export function OverviewRecentActivities({
      activities,
      loading = false,
      onNavigate,
    }: {
          activities: RecentActivityItem[]
          loading?: boolean
          onNavigate?: (view: View, context?: { parkCode?: string; tab?: string; targetId?: string }) => void
        }) {
    if (loading && activities.length === 0) {
    return <LoadingBlock label="Đang tải nhật ký hoạt động gần đây..." />
    }

    if (activities.length === 0) {
    return <EmptyBlock label="Chưa có hoạt động nào được ghi nhận trong phạm vi lọc" />
    }

    return (
    <div className="dashboard-recent-feed">
      {activities.map((act) => (
        <div key={act.id} className="dashboard-recent-item">
          <div className="dashboard-recent-dot" style={{ background: act.dotColor }} />
          <div className="dashboard-recent-top">
            <span
              className="dashboard-recent-title"
              role="button"
              tabIndex={0}
              onClick={() => onNavigate?.(act.view, act.context)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onNavigate?.(act.view, act.context)
                }
              }}
              style={{ cursor: 'pointer' }}
              title="Bấm để xem chi tiết nghiệp vụ"
            >
              {act.title}
            </span>
            <span className="dashboard-recent-time">{act.time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', margin: '0.15rem 0' }}>
            <Badge tone={act.badgeTone}>{act.badgeLabel}</Badge>
            <strong style={{ fontSize: '0.76rem', color: 'var(--color-ink)' }}>{act.location}</strong>
          </div>
          <p className="dashboard-recent-detail">
            {act.detail}
          </p>
        </div>
      ))}
      {activities.length >= 6 && (
        <p style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
          Đang hiển thị {activities.length} hoạt động gần đây nhất
        </p>
      )}
    </div>
    )
}

export function OverviewPage({
      user,
      timeFilter,
      onTimeFilterChange,
      onNavigate,
      realtimeSignal,
    }: {
          user: User
          timeFilter: GlobalTimeFilter
          onTimeFilterChange?: (next: GlobalTimeFilter) => void
          onNavigate?: (view: View, context?: { parkCode?: string; tab?: string }) => void
          realtimeSignal?: { scopes: RefreshScope[]; tick: number }
        }) {
    const [dashboardPark, setDashboardPark] = useState<string>('');
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const todayVietnam = useMemo(() => getTodayVietnam(), []);
    const availableYears = useMemo(() => getAvailableYears(), []);
    const availableTypes = useMemo(() => getAvailablePeriodTypes(timeFilter.year), [timeFilter.year]);
    const periodOptions = useMemo(() => getPeriodOptions(timeFilter.year, timeFilter.periodType), [timeFilter.year, timeFilter.periodType]);
    const parksQuery = useApiData<EnterprisePark[]>(`/enterprises/parks?year=${timeFilter.year}`, user);
    const summaryQuery = useApiData<Summary>(`/reports/summary?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}${dashboardPark ? `&parkCode=${dashboardPark}` : ''}`, user);
    const assetsQuery = useApiData<InfrastructureAsset[]>(
            `/infrastructure/assets${dashboardPark ? `?parkCode=${dashboardPark}` : ''}`,
            user,
          );
    const projectsQuery = useApiData<InfrastructureProject[]>(
            `/infrastructure/projects?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}${dashboardPark ? `&parkCode=${dashboardPark}` : ''}`,
            user,
          );
    const incidentsQuery = useApiData<MaintenanceIncident[]>(
            `/maintenance/incidents?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}${dashboardPark ? `&parkCode=${dashboardPark}` : ''}`,
            user,
          );
    const orderParams = new URLSearchParams();
    if (dashboardPark) orderParams.append('parkCode', dashboardPark)
    if (timeFilter.fromDate) orderParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) orderParams.append('toDate', timeFilter.toDate)
    const ordersQuery = useApiData<MaintenanceOrder[]>(
            `/maintenance/orders${orderParams.toString() ? `?${orderParams.toString()}` : ''}`,
            user,
          );
    const fieldReportsQuery = useApiData<{
            data: FieldReport[]
            stats: { total: number; new: number; reviewed: number; converted: number; archived: number }
          }>(
            `/maintenance/field-reports${dashboardPark ? `?parkCode=${dashboardPark}` : ''}`,
            user,
          );
    const monitoringQuery = useApiData<PremierPublicData>('/monitoring/public', user);
    useEffect(() => {
    if (!realtimeSignal || realtimeSignal.tick === 0) return
    const scopes = realtimeSignal.scopes
    if (scopes.includes('field_reports')) {
      fieldReportsQuery.refresh()
    }
    if (scopes.includes('incidents')) {
      incidentsQuery.refresh()
    }
    if (scopes.includes('work_orders')) {
      ordersQuery.refresh()
    }
    if (scopes.includes('infrastructure_assets')) {
      assetsQuery.refresh()
    }
    if (scopes.includes('infrastructure_projects')) {
      projectsQuery.refresh()
    }
    summaryQuery.refresh()
    }, [realtimeSignal?.tick])
    const allParks = parksQuery.data ?? [];
    const activeParkObj = dashboardPark ? allParks.find((p) => p.code === dashboardPark) : null;
    const parkName = activeParkObj?.name ?? 'Toàn hệ thống';
    const displayedParks = dashboardPark ? allParks.filter((p) => p.code === dashboardPark) : allParks;
    const totalEnterprises = displayedParks.reduce((sum, p) => sum + p.enterpriseCount, 0);
    const assets = assetsQuery.data ?? [];
    const totalAssets = assets.length;
    const operationalAssets = assets.filter((a) => a.status === 'OPERATIONAL').length;
    const degradedAssets = assets.filter((a) => a.status === 'DEGRADED').length;
    const maintenanceAssets = assets.filter((a) => a.status === 'UNDER_MAINTENANCE').length;
    const projects = projectsQuery.data ?? [];
    const totalProjects = projects.length;
    const totalEstimatedBudget = projects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
    const totalDisbursed = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    const overallDisbursementRate = totalEstimatedBudget > 0 ? (totalDisbursed / totalEstimatedBudget) * 100 : 0;
    const inProgressProjects = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const planningProjects = projects.filter((p) => p.status === 'PLANNING').length;
    const summaryRevenue = summaryQuery.data?.revenueByCategory.reduce((tot, row) => tot + numberValue(row.amount_due), 0);
    const summaryDebt = summaryQuery.data ? numberValue(summaryQuery.data.receivables.amountOutstanding) : 0;
    const incidents = incidentsQuery.data ?? [];
    const openIncidents = incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.currentStatus));
    const criticalOrHighIncidents = openIncidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
    const orders = ordersQuery.data ?? [];
    const ordersInProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
    const ordersCompleted = orders.filter((o) => o.status === 'COMPLETED').length;
    const overdueOrdersCount = orders.filter((o) => o.isOverdue && !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
    const monitoringData = monitoringQuery.data;
    const allStations = monitoringData?.stations ?? [];
    const filteredStations = dashboardPark
            ? allStations.filter((s) => {
                if (dashboardPark === 'KCN_AN_PHU') return s.code.includes('AP') || s.name.includes('An Phú')
                if (dashboardPark === 'KCN_HOA_HIEP_1') return s.code.includes('HH') || s.name.includes('Hòa Hiệp')
                if (dashboardPark === 'KCN_DONG_BAC_SONG_CAU_KV1') return s.code.includes('DBSC') || s.name.includes('Sông Cầu')
                return true
              })
            : allStations;
    const currentSnapshots = monitoringData?.current ?? [];
    const relevantSnapshots = currentSnapshots.filter((sn) =>
            filteredStations.some((st) => st.code === sn.stationCode),
          );
    const exceededMetricsCount = relevantSnapshots
            .flatMap((sn) => sn.metrics)
            .filter((m) => m.status === 'EXCEEDED').length;
    const workforceCount = summaryQuery.data?.workforce.activeEmployees;
    const countLabel = (val: number | undefined, loading: boolean) =>
            val === undefined ? (loading ? 'Đang tải...' : '—') : new Intl.NumberFormat('vi-VN').format(val);
    const isFiltered = dashboardPark !== '';
    const resetFilters = () => {
            setDashboardPark('')
          };
    const refreshAll = () => {
            parksQuery.refresh()
            summaryQuery.refresh()
            assetsQuery.refresh()
            projectsQuery.refresh()
            incidentsQuery.refresh()
            ordersQuery.refresh()
            monitoringQuery.refresh()
          };
    const sectionState = (query: { loading: boolean; error: string | null; data: unknown }, children: ReactNode) =>
            query.error ? <ErrorBlock message={query.error} /> : query.loading && !query.data ? <LoadingBlock /> : children;
    const link = (view: View, label = 'Xem chi tiết', context?: { parkCode?: string; tab?: string }) => (
            <button className="dashboard-link" type="button" onClick={() => onNavigate?.(view, context)}>
              {label}
              <Icon name="arrow" size={15} />
            </button>
          );
    const alerts: Array<{
        id: string
        severity: 'critical' | 'warning' | 'info'
        badgeLabel: string
        badgeTone: 'negative' | 'warning' | 'info'
        title: string
        parkName: string
        description: string
        actionLabel: string
        onAction: () => void
        }> = [];
    const unreviewedReports = fieldReportsQuery.data?.data.filter((r) => r.status === 'NEW') ?? [];
    if (unreviewedReports.length > 0) {
    const latestRep = unreviewedReports[0]
    alerts.push({
      id: 'field-reports-new',
      severity: 'warning',
      badgeLabel: `${unreviewedReports.length} tin mới từ Zalo`,
      badgeTone: 'warning',
      title: `Tiếp nhận ${unreviewedReports.length} báo cáo hiện trường mới từ Zalo & Kỹ thuật`,
      parkName: latestRep?.parkName || 'KCN',
      description: `Tin mới nhất: "${latestRep?.title}" (${latestRep?.reporterName}). Bấm để xem nội dung gốc và xử lý chuyển đổi.`,
      actionLabel: 'Xem & tiếp nhận báo cáo',
      onAction: () => onNavigate?.('maintenance', { tab: 'reports' }),
    })
    }

    openIncidents.forEach((inc) => {
    const isHigh = inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
    alerts.push({
      id: `incident-${inc.id}`,
      severity: isHigh ? 'critical' : 'warning',
      badgeLabel: isHigh ? 'Sự cố mức cao' : 'Sự cố kỹ thuật',
      badgeTone: isHigh ? 'negative' : 'warning',
      title: `${inc.incidentCode}: ${inc.title}`,
      parkName: inc.parkName,
      description: `${inc.locationDetail || 'Tại KCN'} · Trạng thái: ${incidentStatusLabel(inc.currentStatus)} · Cần theo dõi tiến độ xử lý.`,
      actionLabel: 'Xử lý sự cố',
      onAction: () => onNavigate?.('maintenance', { parkCode: inc.parkCode, tab: 'incidents' }),
    })
    })
    projects.forEach((proj) => {
    const rate = proj.estimatedBudget > 0 ? (proj.actualCost / proj.estimatedBudget) * 100 : 0
    if (rate < 40 && proj.status !== 'COMPLETED') {
      alerts.push({
        id: `proj-${proj.id}`,
        severity: 'warning',
        badgeLabel: `Chậm giải ngân (${rate.toFixed(1)}%)`,
        badgeTone: 'warning',
        title: `${proj.projectCode}: ${proj.projectName}`,
        parkName: proj.parkName,
        description: `Mới giải ngân ${compactCurrency(proj.actualCost)} / ${compactCurrency(proj.estimatedBudget)} kế hoạch. Cần đẩy nhanh tiến độ giai đoạn "${proj.currentMilestone || 'Thi công'}".`,
        actionLabel: 'Xem kế hoạch vốn',
        onAction: () => onNavigate?.('finance', { parkCode: proj.parkCode, tab: 'projects' }),
      })
    }
    })
    assets
    .filter((a) => a.status === 'DEGRADED')
    .forEach((ast) => {
      alerts.push({
        id: `asset-${ast.id}`,
        severity: 'warning',
        badgeLabel: 'Hạ tầng xuống cấp',
        badgeTone: 'warning',
        title: `${ast.assetCode}: ${ast.assetName}`,
        parkName: ast.parkName,
        description: `Tài sản thuộc danh mục ${ast.categoryName} đang ở trạng thái xuống cấp. Cần khảo sát để lập kế hoạch duy tu hoặc nâng cấp.`,
        actionLabel: 'Khảo sát hạ tầng',
        onAction: () => onNavigate?.('infrastructure', { parkCode: ast.parkCode, tab: 'assets' }),
      })
    })
    orders
    .filter((o) => o.status === 'IN_PROGRESS')
    .forEach((ord) => {
      alerts.push({
        id: `order-${ord.id}`,
        severity: 'info',
        badgeLabel: 'Bảo trì đang thực hiện',
        badgeTone: 'info',
        title: `${ord.orderCode}: ${ord.title}`,
        parkName: ord.parkName || (ord.assetCode.startsWith('HT-AP') ? 'KCN An Phú' : ord.assetCode.startsWith('HT-HH') ? 'KCN Hòa Hiệp 1' : 'KCN Đông Bắc Sông Cầu'),
        description: `Công trình: ${ord.assetName} (${ord.assetCode}) · Phân công: ${ord.assignedTo} · Chi phí: ${formatCurrency(ord.actualCost)}.`,
        actionLabel: 'Xem lệnh bảo dưỡng',
        onAction: () => onNavigate?.('maintenance', { parkCode: ord.parkCode, tab: 'orders' }),
      })
    })
    alerts.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
    })
    const activitiesLoading = fieldReportsQuery.loading || incidentsQuery.loading || ordersQuery.loading || projectsQuery.loading;
    const recentActivities = useMemo(() => {
            return buildRecentActivities({
              fieldReports: fieldReportsQuery.data?.data,
              incidents,
              orders,
              projects,
              monitoring: monitoringData,
              filterParkCode: dashboardPark || undefined,
              filterParkName: dashboardPark ? parkName : undefined,
              limit: 6,
            })
          }, [
            fieldReportsQuery.data?.data,
            incidents,
            orders,
            projects,
            monitoringData,
            dashboardPark,
            parkName,
          ]);
    return (
    <div className="content-stack dashboard-page">
      <PageTitle
        title="Bảng điều hành Tổng quan"
        detail="Trung tâm chỉ huy dữ liệu thời gian thực: Giám sát quy mô doanh nghiệp, tiến độ đầu tư hạ tầng, bảo trì sự cố và quan trắc môi trường."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <button type="button" className="glass-button" onClick={() => setReportDialogOpen(true)}>
              <Icon name="receipt" size={16} /> Xuất báo cáo tổng hợp
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={refreshAll}
              title="Làm mới toàn bộ chỉ số Dashboard"
              aria-label="Làm mới dữ liệu"
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        }
      />

      {/* Unified Filter Bar */}
      <section className="glass-panel dashboard-filter-bar" aria-label="Bộ lọc tổng quan">
        <div className="dashboard-filter-controls-row">
          <div className="dashboard-filter-group dashboard-filter-controls">
            <GlassSelect
              value={dashboardPark}
              onChange={setDashboardPark}
              label="Khu công nghiệp"
              icon="land"
              ariaLabel="Chọn KCN điều hành"
              options={[
                { value: '', label: 'Tất cả KCN (Toàn hệ thống)' },
                ...allParks.map((p) => ({ value: p.code, label: `${p.name} (${p.enterpriseCount} DN)` })),
              ]}
            />
            {onTimeFilterChange && (
              <>
                <GlassSelect
                  value={String(timeFilter.year)}
                  onChange={(val) => onTimeFilterChange(handleYearChange(timeFilter, Number(val)))}
                  label="Năm"
                  icon="calendar"
                  ariaLabel="Chọn năm điều hành"
                  options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                />
                {timeFilter.year === todayVietnam.year && (
                  <GlassSelect
                    value={timeFilter.periodType}
                    onChange={(val) => onTimeFilterChange(handlePeriodTypeChange(timeFilter, val as PeriodType))}
                    label="Loại kỳ"
                    icon="activity"
                    ariaLabel="Loại kỳ báo cáo"
                    options={availableTypes.map((t) => ({ value: t, label: PERIOD_TYPE_LABELS[t] }))}
                  />
                )}
                <GlassSelect
                  value={timeFilter.periodKey}
                  onChange={(val) => onTimeFilterChange(handlePeriodSelect(timeFilter, val))}
                  label="Kỳ báo cáo"
                  icon="calendar"
                  ariaLabel="Kỳ báo cáo"
                  options={periodOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              </>
            )}
            {isFiltered && (
              <button type="button" className="dashboard-filter-reset" onClick={resetFilters}>
                <Icon name="close" size={14} />
                <span>Bỏ lọc KCN</span>
              </button>
            )}
          </div>
        </div>
        <div className="dashboard-filter-meta">
          <span className="dashboard-period-highlight">Kỳ áp dụng: <strong>{timeFilter.displayRange}</strong></span>
          <span style={{ margin: '0 0.35rem', opacity: 0.5 }}>·</span>
          <span>{dashboardPark ? `Đang xem: ${parkName}` : 'Phạm vi: Toàn bộ 3 Khu công nghiệp'}</span>
          <span style={{ margin: '0 0.35rem', opacity: 0.5 }}>·</span>
          <span>Dữ liệu xác thực 100% từ hệ thống tác nghiệp</span>
        </div>
      </section>

      {/* 11 Executive KPI Cards */}
      <section className="dashboard-kpi-grid" aria-label="Các chỉ số điều hành chính">
        {/* KPI 1: Doanh nghiệp */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('enterprises', { parkCode: dashboardPark })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('enterprises', { parkCode: dashboardPark })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Doanh nghiệp KCN</span>
            <div className="dashboard-kpi-icon dashboard-kpi-icon-info">
              <Icon name="building" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(parksQuery.data ? totalEnterprises : undefined, parksQuery.loading)}
            <small>DN</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{dashboardPark ? `${parkName} · 100% hoạt động` : 'Toàn hệ thống · 3 KCN'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 2: Công trình hạ tầng */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('infrastructure', { parkCode: dashboardPark, tab: 'assets' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('infrastructure', { parkCode: dashboardPark, tab: 'assets' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Công trình hạ tầng</span>
            <div className={`dashboard-kpi-icon ${degradedAssets + maintenanceAssets > 0 ? 'dashboard-kpi-icon-warning' : 'dashboard-kpi-icon-positive'}`}>
              <Icon name="land" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(assetsQuery.data ? totalAssets : undefined, assetsQuery.loading)}
            <small>công trình</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{assetsQuery.data ? `${operationalAssets} tốt, ${degradedAssets + maintenanceAssets} cần chú ý` : 'Đang tải...'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 3: Dự án đầu tư */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('infrastructure', { parkCode: dashboardPark, tab: 'projects' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('infrastructure', { parkCode: dashboardPark, tab: 'projects' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Dự án nâng cấp</span>
            <div className="dashboard-kpi-icon dashboard-kpi-icon-info">
              <Icon name="wrench" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(projectsQuery.data ? totalProjects : undefined, projectsQuery.loading)}
            <small>dự án</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{projectsQuery.data ? `${inProgressProjects} thi công, ${planningProjects} lập KH` : 'Đang tải...'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 4: Kế hoạch vốn */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('finance', { parkCode: dashboardPark, tab: 'projects' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('finance', { parkCode: dashboardPark, tab: 'projects' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Kế hoạch vốn duyệt</span>
            <div className="dashboard-kpi-icon">
              <Icon name="dollar" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {projectsQuery.data ? compactCurrency(totalEstimatedBudget) : (projectsQuery.loading ? 'Đang tải' : '—')}
          </div>
          <div className="dashboard-kpi-footer">
            <span>{projectsQuery.data ? `${totalProjects} dự án được phê duyệt` : 'Kế hoạch vốn'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 5: Đã giải ngân */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('finance', { parkCode: dashboardPark, tab: 'projects' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('finance', { parkCode: dashboardPark, tab: 'projects' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Đã giải ngân DA</span>
            <div className={`dashboard-kpi-icon ${overallDisbursementRate >= 60 ? 'dashboard-kpi-icon-positive' : overallDisbursementRate >= 40 ? 'dashboard-kpi-icon-info' : 'dashboard-kpi-icon-warning'}`}>
              <Icon name="chart" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {projectsQuery.data ? compactCurrency(totalDisbursed) : (projectsQuery.loading ? 'Đang tải' : '—')}
          </div>
          <div className="dashboard-kpi-footer">
            <span>{projectsQuery.data ? `Đạt ${overallDisbursementRate.toFixed(1)}% kế hoạch vốn` : 'Tỷ lệ giải ngân'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 6: Nguồn thu hợp đồng */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('finance', { parkCode: dashboardPark, tab: 'leases' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('finance', { parkCode: dashboardPark, tab: 'leases' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Tổng nghĩa vụ thuê</span>
            <div className="dashboard-kpi-icon">
              <Icon name="receipt" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {summaryQuery.data ? compactCurrency(summaryRevenue ?? 0) : (summaryQuery.loading ? 'Đang tải' : '—')}
          </div>
          <div className="dashboard-kpi-footer">
            <span>{timeFilter.periodLabel} · Nghĩa vụ theo nguồn</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 7: Công nợ hiện có */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('finance', { parkCode: dashboardPark, tab: 'receivables' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('finance', { parkCode: dashboardPark, tab: 'receivables' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Công nợ hiện có</span>
            <div className={`dashboard-kpi-icon ${summaryDebt > 0 ? 'dashboard-kpi-icon-warning' : 'dashboard-kpi-icon-positive'}`}>
              <Icon name="alert" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {summaryQuery.data ? compactCurrency(summaryDebt) : (summaryQuery.loading ? 'Đang tải' : '—')}
          </div>
          <div className="dashboard-kpi-footer">
            <span>{summaryQuery.data ? `${summaryQuery.data.receivables.invoiceLines} hóa đơn chưa tất toán` : 'Số dư công nợ'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 8: Sự cố kỹ thuật */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('maintenance', { parkCode: dashboardPark, tab: 'incidents' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('maintenance', { parkCode: dashboardPark, tab: 'incidents' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Sự cố cần xử lý</span>
            <div className={`dashboard-kpi-icon ${criticalOrHighIncidents > 0 ? 'dashboard-kpi-icon-negative' : openIncidents.length > 0 ? 'dashboard-kpi-icon-warning' : 'dashboard-kpi-icon-positive'}`}>
              <Icon name="alert" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(incidentsQuery.data ? openIncidents.length : undefined, incidentsQuery.loading)}
            <small>vụ</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{openIncidents.length > 0 ? `${criticalOrHighIncidents} mức cao/khẩn cấp, ${openIncidents.length - criticalOrHighIncidents} mức TB` : 'Không có sự cố mở'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 9: Lệnh bảo dưỡng */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('maintenance', { parkCode: dashboardPark, tab: 'orders' })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('maintenance', { parkCode: dashboardPark, tab: 'orders' })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Lệnh bảo dưỡng</span>
            <div className={`dashboard-kpi-icon ${overdueOrdersCount > 0 ? 'dashboard-kpi-icon-negative' : 'dashboard-kpi-icon-info'}`}>
              <Icon name="wrench" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(ordersQuery.data ? orders.length : undefined, ordersQuery.loading)}
            <small>lệnh</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{ordersQuery.data ? `${ordersInProgress} đang làm, ${ordersCompleted} xong${overdueOrdersCount > 0 ? `, ${overdueOrdersCount} quá hạn` : ''}` : 'Kế hoạch duy tu'}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 10: Trạm quan trắc */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('monitoring', { parkCode: dashboardPark })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('monitoring', { parkCode: dashboardPark })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Quan trắc tự động</span>
            <div className={`dashboard-kpi-icon ${exceededMetricsCount === 0 ? 'dashboard-kpi-icon-positive' : 'dashboard-kpi-icon-negative'}`}>
              <Icon name="activity" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(monitoringQuery.data ? filteredStations.length : undefined, monitoringQuery.loading)}
            <small>trạm</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>{exceededMetricsCount > 0 ? `${exceededMetricsCount} thông số vượt ngưỡng` : (filteredStations.length === 0 ? 'Chưa đủ dữ liệu' : 'Tất cả chỉ tiêu đạt chuẩn')}</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>

        {/* KPI 11: Nhân sự */}
        <div
          role="button"
          tabIndex={0}
          className="dashboard-kpi-card"
          onClick={() => onNavigate?.('workforce', { parkCode: dashboardPark })}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.('workforce', { parkCode: dashboardPark })}
        >
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-title">Lực lượng nhân sự</span>
            <div className="dashboard-kpi-icon">
              <Icon name="users" size={17} />
            </div>
          </div>
          <div className="dashboard-kpi-value">
            {countLabel(workforceCount, summaryQuery.loading)}
            <small>người</small>
          </div>
          <div className="dashboard-kpi-footer">
            <span>3 tổ KCN & các phòng ban chuyên môn</span>
            <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
          </div>
        </div>
      </section>

      {/* 5 High-Value Visual Charts */}
      <section className="dashboard-grid-2col" aria-label="Biểu đồ tiến độ vốn và tình trạng hạ tầng">
        {/* Chart 1: Vốn & Giải ngân */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Tiến độ Giải ngân Vốn Đầu tư Hạ tầng"
            meta={link('finance', 'Mở phân tích vốn', { parkCode: dashboardPark, tab: 'projects' })}
          />
          <p className="dashboard-caption">So sánh vốn kế hoạch duyệt và số tiền đã giải ngân thực tế theo từng KCN</p>
          {sectionState(projectsQuery, (
            <OverviewDisbursementChart
              projects={projects}
              parks={allParks}
              selectedPark={dashboardPark}
              onNavigate={onNavigate}
            />
          ))}
        </article>

        {/* Chart 2: Cơ cấu trạng thái hạ tầng */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Công trình nào cần bảo dưỡng?"
            meta={link('infrastructure', 'Xem danh mục tài sản', { parkCode: dashboardPark, tab: 'assets' })}
          />
          <p className="dashboard-caption">Tỷ lệ công trình đang vận hành bình thường, xuống cấp hoặc bảo dưỡng kỹ thuật</p>
          {sectionState(assetsQuery, (
            <OverviewAssetStatusChart
              assets={assets}
              onNavigate={onNavigate}
            />
          ))}
        </article>
      </section>

      {/* 3 Col Charts Grid */}
      <section className="dashboard-grid-3col" aria-label="Biểu đồ phân bổ doanh nghiệp, bảo trì và quan trắc">
        {/* Chart 3: Phân bổ Doanh nghiệp */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Phân bổ Doanh nghiệp KCN"
            meta={link('enterprises', 'Xem doanh nghiệp', { parkCode: dashboardPark })}
          />
          <p className="dashboard-caption">Quy mô cơ sở doanh nghiệp đang hoạt động trong các KCN {timeFilter.periodLabel}</p>
          {sectionState(parksQuery, (
            <OverviewParkEnterprisesChart
              parks={allParks}
              selectedPark={dashboardPark}
              onNavigate={onNavigate}
            />
          ))}
        </article>

        {/* Chart 4: Tiến độ Bảo dưỡng */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Tiến độ Lệnh Bảo dưỡng & Sửa chữa"
            meta={link('maintenance', 'Xem lệnh bảo trì', { parkCode: dashboardPark, tab: 'orders' })}
          />
          <p className="dashboard-caption">Tình hình thực hiện các lệnh duy tu hạ tầng kỹ thuật định kỳ và đột xuất</p>
          {sectionState(ordersQuery, (
            <OverviewMaintenanceOrdersChart
              orders={orders}
              onNavigate={onNavigate}
            />
          ))}
        </article>

        {/* Chart 5: Quan trắc nước thải */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Lưu lượng Quan trắc Tự động"
            meta={link('monitoring', 'Xem dữ liệu trạm', { parkCode: dashboardPark })}
          />
          <p className="dashboard-caption">Lưu lượng xả thải hàng ngày qua trạm quan trắc liên tục Premier</p>
          {sectionState(monitoringQuery, (
            <OverviewWastewaterFlowChart
              monitoring={monitoringData}
              selectedPark={dashboardPark}
              onNavigate={onNavigate}
            />
          ))}
        </article>
      </section>

      {/* Actionable Alerts & Recent Activities */}
      <section className="dashboard-grid-2col" aria-label="Cảnh báo và hoạt động gần đây">
        {/* Khu vực cảnh báo & việc cần xử lý ngay */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Khu vực Cảnh báo & Việc cần xử lý ngay"
            action={<Badge tone={alerts.some((a) => a.severity === 'critical') ? 'negative' : 'warning'}>{alerts.length} vấn đề</Badge>}
            meta={link('maintenance', 'Sổ nhật ký sự cố', { parkCode: dashboardPark, tab: 'incidents' })}
          />
          <p className="dashboard-caption">Sắp xếp theo mức độ ưu tiên: Sự cố kỹ thuật cao, dự án chậm giải ngân và tài sản xuống cấp</p>
          <OverviewActionableAlerts alerts={alerts} />
        </article>

        {/* Nhật ký & Hoạt động gần đây */}
        <article className="dashboard-panel">
          <PanelHeading
            title="Nhật ký & Hoạt động Gần đây"
            action={
              <Badge tone={recentActivities.length > 0 ? 'neutral' : 'warning'}>
                {recentActivities.length} sự kiện
              </Badge>
            }
            meta={<span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>Cập nhật liên tục</span>}
          />
          <p className="dashboard-caption">Dòng thời gian các sự kiện quan trọng trong hệ thống quản lý hạ tầng và dịch vụ</p>
          <OverviewRecentActivities
            activities={recentActivities}
            loading={activitiesLoading}
            onNavigate={onNavigate}
          />
        </article>
      </section>
      <AggregateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        year={timeFilter.year}
        periodLabel={timeFilter.periodLabel}
        fromDate={timeFilter.fromDate}
        toDate={timeFilter.toDate}
        parkCode={dashboardPark}
        parks={allParks.map((park) => ({ code: park.code, name: park.name }))}
      />
    </div>
    )
}
