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

export function InfrastructurePage({
      user,
      timeFilter,
      initialPark,
      initialTab,
      initialTargetId,
      realtimeSignal,
      deletedRecord,
    }: {
          user: User
          timeFilter: GlobalTimeFilter
          initialPark?: string
          initialTab?: 'assets' | 'categories' | 'projects'
          initialTargetId?: string
          realtimeSignal?: { scopes: RefreshScope[]; tick: number }
          deletedRecord?: { entityType: string; entityId: string; tick: number } | null
        }) {
    const isAdmin = user.roleCode === 'DATA_ADMIN';
    const [activeTab, setActiveTab] = useState<'assets' | 'categories' | 'projects'>(initialTab ?? 'assets');
    const [parkFilter, setParkFilter] = useState(initialPark ?? '');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [search, setSearch] = useState('');
    useEffect(() => {
    if (initialPark !== undefined) setParkFilter(initialPark)
    }, [initialPark])
    useEffect(() => {
    if (initialTab !== undefined) setActiveTab(initialTab)
    }, [initialTab])
    const parksQuery = useApiData<EnterprisePark[]>(`/enterprises/parks?year=${timeFilter.year}`, user);
    const categoriesQuery = useApiData<AssetCategory[]>('/infrastructure/categories', user);
    const assetParams = new URLSearchParams();
    if (parkFilter) assetParams.append('parkCode', parkFilter)
    if (categoryFilter) assetParams.append('categoryCode', categoryFilter)
    const assetQuery = useApiData<InfrastructureAsset[]>(
            `/infrastructure/assets${assetParams.toString() ? `?${assetParams.toString()}` : ''}`,
            user,
          );
    const projectParams = new URLSearchParams();
    if (parkFilter) projectParams.append('parkCode', parkFilter)
    if (timeFilter.fromDate) projectParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) projectParams.append('toDate', timeFilter.toDate)
    const projectQuery = useApiData<InfrastructureProject[]>(
            `/infrastructure/projects${projectParams.toString() ? `?${projectParams.toString()}` : ''}`,
            user,
          );
    useEffect(() => {
    if (!realtimeSignal || realtimeSignal.tick === 0) return
    const scopes = realtimeSignal.scopes
    if (scopes.includes('infrastructure_assets')) {
      assetQuery.refresh()
    }
    if (scopes.includes('infrastructure_projects')) {
      projectQuery.refresh()
    }
    }, [realtimeSignal?.tick])
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<InfrastructureAsset | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<InfrastructureAsset | null>(null);
    const [assetForm, setAssetForm] = useState({
            assetCode: '',
            assetName: '',
            categoryCode: '',
            parkCode: '',
            locationDesc: '',
            managingUnit: 'Tổ Quản lý Vận hành Hạ tầng',
            commissioningYear: '' as string | number,
            status: 'OPERATIONAL',
            specs: '',
          });
    const [assetSubmitting, setAssetSubmitting] = useState(false);
    const [assetError, setAssetError] = useState<string | null>(null);
    const [assetDeleteError, setAssetDeleteError] = useState<string | null>(null);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<AssetCategory | null>(null);
    const [categoryForm, setCategoryForm] = useState({
            code: '',
            displayName: '',
            iconName: '',
            description: '',
          });
    const [categorySubmitting, setCategorySubmitting] = useState(false);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);

    function handleOpenAddAsset() {
        setEditingAsset(null)
        setAssetForm({
          assetCode: '',
          assetName: '',
          categoryCode: categoriesQuery.data?.[0]?.code ?? '',
          parkCode: parksQuery.data?.[0]?.code ?? '',
          locationDesc: '',
          managingUnit: 'Tổ Quản lý Vận hành Hạ tầng',
          commissioningYear: new Date().getFullYear(),
          status: 'OPERATIONAL',
          specs: '',
        })
        setAssetError(null)
        setAssetModalOpen(true)
    }

    function handleOpenEditAsset(asset: InfrastructureAsset) {
        setEditingAsset(asset)
        setAssetForm({
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          categoryCode: asset.categoryCode,
          parkCode: asset.parkCode,
          locationDesc: asset.locationDesc,
          managingUnit: asset.managingUnit,
          commissioningYear: asset.commissioningYear ?? '',
          status: asset.status,
          specs: formatSpecs(asset.specs),
        })
        setAssetError(null)
        setAssetModalOpen(true)
    }

    async function handleSaveAsset(e: React.FormEvent) {
        e.preventDefault()
        setAssetSubmitting(true)
        setAssetError(null)
        try {
          if (editingAsset) {
            await fetchApi(`/infrastructure/assets/${editingAsset.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                assetName: assetForm.assetName,
                categoryCode: assetForm.categoryCode,
                parkCode: assetForm.parkCode,
                locationDesc: assetForm.locationDesc,
                managingUnit: assetForm.managingUnit,
                commissioningYear: assetForm.commissioningYear ? Number(assetForm.commissioningYear) : null,
                status: assetForm.status,
                specs: assetForm.specs ? { ghi_chu: assetForm.specs } : {},
              }),
            })
          } else {
            await fetchApi('/infrastructure/assets', {
              method: 'POST',
              body: JSON.stringify({
                assetCode: assetForm.assetCode.trim().toUpperCase(),
                assetName: assetForm.assetName.trim(),
                categoryCode: assetForm.categoryCode,
                parkCode: assetForm.parkCode,
                locationDesc: assetForm.locationDesc.trim(),
                managingUnit: assetForm.managingUnit.trim(),
                commissioningYear: assetForm.commissioningYear ? Number(assetForm.commissioningYear) : null,
                status: assetForm.status,
                specs: assetForm.specs ? { ghi_chu: assetForm.specs } : {},
              }),
            })
          }
          setAssetModalOpen(false)
          assetQuery.refresh()
        } catch (err) {
          setAssetError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu công trình')
        } finally {
          setAssetSubmitting(false)
        }
    }

    async function handleDeleteAssetConfirm() {
        if (!deletingAsset) return
        setAssetSubmitting(true)
        setAssetDeleteError(null)
        try {
          await fetchApi(`/infrastructure/assets/${deletingAsset.id}`, {
            method: 'DELETE',
          })
          setDeletingAsset(null)
          assetQuery.refresh()
        } catch (err) {
          setAssetDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa công trình')
        } finally {
          setAssetSubmitting(false)
        }
    }

    function handleOpenAddCategory() {
        setEditingCategory(null)
        setCategoryForm({ code: '', displayName: '', iconName: '', description: '' })
        setCategoryError(null)
        setCategoryModalOpen(true)
    }

    function handleOpenEditCategory(cat: AssetCategory) {
        setEditingCategory(cat)
        setCategoryForm({
          code: cat.code,
          displayName: cat.displayName,
          iconName: cat.iconName ?? '',
          description: cat.description ?? '',
        })
        setCategoryError(null)
        setCategoryModalOpen(true)
    }

    async function handleSaveCategory(e: React.FormEvent) {
        e.preventDefault()
        setCategorySubmitting(true)
        setCategoryError(null)
        try {
          if (editingCategory) {
            await fetchApi(`/infrastructure/categories/${editingCategory.code}`, {
              method: 'PATCH',
              body: JSON.stringify({
                displayName: categoryForm.displayName,
                iconName: categoryForm.iconName || null,
                description: categoryForm.description || null,
              }),
            })
          } else {
            await fetchApi('/infrastructure/categories', {
              method: 'POST',
              body: JSON.stringify({
                code: categoryForm.code.trim().toUpperCase(),
                displayName: categoryForm.displayName.trim(),
                iconName: categoryForm.iconName.trim() || null,
                description: categoryForm.description.trim() || null,
              }),
            })
          }
          setCategoryModalOpen(false)
          categoriesQuery.refresh()
        } catch (err) {
          setCategoryError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu phân loại')
        } finally {
          setCategorySubmitting(false)
        }
    }

    async function handleDeleteCategoryConfirm() {
        if (!deletingCategory) return
        setCategorySubmitting(true)
        setCategoryDeleteError(null)
        try {
          await fetchApi(`/infrastructure/categories/${deletingCategory.code}`, {
            method: 'DELETE',
          })
          setDeletingCategory(null)
          categoriesQuery.refresh()
        } catch (err) {
          setCategoryDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa phân loại')
        } finally {
          setCategorySubmitting(false)
        }
    }

    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<InfrastructureProject | null>(null);
    const [deletingProject, setDeletingProject] = useState<InfrastructureProject | null>(null);
    const [projectForm, setProjectForm] = useState({
            projectName: '',
            projectCode: '',
            parkCode: '',
            projectType: 'UPGRADE' as 'NEW_BUILD' | 'UPGRADE' | 'REPAIR' | 'EMERGENCY',
            estimatedBudget: '' as string | number,
            actualCost: '' as string | number,
            currentMilestone: '',
            status: 'PLANNING' as 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD',
            startDate: '',
            completionDate: '',
            notes: '',
          });
    const [projectSubmitting, setProjectSubmitting] = useState(false);
    const [projectError, setProjectError] = useState<string | null>(null);
    const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
    useEffect(() => {
    if (!deletedRecord) return
    if (deletedRecord.entityType === 'infrastructure_asset' && editingAsset?.id === deletedRecord.entityId) {
      setEditingAsset(null)
      setAssetModalOpen(false)
    }
    if (deletedRecord.entityType === 'infrastructure_project' && editingProject?.id === deletedRecord.entityId) {
      setEditingProject(null)
      setProjectModalOpen(false)
    }
    }, [deletedRecord])
    useEffect(() => {
    if (!initialTargetId) return
    if (activeTab === 'assets' && assetQuery.data && assetQuery.data.length > 0) {
      const match = assetQuery.data.find((a) => a.id === initialTargetId)
      if (match) {
        setEditingAsset(match)
        setAssetModalOpen(true)
      }
    } else if (activeTab === 'projects' && projectQuery.data && projectQuery.data.length > 0) {
      const match = projectQuery.data.find((p) => p.id === initialTargetId)
      if (match) {
        setEditingProject(match)
        setProjectModalOpen(true)
      }
    }
    }, [initialTargetId, activeTab, assetQuery.data, projectQuery.data])

    function handleOpenAddProject() {
        setEditingProject(null)
        setProjectForm({
          projectName: '',
          projectCode: '',
          parkCode: parksQuery.data?.[0]?.code ?? '',
          projectType: 'UPGRADE',
          estimatedBudget: '',
          actualCost: 0,
          currentMilestone: 'Chuẩn bị hồ sơ dự án',
          status: 'PLANNING',
          startDate: new Date().toISOString().split('T')[0] ?? '',
          completionDate: '',
          notes: '',
        })
        setProjectError(null)
        setProjectModalOpen(true)
    }

    function handleOpenEditProject(proj: InfrastructureProject) {
        setEditingProject(proj)
        setProjectForm({
          projectName: proj.projectName,
          projectCode: proj.projectCode,
          parkCode: proj.parkCode,
          projectType: proj.projectType,
          estimatedBudget: proj.estimatedBudget,
          actualCost: proj.actualCost,
          currentMilestone: proj.currentMilestone,
          status: proj.status,
          startDate: proj.startDate ? proj.startDate.split('T')[0] ?? '' : '',
          completionDate: proj.completionDate ? proj.completionDate.split('T')[0] ?? '' : '',
          notes: proj.notes ?? '',
        })
        setProjectError(null)
        setProjectModalOpen(true)
    }

    async function handleSaveProject(e: React.FormEvent) {
        e.preventDefault()
        setProjectSubmitting(true)
        setProjectError(null)
        try {
          const payload = {
            projectName: projectForm.projectName.trim(),
            projectCode: projectForm.projectCode.trim() ? projectForm.projectCode.trim().toUpperCase() : undefined,
            parkCode: projectForm.parkCode,
            projectType: projectForm.projectType,
            estimatedBudget: Number(projectForm.estimatedBudget),
            actualCost: projectForm.actualCost ? Number(projectForm.actualCost) : 0,
            currentMilestone: projectForm.currentMilestone.trim(),
            status: projectForm.status,
            startDate: projectForm.startDate ? projectForm.startDate : null,
            completionDate: projectForm.completionDate ? projectForm.completionDate : null,
            notes: projectForm.notes.trim() ? projectForm.notes.trim() : null,
          }

          if (editingProject) {
            await fetchApi(`/infrastructure/projects/${editingProject.id}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            })
          } else {
            await fetchApi('/infrastructure/projects', {
              method: 'POST',
              body: JSON.stringify(payload),
            })
          }
          setProjectModalOpen(false)
          projectQuery.refresh()
        } catch (err) {
          setProjectError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu dự án')
        } finally {
          setProjectSubmitting(false)
        }
    }

    async function handleDeleteProjectConfirm() {
        if (!deletingProject) return
        setProjectSubmitting(true)
        setProjectDeleteError(null)
        try {
          await fetchApi(`/infrastructure/projects/${deletingProject.id}`, {
            method: 'DELETE',
          })
          setDeletingProject(null)
          projectQuery.refresh()
        } catch (err) {
          setProjectDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa dự án')
        } finally {
          setProjectSubmitting(false)
        }
    }

    const assets = (assetQuery.data ?? []).filter((item) => {
            if (!search.trim()) return true
            const term = search.toLowerCase()
            return (
              item.assetName.toLowerCase().includes(term) ||
              item.assetCode.toLowerCase().includes(term) ||
              item.locationDesc.toLowerCase().includes(term)
            )
          });
    const projects = (projectQuery.data ?? []).filter((item) => {
            if (!search.trim()) return true
            const term = search.toLowerCase()
            return (
              item.projectName.toLowerCase().includes(term) ||
              item.projectCode.toLowerCase().includes(term) ||
              item.currentMilestone.toLowerCase().includes(term) ||
              item.parkName.toLowerCase().includes(term)
            )
          });
    const totalAssets = assetQuery.data?.length ?? 0;
    const operationalAssets = assetQuery.data?.filter((a) => a.status === 'OPERATIONAL').length ?? 0;
    const degradedAssets = assetQuery.data?.filter((a) => a.status === 'DEGRADED' || a.status === 'UNDER_MAINTENANCE').length ?? 0;
    const activeProjects = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    return (
    <div className="content-stack">
      <PageTitle
        title="Kết cấu Hạ tầng & Công trình"
        detail={`Quản lý tài sản công trình, mạng lưới kỹ thuật và dự án phát triển hạ tầng KCN · ${timeFilter.periodLabel}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <div className="segmented-control" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'assets'}
                className={activeTab === 'assets' ? 'segment-active' : ''}
                onClick={() => setActiveTab('assets')}
              >
                <Icon name="building" size={16} /> Công trình ({totalAssets})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'categories'}
                className={activeTab === 'categories' ? 'segment-active' : ''}
                onClick={() => setActiveTab('categories')}
              >
                <Icon name="network" size={16} /> Phân loại ({categoriesQuery.data?.length ?? 0})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'projects'}
                className={activeTab === 'projects' ? 'segment-active' : ''}
                onClick={() => setActiveTab('projects')}
              >
                <Icon name="trendingUp" size={16} /> Dự án nâng cấp ({projects.length})
              </button>
            </div>
            {isAdmin && activeTab === 'assets' && (
              <button
                type="button"
                className="glass-button glass-button-primary"
                onClick={handleOpenAddAsset}
              >
                <Icon name="plus" size={15} /> Thêm công trình
              </button>
            )}
            {isAdmin && activeTab === 'categories' && (
              <button
                type="button"
                className="glass-button glass-button-primary"
                onClick={handleOpenAddCategory}
              >
                <Icon name="plus" size={15} /> Thêm phân loại
              </button>
            )}
            {isAdmin && activeTab === 'projects' && (
              <button
                type="button"
                className="glass-button glass-button-primary"
                onClick={handleOpenAddProject}
              >
                <Icon name="plus" size={15} /> Thêm dự án
              </button>
            )}
          </div>
        }
      />

      <section className="metrics-grid-4">
        <MetricCard
          icon="building"
          label="Tổng công trình quản lý"
          value={String(totalAssets)}
          detail="Mạng lưới KKT & KCN"
          tone="accent"
        />
        <MetricCard
          icon="shield"
          label="Vận hành đạt chuẩn"
          value={String(operationalAssets)}
          detail={`${totalAssets ? Math.round((operationalAssets / totalAssets) * 100) : 0}% công trình ổn định`}
        />
        <MetricCard
          icon="alert"
          label="Xuống cấp / Cần bảo dưỡng"
          value={String(degradedAssets)}
          detail="Cần nạo vét / sửa chữa"
        />
        <MetricCard
          icon="wrench"
          label="Dự án đang thi công"
          value={String(activeProjects)}
          detail="Nâng cấp & sửa chữa lớn"
          tone="accent"
        />
      </section>

      <section className="glass-panel panel distribution-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
              HIỆN TRẠNG VẬN HÀNH TOÀN HỆ THỐNG
            </span>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-ink)', fontWeight: 600 }}>
              {operationalAssets}/{totalAssets} công trình đạt chuẩn vận hành ổn định ({totalAssets ? Math.round((operationalAssets / totalAssets) * 100) : 0}%)
            </h4>
          </div>
          <div className="distribution-legend">
            <span className="distribution-legend-item">
              <i className="distribution-legend-dot" style={{ background: 'var(--color-positive)' }} />
              Đang vận hành ({operationalAssets})
            </span>
            <span className="distribution-legend-item">
              <i className="distribution-legend-dot" style={{ background: 'var(--color-warning)' }} />
              Xuống cấp ({assetQuery.data?.filter((a) => a.status === 'DEGRADED').length ?? 0})
            </span>
            <span className="distribution-legend-item">
              <i className="distribution-legend-dot" style={{ background: 'var(--color-accent-text)' }} />
              Đang bảo trì ({assetQuery.data?.filter((a) => a.status === 'UNDER_MAINTENANCE').length ?? 0})
            </span>
          </div>
        </div>

        <div className="distribution-bar-track">
          <div
            className="distribution-bar-segment"
            style={{
              width: `${totalAssets ? (operationalAssets / totalAssets) * 100 : 0}%`,
              background: 'var(--color-positive)',
            }}
          />
          <div
            className="distribution-bar-segment"
            style={{
              width: `${totalAssets ? ((assetQuery.data?.filter((a) => a.status === 'DEGRADED').length ?? 0) / totalAssets) * 100 : 0}%`,
              background: 'var(--color-warning)',
            }}
          />
          <div
            className="distribution-bar-segment"
            style={{
              width: `${totalAssets ? ((assetQuery.data?.filter((a) => a.status === 'UNDER_MAINTENANCE').length ?? 0) / totalAssets) * 100 : 0}%`,
              background: 'var(--color-accent-text)',
            }}
          />
        </div>

        <div className="distribution-kcn-grid">
          <div className="distribution-kcn-card">
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', display: 'block' }}>KCN An Phú</span>
              <small style={{ color: 'var(--color-ink-muted)', fontSize: '0.72rem' }}>Thoát nước, Nước thải, Chiếu sáng</small>
            </div>
            <strong>{assetQuery.data?.filter((a) => a.parkCode === 'KCN_AN_PHU').length ?? 0} công trình</strong>
          </div>
          <div className="distribution-kcn-card">
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', display: 'block' }}>KCN Đông Bắc Sông Cầu</span>
              <small style={{ color: 'var(--color-ink-muted)', fontSize: '0.72rem' }}>Mương hở, Đèn đường QL1D</small>
            </div>
            <strong>{assetQuery.data?.filter((a) => a.parkCode === 'KCN_ONG_BAC_SONG_CAU_KV1' || a.parkCode === 'KCN_DONG_BAC_SONG_CAU_KV1').length ?? 0} công trình</strong>
          </div>
          <div className="distribution-kcn-card">
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', display: 'block' }}>KCN Hòa Hiệp 1</span>
              <small style={{ color: 'var(--color-ink-muted)', fontSize: '0.72rem' }}>Trạm bơm áp lực, Dải cây xanh</small>
            </div>
            <strong>{assetQuery.data?.filter((a) => a.parkCode === 'KCN_HOA_HIEP_1').length ?? 0} công trình</strong>
          </div>
        </div>
      </section>

      {activeTab !== 'categories' && (
        <div className="glass-panel panel filter-bar-panel" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <GlassSelect
            value={parkFilter}
            onChange={setParkFilter}
            label="KCN"
            icon="land"
            ariaLabel="Chọn khu công nghiệp"
            placeholder="Tất cả KCN"
            options={[
              { value: '', label: 'Tất cả KCN' },
              ...(parksQuery.data?.map((p) => ({ value: p.code, label: p.name })) ?? []),
            ]}
          />
          {activeTab === 'assets' && (
            <GlassSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              label="Phân loại"
              icon="network"
              ariaLabel="Chọn phân loại hạ tầng"
              placeholder="Tất cả phân loại"
              options={[
                { value: '', label: 'Tất cả phân loại' },
                ...(categoriesQuery.data?.map((c) => ({ value: c.code, label: c.displayName })) ?? []),
              ]}
            />
          )}
          <label className="search-field" style={{ marginLeft: 'auto', minWidth: '240px' }}>
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === 'assets' ? 'Tìm công trình, mã tài sản...' : 'Tìm dự án...'}
            />
          </label>
        </div>
      )}

      {activeTab === 'assets' ? (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Danh mục công trình kết cấu hạ tầng"
            meta={<span className="panel-count">{assets.length} công trình</span>}
          />
          {assetQuery.loading ? (
            <LoadingBlock label="Đang tải danh mục công trình" />
          ) : assetQuery.error ? (
            <ErrorBlock message={assetQuery.error} />
          ) : assets.length ? (
            <DataTable minWidth="1050px">
              <thead>
                <tr>
                  <th>Tên công trình / Mã</th>
                  <th>Phân loại hạ tầng</th>
                  <th>KCN / Vị trí</th>
                  <th>Đơn vị quản lý</th>
                  <th>Năm SD</th>
                  <th>Thông số kỹ thuật</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="cell-strong">
                      <span>{asset.assetName}</span>
                      <span className="cell-subtle">{asset.assetCode}</span>
                    </td>
                    <td>
                      <span className="cell-code">{asset.categoryName}</span>
                    </td>
                    <td>
                      <span>{asset.parkName}</span>
                      <span className="cell-subtle">{asset.locationDesc}</span>
                    </td>
                    <td>{asset.managingUnit}</td>
                    <td>{asset.commissioningYear ?? 'Chưa rõ'}</td>
                    <td>
                      <span className="cell-subtle">{formatSpecs(asset.specs)}</span>
                    </td>
                    <td>
                      <Badge tone={assetStatusTone(asset.status)}>
                        {assetStatusLabel(asset.status)}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleOpenEditAsset(asset)}
                            title="Chỉnh sửa công trình"
                          >
                            <Icon name="edit" size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="table-action-btn table-action-btn-danger"
                            onClick={() => {
                              setDeletingAsset(asset)
                              setAssetDeleteError(null)
                            }}
                            title="Xóa công trình"
                          >
                            <Icon name="trash" size={13} /> Xóa
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Không tìm thấy công trình phù hợp với bộ lọc" />
          )}
        </section>
      ) : activeTab === 'categories' ? (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Danh mục phân loại kết cấu hạ tầng"
            meta={<span className="panel-count">{categoriesQuery.data?.length ?? 0} phân loại</span>}
          />
          {categoriesQuery.loading ? (
            <LoadingBlock label="Đang tải danh mục phân loại" />
          ) : categoriesQuery.error ? (
            <ErrorBlock message={categoriesQuery.error} />
          ) : (categoriesQuery.data ?? []).length ? (
            <DataTable minWidth="800px">
              <thead>
                <tr>
                  <th>Mã phân loại</th>
                  <th>Tên phân loại</th>
                  <th>Mô tả chi tiết</th>
                  <th>Biểu tượng</th>
                  <th className="align-right">Số công trình trực thuộc</th>
                  {isAdmin && <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {(categoriesQuery.data ?? []).map((cat) => {
                  const count = (assetQuery.data ?? []).filter((a) => a.categoryCode === cat.code).length
                  return (
                    <tr key={cat.code}>
                      <td className="cell-strong">
                        <span className="cell-code">{cat.code}</span>
                      </td>
                      <td>{cat.displayName}</td>
                      <td>
                        <span className="cell-subtle">{cat.description || 'Chưa có mô tả'}</span>
                      </td>
                      <td>{cat.iconName || 'Mặc định'}</td>
                      <td className="align-right cell-strong">{count}</td>
                      {isAdmin && (
                        <td>
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              className="table-action-btn"
                              onClick={() => handleOpenEditCategory(cat)}
                              title="Chỉnh sửa phân loại"
                            >
                              <Icon name="edit" size={13} /> Sửa
                            </button>
                            <button
                              type="button"
                              className="table-action-btn table-action-btn-danger"
                              onClick={() => {
                                setDeletingCategory(cat)
                                setCategoryDeleteError(null)
                              }}
                              title="Xóa phân loại"
                            >
                              <Icon name="trash" size={13} /> Xóa
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Chưa có phân loại hạ tầng nào" />
          )}
        </section>
      ) : (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Dự án đầu tư & Nâng cấp hạ tầng kỹ thuật"
            meta={<span className="panel-count">{projects.length} dự án</span>}
          />
          {projectQuery.loading ? (
            <LoadingBlock label="Đang tải danh mục dự án" />
          ) : projectQuery.error ? (
            <ErrorBlock message={projectQuery.error} />
          ) : projects.length ? (
            <DataTable minWidth="1050px">
              <thead>
                <tr>
                  <th>Mã / Tên dự án</th>
                  <th>Khu vực</th>
                  <th>Loại hình</th>
                  <th className="align-right">Dự toán</th>
                  <th className="align-right">Đã giải ngân</th>
                  <th>Mốc tiến độ hiện tại</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => (
                  <tr key={proj.id}>
                    <td className="cell-strong">
                      <span>{proj.projectName}</span>
                      <span className="cell-subtle">{proj.projectCode}</span>
                    </td>
                    <td>{proj.parkName}</td>
                    <td>
                      <Badge tone="neutral">{projectTypeLabel(proj.projectType)}</Badge>
                    </td>
                    <td className="align-right cell-strong">{formatCurrency(proj.estimatedBudget)}</td>
                    <td className="align-right cell-positive">{formatCurrency(proj.actualCost)}</td>
                    <td>
                      <span>{proj.currentMilestone}</span>
                      {proj.completionDate && (
                        <span className="cell-subtle">Hạn: {shortDate(proj.completionDate)}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={projectStatusTone(proj.status)}>
                        {projectStatusLabel(proj.status)}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleOpenEditProject(proj)}
                            title="Chỉnh sửa dự án"
                          >
                            <Icon name="edit" size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="table-action-btn table-action-btn-danger"
                            onClick={() => {
                              setDeletingProject(proj)
                              setProjectDeleteError(null)
                            }}
                            title="Xóa dự án"
                          >
                            <Icon name="trash" size={13} /> Xóa
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Chưa có dự án nào được ghi nhận" />
          )}
        </section>
      )}

      {assetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !assetSubmitting && setAssetModalOpen(false)}
        >
          <div className="crud-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>{editingAsset ? 'Chỉnh sửa công trình hạ tầng' : 'Thêm mới công trình hạ tầng'}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setAssetModalOpen(false)}
                disabled={assetSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveAsset}>
              <div className="crud-modal-body">
                {assetError && (
                  <div style={{
                    background: 'var(--color-negative-soft)',
                    color: 'var(--color-negative)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-field)',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <Icon name="alert" size={16} />
                    <span>{assetError}</span>
                  </div>
                )}
                <div className="crud-form-grid">
                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Mã công trình <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={assetForm.assetCode}
                      onChange={(e) => setAssetForm((f) => ({ ...f, assetCode: e.target.value.toUpperCase() }))}
                      placeholder="VD: CT-AP-006"
                      disabled={!!editingAsset || assetSubmitting}
                      required
                    />
                    <div className="crud-form-hint">Mã định danh duy nhất (VD: CT-AP-006)</div>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Tên công trình <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={assetForm.assetName}
                      onChange={(e) => setAssetForm((f) => ({ ...f, assetName: e.target.value }))}
                      placeholder="VD: Trạm biến áp trung gian 110kV"
                      disabled={assetSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Phân loại hạ tầng <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={assetForm.categoryCode}
                      onChange={(e) => setAssetForm((f) => ({ ...f, categoryCode: e.target.value }))}
                      disabled={assetSubmitting}
                      required
                    >
                      <option value="" disabled>-- Chọn phân loại --</option>
                      {(categoriesQuery.data ?? []).map((c) => (
                        <option key={c.code} value={c.code}>{c.displayName} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Khu công nghiệp <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={assetForm.parkCode}
                      onChange={(e) => setAssetForm((f) => ({ ...f, parkCode: e.target.value }))}
                      disabled={assetSubmitting}
                      required
                    >
                      <option value="" disabled>-- Chọn KCN --</option>
                      {(parksQuery.data ?? []).map((p) => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Vị trí công trình <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={assetForm.locationDesc}
                      onChange={(e) => setAssetForm((f) => ({ ...f, locationDesc: e.target.value }))}
                      placeholder="VD: Trục D1 giao N3, KCN An Phú"
                      disabled={assetSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Đơn vị quản lý vận hành</label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={assetForm.managingUnit}
                      onChange={(e) => setAssetForm((f) => ({ ...f, managingUnit: e.target.value }))}
                      placeholder="Tổ Quản lý Vận hành Hạ tầng"
                      disabled={assetSubmitting}
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Năm đưa vào sử dụng</label>
                    <input
                      type="number"
                      className="crud-form-input"
                      value={assetForm.commissioningYear}
                      onChange={(e) => setAssetForm((f) => ({ ...f, commissioningYear: e.target.value }))}
                      placeholder="VD: 2022"
                      min={1990}
                      max={2035}
                      disabled={assetSubmitting}
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Trạng thái công trình</label>
                    <select
                      className="crud-form-select"
                      value={assetForm.status}
                      onChange={(e) => setAssetForm((f) => ({ ...f, status: e.target.value }))}
                      disabled={assetSubmitting}
                    >
                      <option value="OPERATIONAL">Đang vận hành (OPERATIONAL)</option>
                      <option value="DEGRADED">Xuống cấp / Cần bảo dưỡng (DEGRADED)</option>
                      <option value="UNDER_MAINTENANCE">Đang bảo trì (UNDER_MAINTENANCE)</option>
                      <option value="OUT_OF_SERVICE">Ngừng vận hành (OUT_OF_SERVICE)</option>
                    </select>
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Thông số kỹ thuật / Ghi chú</label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={assetForm.specs}
                      onChange={(e) => setAssetForm((f) => ({ ...f, specs: e.target.value }))}
                      placeholder="VD: Chiều dài 2.4km, công suất 2x25MVA..."
                      disabled={assetSubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="crud-modal-footer">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setAssetModalOpen(false)}
                  disabled={assetSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="glass-button glass-button-primary"
                  disabled={assetSubmitting}
                >
                  {assetSubmitting ? 'Đang lưu...' : editingAsset ? 'Cập nhật công trình' : 'Tạo mới công trình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingAsset && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !assetSubmitting && setDeletingAsset(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa công trình</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingAsset(null)}
                disabled={assetSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {assetDeleteError && (
                <div style={{
                  background: 'var(--color-negative-soft)',
                  color: 'var(--color-negative)',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-field)',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Icon name="alert" size={16} />
                  <span>{assetDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa công trình <strong>{deletingAsset.assetName}</strong> (mã <code>{deletingAsset.assetCode}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Lưu ý: Hệ thống sẽ từ chối xóa nếu công trình đang được tham chiếu trong lệnh duy tu, sự cố kỹ thuật hoặc biên bản bàn giao.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingAsset(null)}
                disabled={assetSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteAssetConfirm}
                disabled={assetSubmitting}
              >
                {assetSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !categorySubmitting && setCategoryModalOpen(false)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>{editingCategory ? 'Chỉnh sửa phân loại hạ tầng' : 'Thêm phân loại hạ tầng mới'}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCategoryModalOpen(false)}
                disabled={categorySubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="crud-modal-body">
                {categoryError && (
                  <div style={{
                    background: 'var(--color-negative-soft)',
                    color: 'var(--color-negative)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-field)',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <Icon name="alert" size={16} />
                    <span>{categoryError}</span>
                  </div>
                )}
                <div className="crud-form-grid">
                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Mã phân loại <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={categoryForm.code}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="VD: TELECOM_NET"
                      disabled={!!editingCategory || categorySubmitting}
                      required
                    />
                    <div className="crud-form-hint">Mã viết hoa duy nhất (VD: WATER_SUPPLY)</div>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Tên hiển thị <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={categoryForm.displayName}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, displayName: e.target.value }))}
                      placeholder="VD: Mạng viễn thông & Truyền dẫn"
                      disabled={categorySubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Biểu tượng gợi ý</label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={categoryForm.iconName}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, iconName: e.target.value }))}
                      placeholder="network, droplets, building..."
                      disabled={categorySubmitting}
                    />
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Mô tả chi tiết</label>
                    <textarea
                      className="crud-form-textarea"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Mô tả phạm vi quản lý và tiêu chuẩn kỹ thuật áp dụng..."
                      disabled={categorySubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="crud-modal-footer">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setCategoryModalOpen(false)}
                  disabled={categorySubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="glass-button glass-button-primary"
                  disabled={categorySubmitting}
                >
                  {categorySubmitting ? 'Đang lưu...' : editingCategory ? 'Cập nhật phân loại' : 'Tạo mới phân loại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !categorySubmitting && setDeletingCategory(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa phân loại</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingCategory(null)}
                disabled={categorySubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {categoryDeleteError && (
                <div style={{
                  background: 'var(--color-negative-soft)',
                  color: 'var(--color-negative)',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-field)',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Icon name="alert" size={16} />
                  <span>{categoryDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa phân loại <strong>{deletingCategory.displayName}</strong> (mã <code>{deletingCategory.code}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Hệ thống sẽ từ chối nếu có công trình hạ tầng đang thuộc phân loại này.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingCategory(null)}
                disabled={categorySubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteCategoryConfirm}
                disabled={categorySubmitting}
              >
                {categorySubmitting ? 'Đang xóa...' : 'Xóa phân loại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !projectSubmitting && setProjectModalOpen(false)}
        >
          <div className="crud-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>{editingProject ? 'Chỉnh sửa dự án nâng cấp / phát triển' : 'Thêm mới dự án phát triển / nâng cấp'}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setProjectModalOpen(false)}
                disabled={projectSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveProject}>
              <div className="crud-modal-body">
                {projectError && (
                  <div style={{
                    background: 'var(--color-negative-soft)',
                    color: 'var(--color-negative)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-field)',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <Icon name="alert" size={16} />
                    <span>{projectError}</span>
                  </div>
                )}
                <div className="crud-form-grid">
                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Tên dự án <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={projectForm.projectName}
                      onChange={(e) => setProjectForm((f) => ({ ...f, projectName: e.target.value }))}
                      placeholder="VD: Nâng cấp đồng bộ hệ thống thoát nước mưa KCN An Phú"
                      disabled={projectSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Mã dự án {!editingProject && <span style={{ color: 'var(--color-ink-muted)', fontWeight: 400 }}>(tùy chọn)</span>}
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={projectForm.projectCode}
                      onChange={(e) => setProjectForm((f) => ({ ...f, projectCode: e.target.value.toUpperCase() }))}
                      placeholder={editingProject ? 'VD: DA-2026-01' : 'Tự động tạo: DA-2026-XX'}
                      disabled={projectSubmitting}
                    />
                    <div className="crud-form-hint">
                      {editingProject ? 'Mã định danh dự án' : 'Để trống hệ thống sẽ tự động gán theo năm'}
                    </div>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Khu công nghiệp <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={projectForm.parkCode}
                      onChange={(e) => setProjectForm((f) => ({ ...f, parkCode: e.target.value }))}
                      disabled={projectSubmitting}
                      required
                    >
                      <option value="" disabled>-- Chọn KCN --</option>
                      {(parksQuery.data ?? []).map((p) => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Loại hình dự án <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={projectForm.projectType}
                      onChange={(e) => setProjectForm((f) => ({ ...f, projectType: e.target.value as any }))}
                      disabled={projectSubmitting}
                      required
                    >
                      <option value="UPGRADE">Nâng cấp hạ tầng (UPGRADE)</option>
                      <option value="NEW_BUILD">Xây dựng mới (NEW_BUILD)</option>
                      <option value="REPAIR">Sửa chữa lớn (REPAIR)</option>
                      <option value="EMERGENCY">Công trình khẩn cấp (EMERGENCY)</option>
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Trạng thái thực hiện <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={projectForm.status}
                      onChange={(e) => setProjectForm((f) => ({ ...f, status: e.target.value as any }))}
                      disabled={projectSubmitting}
                      required
                    >
                      <option value="PLANNING">Lập kế hoạch (PLANNING)</option>
                      <option value="IN_PROGRESS">Đang thi công (IN_PROGRESS)</option>
                      <option value="COMPLETED">Đã hoàn thành (COMPLETED)</option>
                      <option value="ON_HOLD">Tạm dừng (ON_HOLD)</option>
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Dự toán tổng mức (VNĐ) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      className="crud-form-input"
                      value={projectForm.estimatedBudget}
                      onChange={(e) => setProjectForm((f) => ({ ...f, estimatedBudget: e.target.value }))}
                      placeholder="VD: 5800000000"
                      min={0}
                      step={1000000}
                      disabled={projectSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Đã giải ngân (VNĐ)</label>
                    <input
                      type="number"
                      className="crud-form-input"
                      value={projectForm.actualCost}
                      onChange={(e) => setProjectForm((f) => ({ ...f, actualCost: e.target.value }))}
                      placeholder="VD: 3400000000"
                      min={0}
                      step={1000000}
                      disabled={projectSubmitting}
                    />
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Mốc tiến độ hiện tại <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={projectForm.currentMilestone}
                      onChange={(e) => setProjectForm((f) => ({ ...f, currentMilestone: e.target.value }))}
                      placeholder="VD: Nghiệm thu hoàn thành phân đoạn 1; đang ép cọc..."
                      disabled={projectSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Ngày khởi công</label>
                    <input
                      type="date"
                      className="crud-form-input"
                      value={projectForm.startDate}
                      onChange={(e) => setProjectForm((f) => ({ ...f, startDate: e.target.value }))}
                      disabled={projectSubmitting}
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Ngày dự kiến hoàn thành</label>
                    <input
                      type="date"
                      className="crud-form-input"
                      value={projectForm.completionDate}
                      onChange={(e) => setProjectForm((f) => ({ ...f, completionDate: e.target.value }))}
                      disabled={projectSubmitting}
                    />
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Ghi chú dự án</label>
                    <textarea
                      className="crud-form-textarea"
                      value={projectForm.notes}
                      onChange={(e) => setProjectForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Thông tin gói thầu, nhà thầu thi công, giám sát, vướng mắc..."
                      disabled={projectSubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="crud-modal-footer">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setProjectModalOpen(false)}
                  disabled={projectSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="glass-button glass-button-primary"
                  disabled={projectSubmitting}
                >
                  {projectSubmitting ? 'Đang lưu...' : editingProject ? 'Cập nhật dự án' : 'Tạo mới dự án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProject && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !projectSubmitting && setDeletingProject(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa dự án hạ tầng</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingProject(null)}
                disabled={projectSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {projectDeleteError && (
                <div style={{
                  background: 'var(--color-negative-soft)',
                  color: 'var(--color-negative)',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-field)',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Icon name="alert" size={16} />
                  <span>{projectDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa dự án <strong>{deletingProject.projectName}</strong> (mã <code>{deletingProject.projectCode}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Hành động này sẽ xóa vĩnh viễn dự án khỏi hệ thống cơ sở dữ liệu.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingProject(null)}
                disabled={projectSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteProjectConfirm}
                disabled={projectSubmitting}
              >
                {projectSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )
}
