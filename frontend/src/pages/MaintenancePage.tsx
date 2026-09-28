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

export function MaintenancePage({
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
          initialTab?: 'reports' | 'incidents' | 'orders'
          initialTargetId?: string
          realtimeSignal?: { scopes: RefreshScope[]; tick: number }
          deletedRecord?: { entityType: string; entityId: string; tick: number } | null
        }) {
    const isAdmin = user.roleCode === 'DATA_ADMIN';
    const isDirector = user.roleCode === 'DIRECTOR';
    const canUpdateCategory = isAdmin;
    const canUpdateStatus = isAdmin || isDirector;

    const FIELD_REPORT_CATEGORIES = [
      { value: 'INCIDENT', label: 'Sự cố / Nguy cơ' },
      { value: 'INSPECTION', label: 'Kiểm tra hiện trường' },
      { value: 'OPERATIONS', label: 'Vận hành / Bảo dưỡng' },
      { value: 'PROGRESS', label: 'Tiến độ công việc' },
      { value: 'ENTERPRISE_ACTIVITY', label: 'Hoạt động doanh nghiệp' },
      { value: 'NOTICE', label: 'Thông báo / Chỉ đạo' },
      { value: 'PENDING_CLASSIFICATION', label: 'Chờ phân loại' },
    ];

    const FIELD_REPORT_STATUSES = [
      { value: 'NEW', label: 'Mới tiếp nhận' },
      { value: 'REVIEWED', label: 'Đã xem' },
      { value: 'CONVERTED', label: 'Đã chuyển đổi' },
      { value: 'ARCHIVED', label: 'Lưu trữ' },
    ];

    const [activeTab, setActiveTab] = useState<'reports' | 'incidents' | 'orders'>(initialTab ?? 'reports');
    const [parkFilter, setParkFilter] = useState(initialPark ?? '');
    const [severityFilter, setSeverityFilter] = useState('');
    const [selectedIncident, setSelectedIncident] = useState<MaintenanceIncident | null>(null);
    const [reportCategoryFilter, setReportCategoryFilter] = useState('');
    const [reportStatusFilter, setReportStatusFilter] = useState('');
    const [reportSearchFilter, setReportSearchFilter] = useState('');
    const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);
    const [reportNotes, setReportNotes] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportActionError, setReportActionError] = useState<string | null>(null);
    const [reportActionSuccess, setReportActionSuccess] = useState<string | null>(null);
    const [deletingReport, setDeletingReport] = useState<FieldReport | null>(null);
    const [reportDeleteError, setReportDeleteError] = useState<string | null>(null);
    const [convertMode, setConvertMode] = useState<'NONE' | 'INCIDENT' | 'ORDER'>('NONE');
    const [convertIncidentForm, setConvertIncidentForm] = useState({
            assignedTo: '',
            targetResolutionDays: 3,
            assetId: '',
          });
    const [convertOrderForm, setConvertOrderForm] = useState({
            assignedTo: '',
            assetId: '',
            orderType: 'CORRECTIVE',
            priority: 'NORMAL',
            scheduledStart: new Date().toISOString().substring(0, 10),
            scheduledEnd: new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10),
            notes: '',
          });
    useEffect(() => {
    if (initialPark !== undefined) setParkFilter(initialPark)
    }, [initialPark])
    useEffect(() => {
    setActiveTab(initialTab ?? 'reports')
    }, [initialTab])
    const parksQuery = useApiData<EnterprisePark[]>(`/enterprises/parks?year=${timeFilter.year}`, user);
    const assetsQuery = useApiData<InfrastructureAsset[]>('/infrastructure/assets', user);
    const reportParams = new URLSearchParams();
    if (parkFilter) reportParams.append('parkCode', parkFilter)
    if (reportCategoryFilter) reportParams.append('category', reportCategoryFilter)
    if (severityFilter) reportParams.append('severity', severityFilter)
    if (reportStatusFilter) reportParams.append('status', reportStatusFilter)
    if (reportSearchFilter) reportParams.append('search', reportSearchFilter)
    if (timeFilter.fromDate) reportParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) reportParams.append('toDate', timeFilter.toDate)
    const fieldReportsQuery = useApiData<{
            data: FieldReport[]
            stats: { total: number; new: number; reviewed: number; converted: number; archived: number }
          }>(
            `/maintenance/field-reports${reportParams.toString() ? `?${reportParams.toString()}` : ''}`,
            user,
          );
    const fieldReports = fieldReportsQuery.data?.data ?? [];
    const reportStats = fieldReportsQuery.data?.stats ?? { total: 0, new: 0, reviewed: 0, converted: 0, archived: 0 };
    const incidentParams = new URLSearchParams();
    if (parkFilter) incidentParams.append('parkCode', parkFilter)
    if (severityFilter) incidentParams.append('severity', severityFilter)
    if (timeFilter.fromDate) incidentParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) incidentParams.append('toDate', timeFilter.toDate)
    const incidentsQuery = useApiData<MaintenanceIncident[]>(
            `/maintenance/incidents${incidentParams.toString() ? `?${incidentParams.toString()}` : ''}`,
            user,
          );
    const orderParams = new URLSearchParams();
    if (parkFilter) orderParams.append('parkCode', parkFilter)
    if (timeFilter.fromDate) orderParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) orderParams.append('toDate', timeFilter.toDate)
    const ordersQuery = useApiData<MaintenanceOrder[]>(
            `/maintenance/orders${orderParams.toString() ? `?${orderParams.toString()}` : ''}`,
            user,
          );
    const [incidentModalOpen, setIncidentModalOpen] = useState(false);
    const [editingIncident, setEditingIncident] = useState<MaintenanceIncident | null>(null);
    const [deletingIncident, setDeletingIncident] = useState<MaintenanceIncident | null>(null);
    const [incidentForm, setIncidentForm] = useState({
            title: '',
            severity: 'MEDIUM',
            parkCode: '',
            locationDetail: '',
            assetId: '',
            currentStatus: 'OPEN',
            assignedTo: '',
            targetResolutionDays: 3,
            rootCause: '',
            mitigationActions: '',
          });
    const [incidentSubmitting, setIncidentSubmitting] = useState(false);
    const [incidentError, setIncidentError] = useState<string | null>(null);
    const [incidentDeleteError, setIncidentDeleteError] = useState<string | null>(null);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<MaintenanceOrder | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<MaintenanceOrder | null>(null);
    const [orderForm, setOrderForm] = useState({
            title: '',
            assetId: '',
            incidentId: '',
            orderType: 'ROUTINE',
            priority: 'NORMAL',
            assignedTo: '',
            scheduledStart: '',
            scheduledEnd: '',
            actualCost: 0,
            status: 'PENDING',
            notes: '',
          });
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [orderDeleteError, setOrderDeleteError] = useState<string | null>(null);
    const incidents = incidentsQuery.data ?? [];
    const orders = ordersQuery.data ?? [];
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
    }, [realtimeSignal?.tick])
    useEffect(() => {
    if (!deletedRecord) return
    if (deletedRecord.entityType === 'field_report' && selectedReport?.id === deletedRecord.entityId) {
      setSelectedReport(null)
    }
    if (deletedRecord.entityType === 'incident' && selectedIncident?.id === deletedRecord.entityId) {
      setSelectedIncident(null)
    }
    if (deletedRecord.entityType === 'work_order' && editingOrder?.id === deletedRecord.entityId) {
      setEditingOrder(null)
      setOrderModalOpen(false)
    }
    }, [deletedRecord, selectedReport?.id, selectedIncident?.id, editingOrder?.id])
    useEffect(() => {
    if (selectedReport && fieldReports.length > 0) {
      const current = fieldReports.find((r) => r.id === selectedReport.id)
      if (current && (current.status !== selectedReport.status || current.notes !== selectedReport.notes)) {
        setSelectedReport(current)
      }
    }
    }, [fieldReports, selectedReport])
    useEffect(() => {
    if (!initialTargetId) return
    if (activeTab === 'reports' && fieldReports.length > 0) {
      const match = fieldReports.find((r) => r.id === initialTargetId)
      if (match) setSelectedReport(match)
    } else if (activeTab === 'incidents' && incidents.length > 0) {
      const match = incidents.find((i) => i.id === initialTargetId)
      if (match) setSelectedIncident(match)
    } else if (activeTab === 'orders' && orders.length > 0) {
      const match = orders.find((o) => o.id === initialTargetId)
      if (match) {
        setEditingOrder(match)
        setOrderModalOpen(true)
      }
    }
    }, [initialTargetId, activeTab, fieldReports, incidents, orders])
    const openIncidents = incidents.filter((i) => i.currentStatus === 'OPEN').length;
    const inProgressIncidents = incidents.filter((i) => i.currentStatus === 'IN_PROGRESS' || i.currentStatus === 'INVESTIGATING').length;
    const activeOrders = orders.filter((o) => o.status === 'IN_PROGRESS').length;
    const overdueOrders = orders.filter((o) => o.isOverdue).length;

    async function handleCompleteOrder(orderId: string) {
        if (!isAdmin) return
        try {
          await fetchApi(`/maintenance/orders/${orderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'COMPLETED' }),
          })
          ordersQuery.refresh()
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Không thể cập nhật')
        }
    }

    async function handleUpdateReportCategory(reportId: string, category: string) {
        if (!canUpdateCategory) return
        try {
          setReportSubmitting(true)
          setReportActionError(null)
          setReportActionSuccess(null)
          await fetchApi(`/maintenance/field-reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          })
          fieldReportsQuery.refresh()
          setReportActionSuccess(`Đã cập nhật phân loại báo cáo thành: ${fieldReportCategoryLabel(category)}`)
          if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport((prev) => prev ? { ...prev, category: category as any } : null)
          }
        } catch (err: any) {
          setReportActionError(err.message || 'Lỗi cập nhật phân loại báo cáo')
        } finally {
          setReportSubmitting(false)
        }
    }

    async function handleUpdateReportStatus(reportId: string, status: string) {
        if (!canUpdateStatus) return
        try {
          setReportSubmitting(true)
          setReportActionError(null)
          setReportActionSuccess(null)
          await fetchApi(`/maintenance/field-reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
          fieldReportsQuery.refresh()
          setReportActionSuccess(`Đã cập nhật trạng thái báo cáo thành: ${fieldReportStatusLabel(status)}`)
          if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport((prev) => prev ? { ...prev, status: status as any } : null)
          }
        } catch (err: any) {
          setReportActionError(err.message || 'Lỗi cập nhật trạng thái báo cáo')
        } finally {
          setReportSubmitting(false)
        }
    }

    async function handleSaveReportNotes(reportId: string) {
        try {
          setReportSubmitting(true)
          setReportActionError(null)
          setReportActionSuccess(null)
          await fetchApi(`/maintenance/field-reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: reportNotes }),
          })
          fieldReportsQuery.refresh()
          setReportActionSuccess('Đã lưu ghi chú điều hành thành công')
          if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport((prev) => prev ? { ...prev, notes: reportNotes } : null)
          }
        } catch (err: any) {
          setReportActionError(err.message || 'Lỗi lưu ghi chú')
        } finally {
          setReportSubmitting(false)
        }
    }

    async function handleDeleteReportConfirm() {
        if (!deletingReport || !isAdmin) return
        setReportSubmitting(true)
        setReportDeleteError(null)
        try {
          await fetchApi(`/maintenance/field-reports/${deletingReport.id}`, { method: 'DELETE' })
          setDeletingReport(null)
          if (selectedReport?.id === deletingReport.id) setSelectedReport(null)
          fieldReportsQuery.refresh()
        } catch (err) {
          setReportDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa báo cáo hiện trường')
        } finally {
          setReportSubmitting(false)
        }
    }

    async function handleConvertToIncident(reportId: string) {
        try {
          setReportSubmitting(true)
          setReportActionError(null)
          setReportActionSuccess(null)
          const res = await fetchApi<{ success: boolean; data: any; message: string }>(`/maintenance/field-reports/${reportId}/convert-to-incident`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(convertIncidentForm),
          })
          fieldReportsQuery.refresh()
          incidentsQuery.refresh()
          setConvertMode('NONE')
          setReportActionSuccess(res.message || 'Chuyển đổi sang Sự cố thành công')
          setSelectedReport(null)
        } catch (err: any) {
          setReportActionError(err.message || 'Lỗi chuyển đổi sang sự cố')
        } finally {
          setReportSubmitting(false)
        }
    }

    async function handleConvertToWorkOrder(reportId: string) {
        try {
          setReportSubmitting(true)
          setReportActionError(null)
          setReportActionSuccess(null)
          const res = await fetchApi<{ success: boolean; data: any; message: string }>(`/maintenance/field-reports/${reportId}/convert-to-work-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(convertOrderForm),
          })
          fieldReportsQuery.refresh()
          ordersQuery.refresh()
          setConvertMode('NONE')
          setReportActionSuccess(res.message || 'Chuyển đổi sang Lệnh bảo dưỡng thành công')
          setSelectedReport(null)
        } catch (err: any) {
          setReportActionError(err.message || 'Lỗi chuyển đổi sang lệnh bảo dưỡng')
        } finally {
          setReportSubmitting(false)
        }
    }

    function handleOpenAddIncident() {
        setEditingIncident(null)
        setIncidentForm({
          title: '',
          severity: 'MEDIUM',
          parkCode: parksQuery.data?.[0]?.code ?? '',
          locationDetail: '',
          assetId: '',
          currentStatus: 'OPEN',
          assignedTo: '',
          targetResolutionDays: 3,
          rootCause: '',
          mitigationActions: '',
        })
        setIncidentError(null)
        setIncidentModalOpen(true)
    }

    function handleOpenEditIncident(inc: MaintenanceIncident) {
        setEditingIncident(inc)
        setIncidentForm({
          title: inc.title,
          severity: inc.severity,
          parkCode: inc.parkCode,
          locationDetail: inc.locationDetail,
          assetId: inc.assetId ?? '',
          currentStatus: inc.currentStatus,
          assignedTo: inc.assignedTo ?? '',
          targetResolutionDays: 3,
          rootCause: inc.rootCause ?? '',
          mitigationActions: inc.mitigationActions ?? '',
        })
        setIncidentError(null)
        setIncidentModalOpen(true)
    }

    async function handleSaveIncident(e: React.FormEvent) {
        e.preventDefault()
        setIncidentSubmitting(true)
        setIncidentError(null)
        try {
          if (editingIncident) {
            await fetchApi(`/maintenance/incidents/${editingIncident.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                title: incidentForm.title.trim(),
                severity: incidentForm.severity,
                parkCode: incidentForm.parkCode,
                locationDetail: incidentForm.locationDetail.trim(),
                assetId: incidentForm.assetId || null,
                currentStatus: incidentForm.currentStatus,
                assignedTo: incidentForm.assignedTo.trim() || null,
                rootCause: incidentForm.rootCause.trim() || null,
                mitigationActions: incidentForm.mitigationActions.trim() || null,
              }),
            })
          } else {
            await fetchApi('/maintenance/incidents', {
              method: 'POST',
              body: JSON.stringify({
                title: incidentForm.title.trim(),
                severity: incidentForm.severity,
                parkCode: incidentForm.parkCode,
                locationDetail: incidentForm.locationDetail.trim(),
                assetId: incidentForm.assetId || undefined,
                currentStatus: incidentForm.currentStatus,
                assignedTo: incidentForm.assignedTo.trim() || undefined,
                targetResolutionDays: Number(incidentForm.targetResolutionDays) || 3,
                rootCause: incidentForm.rootCause.trim() || undefined,
                mitigationActions: incidentForm.mitigationActions.trim() || undefined,
              }),
            })
          }
          setIncidentModalOpen(false)
          incidentsQuery.refresh()
        } catch (err) {
          setIncidentError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu sự cố')
        } finally {
          setIncidentSubmitting(false)
        }
    }

    async function handleDeleteIncidentConfirm() {
        if (!deletingIncident) return
        setIncidentSubmitting(true)
        setIncidentDeleteError(null)
        try {
          await fetchApi(`/maintenance/incidents/${deletingIncident.id}`, {
            method: 'DELETE',
          })
          setDeletingIncident(null)
          incidentsQuery.refresh()
        } catch (err) {
          setIncidentDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa sự cố')
        } finally {
          setIncidentSubmitting(false)
        }
    }

    function handleOpenAddOrder() {
        setEditingOrder(null)
        const today = new Date().toISOString().substring(0, 10);
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
        setOrderForm({
          title: '',
          assetId: assetsQuery.data?.[0]?.id ?? '',
          incidentId: '',
          orderType: 'ROUTINE',
          priority: 'NORMAL',
          assignedTo: '',
          scheduledStart: today,
          scheduledEnd: nextWeek,
          actualCost: 0,
          status: 'PENDING',
          notes: '',
        })
        setOrderError(null)
        setOrderModalOpen(true)
    }

    function handleOpenEditOrder(ord: MaintenanceOrder) {
        setEditingOrder(ord)
        setOrderForm({
          title: ord.title,
          assetId: ord.assetId,
          incidentId: ord.incidentId ?? '',
          orderType: ord.orderType,
          priority: ord.priority,
          assignedTo: ord.assignedTo,
          scheduledStart: ord.scheduledStart ? ord.scheduledStart.substring(0, 10) : '',
          scheduledEnd: ord.scheduledEnd ? ord.scheduledEnd.substring(0, 10) : '',
          actualCost: ord.actualCost ?? 0,
          status: ord.status,
          notes: ord.notes ?? '',
        })
        setOrderError(null)
        setOrderModalOpen(true)
    }

    async function handleSaveOrder(e: React.FormEvent) {
        e.preventDefault()
        setOrderSubmitting(true)
        setOrderError(null)
        try {
          if (editingOrder) {
            await fetchApi(`/maintenance/orders/${editingOrder.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                title: orderForm.title.trim(),
                assetId: orderForm.assetId,
                incidentId: orderForm.incidentId || null,
                orderType: orderForm.orderType,
                priority: orderForm.priority,
                assignedTo: orderForm.assignedTo.trim(),
                scheduledStart: orderForm.scheduledStart,
                scheduledEnd: orderForm.scheduledEnd,
                actualCost: Number(orderForm.actualCost) || 0,
                status: orderForm.status,
                notes: orderForm.notes.trim() || null,
              }),
            })
          } else {
            await fetchApi('/maintenance/orders', {
              method: 'POST',
              body: JSON.stringify({
                title: orderForm.title.trim(),
                assetId: orderForm.assetId,
                incidentId: orderForm.incidentId || undefined,
                orderType: orderForm.orderType,
                priority: orderForm.priority,
                assignedTo: orderForm.assignedTo.trim(),
                scheduledStart: orderForm.scheduledStart,
                scheduledEnd: orderForm.scheduledEnd,
                actualCost: Number(orderForm.actualCost) || 0,
                status: orderForm.status,
                notes: orderForm.notes.trim() || undefined,
              }),
            })
          }
          setOrderModalOpen(false)
          ordersQuery.refresh()
        } catch (err) {
          setOrderError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu lệnh công tác')
        } finally {
          setOrderSubmitting(false)
        }
    }

    async function handleDeleteOrderConfirm() {
        if (!deletingOrder) return
        setOrderSubmitting(true)
        setOrderDeleteError(null)
        try {
          await fetchApi(`/maintenance/orders/${deletingOrder.id}`, {
            method: 'DELETE',
          })
          setDeletingOrder(null)
          ordersQuery.refresh()
        } catch (err) {
          setOrderDeleteError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa lệnh công tác')
        } finally {
          setOrderSubmitting(false)
        }
    }

    return (
    <div className="content-stack">
      <PageTitle
        title="Báo cáo hiện trường & Bảo trì KCN"
        detail={`Tiếp nhận báo cáo hiện trường/Zalo, theo dõi xử lý sự cố kỹ thuật và lệnh duy tu bảo dưỡng · ${timeFilter.periodLabel}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <div className="segmented-control" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'reports'}
                className={activeTab === 'reports' ? 'segment-active' : ''}
                onClick={() => setActiveTab('reports')}
              >
                <Icon name="activity" size={16} /> Báo cáo hiện trường ({fieldReports.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'incidents'}
                className={activeTab === 'incidents' ? 'segment-active' : ''}
                onClick={() => setActiveTab('incidents')}
              >
                <Icon name="alert" size={16} /> Sự cố & Nguy cơ ({incidents.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'orders'}
                className={activeTab === 'orders' ? 'segment-active' : ''}
                onClick={() => setActiveTab('orders')}
              >
                <Icon name="wrench" size={16} /> Lệnh công việc ({orders.length})
              </button>
            </div>
            {isAdmin && activeTab === 'incidents' && (
              <button
                type="button"
                className="glass-button glass-button-primary"
                onClick={handleOpenAddIncident}
              >
                <Icon name="plus" size={15} /> Ghi nhận sự cố
              </button>
            )}
            {isAdmin && activeTab === 'orders' && (
              <button
                type="button"
                className="glass-button glass-button-primary"
                onClick={handleOpenAddOrder}
              >
                <Icon name="plus" size={15} /> Tạo lệnh duy tu
              </button>
            )}
          </div>
        }
      />

      {activeTab === 'reports' ? (
        <section className="metrics-grid-4">
          <MetricCard
            icon="activity"
            label="Tổng báo cáo hiện trường"
            value={String(reportStats.total)}
            detail="Tiếp nhận từ kênh hiện trường & Zalo"
          />
          <MetricCard
            icon="alert"
            label="Mới tiếp nhận / Chờ duyệt"
            value={String(reportStats.new)}
            detail="Cần xem xét & xử lý phân loại"
            tone={reportStats.new > 0 ? 'accent' : 'neutral'}
          />
          <MetricCard
            icon="check"
            label="Đã đánh giá / Theo dõi"
            value={String(reportStats.reviewed)}
            detail="Nội dung đã được xác nhận"
          />
          <MetricCard
            icon="wrench"
            label="Đã chuyển đổi Sự cố / Lệnh"
            value={String(reportStats.converted)}
            detail="Đã chuyển sang quy trình xử lý kỹ thuật"
            tone="accent"
          />
        </section>
      ) : (
        <section className="metrics-grid-4">
          <MetricCard
            icon="alert"
            label="Sự cố mới ghi nhận"
            value={String(openIncidents)}
            detail="Cần khảo sát & phân công"
            tone={openIncidents > 0 ? 'accent' : 'neutral'}
          />
          <MetricCard
            icon="activity"
            label="Sự cố đang xử lý"
            value={String(inProgressIncidents)}
            detail="Đang khắc phục hiện trường"
          />
          <MetricCard
            icon="wrench"
            label="Lệnh bảo trì đang thực hiện"
            value={String(activeOrders)}
            detail="Duy tu định kỳ & đột xuất"
            tone="accent"
          />
          <MetricCard
            icon="flame"
            label="Hạng mục quá hạn"
            value={String(overdueOrders)}
            detail={overdueOrders > 0 ? 'Cảnh báo tiến độ' : (orders.length === 0 ? 'Chưa có dữ liệu' : 'Đang đáp ứng tiến độ')}
          />
        </section>
      )}

      {activeTab === 'reports' ? (
        <section className="glass-panel panel distribution-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
                PHÂN LOẠI BÁO CÁO HIỆN TRƯỜNG KCN
              </span>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-ink)', fontWeight: 600 }}>
                {reportStats.total} tin báo hiện trường · {reportStats.new} tin mới chờ duyệt · {reportStats.converted} đã lập sự cố/lệnh
              </h4>
            </div>
            <div className="distribution-legend">
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-negative)' }} />
                Sự cố / Nguy cơ ({fieldReports.filter((r) => r.category === 'INCIDENT').length})
              </span>
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-accent)' }} />
                Kiểm tra / Vận hành ({fieldReports.filter((r) => r.category === 'INSPECTION' || r.category === 'OPERATIONS').length})
              </span>
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-positive)' }} />
                DN / Tiến độ / Thông báo ({fieldReports.filter((r) => r.category === 'ENTERPRISE_ACTIVITY' || r.category === 'PROGRESS' || r.category === 'NOTICE').length})
              </span>
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-subtle)' }} />
                Chờ phân loại ({fieldReports.filter((r) => r.category === 'PENDING_CLASSIFICATION' || !['INCIDENT', 'INSPECTION', 'OPERATIONS', 'ENTERPRISE_ACTIVITY', 'PROGRESS', 'NOTICE'].includes(r.category)).length})
              </span>
            </div>
          </div>

          <div className="distribution-bar-track">
            <div
              className="distribution-bar-segment"
              style={{
                width: `${fieldReports.length ? (fieldReports.filter((r) => r.category === 'INCIDENT').length / fieldReports.length) * 100 : 0}%`,
                background: 'var(--color-negative)',
              }}
            />
            <div
              className="distribution-bar-segment"
              style={{
                width: `${fieldReports.length ? (fieldReports.filter((r) => r.category === 'INSPECTION' || r.category === 'OPERATIONS').length / fieldReports.length) * 100 : 0}%`,
                background: 'var(--color-accent)',
              }}
            />
            <div
              className="distribution-bar-segment"
              style={{
                width: `${fieldReports.length ? (fieldReports.filter((r) => r.category === 'ENTERPRISE_ACTIVITY' || r.category === 'PROGRESS' || r.category === 'NOTICE').length / fieldReports.length) * 100 : 0}%`,
                background: 'var(--color-positive)',
              }}
            />
            <div
              className="distribution-bar-segment"
              style={{
                width: `${fieldReports.length ? (fieldReports.filter((r) => r.category === 'PENDING_CLASSIFICATION' || !['INCIDENT', 'INSPECTION', 'OPERATIONS', 'ENTERPRISE_ACTIVITY', 'PROGRESS', 'NOTICE'].includes(r.category)).length / fieldReports.length) * 100 : 0}%`,
                background: 'var(--color-subtle)',
              }}
            />
          </div>
        </section>
      ) : (
        <section className="glass-panel panel distribution-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
                TIẾN ĐỘ XỬ LÝ SỰ CỐ & LỆNH CÔNG TÁC
              </span>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-ink)', fontWeight: 600 }}>
                {incidents.length} sự cố kỹ thuật hạ tầng · {orders.length} lệnh duy tu bảo dưỡng ({orders.filter((o) => o.status === 'COMPLETED').length} đã nghiệm thu)
              </h4>
            </div>
            <div className="distribution-legend">
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-negative)' }} />
                Nguy hiểm / Cao ({incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length})
              </span>
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-warning)' }} />
                Trung bình ({incidents.filter((i) => i.severity === 'MEDIUM').length})
              </span>
              <span className="distribution-legend-item">
                <i className="distribution-legend-dot" style={{ background: 'var(--color-positive)' }} />
                Đã nghiệm thu lệnh ({orders.filter((o) => o.status === 'COMPLETED').length})
              </span>
            </div>
          </div>

          <div className="distribution-bar-track">
            <div
              className="distribution-bar-segment"
              style={{
                width: `${incidents.length ? (incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length / incidents.length) * 100 : 0}%`,
                background: 'var(--color-negative)',
              }}
            />
            <div
              className="distribution-bar-segment"
              style={{
                width: `${incidents.length ? (incidents.filter((i) => i.severity === 'MEDIUM').length / incidents.length) * 100 : 0}%`,
                background: 'var(--color-warning)',
              }}
            />
            <div
              className="distribution-bar-segment"
              style={{
                width: `${incidents.length ? (incidents.filter((i) => i.severity === 'LOW' || i.currentStatus === 'RESOLVED' || i.currentStatus === 'CLOSED').length / incidents.length) * 100 : 0}%`,
                background: 'var(--color-positive)',
              }}
            />
          </div>
        </section>
      )}

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
        {activeTab === 'reports' && (
          <>
            <GlassSelect
              value={reportCategoryFilter}
              onChange={setReportCategoryFilter}
              label="Phân loại"
              icon="activity"
              ariaLabel="Chọn phân loại báo cáo"
              placeholder="Tất cả loại tin"
              options={[
                { value: '', label: 'Tất cả loại tin' },
                { value: 'INCIDENT', label: 'Sự cố / Nguy cơ' },
                { value: 'INSPECTION', label: 'Kiểm tra hiện trường' },
                { value: 'OPERATIONS', label: 'Vận hành / Bảo dưỡng' },
                { value: 'PROGRESS', label: 'Tiến độ công việc' },
                { value: 'ENTERPRISE_ACTIVITY', label: 'Hoạt động doanh nghiệp' },
                { value: 'NOTICE', label: 'Thông báo / Chỉ đạo' },
                { value: 'PENDING_CLASSIFICATION', label: 'Chờ phân loại' },
              ]}
            />
            <GlassSelect
              value={reportStatusFilter}
              onChange={setReportStatusFilter}
              label="Trạng thái"
              icon="check"
              ariaLabel="Chọn trạng thái báo cáo"
              placeholder="Tất cả trạng thái"
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'NEW', label: 'Mới tiếp nhận' },
                { value: 'REVIEWED', label: 'Đã xem xét' },
                { value: 'CONVERTED', label: 'Đã chuyển đổi' },
                { value: 'ARCHIVED', label: 'Đã lưu trữ / Bỏ qua' },
              ]}
            />
            <GlassSelect
              value={severityFilter}
              onChange={setSeverityFilter}
              label="Mức độ"
              icon="alert"
              ariaLabel="Chọn mức độ"
              placeholder="Tất cả mức độ"
              options={[
                { value: '', label: 'Tất cả mức độ' },
                { value: 'CRITICAL', label: 'Khẩn cấp' },
                { value: 'HIGH', label: 'Cao' },
                { value: 'MEDIUM', label: 'Trung bình' },
                { value: 'LOW', label: 'Thấp' },
              ]}
            />
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="crud-form-input"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                placeholder="Tìm người báo cáo, nội dung, mã..."
                value={reportSearchFilter}
                onChange={(e) => setReportSearchFilter(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="glass-button"
              onClick={() => fieldReportsQuery.refresh()}
              title="Tải lại danh sách"
            >
              <Icon name="activity" size={14} /> Làm mới
            </button>
          </>
        )}
        {activeTab === 'incidents' && (
          <GlassSelect
            value={severityFilter}
            onChange={setSeverityFilter}
            label="Mức độ"
            icon="alert"
            ariaLabel="Chọn mức độ nghiêm trọng"
            placeholder="Tất cả mức độ"
            options={[
              { value: '', label: 'Tất cả mức độ' },
              { value: 'CRITICAL', label: 'Khẩn cấp' },
              { value: 'HIGH', label: 'Cao' },
              { value: 'MEDIUM', label: 'Trung bình' },
              { value: 'LOW', label: 'Thấp' },
            ]}
          />
        )}
      </div>

      {activeTab === 'reports' ? (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Sổ tiếp nhận báo cáo hiện trường từ Zalo & Kỹ thuật viên"
            meta={<span className="panel-count">{fieldReports.length} báo cáo</span>}
          />
          {fieldReportsQuery.loading ? (
            <LoadingBlock label="Đang tải danh sách báo cáo hiện trường" />
          ) : fieldReportsQuery.error ? (
            <ErrorBlock message={fieldReportsQuery.error} />
          ) : fieldReports.length ? (
            <DataTable minWidth="1100px">
              <thead>
                <tr>
                  <th>Mã / Tiêu đề báo cáo</th>
                  <th>Phân loại</th>
                  <th>Mức độ</th>
                  <th>KCN & Vị trí</th>
                  <th>Người báo cáo</th>
                  <th>Thời gian gửi</th>
                  <th>Trạng thái</th>
                  <th>Liên kết xử lý</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {fieldReports.map((rep) => (
                  <tr
                    key={rep.id}
                    onClick={() => {
                      setSelectedReport(rep)
                      setReportNotes(rep.notes || '')
                      setConvertMode('NONE')
                      setReportActionError(null)
                      setReportActionSuccess(null)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="cell-strong">
                      <span>{rep.title}</span>
                      <span className="cell-subtle">
                        {rep.reportCode} · {rep.content.length > 55 ? `${rep.content.substring(0, 55)}...` : rep.content}
                      </span>
                    </td>
                    <td>
                      {canUpdateCategory ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                          <select
                            className={`status-badge status-${fieldReportCategoryTone(rep.category)} table-badge-select`}
                            value={rep.category}
                            aria-label={`Thay đổi phân loại báo cáo ${rep.reportCode}`}
                            onChange={(e) => handleUpdateReportCategory(rep.id, e.target.value)}
                            disabled={reportSubmitting}
                            title="Chọn phân loại trực tiếp (Quản trị viên)"
                          >
                            {FIELD_REPORT_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Badge tone={fieldReportCategoryTone(rep.category)}>
                          {fieldReportCategoryLabel(rep.category)}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={fieldReportSeverityTone(rep.severity)}>
                        {fieldReportSeverityLabel(rep.severity)}
                      </Badge>
                    </td>
                    <td>
                      <span>{rep.locationDetail === 'Chưa xác định' ? 'Chưa xác định' : rep.parkName || rep.parkCode || 'Chưa xác định'}</span>
                      <span className="cell-subtle">{rep.locationDetail || 'Hiện trường'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{rep.reporterName}</span>
                      <span className="cell-subtle">{rep.rawReporterName ? `Zalo: ${rep.rawReporterName}` : (rep.source === 'ZALO' ? 'Nhóm Zalo ĐVCI' : rep.source)}</span>
                    </td>
                    <td>
                      <span>{formatDate(rep.reportedAt)}</span>
                    </td>
                    <td>
                      {canUpdateStatus ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                          <select
                            className={`status-badge status-${fieldReportStatusTone(rep.status)} table-badge-select`}
                            value={rep.status}
                            aria-label={`Thay đổi trạng thái báo cáo ${rep.reportCode}`}
                            onChange={(e) => handleUpdateReportStatus(rep.id, e.target.value)}
                            disabled={reportSubmitting}
                            title="Chọn trạng thái trực tiếp"
                          >
                            {FIELD_REPORT_STATUSES.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Badge tone={fieldReportStatusTone(rep.status)}>
                          {fieldReportStatusLabel(rep.status)}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {rep.linkedIncidentCode ? (
                        <span
                          className="badge"
                          style={{ background: 'var(--color-negative-soft)', color: 'var(--color-negative)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Đã tạo sự cố"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveTab('incidents')
                          }}
                        >
                          <Icon name="alert" size={12} /> {rep.linkedIncidentCode}
                        </span>
                      ) : rep.linkedWorkOrderCode ? (
                        <span
                          className="badge"
                          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Đã tạo lệnh bảo dưỡng"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveTab('orders')
                          }}
                        >
                          <Icon name="wrench" size={12} /> {rep.linkedWorkOrderCode}
                        </span>
                      ) : (
                        <span className="cell-subtle">Chưa chuyển</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions-cell" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => {
                            setSelectedReport(rep)
                            setReportNotes(rep.notes || '')
                            setConvertMode('NONE')
                            setReportActionError(null)
                            setReportActionSuccess(null)
                          }}
                          title="Xem chi tiết và xử lý"
                        >
                          <Icon name="edit" size={13} /> Xem / Xử lý
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="table-action-btn table-action-btn-danger"
                            onClick={() => {
                              setDeletingReport(rep)
                              setReportDeleteError(null)
                            }}
                            title="Xóa báo cáo hiện trường"
                            disabled={reportSubmitting}
                          >
                            <Icon name="trash" size={13} /> Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyBlock label="Không có báo cáo hiện trường nào trong phạm vi này" />
          )}
        </section>
      ) : activeTab === 'incidents' ? (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Sổ theo dõi sự cố và nguy cơ an toàn hạ tầng"
            meta={<span className="panel-count">{incidents.length} sự cố</span>}
          />
          {incidentsQuery.loading ? (
            <LoadingBlock label="Đang tải danh sách sự cố" />
          ) : incidentsQuery.error ? (
            <ErrorBlock message={incidentsQuery.error} />
          ) : incidents.length ? (
            <DataTable minWidth="1050px">
              <thead>
                <tr>
                  <th>Mã / Tiêu đề sự cố</th>
                  <th>Mức độ</th>
                  <th>KCN & Vị trí</th>
                  <th>Người báo cáo</th>
                  <th>Hạn xử lý</th>
                  <th>Biện pháp khắc phục tạm thời</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} onClick={() => setSelectedIncident(inc)} style={{ cursor: 'pointer' }}>
                    <td className="cell-strong">
                      <span>{inc.title}</span>
                      <span className="cell-subtle">
                        {inc.incidentCode} {inc.assetName ? `· ${inc.assetName}` : ''}
                      </span>
                    </td>
                    <td>
                      <Badge tone={incidentSeverityTone(inc.severity)}>
                        {incidentSeverityLabel(inc.severity)}
                      </Badge>
                    </td>
                    <td>
                      <span>{inc.parkName}</span>
                      <span className="cell-subtle">{inc.locationDetail}</span>
                    </td>
                    <td>{inc.assignedTo ?? 'Chưa xác định'}</td>
                    <td>
                      {inc.targetResolutionAt ? (
                        <span>{shortDate(inc.targetResolutionAt)}</span>
                      ) : (
                        <span className="cell-subtle">Không áp dụng</span>
                      )}
                    </td>
                    <td>
                      <span className="cell-subtle" title={inc.mitigationActions ?? ''}>
                        {inc.mitigationActions ? (inc.mitigationActions.length > 50 ? `${inc.mitigationActions.substring(0, 50)}...` : inc.mitigationActions) : 'Đang khảo sát'}
                      </span>
                    </td>
                    <td>
                      <Badge tone={incidentStatusTone(inc.currentStatus)}>
                        {incidentStatusLabel(inc.currentStatus)}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEditIncident(inc)
                            }}
                            title="Cập nhật sự cố"
                          >
                            <Icon name="edit" size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="table-action-btn table-action-btn-danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingIncident(inc)
                              setIncidentDeleteError(null)
                            }}
                            title="Xóa sự cố"
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
            <EmptyBlock label="Không có sự cố nào ghi nhận trong phạm vi này" />
          )}
        </section>
      ) : (
        <section className="glass-panel panel table-panel">
          <PanelHeading
            title="Lệnh công việc duy tu & bảo dưỡng định kỳ"
            meta={<span className="panel-count">{orders.length} lệnh công việc</span>}
          />
          {ordersQuery.loading ? (
            <LoadingBlock label="Đang tải danh mục lệnh công việc" />
          ) : ordersQuery.error ? (
            <ErrorBlock message={ordersQuery.error} />
          ) : orders.length ? (
            <DataTable minWidth="1050px">
              <thead>
                <tr>
                  <th>Mã lệnh / Tiêu đề</th>
                  <th>Loại hình</th>
                  <th>Công trình liên quan</th>
                  <th>Đơn vị thực hiện</th>
                  <th>Thời hạn</th>
                  <th className="align-right">Chi phí thực tế</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th style={{ width: '190px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="cell-strong">
                      <span>{ord.title}</span>
                      <span className="cell-subtle">{ord.orderCode}</span>
                    </td>
                    <td>
                      <Badge tone="neutral">{orderTypeLabel(ord.orderType)}</Badge>
                    </td>
                    <td>
                      <span>{ord.assetName}</span>
                      <span className="cell-subtle">{ord.assetCode}</span>
                    </td>
                    <td>{ord.assignedTo}</td>
                    <td>
                      <span>{shortDate(ord.scheduledStart)} - {shortDate(ord.scheduledEnd)}</span>
                      {ord.isOverdue && <Badge tone="negative">Quá hạn</Badge>}
                    </td>
                    <td className="align-right cell-strong">{formatCurrency(ord.actualCost)}</td>
                    <td>
                      <Badge tone={orderStatusTone(ord.status)}>
                        {orderStatusLabel(ord.status)}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="table-actions-cell">
                          {ord.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              className="table-action-btn"
                              style={{ color: 'var(--color-positive)', borderColor: 'var(--color-positive)' }}
                              onClick={() => handleCompleteOrder(ord.id)}
                              title="Nghiệm thu nhanh"
                            >
                              <Icon name="check" size={13} /> Nghiệm thu
                            </button>
                          )}
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleOpenEditOrder(ord)}
                            title="Sửa lệnh công tác"
                          >
                            <Icon name="edit" size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="table-action-btn table-action-btn-danger"
                            onClick={() => {
                              setDeletingOrder(ord)
                              setOrderDeleteError(null)
                            }}
                            title="Xóa lệnh công tác"
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
            <EmptyBlock label="Chưa có lệnh công việc duy tu nào" />
          )}
        </section>
      )}

      {incidentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !incidentSubmitting && setIncidentModalOpen(false)}
        >
          <div className="crud-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>{editingIncident ? 'Cập nhật sự cố kỹ thuật' : 'Ghi nhận sự cố kỹ thuật mới'}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIncidentModalOpen(false)}
                disabled={incidentSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveIncident}>
              <div className="crud-modal-body">
                {incidentError && (
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
                    <span>{incidentError}</span>
                  </div>
                )}
                <div className="crud-form-grid">
                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Tiêu đề sự cố / Hiện tượng <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={incidentForm.title}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="VD: Sạt lở mương thoát nước mưa trục D1"
                      disabled={incidentSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Khu công nghiệp <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={incidentForm.parkCode}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, parkCode: e.target.value }))}
                      disabled={incidentSubmitting}
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
                      Mức độ nghiêm trọng <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={incidentForm.severity}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, severity: e.target.value }))}
                      disabled={incidentSubmitting}
                    >
                      <option value="CRITICAL">Khẩn cấp / Nguy hiểm (CRITICAL)</option>
                      <option value="HIGH">Mức độ cao (HIGH)</option>
                      <option value="MEDIUM">Trung bình (MEDIUM)</option>
                      <option value="LOW">Thấp (LOW)</option>
                    </select>
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Vị trí chi tiết xảy ra sự cố <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={incidentForm.locationDetail}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, locationDetail: e.target.value }))}
                      placeholder="VD: Km 1+200, tuyến mương giáp hàng rào Công ty TNHH Thủy sản A"
                      disabled={incidentSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Công trình hạ tầng liên quan</label>
                    <select
                      className="crud-form-select"
                      value={incidentForm.assetId}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, assetId: e.target.value }))}
                      disabled={incidentSubmitting}
                    >
                      <option value="">-- Không xác định hoặc chung toàn khu --</option>
                      {(assetsQuery.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Trạng thái xử lý</label>
                    <select
                      className="crud-form-select"
                      value={incidentForm.currentStatus}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, currentStatus: e.target.value }))}
                      disabled={incidentSubmitting}
                    >
                      <option value="OPEN">Mới ghi nhận (OPEN)</option>
                      <option value="INVESTIGATING">Đang khảo sát (INVESTIGATING)</option>
                      <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
                      <option value="RESOLVED">Đã xử lý (RESOLVED)</option>
                      <option value="CLOSED">Đã đóng nghiệm thu (CLOSED)</option>
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Người báo cáo</label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={incidentForm.assignedTo}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, assignedTo: e.target.value }))}
                      placeholder="VD: Nguyễn Văn A (Người báo cáo)"
                      disabled={incidentSubmitting}
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Thời hạn xử lý (ngày)</label>
                    <input
                      type="number"
                      className="crud-form-input"
                      value={incidentForm.targetResolutionDays}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, targetResolutionDays: Number(e.target.value) }))}
                      min={1}
                      max={90}
                      disabled={incidentSubmitting}
                    />
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Nguyên nhân cốt lõi</label>
                    <textarea
                      className="crud-form-textarea"
                      value={incidentForm.rootCause}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, rootCause: e.target.value }))}
                      placeholder="Mưa lớn kéo dài gây sụt lún taluy mương đất..."
                      disabled={incidentSubmitting}
                    />
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Biện pháp khắc phục / Phòng ngừa</label>
                    <textarea
                      className="crud-form-textarea"
                      value={incidentForm.mitigationActions}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, mitigationActions: e.target.value }))}
                      placeholder="Đã giăng dây cảnh báo nguy hiểm, phủ bạt chống sạt..."
                      disabled={incidentSubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="crud-modal-footer">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setIncidentModalOpen(false)}
                  disabled={incidentSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="glass-button glass-button-primary"
                  disabled={incidentSubmitting}
                >
                  {incidentSubmitting ? 'Đang lưu...' : editingIncident ? 'Cập nhật sự cố' : 'Ghi nhận sự cố'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingIncident && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !incidentSubmitting && setDeletingIncident(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa sự cố kỹ thuật</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingIncident(null)}
                disabled={incidentSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {incidentDeleteError && (
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
                  <span>{incidentDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa hồ sơ sự cố <strong>{deletingIncident.title}</strong> (mã <code>{deletingIncident.incidentCode}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Lưu ý: Hệ thống sẽ từ chối xóa nếu sự cố đang có lệnh công việc duy tu tham chiếu.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingIncident(null)}
                disabled={incidentSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteIncidentConfirm}
                disabled={incidentSubmitting}
              >
                {incidentSubmitting ? 'Đang xóa...' : 'Xóa sự cố'}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !orderSubmitting && setOrderModalOpen(false)}
        >
          <div className="crud-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>{editingOrder ? 'Cập nhật lệnh duy tu bảo dưỡng' : 'Tạo lệnh duy tu, bảo dưỡng mới'}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOrderModalOpen(false)}
                disabled={orderSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOrder}>
              <div className="crud-modal-body">
                {orderError && (
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
                    <span>{orderError}</span>
                  </div>
                )}
                <div className="crud-form-grid">
                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Nội dung công việc <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={orderForm.title}
                      onChange={(e) => setOrderForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="VD: Nạo vét mương hở thoát nước mưa trục D1"
                      disabled={orderSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Công trình hạ tầng <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={orderForm.assetId}
                      onChange={(e) => setOrderForm((f) => ({ ...f, assetId: e.target.value }))}
                      disabled={orderSubmitting}
                      required
                    >
                      <option value="" disabled>-- Chọn công trình --</option>
                      {(assetsQuery.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Sự cố liên quan (nếu có)</label>
                    <select
                      className="crud-form-select"
                      value={orderForm.incidentId}
                      onChange={(e) => setOrderForm((f) => ({ ...f, incidentId: e.target.value }))}
                      disabled={orderSubmitting}
                    >
                      <option value="">-- Duy tu định kỳ / Không gắn sự cố --</option>
                      {(incidentsQuery.data ?? []).map((inc) => (
                        <option key={inc.id} value={inc.id}>{inc.incidentCode} - {inc.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Loại hình duy tu <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={orderForm.orderType}
                      onChange={(e) => setOrderForm((f) => ({ ...f, orderType: e.target.value as any }))}
                      disabled={orderSubmitting}
                    >
                      <option value="ROUTINE">Bảo dưỡng định kỳ (ROUTINE)</option>
                      <option value="CORRECTIVE">Sửa chữa khắc phục (CORRECTIVE)</option>
                      <option value="EMERGENCY">Ứng phó khẩn cấp (EMERGENCY)</option>
                      <option value="UPGRADE">Cải tạo nâng cấp (UPGRADE)</option>
                    </select>
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Mức độ ưu tiên <span className="required">*</span>
                    </label>
                    <select
                      className="crud-form-select"
                      value={orderForm.priority}
                      onChange={(e) => setOrderForm((f) => ({ ...f, priority: e.target.value as any }))}
                      disabled={orderSubmitting}
                    >
                      <option value="NORMAL">Bình thường (NORMAL)</option>
                      <option value="HIGH">Ưu tiên cao (HIGH)</option>
                      <option value="URGENT">Khẩn cấp (URGENT)</option>
                      <option value="LOW">Thấp (LOW)</option>
                    </select>
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">
                      Đơn vị / Người thực hiện <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="crud-form-input"
                      value={orderForm.assignedTo}
                      onChange={(e) => setOrderForm((f) => ({ ...f, assignedTo: e.target.value }))}
                      placeholder="VD: Tổ Thoát nước & Vệ sinh môi trường"
                      disabled={orderSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Ngày bắt đầu <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="crud-form-input"
                      value={orderForm.scheduledStart}
                      onChange={(e) => setOrderForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                      disabled={orderSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">
                      Hạn hoàn thành <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="crud-form-input"
                      value={orderForm.scheduledEnd}
                      onChange={(e) => setOrderForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                      disabled={orderSubmitting}
                      required
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Chi phí thực tế (VNĐ)</label>
                    <input
                      type="number"
                      className="crud-form-input"
                      value={orderForm.actualCost}
                      onChange={(e) => setOrderForm((f) => ({ ...f, actualCost: Number(e.target.value) }))}
                      min={0}
                      step={100000}
                      placeholder="0"
                      disabled={orderSubmitting}
                    />
                  </div>

                  <div className="crud-form-group">
                    <label className="crud-form-label">Trạng thái lệnh</label>
                    <select
                      className="crud-form-select"
                      value={orderForm.status}
                      onChange={(e) => setOrderForm((f) => ({ ...f, status: e.target.value as any }))}
                      disabled={orderSubmitting}
                    >
                      <option value="PENDING">Chờ triển khai (PENDING)</option>
                      <option value="IN_PROGRESS">Đang thi công (IN_PROGRESS)</option>
                      <option value="COMPLETED">Đã nghiệm thu (COMPLETED)</option>
                      <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                    </select>
                  </div>

                  <div className="crud-form-group full-width">
                    <label className="crud-form-label">Ghi chú kỹ thuật / Kết quả thi công</label>
                    <textarea
                      className="crud-form-textarea"
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Tiến độ thực tế, vật tư thay thế, kiến nghị bảo dưỡng tiếp theo..."
                      disabled={orderSubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="crud-modal-footer">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setOrderModalOpen(false)}
                  disabled={orderSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="glass-button glass-button-primary"
                  disabled={orderSubmitting}
                >
                  {orderSubmitting ? 'Đang lưu...' : editingOrder ? 'Cập nhật lệnh' : 'Tạo lệnh duy tu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !orderSubmitting && setDeletingOrder(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa lệnh duy tu</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingOrder(null)}
                disabled={orderSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {orderDeleteError && (
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
                  <span>{orderDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa lệnh công việc <strong>{deletingOrder.title}</strong> (mã <code>{deletingOrder.orderCode}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Thao tác này sẽ xóa vĩnh viễn dữ liệu lệnh công tác duy tu bảo dưỡng.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingOrder(null)}
                disabled={orderSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteOrderConfirm}
                disabled={orderSubmitting}
              >
                {orderSubmitting ? 'Đang xóa...' : 'Xóa lệnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIncident && (
        <div
          role="dialog"
          aria-modal="true"
          className="glass-modal-backdrop"
          onClick={() => setSelectedIncident(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '640px',
              width: '100%',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-panel)',
              padding: '1.75rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="cell-code" style={{ marginRight: '0.5rem' }}>{selectedIncident.incidentCode}</span>
                <Badge tone={incidentSeverityTone(selectedIncident.severity)}>
                  {incidentSeverityLabel(selectedIncident.severity)}
                </Badge>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedIncident(null)}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{selectedIncident.title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><strong>Khu công nghiệp:</strong> {selectedIncident.parkName}</div>
              <div><strong>Vị trí:</strong> {selectedIncident.locationDetail}</div>
              <div><strong>Người báo cáo:</strong> {selectedIncident.assignedTo ?? 'Chưa xác định'}</div>
              <div><strong>Hạn xử lý:</strong> {selectedIncident.targetResolutionAt ? shortDate(selectedIncident.targetResolutionAt) : 'Không có'}</div>
            </div>
            {selectedIncident.rootCause && (
              <div style={{ background: 'var(--color-surface-hover)', padding: '0.875rem', borderRadius: 'var(--radius-field)' }}>
                <strong>Nguyên nhân cốt lõi:</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--color-text-subtle)' }}>{selectedIncident.rootCause}</p>
              </div>
            )}
            {selectedIncident.mitigationActions && (
              <div style={{ background: 'var(--color-surface-hover)', padding: '0.875rem', borderRadius: 'var(--radius-field)' }}>
                <strong>Biện pháp khắc phục:</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--color-text-subtle)' }}>{selectedIncident.mitigationActions}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="glass-button" onClick={() => setSelectedIncident(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !reportSubmitting && setSelectedReport(null)}
        >
          <div
            className="crud-modal-card"
            style={{ maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="crud-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <span className="cell-code" style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {selectedReport.reportCode}
                </span>
                {canUpdateCategory ? (
                  <select
                    className={`status-badge status-${fieldReportCategoryTone(selectedReport.category)} table-badge-select`}
                    value={selectedReport.category}
                    aria-label={`Thay đổi phân loại báo cáo ${selectedReport.reportCode}`}
                    onChange={(e) => handleUpdateReportCategory(selectedReport.id, e.target.value)}
                    disabled={reportSubmitting}
                    title="Thay đổi phân loại trực tiếp (Quản trị viên)"
                  >
                    {FIELD_REPORT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={fieldReportCategoryTone(selectedReport.category)}>
                    {fieldReportCategoryLabel(selectedReport.category)}
                  </Badge>
                )}
                <Badge tone={fieldReportSeverityTone(selectedReport.severity)}>
                  {fieldReportSeverityLabel(selectedReport.severity)}
                </Badge>
                {canUpdateStatus ? (
                  <select
                    className={`status-badge status-${fieldReportStatusTone(selectedReport.status)} table-badge-select`}
                    value={selectedReport.status}
                    aria-label={`Thay đổi trạng thái báo cáo ${selectedReport.reportCode}`}
                    onChange={(e) => handleUpdateReportStatus(selectedReport.id, e.target.value)}
                    disabled={reportSubmitting}
                    title="Thay đổi trạng thái trực tiếp"
                  >
                    {FIELD_REPORT_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={fieldReportStatusTone(selectedReport.status)}>
                    {fieldReportStatusLabel(selectedReport.status)}
                  </Badge>
                )}
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedReport(null)}
                disabled={reportSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="crud-modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {reportActionError && (
                <div style={{
                  background: 'var(--color-negative-soft)',
                  color: 'var(--color-negative)',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-field)',
                  fontSize: '0.82rem',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Icon name="alert" size={16} />
                  <span>{reportActionError}</span>
                </div>
              )}

              {reportActionSuccess && (
                <div style={{
                  background: 'var(--color-positive-soft)',
                  color: 'var(--color-positive)',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-field)',
                  fontSize: '0.82rem',
                  border: '1px solid rgba(22, 163, 74, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Icon name="check" size={16} />
                  <span>{reportActionSuccess}</span>
                </div>
              )}

              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                  {selectedReport.title}
                </h3>
              </div>

              {/* Report Metadata */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                padding: '0.85rem',
                background: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-field)',
                fontSize: '0.85rem',
              }}>
                <div>
                  <span style={{ color: 'var(--color-subtle)', display: 'block', fontSize: '0.75rem' }}>NGƯỜI BÁO CÁO</span>
                  <strong>{selectedReport.reporterName}</strong>
                  {selectedReport.rawReporterName && (
                    <span style={{ display: 'block', color: 'var(--color-ink-muted)', fontSize: '0.78rem' }}>
                      Zalo gốc: {selectedReport.rawReporterName}
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: 'var(--color-subtle)', display: 'block', fontSize: '0.75rem' }}>THỜI GIAN TIẾP NHẬN</span>
                  <strong>{new Date(selectedReport.reportedAt).toLocaleString('vi-VN')}</strong>
                  <span style={{ display: 'block', color: 'var(--color-ink-muted)', fontSize: '0.78rem' }}>
                    Nguồn: {selectedReport.source === 'ZALO' ? 'Nhóm Zalo ĐVCI' : selectedReport.source}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-subtle)', display: 'block', fontSize: '0.75rem' }}>KHU CÔNG NGHIỆP</span>
                  <strong>{selectedReport.locationDetail === 'Chưa xác định' ? 'Chưa xác định' : selectedReport.parkName || selectedReport.parkCode || 'Chưa xác định'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-subtle)', display: 'block', fontSize: '0.75rem' }}>VỊ TRÍ CHI TIẾT</span>
                  <strong>{selectedReport.locationDetail || 'Hiện trường KCN'}</strong>
                </div>
              </div>

              {/* Raw Zalo Message Box */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="crud-form-label" style={{ margin: 0, fontWeight: 600 }}>
                    Nội dung tin nhắn gốc từ hiện trường (Zalo)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>Chế độ chỉ đọc</span>
                </div>
                <div style={{
                  background: 'var(--color-surface-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-field)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}>
                  {selectedReport.content}
                </div>
              </div>

              {/* Status Update Actions */}
              <div>
                <label className="crud-form-label" style={{ marginBottom: '0.4rem', fontWeight: 600 }}>
                  Trạng thái tiếp nhận & xử lý
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`glass-button ${selectedReport.status === 'NEW' ? 'glass-button-primary' : ''}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'NEW')}
                    disabled={reportSubmitting || selectedReport.status === 'NEW'}
                  >
                    Mới tiếp nhận
                  </button>
                  <button
                    type="button"
                    className={`glass-button ${selectedReport.status === 'REVIEWED' ? 'glass-button-primary' : ''}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'REVIEWED')}
                    disabled={reportSubmitting || selectedReport.status === 'REVIEWED'}
                  >
                    Đã xem xét / Theo dõi
                  </button>
                  <button
                    type="button"
                    className={`glass-button ${selectedReport.status === 'ARCHIVED' ? 'glass-button-primary' : ''}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'ARCHIVED')}
                    disabled={reportSubmitting || selectedReport.status === 'ARCHIVED'}
                  >
                    Lưu trữ / Bỏ qua
                  </button>
                </div>
              </div>

              {/* Operational Notes */}
              <div>
                <label className="crud-form-label" style={{ marginBottom: '0.4rem', fontWeight: 600 }}>
                  Ghi chú điều hành / Đánh giá nội bộ
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <textarea
                    className="crud-form-textarea"
                    rows={2}
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="Ghi chú đánh giá sơ bộ hiện trường, yêu cầu kiểm tra thực địa hoặc hướng dẫn kỹ thuật..."
                    disabled={reportSubmitting}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="glass-button glass-button-primary"
                    style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    onClick={() => handleSaveReportNotes(selectedReport.id)}
                    disabled={reportSubmitting}
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>

              {/* Conversion / Link Section */}
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-field)',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>Quy trình chuyển đổi kỹ thuật</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>
                      Chỉ chuyển thành Sự cố hoặc Lệnh bảo dưỡng khi cần can thiệp xử lý công trình
                    </span>
                  </div>

                  {/* Linked status indicator */}
                  {selectedReport.linkedIncidentCode && (
                    <Badge tone="negative">
                      Đã gắn Sự cố: {selectedReport.linkedIncidentCode}
                    </Badge>
                  )}
                  {selectedReport.linkedWorkOrderCode && (
                    <Badge tone="info">
                      Đã gắn Lệnh duy tu: {selectedReport.linkedWorkOrderCode}
                    </Badge>
                  )}
                </div>

                {convertMode === 'NONE' ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="glass-button"
                      style={{ borderColor: 'var(--color-negative)', color: 'var(--color-negative)' }}
                      onClick={() => {
                        setConvertIncidentForm({
                          assignedTo: selectedReport.reporterName !== 'Chưa xác định' ? selectedReport.reporterName : '',
                          targetResolutionDays: 3,
                          assetId: '',
                        })
                        setConvertMode('INCIDENT')
                      }}
                      disabled={reportSubmitting}
                    >
                      <Icon name="alert" size={15} /> Chuyển thành Sự cố kỹ thuật
                    </button>
                    <button
                      type="button"
                      className="glass-button"
                      style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                      onClick={() => {
                        setConvertOrderForm({
                          assignedTo: '',
                          assetId: '',
                          orderType: 'CORRECTIVE',
                          priority: selectedReport.severity === 'CRITICAL' || selectedReport.severity === 'HIGH' ? 'HIGH' : 'NORMAL',
                          scheduledStart: new Date().toISOString().substring(0, 10),
                          scheduledEnd: new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10),
                          notes: `Khởi tạo từ Báo cáo hiện trường ${selectedReport.reportCode}: ${selectedReport.title}`,
                        })
                        setConvertMode('ORDER')
                      }}
                      disabled={reportSubmitting}
                    >
                      <Icon name="wrench" size={15} /> Chuyển thành Lệnh bảo dưỡng
                    </button>
                  </div>
                ) : convertMode === 'INCIDENT' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-surface-hover)', padding: '0.85rem', borderRadius: 'var(--radius-field)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-negative)' }}>
                        Thiết lập thông tin Sự cố kỹ thuật
                      </strong>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setConvertMode('NONE')}
                        style={{ padding: '2px' }}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <div className="crud-form-grid">
                      <div className="crud-form-group">
                        <label className="crud-form-label">Kỹ thuật viên phụ trách xử lý</label>
                        <input
                          type="text"
                          className="crud-form-input"
                          value={convertIncidentForm.assignedTo}
                          onChange={(e) => setConvertIncidentForm((f) => ({ ...f, assignedTo: e.target.value }))}
                          placeholder="VD: Nguyễn Văn A"
                          disabled={reportSubmitting}
                        />
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Công trình hạ tầng liên quan</label>
                        <select
                          className="crud-form-select"
                          value={convertIncidentForm.assetId}
                          onChange={(e) => setConvertIncidentForm((f) => ({ ...f, assetId: e.target.value }))}
                          disabled={reportSubmitting}
                        >
                          <option value="">-- Chọn công trình (hoặc để trống) --</option>
                          {(assetsQuery.data ?? []).map((a) => (
                            <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</option>
                          ))}
                        </select>
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Thời hạn giải quyết (ngày)</label>
                        <input
                          type="number"
                          className="crud-form-input"
                          value={convertIncidentForm.targetResolutionDays}
                          onChange={(e) => setConvertIncidentForm((f) => ({ ...f, targetResolutionDays: Number(e.target.value) }))}
                          min={1}
                          max={90}
                          disabled={reportSubmitting}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="glass-button"
                        onClick={() => setConvertMode('NONE')}
                        disabled={reportSubmitting}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="glass-button glass-button-primary"
                        style={{ background: 'var(--color-negative)', borderColor: 'var(--color-negative)' }}
                        onClick={() => handleConvertToIncident(selectedReport.id)}
                        disabled={reportSubmitting}
                      >
                        {reportSubmitting ? 'Đang tạo sự cố...' : 'Xác nhận tạo Sự cố kỹ thuật'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-surface-hover)', padding: '0.85rem', borderRadius: 'var(--radius-field)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-accent)' }}>
                        Thiết lập Lệnh duy tu, bảo dưỡng
                      </strong>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setConvertMode('NONE')}
                        style={{ padding: '2px' }}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <div className="crud-form-grid">
                      <div className="crud-form-group">
                        <label className="crud-form-label">Công trình hạ tầng <span className="required">*</span></label>
                        <select
                          className="crud-form-select"
                          value={convertOrderForm.assetId}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, assetId: e.target.value }))}
                          disabled={reportSubmitting}
                        >
                          <option value="">-- Chọn công trình hạ tầng --</option>
                          {(assetsQuery.data ?? []).map((a) => (
                            <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</option>
                          ))}
                        </select>
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Đơn vị / Đội thi công</label>
                        <input
                          type="text"
                          className="crud-form-input"
                          value={convertOrderForm.assignedTo}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, assignedTo: e.target.value }))}
                          placeholder="VD: Tổ thoát nước & VSMT"
                          disabled={reportSubmitting}
                        />
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Loại hình bảo dưỡng</label>
                        <select
                          className="crud-form-select"
                          value={convertOrderForm.orderType}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, orderType: e.target.value }))}
                          disabled={reportSubmitting}
                        >
                          <option value="CORRECTIVE">Sửa chữa khắc phục (CORRECTIVE)</option>
                          <option value="EMERGENCY">Ứng phó khẩn cấp (EMERGENCY)</option>
                          <option value="ROUTINE">Bảo dưỡng định kỳ (ROUTINE)</option>
                          <option value="UPGRADE">Cải tạo nâng cấp (UPGRADE)</option>
                        </select>
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Mức độ ưu tiên</label>
                        <select
                          className="crud-form-select"
                          value={convertOrderForm.priority}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, priority: e.target.value }))}
                          disabled={reportSubmitting}
                        >
                          <option value="NORMAL">Bình thường (NORMAL)</option>
                          <option value="HIGH">Ưu tiên cao (HIGH)</option>
                          <option value="URGENT">Khẩn cấp (URGENT)</option>
                          <option value="LOW">Thấp (LOW)</option>
                        </select>
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Ngày bắt đầu</label>
                        <input
                          type="date"
                          className="crud-form-input"
                          value={convertOrderForm.scheduledStart}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                          disabled={reportSubmitting}
                        />
                      </div>
                      <div className="crud-form-group">
                        <label className="crud-form-label">Hạn hoàn thành</label>
                        <input
                          type="date"
                          className="crud-form-input"
                          value={convertOrderForm.scheduledEnd}
                          onChange={(e) => setConvertOrderForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                          disabled={reportSubmitting}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="glass-button"
                        onClick={() => setConvertMode('NONE')}
                        disabled={reportSubmitting}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="glass-button glass-button-primary"
                        onClick={() => handleConvertToWorkOrder(selectedReport.id)}
                        disabled={reportSubmitting}
                      >
                        {reportSubmitting ? 'Đang tạo lệnh...' : 'Xác nhận tạo Lệnh bảo dưỡng'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="crud-modal-footer">
              {isAdmin && (
                <button
                  type="button"
                  className="glass-button table-action-btn-danger"
                  style={{ background: 'var(--color-negative)', color: '#fff' }}
                  onClick={() => {
                    setDeletingReport(selectedReport)
                    setReportDeleteError(null)
                  }}
                  disabled={reportSubmitting}
                >
                  <Icon name="trash" size={14} /> Xóa báo cáo
                </button>
              )}
              <button
                type="button"
                className="glass-button"
                onClick={() => setSelectedReport(null)}
                disabled={reportSubmitting}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => !reportSubmitting && setDeletingReport(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <h3>Xác nhận xóa báo cáo hiện trường</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingReport(null)}
                disabled={reportSubmitting}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              {reportDeleteError && (
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
                  <span>{reportDeleteError}</span>
                </div>
              )}
              <p className="confirm-dialog-text">
                Bạn có chắc chắn muốn xóa báo cáo <strong>{deletingReport.title}</strong> (mã <code>{deletingReport.reportCode}</code>)?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-subtle)', margin: 0 }}>
                Thao tác này xóa vĩnh viễn bản ghi báo cáo hiện trường; sự cố hoặc lệnh duy tu đã liên kết vẫn được giữ lại.
              </p>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="glass-button"
                onClick={() => setDeletingReport(null)}
                disabled={reportSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="glass-button table-action-btn-danger"
                style={{ background: 'var(--color-negative)', color: '#fff' }}
                onClick={handleDeleteReportConfirm}
                disabled={reportSubmitting}
              >
                {reportSubmitting ? 'Đang xóa...' : 'Xóa báo cáo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )
}
