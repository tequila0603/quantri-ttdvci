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

export type RoleCode = 'DIRECTOR' | 'DATA_ADMIN';
export type User = { id: string; username: string; displayName: string; roleCode: RoleCode };
export type PageMeta = { limit: number; hasNext: boolean; nextCursor: string | null };
export type ApiEnvelope<T> = { success: boolean; data: T; meta?: PageMeta; error?: { message?: string } };
export type Page<T> = { data: T[]; meta: PageMeta };
export type Summary = {
      year: number
      workforce: { activeEmployees: number }
      leaseSnapshots: number
      uniqueEnterprises?: number
      uniqueLots?: number
      totalReceivableAmount?: string
      revenueByCategory: { code: string; display_name: string; amount_due: string }[]
      receivables: { invoiceLines: number; amountOutstanding: string }
      dataStatus: { actualPaymentsImported: boolean; note: string }
    };
export type LeaseRow = {
      id: string
      enterpriseId: string
      enterpriseName: string
      parkCode: string
      parkName: string
      year: number
      lotLocation: string
      landAreaM2: string
      leaseStatus: string | null
      sourceTotalAmount: string
      amounts: {
        rawLandLease: string
        infrastructureAssetLease: string
        infrastructureServiceLease: string
      }
    };
export type ReceivableRow = {
      id: string
      invoiceId: string
      invoiceNumber: string
      enterpriseId: string
      enterpriseName: string
      categoryCode: string
      issuedOn: string | null
      dueOn: string | null
      amountDue: string
      amountPaid: string
      amountAdjusted: string
      amountOutstanding: string
    };
export type Employee = {
      id: string
      employeeCode: string | null
      fullName: string
      birthDate: string | null
      unitId?: string | null
      organizationalUnit: string | null
      parkCode?: string | null
      parkName?: string | null
      teamName?: string | null
      decisionNumber?: string | null
      notes?: string | null
      professionalQualification: string | null
      politicalTheory: string | null
      stateManagement: string | null
      foreignLanguage: string | null
      informatics: string | null
      workPosition: string | null
      partyPosition: string | null
      employmentType: string | null
    };
export type WorkforceUnit = { id: string; name: string; parentId: string | null };
export type WorkforcePark = { id: string; code: string; name: string };
export type Observation = {
      id: string
      stationCode: string
      stationName: string
      deviceCode: string
      parameterCode: string
      parameterName: string
      unit: string | null
      measuredAt: string
      value: string | null
      qualityCode: string | null
      providerRecordKey: string | null
    };
export type PremierMetricStatus = 'NORMAL' | 'EXCEEDED' | 'NO_LIMIT' | 'MISSING';
export type PremierMetric = {
      code: string
      displayName: string
      unit: string | null
      value: number | null
      limitText: string | null
      status: PremierMetricStatus
    };
export type PremierStation = { code: string; name: string };
export type PremierSnapshot = {
      stationCode: string
      stationName: string
      observedOn: string
      measuredAt: string
      readingMode: 'CURRENT' | 'LATEST_30D'
      metrics: PremierMetric[]
    };
export type PremierPublicData = {
      source: {
        name: string
        url: string
        fetchedAt: string
        currentMeasuredAt: string | null
        availableFrom: string | null
        availableTo: string | null
      }
      stations: PremierStation[]
      parameters: Array<{ code: string; displayName: string; unit: string | null }>
      current: PremierSnapshot[]
      history: PremierSnapshot[]
    };
export type SyncRun = {
      id: string
      provider: string
      status: string
      checkpoint: string | null
      recordsReceived: number
      recordsSaved: number
      errorMessage: string | null
      startedAt: string
      finishedAt: string | null
    };
export type ImportBatch = { id: string; sourceFile: string; sourceSha256: string; importKind: string; status: string; importedByUserId: string | null; createdAt: string; reportingPeriod?: string; totalRows?: number; acceptedRows?: number; rejectedRows?: number; duplicateRows?: number; totalAmount?: number; };
export type EnterprisePark = { id: string; code: string; name: string; enterpriseCount: number };
export type EnterpriseRow = {
      id: string
      legalName: string
      taxCode: string | null
      isActive: boolean
      parkCode: string
      parkName: string
      lotLocation: string
      landAreaM2: string
      sourceTotalAmount: string
      leaseStatus: string | null
    };
export type View = | 'overview'
      | 'finance'
      | 'enterprises'
      | 'infrastructure'
      | 'maintenance'
      | 'workforce'
      | 'monitoring'
      | 'imports';
export type IconName = | 'user' | 'download' | 'file' | 'alert'
      | 'grid'
      | 'chart'
      | 'users'
      | 'activity'
      | 'upload'
      | 'arrow'
      | 'logout'
      | 'menu'
      | 'close'
      | 'check'
      | 'refresh'
      | 'shield'
      | 'calendar'
      | 'chevron'
      | 'search'
      | 'land'
      | 'receipt'
      | 'database'
      | 'network'
      | 'dollar'
      | 'alert'
      | 'lock'
      | 'eye'
      | 'eyeOff'
      | 'sliders'
      | 'droplets'
      | 'externalLink'
      | 'trendingUp'
      | 'gauge'
      | 'building'
      | 'wrench'
      | 'flame'
      | 'edit'
      | 'trash'
      | 'plus';
export type GlassSelectOption = { value: string; label: string };
export type LimitRuleInfo = {
      min?: number
      max?: number
      isRange: boolean
    };
export type NavItem = { id: View; label: string; icon: IconName; adminOnly?: boolean };
export type FinanceBarRow = { label: string; value: number; detail?: string; color?: string };
export type AgingKey = 'current' | 'short' | 'medium' | 'long' | 'unknown';
export type FinanceAgingRow = FinanceBarRow & { key: AgingKey; count: number };
export type InfrastructureProject = {
      id: string
      projectCode: string
      projectName: string
      parkCode: string
      parkName: string
      projectType: 'NEW_BUILD' | 'UPGRADE' | 'REPAIR' | 'EMERGENCY'
      estimatedBudget: number
      actualCost: number
      currentMilestone: string
      status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
      startDate: string | null
      completionDate: string | null
      notes: string | null
    };
export type CoordinationTask = {
      id: string
      taskCode: string
      title: string
      taskCategory: string
      requestingAgency: string
      coordinatorName: string | null
      assignedDate: string
      dueDate: string | null
      priority: string
      status: string
      progressPercent: number
      completionEvidence: string | null
      notes: string | null
      isOverdue: boolean
      createdAt: string
      updatedAt: string
    };
export type AssetCategory = {
      code: string
      displayName: string
      iconName: string | null
      description: string | null
    };
export type InfrastructureAsset = {
      id: string
      assetCode: string
      assetName: string
      categoryCode: string
      categoryName: string
      categoryIcon: string | null
      parkCode: string
      parkName: string
      locationDesc: string
      managingUnit: string
      commissioningYear: number | null
      status: 'OPERATIONAL' | 'DEGRADED' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE'
      specs: Record<string, unknown>
      createdAt: string
      updatedAt: string
    };
export type MaintenanceIncident = {
      id: string
      incidentCode: string
      title: string
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      parkCode: string
      parkName: string
      locationDetail: string
      reportedAt: string
      targetResolutionAt: string | null
      resolvedAt: string | null
      currentStatus: 'OPEN' | 'INVESTIGATING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
      assignedTo: string | null
      rootCause: string | null
      mitigationActions: string | null
      assetId?: string | null
      assetCode: string | null
      assetName: string | null
    };
export type MaintenanceOrder = {
      id: string
      incidentId?: string | null
      orderCode: string
      title: string
      orderType: 'ROUTINE' | 'CORRECTIVE' | 'EMERGENCY' | 'UPGRADE'
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
      assignedTo: string
      scheduledStart: string
      scheduledEnd: string
      completedAt: string | null
      actualCost: number
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
      notes: string | null
      assetId: string
      assetCode: string
      assetName: string
      parkCode?: string
      parkName?: string
      isOverdue: boolean
    };
export type FieldReport = {
      id: string
      reportCode: string
      source: string
      sourceMessageKey: string | null
      rawReporterName: string | null
      reporterName: string
      title: string
      content: string
      parkId: string
      parkCode: string
      parkName: string
      locationDetail: string
      category: 'INCIDENT' | 'INSPECTION' | 'OPERATIONS' | 'PROGRESS' | 'ENTERPRISE_ACTIVITY' | 'NOTICE' | 'PENDING_CLASSIFICATION' | string
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
      status: 'NEW' | 'REVIEWED' | 'CONVERTED' | 'ARCHIVED'
      reportedAt: string
      linkedIncidentId: string | null
      linkedIncidentCode: string | null
      linkedWorkOrderId: string | null
      linkedWorkOrderCode: string | null
      reviewedBy: string | null
      reviewedAt: string | null
      notes: string | null
      createdAt: string
    };
export type TrendPoint = {
      date: string
      formattedDate: string
      value: number | null
      limitText: string | null
      status: PremierMetricStatus
    };
export type WasteRecord = {
      id: string
      enterpriseId: string
      enterpriseName: string
      parkCode: string
      parkName: string
      reportingYear: number
      reportingQuarter: number | null
      wastewaterM3: number
      solidWasteKg: number
      rawWastewaterValue: number | null
      rawWastewaterUnit: string
      rawWasteValue: number | null
      rawWasteUnit: string
      sourceType: string
      status: string
      notes: string | null
      createdAt: string
    };
export type PdfDocument = {
      id: string
      fileName: string
      sha256: string
      enterpriseName: string
      parkName: string
      reportingPeriod: string
      extractedWastewaterM3: number | null
      extractedWasteKg: number | null
      confidenceScore: number
      isScanned: boolean
      status: string
      pageReference: string | null
      notes: string | null
      createdAt: string
    };

export const API_ROOT = import.meta.env.VITE_API_ROOT ?? '/api/v1';
export const YEARS = [2026, 2025, 2024, 2023, 2022];
export const CATEGORY_LABELS: Record<string, string> = {
      WASTEWATER: 'Xử lý nước thải',
      WASTE_TREATMENT: 'Xử lý rác',
      WASTE_TRANSPORT: 'Vận chuyển rác',
      OTHER_SERVICE: 'Dịch vụ khác',
      INFRASTRUCTURE_SERVICE_LEASE: 'Thuê dịch vụ hạ tầng',
      RAW_LAND_LEASE: 'Thuê đất nguyên thổ',
      INFRASTRUCTURE_ASSET_LEASE: 'Thuê kết cấu hạ tầng',
    };
export const CENTER_DUTIES = [
      'Phối hợp cung cấp và cập nhật dữ liệu, hồ sơ thuộc phạm vi được giao.',
      'Rà soát, lập danh mục, chuẩn hóa và số hóa hồ sơ ưu tiên.',
      'Cập nhật, khai thác cơ sở dữ liệu theo hướng dẫn của Ban Quản lý Khu kinh tế.',
      'Bàn giao hoặc đồng bộ dữ liệu cho đơn vị chủ trì, cập nhật khi phát sinh và báo cáo định kỳ.',
    ];
import { Download, FileText } from 'lucide';
export const ICONS = {
  download: Download,
  file: FileText,
      user: UserIcon,
      grid: LayoutDashboard,
      chart: ChartNoAxesCombined,
      users: UsersRound,
      activity: Activity,
      upload: Upload,
      arrow: ArrowRight,
      logout: LogOut,
      menu: Menu,
      close: X,
      check: Check,
      refresh: RefreshCw,
      shield: ShieldCheck,
      calendar: CalendarDays,
      chevron: ChevronDown,
      search: Search,
      land: LandPlot,
      receipt: ReceiptText,
      database: Database,
      network: Network,
      dollar: CircleDollarSign,
      alert: CircleAlert,
      lock: LockKeyhole,
      eye: Eye,
      eyeOff: EyeOff,
      sliders: SlidersHorizontal,
      droplets: Droplets,
      externalLink: ExternalLink,
      trendingUp: TrendingUp,
      gauge: Gauge,
      building: Building2,
      wrench: Wrench,
      flame: Flame,
      edit: Pencil,
      trash: Trash2,
      plus: Plus,
    } as const;
export const NAV_ITEMS: NavItem[] = [
      { id: 'overview', label: 'Tổng quan', icon: 'grid' },
      { id: 'finance', label: 'Tài chính', icon: 'chart' },
      { id: 'enterprises', label: 'Doanh nghiệp', icon: 'land' },
      { id: 'infrastructure', label: 'Hạ tầng', icon: 'building' },
      { id: 'maintenance', label: 'Báo cáo & Bảo trì', icon: 'wrench' },
      { id: 'workforce', label: 'Nhân sự', icon: 'users' },
      { id: 'monitoring', label: 'Quan trắc', icon: 'activity' },
      { id: 'imports', label: 'Import', icon: 'upload', adminOnly: true },
    ];
export const FINANCE_BAR_COLORS = ['#191919', '#4f6f5e', '#85938b', '#9a8160', '#7c849b', '#a8746b', '#a7a7a2'];

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {};
    if (init?.body) {
    headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${API_ROOT}${path}`, {
            credentials: 'include',
            headers: { ...headers, ...(init?.headers ?? {}) },
            ...init,
          });
    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message ?? 'Không thể tải dữ liệu từ máy chủ')
    }

    return unwrapApiData(body)
}

export function useApiData<T>(path: string | null, user: User | null, pollingIntervalMs?: number) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    useEffect(() => {
    let mounted = true
    if (!path || !user) {
      setData(null)
      setLoading(false)
      setError(null)
      return () => {
        mounted = false
      }
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchApi<T>(path, { signal: controller.signal })
      .then((result) => mounted && setData(result))
      .catch((reason: unknown) => {
        if (mounted && !(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu')
      })
      .finally(() => mounted && setLoading(false))

    let intervalId: any = null
    if (pollingIntervalMs && pollingIntervalMs > 0) {
      intervalId = setInterval(() => {
        if (!mounted) return
        fetchApi<T>(path)
          .then((result) => mounted && setData(result))
          .catch(() => undefined)
      }, pollingIntervalMs)
    }

    return () => {
      mounted = false
      controller.abort()
      if (intervalId) clearInterval(intervalId)
    }
    }, [path, user?.id, reloadKey, pollingIntervalMs])
    const refresh = useCallback(() => setReloadKey((value) => value + 1), []);
    return { data, loading, error, refresh }
}

export function formatCurrency(value: string | number | null | undefined): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return 'Chưa có'
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} ₫`
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return 'Chưa có'
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function shortDate(value: string | null | undefined): string {
    if (!value) return 'Chưa có'
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

export function displayCategory(code: string): string {
    return CATEGORY_LABELS[code] ?? code
}

export function monitoringStatusLabel(status: PremierMetricStatus): string {
    if (status === 'NORMAL') return 'Đạt chuẩn'
    if (status === 'EXCEEDED') return 'Vượt ngưỡng'
    if (status === 'NO_LIMIT') return 'Vận hành'
    return 'Chưa có dữ liệu'
}

export function monitoringStatusTone(status: PremierMetricStatus): 'neutral' | 'positive' | 'warning' | 'negative' | 'info' {
    if (status === 'NORMAL') return 'positive'
    if (status === 'EXCEEDED') return 'negative'
    if (status === 'NO_LIMIT') return 'info'
    return 'warning'
}

export function formatMonitoringValue(value: number | null): string {
    return value === null ? 'Chưa có' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
}

export function parseLimitInfo(limitText: string | null | undefined): LimitRuleInfo | null {
    if (!limitText || /không giới hạn/i.test(limitText)) return null
    const cleaned = limitText.replace(/−/g, '-').trim();
    const rangeMatch = cleaned.match(/(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)/);
    if (rangeMatch) {
    const min = parseFloat((rangeMatch[1] ?? '').replace(',', '.'))
    const max = parseFloat((rangeMatch[2] ?? '').replace(',', '.'))
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max, isRange: true }
    }

    const upperMatch = cleaned.match(/(?:<=|<)\s*(-?\d+(?:[.,]\d+)?)/);
    if (upperMatch) {
    const max = parseFloat((upperMatch[1] ?? '').replace(',', '.'))
    if (Number.isFinite(max)) return { max, isRange: false }
    }

    const lowerMatch = cleaned.match(/(?:>=|>)\s*(-?\d+(?:[.,]\d+)?)/);
    if (lowerMatch) {
    const min = parseFloat((lowerMatch[1] ?? '').replace(',', '.'))
    if (Number.isFinite(min)) return { min, isRange: false }
    }

    return null
}

export function numberValue(value: string | number | null | undefined): number {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0
}

export function compactCurrency(value: number): string {
    const amount = numberValue(value);
    const absolute = Math.abs(amount);
    if (absolute >= 1_000_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(amount / 1_000_000_000)} tỷ`
    if (absolute >= 1_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} triệu`
    if (absolute >= 1_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount / 1_000)} nghìn`
    return formatCurrency(amount)
}

export function agingKey(value: string | null): AgingKey {
    if (!value) return 'unknown'
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return 'unknown'
    const overdueDays = Math.floor((Date.now() - dueDate.getTime()) / 86_400_000);
    if (overdueDays <= 0) return 'current'
    if (overdueDays <= 30) return 'short'
    if (overdueDays <= 90) return 'medium'
    return 'long'
}

export function projectStatusLabel(status: string): string {
    switch (status) {
    case 'COMPLETED': return 'Hoàn thành'
    case 'IN_PROGRESS': return 'Đang thi công'
    case 'PLANNING': return 'Lập kế hoạch'
    case 'ON_HOLD': return 'Tạm dừng'
    default: return status
    }
}

export function projectStatusTone(status: string): 'positive' | 'info' | 'warning' | 'neutral' {
    switch (status) {
    case 'COMPLETED': return 'positive'
    case 'IN_PROGRESS': return 'info'
    case 'PLANNING': return 'neutral'
    case 'ON_HOLD': return 'warning'
    default: return 'neutral'
    }
}

export function projectTypeLabel(type: string): string {
    switch (type) {
    case 'UPGRADE': return 'Nâng cấp'
    case 'REPAIR': return 'Sửa chữa'
    case 'NEW_BUILD': return 'Xây dựng mới'
    case 'EMERGENCY': return 'Khẩn cấp'
    default: return type
    }
}

export function taskCategoryLabel(category: string): string {
    switch (category) {
    case 'FIRE_SAFETY': return 'PCCC & Cứu nạn'
    case 'DISASTER_PREVENTION': return 'Phòng chống thiên tai'
    case 'OCCUPATIONAL_SAFETY': return 'An toàn lao động'
    case 'PUBLIC_SERVICE': return 'Sự nghiệp công'
    case 'ENVIRONMENTAL_INSPECTION': return 'Kiểm tra môi trường'
    default: return 'Phối hợp khác'
    }
}

export function taskStatusLabel(status: string): string {
    switch (status) {
    case 'NOT_STARTED': return 'Chưa thực hiện'
    case 'IN_PROGRESS': return 'Đang thực hiện'
    case 'COMPLETED': return 'Hoàn thành'
    case 'PAUSED': return 'Tạm dừng'
    case 'CANCELLED': return 'Đã hủy'
    case 'REOPENED': return 'Mở lại'
    default: return status
    }
}

export function taskStatusTone(status: string): 'neutral' | 'info' | 'positive' | 'warning' | 'negative' {
    switch (status) {
    case 'COMPLETED': return 'positive'
    case 'IN_PROGRESS': return 'info'
    case 'NOT_STARTED': return 'neutral'
    case 'PAUSED': return 'warning'
    case 'CANCELLED': return 'negative'
    case 'REOPENED': return 'warning'
    default: return 'neutral'
    }
}

export function assetStatusLabel(status: string): string {
    switch (status) {
    case 'OPERATIONAL': return 'Đang vận hành'
    case 'DEGRADED': return 'Xuống cấp / Cần bảo dưỡng'
    case 'UNDER_MAINTENANCE': return 'Đang bảo trì'
    case 'OUT_OF_SERVICE': return 'Ngừng vận hành'
    default: return status
    }
}

export function assetStatusTone(status: string): 'positive' | 'warning' | 'negative' | 'neutral' | 'info' {
    switch (status) {
    case 'OPERATIONAL': return 'positive'
    case 'DEGRADED': return 'warning'
    case 'UNDER_MAINTENANCE': return 'info'
    case 'OUT_OF_SERVICE': return 'negative'
    default: return 'neutral'
    }
}

export function formatSpecs(specs: Record<string, unknown>): string {
    if (!specs || Object.keys(specs).length === 0) return 'Tiêu chuẩn kỹ thuật KCN'
    return Object.entries(specs)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ')
}

export function fieldReportCategoryLabel(cat: string): string {
    switch (cat) {
    case 'INCIDENT': return 'Sự cố / Nguy cơ'
    case 'INSPECTION': return 'Kiểm tra hiện trường'
    case 'OPERATIONS': return 'Vận hành / Bảo dưỡng'
    case 'PROGRESS': return 'Tiến độ công việc'
    case 'ENTERPRISE_ACTIVITY': return 'Hoạt động doanh nghiệp'
    case 'NOTICE': return 'Thông báo / Chỉ đạo'
    case 'PENDING_CLASSIFICATION': return 'Chờ phân loại'
    default: return 'Chờ phân loại'
    }
}

export function fieldReportCategoryTone(cat: string): 'negative' | 'warning' | 'info' | 'positive' | 'neutral' {
    switch (cat) {
    case 'INCIDENT': return 'negative'
    case 'INSPECTION': return 'info'
    case 'OPERATIONS': return 'positive'
    case 'PROGRESS': return 'warning'
    case 'ENTERPRISE_ACTIVITY': return 'info'
    case 'NOTICE': return 'warning'
    case 'PENDING_CLASSIFICATION': return 'neutral'
    default: return 'neutral'
    }
}

export function fieldReportSeverityLabel(severity: string): string {
    switch (severity) {
    case 'CRITICAL': return 'Khẩn cấp'
    case 'HIGH': return 'Cao'
    case 'MEDIUM': return 'Trung bình'
    case 'LOW': return 'Thấp'
    default: return 'Chưa xác định'
    }
}

export function fieldReportSeverityTone(severity: string): 'negative' | 'warning' | 'info' | 'neutral' {
    switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'negative'
    case 'MEDIUM':
      return 'warning'
    case 'LOW':
      return 'info'
    default:
      return 'neutral'
    }
}

export function fieldReportStatusLabel(status: string): string {
    switch (status) {
    case 'NEW': return 'Mới tiếp nhận'
    case 'REVIEWED': return 'Đã xem'
    case 'CONVERTED': return 'Đã chuyển đổi'
    case 'ARCHIVED': return 'Lưu trữ'
    default: return status
    }
}

export function fieldReportStatusTone(status: string): 'info' | 'warning' | 'positive' | 'neutral' {
    switch (status) {
    case 'NEW': return 'info'
    case 'REVIEWED': return 'warning'
    case 'CONVERTED': return 'positive'
    case 'ARCHIVED': return 'neutral'
    default: return 'neutral'
    }
}

export function incidentSeverityLabel(severity: string): string {
    switch (severity) {
    case 'CRITICAL': return 'Khẩn cấp / Nguy hiểm'
    case 'HIGH': return 'Mức độ cao'
    case 'MEDIUM': return 'Trung bình'
    case 'LOW': return 'Thấp'
    default: return severity
    }
}

export function incidentSeverityTone(severity: string): 'negative' | 'warning' | 'info' | 'positive' {
    switch (severity) {
    case 'CRITICAL': return 'negative'
    case 'HIGH': return 'negative'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'info'
    default: return 'info'
    }
}

export function incidentStatusLabel(status: string): string {
    switch (status) {
    case 'OPEN': return 'Mới ghi nhận'
    case 'INVESTIGATING': return 'Đang khảo sát'
    case 'IN_PROGRESS': return 'Đang xử lý'
    case 'RESOLVED': return 'Đã xử lý'
    case 'CLOSED': return 'Đã đóng nghiệm thu'
    default: return status
    }
}

export function incidentStatusTone(status: string): 'warning' | 'info' | 'positive' | 'neutral' {
    switch (status) {
    case 'OPEN': return 'warning'
    case 'INVESTIGATING': return 'info'
    case 'IN_PROGRESS': return 'info'
    case 'RESOLVED': return 'positive'
    case 'CLOSED': return 'neutral'
    default: return 'neutral'
    }
}

export function orderStatusLabel(status: string): string {
    switch (status) {
    case 'COMPLETED': return 'Đã nghiệm thu'
    case 'IN_PROGRESS': return 'Đang thi công'
    case 'PENDING': return 'Chờ triển khai'
    case 'CANCELLED': return 'Đã hủy'
    default: return status
    }
}

export function orderStatusTone(status: string): 'positive' | 'info' | 'warning' | 'neutral' {
    switch (status) {
    case 'COMPLETED': return 'positive'
    case 'IN_PROGRESS': return 'info'
    case 'PENDING': return 'warning'
    case 'CANCELLED': return 'neutral'
    default: return 'neutral'
    }
}

export function orderTypeLabel(type: string): string {
    switch (type) {
    case 'ROUTINE': return 'Bảo dưỡng định kỳ'
    case 'CORRECTIVE': return 'Sửa chữa khắc phục'
    case 'EMERGENCY': return 'Ứng phó khẩn cấp'
    case 'UPGRADE': return 'Cải tạo nâng cấp'
    default: return type
    }
}
