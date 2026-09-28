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

export function EnterprisesPage({ user, timeFilter, initialPark }: { user: User; timeFilter: GlobalTimeFilter; initialPark?: string }) {
    const [parkCode, setParkCode] = useState(initialPark ?? '');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm.trim());
      }, 250);
      return () => clearTimeout(timer);
    }, [searchTerm]);

    const parksQuery = useApiData<EnterprisePark[]>(`/enterprises/parks?year=${timeFilter.year}`, user);
    const selectedPark = parksQuery.data?.find((park) => park.code === parkCode);

    const queryUrl = useMemo(() => {
      if (!parkCode) return null;
      const params = new URLSearchParams({
        parkCode,
        year: String(timeFilter.year),
        limit: '100',
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      return `/enterprises?${params.toString()}`;
    }, [parkCode, timeFilter.year, debouncedSearch]);

    const enterprisesQuery = useApiData<Page<EnterpriseRow>>(queryUrl, user);
    const enterprises = enterprisesQuery.data?.data ?? [];

    useEffect(() => {
      if (initialPark) {
        setParkCode(initialPark);
      } else if (!parkCode && parksQuery.data?.length) {
        setParkCode(parksQuery.data[0].code);
      }
    }, [initialPark, parkCode, parksQuery.data]);

    return (
    <div className="content-stack">
      <PageTitle
        title="Doanh nghiệp"
        detail={selectedPark ? `${selectedPark.name} · ${enterprises.length} doanh nghiệp · ${timeFilter.periodLabel}` : 'Chọn KCN để xem danh sách'}
        action={(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <GlassSelect
              value={parkCode}
              onChange={(newPark) => {
                setParkCode(newPark);
                setSearchTerm('');
              }}
              label="KCN"
              icon="land"
              ariaLabel="Chọn KCN"
              placeholder="Đang tải KCN"
              loading={parksQuery.loading && !parksQuery.data}
              options={parksQuery.data?.map((park) => ({ value: park.code, label: `${park.name} · ${park.enterpriseCount}` })) ?? []}
            />
          </div>
        )}
      />
      {parksQuery.error && <ErrorBlock message={parksQuery.error} />}
      {enterprisesQuery.error && <ErrorBlock message={enterprisesQuery.error} />}
      <section className="glass-panel panel table-panel">
        <PanelHeading
          title={selectedPark ? `Doanh nghiệp tại ${selectedPark.name}` : 'Danh sách doanh nghiệp'}
          meta={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {enterprisesQuery.loading && <span style={{ fontSize: '0.75rem', color: 'var(--color-subtle)' }}>Đang tìm...</span>}
              <span className="panel-count">
                {debouncedSearch ? `${enterprises.length} kết quả` : `${enterprises.length} hồ sơ`}
              </span>
            </div>
          }
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="finance-search-box" style={{ maxWidth: '24rem', flex: '1 1 18rem' }}>
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Tìm theo tên doanh nghiệp, MST, mã hoặc số lô..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Tìm kiếm doanh nghiệp"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Xóa tìm kiếm"
                title="Xóa tìm kiếm"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </div>

        {parksQuery.loading && !parksQuery.data ? (
          <LoadingBlock label="Đang tải danh sách KCN" />
        ) : enterprisesQuery.loading && !enterprises.length ? (
          <LoadingBlock label="Đang tìm kiếm doanh nghiệp..." />
        ) : enterprisesQuery.error ? null : enterprises.length ? (
          <DataTable minWidth="980px">
            <thead>
              <tr>
                <th>Doanh nghiệp</th>
                <th>Mã số thuế</th>
                <th>Lô thuê</th>
                <th>Diện tích</th>
                <th className="align-right">Tổng thuê năm</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {enterprises.map((enterprise) => (
                <tr key={enterprise.id}>
                  <td className="cell-strong">
                    <span>{enterprise.legalName}</span>
                    <span className="cell-subtle">{enterprise.parkCode} · {enterprise.parkName}</span>
                  </td>
                  <td>{enterprise.taxCode ?? 'Chưa cập nhật'}</td>
                  <td>{enterprise.lotLocation}</td>
                  <td>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(enterprise.landAreaM2))} m²</td>
                  <td className="align-right cell-strong">{formatCurrency(enterprise.sourceTotalAmount)}</td>
                  <td>
                    <Badge tone={enterprise.isActive ? 'positive' : 'neutral'}>
                      {enterprise.leaseStatus ?? (enterprise.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyBlock
            label={
              debouncedSearch
                ? `Không tìm thấy doanh nghiệp phù hợp với từ khóa "${debouncedSearch}"`
                : selectedPark
                ? `Chưa có doanh nghiệp trong ${selectedPark.name} năm ${timeFilter.year}`
                : 'Chưa chọn KCN'
            }
          />
        )}
      </section>
    </div>
    )
}
