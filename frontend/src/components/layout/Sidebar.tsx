import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Activity, ArrowRight, Building2, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, CircleAlert, CircleDollarSign, Database, Droplets, ExternalLink, Eye, EyeOff, Flame, Gauge, LandPlot, LayoutDashboard, LockKeyhole, LogOut, Menu, Network, Pencil, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, TrendingUp, Upload, User as UserIcon, UsersRound, Wrench, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { AggregateReportDialog } from "../../reporting/AggregateReportDialog";
import { type GlobalTimeFilter, type PeriodType, PERIOD_TYPE_LABELS, getAvailableYears, getAvailablePeriodTypes, getPeriodOptions, handleYearChange, handlePeriodTypeChange, handlePeriodSelect, loadSavedTimeFilter, saveTimeFilter, getTodayVietnam } from "../../utils/timeFilter";
import { unwrapApiData } from "../../utils/apiResponse";
import { buildRecentActivities, type RecentActivityItem } from "../../utils/recentActivities";
import { useRealtimeEvents } from "../../realtime/useRealtimeEvents";
import { RealtimeNotificationPill } from "../../components/RealtimeNotificationPill";
import type { RefreshScope, NotificationItem } from "../../realtime/types";
import { getNotificationClickAction } from "../../realtime/eventHelpers";
import { RoleCode, User, PageMeta, ApiEnvelope, Page, Summary, LeaseRow, ReceivableRow, Employee, WorkforceUnit, WorkforcePark, Observation, PremierMetricStatus, PremierMetric, PremierStation, PremierSnapshot, PremierPublicData, SyncRun, ImportBatch, EnterprisePark, EnterpriseRow, View, IconName, GlassSelectOption, LimitRuleInfo, NavItem, FinanceBarRow, AgingKey, FinanceAgingRow, InfrastructureProject, CoordinationTask, AssetCategory, InfrastructureAsset, MaintenanceIncident, MaintenanceOrder, FieldReport, TrendPoint, WasteRecord, PdfDocument, API_ROOT, YEARS, CATEGORY_LABELS, CENTER_DUTIES, ICONS, NAV_ITEMS, FINANCE_BAR_COLORS, fetchApi, useApiData, formatCurrency, formatDate, shortDate, displayCategory, monitoringStatusLabel, monitoringStatusTone, formatMonitoringValue, parseLimitInfo, numberValue, compactCurrency, agingKey, projectStatusLabel, projectStatusTone, projectTypeLabel, taskCategoryLabel, taskStatusLabel, taskStatusTone, assetStatusLabel, assetStatusTone, formatSpecs, fieldReportCategoryLabel, fieldReportCategoryTone, fieldReportSeverityLabel, fieldReportSeverityTone, fieldReportStatusLabel, fieldReportStatusTone, incidentSeverityLabel, incidentSeverityTone, incidentStatusLabel, incidentStatusTone, orderStatusLabel, orderStatusTone, orderTypeLabel } from "../../utils/shared";
import { Icon } from "../ui/Icon";
import { GlassSelect } from "../ui/GlassSelect";
import { Badge } from "../ui/Badge";
import { LoadingBlock } from "../ui/LoadingBlock";
import { EmptyBlock } from "../ui/EmptyBlock";
import { ErrorBlock } from "../ui/ErrorBlock";
import { PageTitle } from "../ui/PageTitle";
import { PanelHeading } from "../ui/PanelHeading";
import { MetricCard } from "../ui/MetricCard";
import { DataTable } from "../ui/DataTable";

export function Sidebar({ activeView, onChange, user, expanded, onToggle }: { activeView: View; onChange: (view: View) => void; user: User; expanded: boolean; onToggle: () => void }) {
    const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.roleCode === 'DATA_ADMIN');
    return (
    <aside className={`sidebar-rail ${expanded ? 'sidebar-rail-expanded' : ''}`} aria-label="Điều hướng chính">
      <div className="sidebar-top">
        <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={expanded ? 'Thu gọn thanh điều hướng' : 'Mở rộng thanh điều hướng'} aria-expanded={expanded} title={expanded ? 'Thu gọn' : 'Mở rộng'}>
          <Icon name={expanded ? 'close' : 'menu'} size={18} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <button type="button" key={item.id} className={`sidebar-item ${activeView === item.id ? 'sidebar-item-active' : ''}`} onClick={() => onChange(item.id)} aria-label={item.label} title={expanded ? undefined : item.label}>
            <span className="sidebar-item-icon"><Icon name={item.icon} size={19} /></span>
            {expanded && <span>{item.label}</span>}
            {activeView === item.id && <span className="sidebar-active-mark" aria-hidden="true" />}
          </button>
        ))}
      </nav>
    </aside>
    )
}
