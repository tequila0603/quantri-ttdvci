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

export function FinanceDonutChart({ paid, outstanding, hasPaymentData }: { paid: number; outstanding: number; hasPaymentData: boolean }) {
    const balance = Math.max(paid + outstanding, 0);
    const paidShare = balance > 0 ? Math.min(Math.max(paid / balance, 0), 1) : 0;
    const circumference = 2 * Math.PI * 43;
    const paidLength = circumference * paidShare;
    const centerLabel = hasPaymentData ? compactCurrency(balance) : 'Chưa có';
    return (
    <div className="finance-donut" role="img" aria-label={hasPaymentData ? `Đã thu ${formatCurrency(paid)}, còn nợ ${formatCurrency(outstanding)}` : 'Chưa có dữ liệu thanh toán thực tế'}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="finance-donut-track" cx="60" cy="60" r="43" />
        <circle className="finance-donut-paid" cx="60" cy="60" r="43" strokeDasharray={`${paidLength} ${circumference}`} />
        <text className="finance-donut-total" x="60" y="56">{centerLabel}</text>
        <text className="finance-donut-caption" x="60" y="71">{hasPaymentData ? 'theo hóa đơn' : 'chờ import'}</text>
      </svg>
      <div className="finance-donut-legend">
        <span><i className="finance-dot finance-dot-paid" />Đã thu <strong>{hasPaymentData ? formatCurrency(paid) : 'Chưa có'}</strong></span>
        <span><i className="finance-dot finance-dot-outstanding" />Còn nợ <strong>{formatCurrency(outstanding)}</strong></span>
      </div>
    </div>
    )
}

export function FinanceCategoryBars({ rows, compact = false }: { rows: FinanceBarRow[]; compact?: boolean }) {
    const maxValue = Math.max(...rows.map((row) => row.value), 1);
    if (!rows.length) return <EmptyBlock label="Chưa có khoản thu trong phạm vi này" />
    return (
    <div className={`finance-category-bars ${compact ? 'finance-category-bars-compact' : ''}`}>
      {rows.map((row) => {
        const width = row.value > 0 ? Math.max((row.value / maxValue) * 100, 3) : 0
        return (
          <div className="finance-category-row" key={row.label}>
            <div className="finance-category-row-head"><span>{row.label}</span><strong>{compactCurrency(row.value)}</strong></div>
            <div className="finance-category-track"><span style={{ width: `${width}%`, background: row.color ?? 'var(--color-ink)' }} /></div>
            {row.detail && <small>{row.detail}</small>}
          </div>
        )
      })}
    </div>
    )
}

export function FinanceAgingChart({ rows }: { rows: FinanceAgingRow[] }) {
    const maxValue = Math.max(...rows.map((row) => row.value), 1);
    return (
    <div className="finance-aging-chart" role="img" aria-label="Biểu đồ tuổi công nợ">
      {rows.map((row) => (
        <div className="finance-aging-column" key={row.key}>
          <strong>{compactCurrency(row.value)}</strong>
          <div className="finance-aging-track"><span style={{ height: `${row.value > 0 ? Math.max((row.value / maxValue) * 100, 5) : 4}%`, background: row.color }} /></div>
          <span>{row.label}</span>
          <small>{row.count} hóa đơn</small>
        </div>
      ))}
    </div>
    )
}

export function FinanceKPICards({
      totalPlanned,
      totalAllocated,
      totalDisbursed,
      remainingBudget,
      disbursementRate,
      inProgressCount,
      attentionCount,
      totalProjectsCount,
    }: {
          totalPlanned: number
          totalAllocated: number
          totalDisbursed: number
          remainingBudget: number
          disbursementRate: number
          inProgressCount: number
          attentionCount: number
          totalProjectsCount: number
        }) {
    return (
    <div className="finance-kpi-grid">
      <article className="glass-panel finance-kpi-card" title={`Kế hoạch vốn: ${formatCurrency(totalPlanned)}`}>
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Tổng kế hoạch vốn</span>
          <span className="finance-kpi-icon"><Icon name="dollar" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{compactCurrency(totalPlanned)}</strong>
        <span className="finance-kpi-sub">{totalPlanned > 0 ? "Kế hoạch được duyệt" : "Chưa có dự toán"}</span>
      </article>

      <article className="glass-panel finance-kpi-card" title={`Đã phân bổ: ${formatCurrency(totalAllocated)}`}>
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Tổng vốn phân bổ</span>
          <span className="finance-kpi-icon"><Icon name="database" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{compactCurrency(totalAllocated)}</strong>
        <span className="finance-kpi-sub">{totalProjectsCount}/{totalProjectsCount} dự án cấp vốn</span>
      </article>

      <article className="glass-panel finance-kpi-card" title={`Đã giải ngân: ${formatCurrency(totalDisbursed)}`}>
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Tổng đã giải ngân</span>
          <span className="finance-kpi-icon" style={{ color: 'var(--color-positive)' }}><Icon name="trendingUp" size={15} /></span>
        </div>
        <strong className="finance-kpi-value" style={{ color: 'var(--color-positive)' }}>{compactCurrency(totalDisbursed)}</strong>
        <span className="finance-kpi-sub">Đã thanh toán thực tế</span>
      </article>

      <article className="glass-panel finance-kpi-card" title={`Vốn còn lại: ${formatCurrency(remainingBudget)}`}>
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Số vốn còn lại</span>
          <span className="finance-kpi-icon"><Icon name="activity" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{compactCurrency(remainingBudget)}</strong>
        <span className="finance-kpi-sub">Chưa giải ngân</span>
      </article>

      <article className="glass-panel finance-kpi-card">
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Tỷ lệ giải ngân</span>
          <span className="finance-kpi-icon"><Icon name="gauge" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{disbursementRate.toFixed(1)}%</strong>
        <div className="finance-kpi-mini-bar">
          <div
            className="finance-kpi-mini-fill"
            style={{
              width: `${Math.min(disbursementRate, 100)}%`,
              background: disbursementRate >= 80 ? 'var(--color-positive)' : disbursementRate >= 50 ? 'var(--color-accent)' : 'var(--color-warning)',
            }}
          />
        </div>
      </article>

      <article className="glass-panel finance-kpi-card">
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Đang thực hiện</span>
          <span className="finance-kpi-icon"><Icon name="wrench" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{inProgressCount} <small style={{ fontSize: '0.78rem', fontWeight: 500 }}>dự án</small></strong>
        <span className="finance-kpi-sub">Tổng {totalProjectsCount} danh mục DA</span>
      </article>

      <article className={`glass-panel finance-kpi-card ${attentionCount > 0 ? 'finance-kpi-card-attention' : ''}`}>
        <div className="finance-kpi-head">
          <span className="finance-kpi-label">Cần chú ý</span>
          <span className="finance-kpi-icon"><Icon name="alert" size={15} /></span>
        </div>
        <strong className="finance-kpi-value">{attentionCount} <small style={{ fontSize: '0.78rem', fontWeight: 500 }}>dự án</small></strong>
        <span className="finance-kpi-sub">{attentionCount > 0 ? 'Giải ngân chậm / cận hạn' : 'Đảm bảo tiến độ'}</span>
      </article>
    </div>
    )
}

export function ProjectDisbursementBars({ projects }: { projects: InfrastructureProject[] }) {
    if (!projects.length) {
    return <EmptyBlock label="Không có dự án phù hợp với bộ lọc hiện tại" />
    }

    return (
    <div className="project-bars-list">
      {projects.map((proj) => {
        const rate = proj.estimatedBudget > 0 ? (proj.actualCost / proj.estimatedBudget) * 100 : 0
        const isAttention = (proj.status === 'IN_PROGRESS' && rate < 50) || (proj.completionDate && new Date(proj.completionDate).getTime() < Date.now() && proj.status !== 'COMPLETED')
        const fillClass = proj.status === 'COMPLETED' ? 'project-progress-fill-positive' : rate < 50 ? 'project-progress-fill-warning' : 'project-progress-fill-info'

        return (
          <div key={proj.id} className={`project-bar-card ${isAttention ? 'project-bar-card-attention' : ''}`}>
            <div className="project-bar-header">
              <div className="project-bar-title-area">
                <span className="project-bar-code">{proj.projectCode} · {proj.parkName}</span>
                <span className="project-bar-name">{proj.projectName}</span>
              </div>
              <div className="project-bar-badges">
                <Badge tone="neutral">{projectTypeLabel(proj.projectType)}</Badge>
                <Badge tone={projectStatusTone(proj.status)}>{projectStatusLabel(proj.status)}</Badge>
                {isAttention && (
                  <Badge tone="warning">
                    <Icon name="alert" size={12} /> Cần chú ý
                  </Badge>
                )}
              </div>
            </div>

            <div className="project-progress-track">
              <div className={`project-progress-fill ${fillClass}`} style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>

            <div className="project-bar-stats">
              <span>Đã giải ngân: <strong>{formatCurrency(proj.actualCost)}</strong></span>
              <span>Kế hoạch: <strong>{formatCurrency(proj.estimatedBudget)}</strong></span>
              <span>Tỷ lệ: <strong style={{ color: rate < 50 ? 'var(--color-warning)' : 'var(--color-positive)' }}>{rate.toFixed(1)}%</strong></span>
              <span>Còn lại: <strong>{formatCurrency((proj.estimatedBudget - proj.actualCost))}</strong></span>
            </div>

            <div className="project-bar-footer">
              <span>Mốc tiến độ: <strong style={{ color: 'var(--color-ink)' }}>{proj.currentMilestone}</strong></span>
              <span>Hạn hoàn thành: <strong style={{ color: 'var(--color-ink)' }}>{shortDate(proj.completionDate)}</strong></span>
            </div>
          </div>
        )
      })}
    </div>
    )
}

export function ParkCapitalComparisonChart({ projects }: { projects: InfrastructureProject[] }) {
    const parkSummary = useMemo(() => {
            const map = new Map<string, { parkCode: string; parkName: string; planned: number; disbursed: number; count: number }>()
            for (const p of projects) {
              const existing = map.get(p.parkCode) ?? { parkCode: p.parkCode, parkName: p.parkName, planned: 0, disbursed: 0, count: 0 }
              existing.planned += p.estimatedBudget
              existing.disbursed += p.actualCost
              existing.count += 1
              map.set(p.parkCode, existing)
            }
            return Array.from(map.values()).sort((a, b) => b.planned - a.planned)
          }, [projects]);
    const maxVal = Math.max(...parkSummary.map((p) => Math.max(p.planned, p.disbursed)), 1);
    if (!parkSummary.length) return <EmptyBlock label="Chưa có dữ liệu KCN" />
    return (
    <div className="park-bar-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', fontSize: '0.68rem', color: 'var(--color-subtle)', marginBottom: '0.25rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '2px', background: 'var(--color-ink)' }} /> Kế hoạch vốn</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '2px', background: 'var(--color-accent)' }} /> Đã giải ngân</span>
      </div>
      {parkSummary.map((item) => {
        const rate = item.planned > 0 ? (item.disbursed / item.planned) * 100 : 0
        const plannedWidth = Math.max((item.planned / maxVal) * 100, 3)
        const disbursedWidth = Math.max((item.disbursed / maxVal) * 100, 3)

        return (
          <div key={item.parkCode} className="park-bar-item">
            <div className="park-bar-item-head">
              <span><strong>{item.parkName}</strong> ({item.count} dự án)</span>
              <span style={{ fontWeight: 700, color: rate < 50 ? 'var(--color-warning)' : 'var(--color-positive)' }}>
                {rate.toFixed(1)}% giải ngân
              </span>
            </div>
            <div className="park-bar-pair">
              <div className="park-bar-row">
                <span className="park-bar-label">Kế hoạch</span>
                <div className="park-bar-track">
                  <div className="park-bar-fill" style={{ width: `${plannedWidth}%`, background: 'var(--color-ink)' }} />
                </div>
                <span className="park-bar-val">{compactCurrency(item.planned)}</span>
              </div>
              <div className="park-bar-row">
                <span className="park-bar-label">Giải ngân</span>
                <div className="park-bar-track">
                  <div className="park-bar-fill" style={{ width: `${disbursedWidth}%`, background: 'var(--color-accent)' }} />
                </div>
                <span className="park-bar-val">{compactCurrency(item.disbursed)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
    )
}

export function ProjectTypeDonutChart({ projects }: { projects: InfrastructureProject[] }) {
    const TYPE_COLORS: Record<string, string> = {
            UPGRADE: '#4f6f5e',
            NEW_BUILD: '#191919',
            REPAIR: '#9a8160',
            EMERGENCY: '#a8746b',
          };
    const { items, total } = useMemo(() => {
            const map = new Map<string, { type: string; label: string; amount: number; count: number; color: string }>()
            let sum = 0
            for (const p of projects) {
              sum += p.estimatedBudget
              const existing = map.get(p.projectType) ?? {
                type: p.projectType,
                label: projectTypeLabel(p.projectType),
                amount: 0,
                count: 0,
                color: TYPE_COLORS[p.projectType] ?? '#7c849b',
              }
              existing.amount += p.estimatedBudget
              existing.count += 1
              map.set(p.projectType, existing)
            }
            return {
              items: Array.from(map.values()).sort((a, b) => b.amount - a.amount),
              total: sum,
            }
          }, [projects]);
    if (!items.length || total === 0) return <EmptyBlock label="Chưa có dữ liệu phân bổ vốn" />
    const circumference = 2 * Math.PI * 40;
    let accumulatedOffset = 0;
    return (
    <div className="donut-chart-container">
      <div className="donut-svg-wrapper">
        <svg viewBox="0 0 110 110" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r="40" fill="none" stroke="var(--color-line)" strokeWidth="11" />
          {items.map((item) => {
            const share = item.amount / total
            const dashLength = share * circumference
            const dashOffset = -accumulatedOffset
            accumulatedOffset += dashLength

            return (
              <circle
                key={item.type}
                cx="55"
                cy="55"
                r="40"
                fill="none"
                stroke={item.color}
                strokeWidth="11"
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dasharray 700ms var(--ease-out)' }}
              />
            )
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--color-subtle)', fontWeight: 600 }}>TỔNG VỐN</span>
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--color-ink)' }}>{compactCurrency(total)}</strong>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item) => {
          const pct = total > 0 ? (item.amount / total) * 100 : 0
          return (
            <div key={item.type} className="donut-legend-item">
              <div className="donut-legend-left">
                <span className="donut-legend-dot" style={{ background: item.color }} />
                <span>{item.label} <small style={{ color: 'var(--color-subtle)' }}>({item.count} DA)</small></span>
              </div>
              <div className="donut-legend-right">
                <span className="donut-legend-val">{compactCurrency(item.amount)}</span>
                <span className="donut-legend-pct">{pct.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
    )
}

export function DisbursementAlertCard({ projects }: { projects: InfrastructureProject[] }) {
    const atRiskProjects = useMemo(() => {
            return projects.filter((p) => {
              const rate = p.estimatedBudget > 0 ? (p.actualCost / p.estimatedBudget) * 100 : 0
              return (p.status === 'IN_PROGRESS' && rate < 50) || (p.completionDate && new Date(p.completionDate).getTime() < Date.now() && p.status !== 'COMPLETED')
            })
          }, [projects]);
    if (!atRiskProjects.length) {
    return (
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-panel)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-positive-soft)', border: '1px solid var(--color-positive-border)' }}>
        <Icon name="check" size={18} />
        <span style={{ fontSize: '0.78rem', color: 'var(--color-positive)', fontWeight: 600 }}>
          Tất cả các dự án hạ tầng đều đang đáp ứng tiến độ giải ngân theo kế hoạch được phê duyệt.
        </span>
      </div>
    )
    }

    return (
    <div className="finance-risk-card">
      <div className="finance-risk-header">
        <div className="finance-risk-title">
          <Icon name="alert" size={17} />
          <span>CẢNH BÁO TIẾN ĐỘ GIẢI NGÂN & RỦI RO HOÀN THÀNH ({atRiskProjects.length} DỰ ÁN)</span>
        </div>
        <Badge tone="warning">Cần chỉ đạo điều hành</Badge>
      </div>

      {atRiskProjects.map((p) => {
        const rate = p.estimatedBudget > 0 ? (p.actualCost / p.estimatedBudget) * 100 : 0
        return (
          <div key={p.id} className="finance-risk-body">
            <div className="finance-risk-desc">
              <h4>[{p.projectCode}] {p.projectName}</h4>
              <p>
                <strong>{p.parkName}</strong> · Hạn hoàn thành: <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{shortDate(p.completionDate)}</span>
              </p>
              <p style={{ marginTop: '0.35rem' }}>
                Hiện trạng thi công: <em>{p.currentMilestone}</em>. {p.notes ? `Ghi chú: ${p.notes}.` : ''}
              </p>
              <div className="finance-risk-recommendation" style={{ marginTop: '0.5rem' }}>
                <strong>Khuyến nghị điều hành:</strong> Đôn đốc Ban QLDA và tổ kỹ thuật nghiệm thu khối lượng đã hoàn thành để đẩy nhanh tiến độ giải ngân vốn trước khi kết thúc mùa khô.
              </div>
            </div>
            <div className="finance-risk-metrics">
              <span className="finance-risk-rate">{rate.toFixed(1)}%</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-subtle)' }}>Đã giải ngân {compactCurrency(p.actualCost)}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-subtle)' }}>Kế hoạch {compactCurrency(p.estimatedBudget)}</span>
            </div>
          </div>
        )
      })}
    </div>
    )
}

export function RevenueTrendCard({ year, summary }: { year: number; summary?: Summary | null }) {
    const categories = summary?.revenueByCategory ?? []
    const totalDue = categories.reduce((sum, c) => sum + (Number(c.amount_due) || 0), 0)

    return (
      <article className="glass-panel panel finance-chart-panel">
        <PanelHeading
          title={`Tổng nghĩa vụ thuê theo nguồn (Năm ${year})`}
          meta={<Badge tone="positive">{totalDue > 0 ? compactCurrency(totalDue) : 'Nghĩa vụ hợp đồng'}</Badge>}
        />
        {categories.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.85rem 0' }}>
            {categories.filter((c) => Number(c.amount_due) > 0).map((cat) => (
              <div key={cat.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--color-glass-soft)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cat.display_name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{formatCurrency(cat.amount_due)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--color-line)' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800 }}>Tổng nghĩa vụ phải thu</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-ink)' }}>{formatCurrency(totalDue)}</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            Chưa có dữ liệu nghĩa vụ thuê cho năm này.
          </div>
        )}
      </article>
    )
}

export function FinanceProjectLedger({
      projects,
      leaseRows,
      receivableRows,
      mode,
      onModeChange,
      loading,
      hasPaymentData,
      hasMoreRows,
    }: {
          projects: InfrastructureProject[]
          leaseRows: LeaseRow[]
          receivableRows: ReceivableRow[]
          mode: 'projects' | 'leases' | 'receivables'
          onModeChange: (mode: 'projects' | 'leases' | 'receivables') => void
          loading: boolean
          hasPaymentData: boolean
          hasMoreRows: boolean
          summary: Summary | null
        }) {
    const [sortField, setSortField] = useState<'projectCode' | 'projectName' | 'estimatedBudget' | 'actualCost' | 'rate' | 'completionDate'>('estimatedBudget');
    const [sortAsc, setSortAsc] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const handleSort = (field: typeof sortField) => {
            if (sortField === field) {
              setSortAsc((prev) => !prev)
            } else {
              setSortField(field)
              setSortAsc(false)
            }
          };
    const sortedProjects = useMemo(() => {
            let list = [...projects]
            if (tableSearch.trim()) {
              const q = tableSearch.toLowerCase().trim()
              list = list.filter((p) => p.projectCode.toLowerCase().includes(q) || p.projectName.toLowerCase().includes(q) || p.parkName.toLowerCase().includes(q))
            }
            list.sort((a, b) => {
              let valA: number | string = 0
              let valB: number | string = 0
              if (sortField === 'projectCode') { valA = a.projectCode; valB = b.projectCode }
              else if (sortField === 'projectName') { valA = a.projectName; valB = b.projectName }
              else if (sortField === 'estimatedBudget') { valA = a.estimatedBudget; valB = b.estimatedBudget }
              else if (sortField === 'actualCost') { valA = a.actualCost; valB = b.actualCost }
              else if (sortField === 'rate') {
                valA = a.estimatedBudget > 0 ? (a.actualCost / a.estimatedBudget) : 0
                valB = b.estimatedBudget > 0 ? (b.actualCost / b.estimatedBudget) : 0
              } else if (sortField === 'completionDate') {
                valA = a.completionDate ?? ''
                valB = b.completionDate ?? ''
              }
              if (typeof valA === 'string') {
                return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA)
              }
              return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
            })
            return list
          }, [projects, sortField, sortAsc, tableSearch]);
    const totals = useMemo(() => {
            const planned = sortedProjects.reduce((s, p) => s + p.estimatedBudget, 0)
            const disbursed = sortedProjects.reduce((s, p) => s + p.actualCost, 0)
            const remaining = (planned - disbursed)
            const rate = planned > 0 ? (disbursed / planned) * 100 : 0
            return { planned, disbursed, remaining, rate }
          }, [sortedProjects]);
    return (
    <section className="glass-panel panel finance-ledger-panel">
      <div className="finance-ledger-heading">
        <div>
          <span className="finance-eyebrow finance-eyebrow-light">SỔ DỮ LIỆU CHI TIẾT</span>
          <h3>
            {mode === 'projects'
              ? 'Kế hoạch vốn & Tiến độ giải ngân dự án'
              : mode === 'leases'
              ? 'Đối chiếu khoản thuê theo doanh nghiệp'
              : 'Công nợ và hóa đơn doanh nghiệp'}
          </h3>
        </div>
        <div className="segmented-control" role="tablist" aria-label="Loại sổ chi tiết tài chính">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'leases'}
            className={mode === 'leases' ? 'segment-active' : ''}
            onClick={() => onModeChange('leases')}
          >
            <Icon name="land" size={16} />
            Khoản thuê ({leaseRows.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'projects'}
            className={mode === 'projects' ? 'segment-active' : ''}
            onClick={() => onModeChange('projects')}
          >
            <Icon name="sliders" size={16} />
            Dự án & Vốn ({projects.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'receivables'}
            className={mode === 'receivables' ? 'segment-active' : ''}
            onClick={() => onModeChange('receivables')}
          >
            <Icon name="receipt" size={16} />
            Công nợ ({receivableRows.length})
          </button>
        </div>
      </div>

      {mode === 'projects' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="finance-search-box" style={{ maxWidth: '18rem' }}>
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder="Lọc nhanh trong bảng..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
              {tableSearch && (
                <button type="button" onClick={() => setTableSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)' }}>
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
              Hiển thị <strong>{sortedProjects.length}</strong> dự án (click tiêu đề cột để sắp xếp)
            </span>
          </div>

          {loading ? (
            <LoadingBlock label="Đang tải danh sách dự án..." />
          ) : sortedProjects.length ? (
            <DataTable minWidth="1100px">
              <thead>
                <tr>
                  <th className="sortable-th" onClick={() => handleSort('projectCode')}>
                    Mã DA {sortField === 'projectCode' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('projectName')}>
                    Tên dự án & KCN {sortField === 'projectName' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th>Phân loại</th>
                  <th className="align-right sortable-th" onClick={() => handleSort('estimatedBudget')}>
                    Kế hoạch vốn {sortField === 'estimatedBudget' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th className="align-right sortable-th" onClick={() => handleSort('actualCost')}>
                    Đã giải ngân {sortField === 'actualCost' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th className="align-right">Số vốn còn lại</th>
                  <th className="sortable-th" style={{ width: '13rem' }} onClick={() => handleSort('rate')}>
                    Tỷ lệ giải ngân {sortField === 'rate' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('completionDate')}>
                    Hạn hoàn thành {sortField === 'completionDate' && <span className="sort-indicator">{sortAsc ? '▲' : '▼'}</span>}
                  </th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((p) => {
                  const rate = p.estimatedBudget > 0 ? (p.actualCost / p.estimatedBudget) * 100 : 0
                  const isAttention = (p.status === 'IN_PROGRESS' && rate < 50) || (p.completionDate && new Date(p.completionDate).getTime() < Date.now() && p.status !== 'COMPLETED')
                  const fillClass = p.status === 'COMPLETED' ? 'project-progress-fill-positive' : rate < 50 ? 'project-progress-fill-warning' : 'project-progress-fill-info'

                  return (
                    <tr key={p.id} style={isAttention ? { background: 'oklch(94% 0.04 85 / 0.18)' } : undefined}>
                      <td className="cell-code" style={{ fontWeight: 700 }}>{p.projectCode}</td>
                      <td>
                        <span className="cell-strong">{p.projectName}</span>
                        <span className="cell-subtle">{p.parkName} · {p.currentMilestone}</span>
                      </td>
                      <td><Badge tone="neutral">{projectTypeLabel(p.projectType)}</Badge></td>
                      <td className="align-right cell-strong">{formatCurrency(p.estimatedBudget)}</td>
                      <td className="align-right cell-positive" style={{ fontWeight: 700 }}>{formatCurrency(p.actualCost)}</td>
                      <td className="align-right">{formatCurrency((p.estimatedBudget - p.actualCost))}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div className="project-progress-track" style={{ flex: 1, margin: 0, height: '0.45rem' }}>
                            <div className={`project-progress-fill ${fillClass}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, minWidth: '2.8rem', textAlign: 'right', color: rate < 50 ? 'var(--color-warning)' : 'var(--color-positive)' }}>
                            {rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>{shortDate(p.completionDate)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <Badge tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</Badge>
                          {isAttention && (
                            <Badge tone="warning"><Icon name="alert" size={11} /> Cần chú ý</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="table-summary-row">
                  <td colSpan={3} style={{ fontWeight: 800 }}>TỔNG CỘNG ({sortedProjects.length} DỰ ÁN)</td>
                  <td className="align-right" style={{ fontWeight: 800 }}>{formatCurrency(totals.planned)}</td>
                  <td className="align-right cell-positive" style={{ fontWeight: 800 }}>{formatCurrency(totals.disbursed)}</td>
                  <td className="align-right" style={{ fontWeight: 800 }}>{formatCurrency(totals.remaining)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="project-progress-track" style={{ flex: 1, margin: 0, height: '0.5rem' }}>
                        <div className="project-progress-fill project-progress-fill-info" style={{ width: `${Math.min(totals.rate, 100)}%` }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 800 }}>
                        {totals.rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                    Bình quân giải ngân: <strong>{totals.rate.toFixed(1)}%</strong>
                  </td>
                </tr>
              </tfoot>
            </DataTable>
          ) : (
            <EmptyBlock label="Không tìm thấy dự án phù hợp với từ khóa" />
          )}
        </>
      )}

      {mode === 'leases' && (
        <>
          {loading ? (
            <LoadingBlock />
          ) : leaseRows.length ? (
            <DataTable minWidth="1080px">
              <thead>
                <tr>
                  <th>Doanh nghiệp</th>
                  <th>KCN / vị trí</th>
                  <th>Diện tích</th>
                  <th>Đất nguyên thổ</th>
                  <th>Kết cấu hạ tầng</th>
                  <th>Dịch vụ hạ tầng</th>
                  <th className="align-right">Tổng nguồn</th>
                </tr>
              </thead>
              <tbody>
                {leaseRows.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-strong">{row.enterpriseName}</td>
                    <td>
                      <span className="cell-code">{row.parkCode}</span>
                      <span className="cell-subtle">{row.lotLocation}</span>
                    </td>
                    <td>{new Intl.NumberFormat('vi-VN').format(Number(row.landAreaM2))} m²</td>
                    <td>{formatCurrency(row.amounts.rawLandLease)}</td>
                    <td>{formatCurrency(row.amounts.infrastructureAssetLease)}</td>
                    <td>{formatCurrency(row.amounts.infrastructureServiceLease)}</td>
                    <td className="align-right cell-strong">{formatCurrency(row.sourceTotalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Chưa có dữ liệu thuê trong năm này" />
          )}
          {hasMoreRows && (
            <p className="panel-note">
              Biểu đồ và sổ chi tiết đang hiển thị {leaseRows.length} bản ghi theo giới hạn truy vấn hiện tại.
            </p>
          )}
        </>
      )}

      {mode === 'receivables' && (
        <>
          {loading ? (
            <LoadingBlock />
          ) : receivableRows.length ? (
            <DataTable minWidth="1060px">
              <thead>
                <tr>
                  <th>Doanh nghiệp</th>
                  <th>Hóa đơn</th>
                  <th>Danh mục</th>
                  <th>Hạn thanh toán</th>
                  <th className="align-right">Phải thu</th>
                  <th className="align-right">Đã thu</th>
                  <th className="align-right">Còn nợ</th>
                </tr>
              </thead>
              <tbody>
                {receivableRows.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-strong">{row.enterpriseName}</td>
                    <td>
                      <span className="cell-code">{row.invoiceNumber}</span>
                      <span className="cell-subtle">Phát hành {shortDate(row.issuedOn)}</span>
                    </td>
                    <td>{displayCategory(row.categoryCode)}</td>
                    <td>{shortDate(row.dueOn)}</td>
                    <td className="align-right">{formatCurrency(row.amountDue)}</td>
                    <td className="align-right cell-positive">{hasPaymentData ? formatCurrency(row.amountPaid) : 'Chưa có'}</td>
                    <td className="align-right cell-negative cell-strong">{formatCurrency(row.amountOutstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Chưa có dòng công nợ hợp lệ" />
          )}
        </>
      )}
    </section>
    )
}

export function FinancePage({ user, timeFilter, initialPark, initialTab, realtimeSignal }: { user: User; timeFilter: GlobalTimeFilter; initialPark?: string; initialTab?: 'projects' | 'leases' | 'receivables'; realtimeSignal?: { scopes: RefreshScope[]; tick: number } }) {
    const [activeTab, setActiveTab] = useState<'projects' | 'leases' | 'receivables'>(initialTab ?? 'leases');
    const [parkFilter, setParkFilter] = useState(initialPark ?? '');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [attentionOnly, setAttentionOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [receivablesReady, setReceivablesReady] = useState(false);
    useEffect(() => {
    if (initialPark !== undefined) setParkFilter(initialPark || '')
    }, [initialPark])
    useEffect(() => {
    if (initialTab !== undefined) setActiveTab(initialTab)
    }, [initialTab])
    const summaryQuery = useApiData<Summary>(`/reports/summary?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}${parkFilter ? `&parkCode=${parkFilter}` : ''}`, user);
    const leaseQuery = useApiData<Page<LeaseRow>>(`/reports/lease-annual?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}&limit=100${parkFilter ? `&parkCode=${encodeURIComponent(parkFilter)}` : ''}`, user);
    const receivableQuery = useApiData<Page<ReceivableRow>>(receivablesReady ? `/reports/receivables?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}&limit=100${parkFilter ? `&parkCode=${encodeURIComponent(parkFilter)}` : ''}` : null, user);
    const projectsQuery = useApiData<InfrastructureProject[]>(`/infrastructure/projects?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}`, user);
    const parksQuery = useApiData<EnterprisePark[]>(`/enterprises/parks?year=${timeFilter.year}`, user);
      useEffect(() => {
        if (!realtimeSignal?.tick) return
        const s = realtimeSignal?.scopes || []
        if (s.includes('ALL' as any) || s.includes('FINANCE' as any)) {
          summaryQuery.refresh()
          leaseQuery.refresh()
          if (receivableQuery) receivableQuery.refresh()
          projectsQuery.refresh()
        }
      }, [realtimeSignal?.tick])
    useEffect(() => {
    const timer = window.setTimeout(() => setReceivablesReady(true), 220)
    return () => window.clearTimeout(timer)
    }, [])
    const allProjects = projectsQuery.data ?? [];
    const leaseRows = leaseQuery.data?.data ?? [];
    const receivableRows = receivableQuery.data?.data ?? [];
    const hasPaymentData = summaryQuery.data?.dataStatus.actualPaymentsImported ?? false;
    const financeError = summaryQuery.error ?? leaseQuery.error ?? receivableQuery.error ?? projectsQuery.error;
    const financeLoading = summaryQuery.loading || leaseQuery.loading || projectsQuery.loading;
    const refreshAll = () => {
            summaryQuery.refresh()
            leaseQuery.refresh()
            receivableQuery.refresh()
            projectsQuery.refresh()
          };
    const filteredProjects = useMemo(() => {
            return allProjects.filter((p) => {
              if (parkFilter && p.parkCode !== parkFilter) return false
              if (typeFilter && p.projectType !== typeFilter) return false
              if (statusFilter && p.status !== statusFilter) return false
              const rate = p.estimatedBudget > 0 ? (p.actualCost / p.estimatedBudget) * 100 : 0
              const isAttention = (p.status === 'IN_PROGRESS' && rate < 50) || (p.completionDate && new Date(p.completionDate).getTime() < Date.now() && p.status !== 'COMPLETED')
              if (attentionOnly && !isAttention) return false
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const match = p.projectCode.toLowerCase().includes(q) || p.projectName.toLowerCase().includes(q) || p.parkName.toLowerCase().includes(q)
                if (!match) return false
              }
              return true
            })
          }, [allProjects, parkFilter, typeFilter, statusFilter, attentionOnly, searchQuery]);
    const totalPlanned = useMemo(() => allProjects.reduce((s, p) => s + p.estimatedBudget, 0), [allProjects]);
    const totalAllocated = totalPlanned;
    const totalDisbursed = useMemo(() => allProjects.reduce((s, p) => s + p.actualCost, 0), [allProjects]);
    const remainingBudget = (totalPlanned - totalDisbursed);
    const disbursementRate = totalPlanned > 0 ? (totalDisbursed / totalPlanned) * 100 : 0;
    const inProgressCount = useMemo(() => allProjects.filter((p) => p.status === 'IN_PROGRESS').length, [allProjects]);
    const attentionCount = useMemo(() => {
            return allProjects.filter((p) => {
              const rate = p.estimatedBudget > 0 ? (p.actualCost / p.estimatedBudget) * 100 : 0
              return (p.status === 'IN_PROGRESS' && rate < 50) || (p.completionDate && new Date(p.completionDate).getTime() < Date.now() && p.status !== 'COMPLETED')
            }).length
          }, [allProjects]);
    const parkOptions = useMemo(() => [
            { value: '', label: 'Tất cả KCN (3)' },
            ...(parksQuery.data?.map((p) => ({ value: p.code, label: p.name })) ?? [
              { value: 'KCN_AN_PHU', label: 'KCN An Phú' },
              { value: 'KCN_HOA_HIEP_1', label: 'KCN Hoà Hiệp 1' },
              { value: 'KCN_ONG_BAC_SONG_CAU_KV1', label: 'KCN Đông Bắc Sông Cầu' },
            ]),
          ], [parksQuery.data]);
    const typeOptions = useMemo(() => [
            { value: '', label: 'Tất cả loại công trình' },
            { value: 'UPGRADE', label: 'Nâng cấp mở rộng' },
            { value: 'NEW_BUILD', label: 'Xây dựng mới' },
            { value: 'REPAIR', label: 'Sửa chữa / Cải tạo' },
            { value: 'EMERGENCY', label: 'Xử lý khẩn cấp' },
          ], []);
    const statusOptions = useMemo(() => [
            { value: '', label: 'Tất cả trạng thái' },
            { value: 'IN_PROGRESS', label: 'Đang thi công' },
            { value: 'COMPLETED', label: 'Đã hoàn thành' },
            { value: 'PLANNING', label: 'Lập kế hoạch' },
            { value: 'ON_HOLD', label: 'Tạm dừng' },
          ], []);
    const isFilterActive = Boolean(parkFilter || typeFilter || statusFilter || attentionOnly || searchQuery);
    const resetFilters = () => {
            setParkFilter('')
            setTypeFilter('')
            setStatusFilter('')
            setAttentionOnly(false)
            setSearchQuery('')
          };
    const agingRows = useMemo<FinanceAgingRow[]>(() => {
            const initial: Record<AgingKey, FinanceAgingRow> = {
              current: { key: 'current', label: 'Chưa đến hạn', value: 0, count: 0, color: 'var(--color-positive)' },
              short: { key: 'short', label: '1–30 ngày', value: 0, count: 0, color: 'var(--color-warning)' },
              medium: { key: 'medium', label: '31–90 ngày', value: 0, count: 0, color: '#a87563' },
              long: { key: 'long', label: 'Trên 90 ngày', value: 0, count: 0, color: 'var(--color-negative)' },
              unknown: { key: 'unknown', label: 'Chưa xác định', value: 0, count: 0, color: 'var(--color-line-strong)' },
            }
            const grouped = receivableRows.reduce((result, row) => {
              const key = agingKey(row.dueOn)
              const bucket = result[key]
              return { ...result, [key]: { ...bucket, value: bucket.value + numberValue(row.amountOutstanding), count: bucket.count + 1 } }
            }, initial)
            return Object.values(grouped).filter((row) => row.count > 0)
          }, [receivableRows]);
    return (
    <div className="content-stack finance-page">
      <div className="finance-page-head">
        <PageTitle
          title={`Báo cáo tài chính & Kế hoạch vốn ${timeFilter.year}`}
          detail={`Kỳ báo cáo: ${timeFilter.displayRange} · Phân bổ nguồn vốn, tiến độ giải ngân dự án và đối chiếu khoản thu`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <Badge tone="info">{timeFilter.displayRange}</Badge>
              <button type="button" className="glass-button" onClick={refreshAll}>
                <Icon name="refresh" size={16} /> Làm mới
              </button>
            </div>
          }
        />
        <div className="finance-data-status">
          <span className="finance-status-pulse" />
          {hasPaymentData ? 'Đã kết nối dữ liệu thanh toán' : 'Đang theo dõi kế hoạch vốn & nghĩa vụ theo nguồn'}
          <span className="finance-status-separator">·</span>
          {allProjects.length} danh mục dự án
          <span className="finance-status-separator">·</span>
          {leaseRows.length} bản ghi khoản thuê
        </div>
      </div>

      {financeError && <ErrorBlock message={financeError} />}

      {financeLoading && !allProjects.length && !summaryQuery.data ? (
        <LoadingBlock label="Đang dựng dashboard tài chính và tiến độ giải ngân..." />
      ) : (
        <>
          {/* Top KPI row: 7 cards */}
          <FinanceKPICards
            totalPlanned={totalPlanned}
            totalAllocated={totalAllocated}
            totalDisbursed={totalDisbursed}
            remainingBudget={remainingBudget}
            disbursementRate={disbursementRate}
            inProgressCount={inProgressCount}
            attentionCount={attentionCount}
            totalProjectsCount={allProjects.length}
          />

          {/* Filter Toolbar */}
          <section className="glass-panel finance-filter-bar">
            <div className="finance-filter-group">
              <GlassSelect
                value={parkFilter}
                onChange={setParkFilter}
                label="Khu công nghiệp"
                icon="land"
                ariaLabel="Lọc theo KCN"
                options={parkOptions}
              />
              <GlassSelect
                value={typeFilter}
                onChange={setTypeFilter}
                label="Loại công trình"
                icon="building"
                ariaLabel="Lọc theo loại công trình"
                options={typeOptions}
              />
              <GlassSelect
                value={statusFilter}
                onChange={setStatusFilter}
                label="Trạng thái"
                icon="activity"
                ariaLabel="Lọc theo trạng thái"
                options={statusOptions}
              />
              <button
                type="button"
                className={`finance-filter-toggle ${attentionOnly ? 'finance-filter-toggle-active' : ''}`}
                onClick={() => setAttentionOnly((prev) => !prev)}
                title="Chỉ xem dự án chậm giải ngân hoặc cận hạn"
              >
                <Icon name="alert" size={15} />
                <span>Cần chú ý {attentionCount > 0 ? `(${attentionCount})` : ''}</span>
              </button>
            </div>

            <div className="finance-filter-group">
              <div className="finance-search-box">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  placeholder="Tìm mã DA, tên dự án, KCN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)' }}>
                    <Icon name="close" size={13} />
                  </button>
                )}
              </div>
              {isFilterActive && (
                <button type="button" className="finance-filter-reset" onClick={resetFilters}>
                  <Icon name="refresh" size={13} /> Đặt lại
                </button>
              )}
              <span className="finance-filter-meta">
                {filteredProjects.length}/{allProjects.length} dự án
              </span>
            </div>
          </section>

          {/* Attention / Risk Alert Card */}
          <DisbursementAlertCard projects={allProjects} />

          {/* Visual Charts Grid */}
          <section className="finance-dashboard-grid">
            {/* Left: Project Disbursement Bars */}
            <article className="glass-panel panel finance-chart-card">
              <PanelHeading
                title="Tiến độ & Tỷ lệ giải ngân theo dự án"
                meta={<Badge tone="neutral">{filteredProjects.length} dự án</Badge>}
              />
              <ProjectDisbursementBars projects={filteredProjects} />
            </article>

            {/* Right: KCN Comparison & Project Type Distribution */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <article className="glass-panel panel finance-chart-card">
                <PanelHeading
                  title="So sánh Kế hoạch vs Giải ngân theo KCN"
                  meta={<span className="panel-count">3 Khu công nghiệp</span>}
                />
                <ParkCapitalComparisonChart projects={allProjects} />
              </article>

              <article className="glass-panel panel finance-chart-card">
                <PanelHeading
                  title="Cơ cấu phân bổ vốn theo loại công trình"
                  meta={<span className="panel-count">Tỷ trọng vốn</span>}
                />
                <ProjectTypeDonutChart projects={allProjects} />
              </article>
            </div>
          </section>

          {/* Secondary Grid: Multi-year Lease Trends & Receivables Aging */}
          <section className="finance-chart-grid finance-chart-grid-secondary">
            <RevenueTrendCard year={timeFilter.year} summary={summaryQuery.data} />
            <article className="glass-panel panel finance-chart-panel">
              <PanelHeading title="Tuổi công nợ doanh nghiệp" meta={<Badge tone="negative">Theo hạn hóa đơn</Badge>} />
              {receivableQuery.loading ? (
                <LoadingBlock label="Đang phân tích tuổi công nợ" />
              ) : receivableRows.length ? (
                <FinanceAgingChart rows={agingRows} />
              ) : (
                <EmptyBlock label="Chưa có dữ liệu hóa đơn để phân tích tuổi nợ" />
              )}
            </article>
          </section>

          {/* Tabbed Detailed Ledger: Projects / Leases / Receivables */}
          <FinanceProjectLedger
            projects={filteredProjects}
            leaseRows={leaseRows}
            receivableRows={receivableRows}
            mode={activeTab}
            onModeChange={setActiveTab}
            loading={financeLoading}
            hasPaymentData={hasPaymentData}
            hasMoreRows={Boolean(leaseQuery.data?.meta.hasNext || receivableQuery.data?.meta.hasNext)}
            summary={summaryQuery.data}
          />
        </>
      )}
    </div>
    )
}
