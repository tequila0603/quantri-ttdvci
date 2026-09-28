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

export function WorkforcePage({ user, timeFilter, initialPark }: { user: User; timeFilter: GlobalTimeFilter; initialPark?: string }) {
    const [activeTab, setActiveTab] = useState<'employees' | 'coordination'>('employees');
    const [search, setSearch] = useState('');
    const [scopeFilter, setScopeFilter] = useState<'ALL' | 'OFFICE' | 'FIELD'>('ALL');
    const [unitFilter, setUnitFilter] = useState('');
    const [parkFilter, setParkFilter] = useState(initialPark ?? '');
    const [teamFilter, setTeamFilter] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [taskCategoryFilter, setTaskCategoryFilter] = useState('');
    useEffect(() => {
    if (initialPark !== undefined) setParkFilter(initialPark)
    }, [initialPark])
    const allEmployeesQuery = useApiData<Page<Employee>>('/workforce/employees?limit=100', user);
    const allEmployees = allEmployeesQuery.data?.data ?? [];
    const unitsQuery = useApiData<WorkforceUnit[]>('/workforce/units', user);
    const parksQuery = useApiData<WorkforcePark[]>('/workforce/parks', user);
    const teamsQuery = useApiData<string[]>('/workforce/teams', user);
    const taskParams = new URLSearchParams();
    if (taskCategoryFilter) taskParams.append('category', taskCategoryFilter)
    if (timeFilter.fromDate) taskParams.append('fromDate', timeFilter.fromDate)
    if (timeFilter.toDate) taskParams.append('toDate', timeFilter.toDate)
    const tasksQuery = useApiData<CoordinationTask[]>(`/coordination/tasks${taskParams.toString() ? `?${taskParams.toString()}` : ''}`, user);
    const tasks = tasksQuery.data ?? [];
    const activeTasksCount = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'NOT_STARTED').length;
    const overdueTasksCount = tasks.filter((t) => t.isOverdue).length;
    const completedTasksCount = tasks.filter((t) => t.status === 'COMPLETED').length;
    const totalEmployeesCount = allEmployees.length;
    const officeCount = useMemo(() => allEmployees.filter((e) => !e.parkCode).length, [allEmployees]);
    const fieldCount = useMemo(() => allEmployees.filter((e) => !!e.parkCode).length, [allEmployees]);
    const anPhuCount = useMemo(() => allEmployees.filter((e) => e.parkCode === 'KCN_AN_PHU').length, [allEmployees]);
    const hoaHiepCount = useMemo(() => allEmployees.filter((e) => e.parkCode === 'KCN_HOA_HIEP_1').length, [allEmployees]);
    const songCauCount = useMemo(() => allEmployees.filter((e) => e.parkCode === 'KCN_ONG_BAC_SONG_CAU_KV1').length, [allEmployees]);
    const filteredEmployees = useMemo(() => {
            return allEmployees.filter((emp) => {
              if (scopeFilter === 'OFFICE' && emp.parkCode) return false
              if (scopeFilter === 'FIELD' && !emp.parkCode) return false
              if (unitFilter && emp.unitId !== unitFilter) return false
              if (parkFilter && emp.parkCode !== parkFilter) return false
              if (teamFilter && emp.teamName !== teamFilter) return false
              if (search.trim()) {
                const q = search.trim().toLowerCase()
                const matchName = emp.fullName.toLowerCase().includes(q)
                const matchCode = emp.employeeCode?.toLowerCase().includes(q) ?? false
                const matchPos = emp.workPosition?.toLowerCase().includes(q) ?? false
                const matchUnit = emp.organizationalUnit?.toLowerCase().includes(q) ?? false
                const matchPark = emp.parkName?.toLowerCase().includes(q) ?? false
                const matchTeam = emp.teamName?.toLowerCase().includes(q) ?? false
                const matchDec = emp.decisionNumber?.toLowerCase().includes(q) ?? false
                const matchQual = emp.professionalQualification?.toLowerCase().includes(q) ?? false
                const matchNotes = emp.notes?.toLowerCase().includes(q) ?? false
                if (!matchName && !matchCode && !matchPos && !matchUnit && !matchPark && !matchTeam && !matchDec && !matchQual && !matchNotes) {
                  return false
                }
              }
              return true
            })
          }, [allEmployees, scopeFilter, unitFilter, parkFilter, teamFilter, search]);
    const kcnSummary = useMemo(() => {
            const kcnDefs = [
              { code: 'KCN_AN_PHU', name: 'KCN An Phú' },
              { code: 'KCN_HOA_HIEP_1', name: 'KCN Hoà Hiệp 1' },
              { code: 'KCN_ONG_BAC_SONG_CAU_KV1', name: 'KCN Đông Bắc Sông Cầu' },
            ]
            return kcnDefs.map((park) => {
              const parkEmps = allEmployees.filter((e) => e.parkCode === park.code)
              const greenTeam = parkEmps.filter((e) => e.teamName === 'Tổ Cây xanh, Điện, Bảo vệ')
              const waterTeam = parkEmps.filter((e) => e.teamName === 'Tổ Xử lý nước thải')

              const greenLeader = greenTeam.find((e) => e.workPosition?.toLowerCase().includes('tổ trưởng')) ?? greenTeam[0]
              const waterLeader = waterTeam.find((e) => e.workPosition?.toLowerCase().includes('tổ trưởng')) ?? waterTeam[0]

              return {
                ...park,
                total: parkEmps.length,
                teams: [
                  {
                    name: 'Tổ Cây xanh, Điện, Bảo vệ',
                    count: greenTeam.length,
                    leaderName: greenLeader ? greenLeader.fullName : 'Chưa chỉ định',
                    decisionNumber: greenTeam[0]?.decisionNumber ?? '',
                  },
                  {
                    name: 'Tổ Xử lý nước thải',
                    count: waterTeam.length,
                    leaderName: waterLeader ? waterLeader.fullName : 'Chưa chỉ định',
                    decisionNumber: waterTeam[0]?.decisionNumber ?? '',
                  },
                ],
              }
            })
          }, [allEmployees]);
    const unitOptions = useMemo(() => [
            { value: '', label: 'Tất cả đơn vị' },
            ...(unitsQuery.data ?? []).map((u) => {
              const cnt = allEmployees.filter((e) => e.unitId === u.id).length
              return { value: u.id, label: `${u.name} (${cnt})` }
            }),
          ], [unitsQuery.data, allEmployees]);
    const parkOptions = useMemo(() => [
            { value: '', label: 'Tất cả KCN' },
            { value: 'KCN_AN_PHU', label: `KCN An Phú (${anPhuCount})` },
            { value: 'KCN_HOA_HIEP_1', label: `KCN Hoà Hiệp 1 (${hoaHiepCount})` },
            { value: 'KCN_ONG_BAC_SONG_CAU_KV1', label: `KCN Đông Bắc Sông Cầu (${songCauCount})` },
          ], [anPhuCount, hoaHiepCount, songCauCount]);
    const teamOptions = useMemo(() => [
            { value: '', label: 'Tất cả các tổ' },
            ...(teamsQuery.data ?? []).map((t) => {
              const cnt = allEmployees.filter((e) => e.teamName === t).length
              return { value: t, label: `${t} (${cnt})` }
            }),
          ], [teamsQuery.data, allEmployees]);
    const isFiltered = scopeFilter !== 'ALL' || !!unitFilter || !!parkFilter || !!teamFilter || !!search.trim();

    function handleResetFilters() {
        setScopeFilter('ALL')
        setUnitFilter('')
        setParkFilter('')
        setTeamFilter('')
        setSearch('')
    }

    function handleSelectPark(code: string) {
        setScopeFilter('FIELD')
        setParkFilter(code)
        setTeamFilter('')
    }

    function handleSelectTeam(parkCode: string, teamName: string) {
        setScopeFilter('FIELD')
        setParkFilter(parkCode)
        setTeamFilter(teamName)
    }

    async function handleCompleteTask(taskId: string) {
        if (user.roleCode !== 'DATA_ADMIN') return
        try {
          await fetchApi(`/coordination/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'COMPLETED', progressPercent: 100 }),
          })
          tasksQuery.refresh()
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Không thể cập nhật')
        }
    }

    return (
    <div className="content-stack">
      <PageTitle
        title="Nhân sự & Phối hợp Nhiệm vụ"
        detail={activeTab === 'employees' ? `${totalEmployeesCount} hồ sơ nhân sự đang hiệu lực (${officeCount} cơ quan, ${fieldCount} hiện trường 3 KCN)` : `Theo dõi nhiệm vụ phối hợp liên ngành · ${timeFilter.periodLabel}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <div className="segmented-control" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'employees'}
              className={activeTab === 'employees' ? 'segment-active' : ''}
              onClick={() => setActiveTab('employees')}
            >
              <Icon name="users" size={16} /> Hồ sơ nhân sự ({totalEmployeesCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'coordination'}
              className={activeTab === 'coordination' ? 'segment-active' : ''}
              onClick={() => setActiveTab('coordination')}
            >
              <Icon name="shield" size={16} /> Phối hợp liên ngành ({tasks.length})
            </button>
          </div>
          </div>
        }
      />

      {activeTab === 'employees' ? (
        <>
          {/* Top KPI Cards */}
          <section className="workforce-kpi-grid">
            <button
              type="button"
              className={`workforce-kpi-card ${scopeFilter === 'ALL' && !parkFilter && !unitFilter && !teamFilter ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => { setScopeFilter('ALL'); setParkFilter(''); setTeamFilter(''); setUnitFilter(''); }}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">Tổng nhân sự</span>
                <Icon name="users" size={16} />
              </div>
              <div className="workforce-kpi-value">{totalEmployeesCount}</div>
              <div className="workforce-kpi-detail">Toàn bộ Trung tâm</div>
            </button>

            <button
              type="button"
              className={`workforce-kpi-card ${scopeFilter === 'OFFICE' ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => { setScopeFilter('OFFICE'); setParkFilter(''); setTeamFilter(''); }}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">Khối Cơ quan</span>
                <Icon name="building" size={16} />
              </div>
              <div className="workforce-kpi-value">{officeCount}</div>
              <div className="workforce-kpi-detail">Lãnh đạo & Các phòng</div>
            </button>

            <button
              type="button"
              className={`workforce-kpi-card ${scopeFilter === 'FIELD' && !parkFilter ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => { setScopeFilter('FIELD'); setParkFilter(''); setTeamFilter(''); }}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">Khối Hiện trường</span>
                <Icon name="land" size={16} />
              </div>
              <div className="workforce-kpi-value">{fieldCount}</div>
              <div className="workforce-kpi-detail">Đội dịch vụ các KCN</div>
            </button>

            <button
              type="button"
              className={`workforce-kpi-card ${parkFilter === 'KCN_AN_PHU' ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => handleSelectPark('KCN_AN_PHU')}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">KCN An Phú</span>
                <Icon name="land" size={16} />
              </div>
              <div className="workforce-kpi-value">{anPhuCount}</div>
              <div className="workforce-kpi-detail">2 tổ (QĐ 48, 49)</div>
            </button>

            <button
              type="button"
              className={`workforce-kpi-card ${parkFilter === 'KCN_HOA_HIEP_1' ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => handleSelectPark('KCN_HOA_HIEP_1')}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">KCN Hoà Hiệp 1</span>
                <Icon name="land" size={16} />
              </div>
              <div className="workforce-kpi-value">{hoaHiepCount}</div>
              <div className="workforce-kpi-detail">2 tổ (QĐ 46, 47)</div>
            </button>

            <button
              type="button"
              className={`workforce-kpi-card ${parkFilter === 'KCN_ONG_BAC_SONG_CAU_KV1' ? 'workforce-kpi-card-active' : ''}`}
              onClick={() => handleSelectPark('KCN_ONG_BAC_SONG_CAU_KV1')}
            >
              <div className="workforce-kpi-header">
                <span className="workforce-kpi-title">KCN ĐB Sông Cầu</span>
                <Icon name="land" size={16} />
              </div>
              <div className="workforce-kpi-value">{songCauCount}</div>
              <div className="workforce-kpi-detail">2 tổ (QĐ 50, 51)</div>
            </button>
          </section>

          {/* KCN Overview Cards */}
          {scopeFilter !== 'OFFICE' && (
            <section className="workforce-kcn-grid">
              {kcnSummary.map((kcn) => {
                const isParkActive = parkFilter === kcn.code
                return (
                  <div
                    key={kcn.code}
                    className={`workforce-kcn-card ${isParkActive ? 'workforce-kcn-card-active' : ''}`}
                  >
                    <div className="workforce-kcn-header">
                      <div className="workforce-kcn-title-area">
                        <Icon name="land" size={17} />
                        <span className="workforce-kcn-title">{kcn.name}</span>
                      </div>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={() => handleSelectPark(kcn.code)}
                        title={`Lọc tất cả nhân sự ${kcn.name}`}
                      >
                        <span>{kcn.total} người</span>
                        <Icon name="arrow" size={12} />
                      </button>
                    </div>

                    <div className="workforce-kcn-teams">
                      {kcn.teams.map((t) => {
                        const isTeamActive = isParkActive && teamFilter === t.name
                        return (
                          <div
                            key={t.name}
                            className={`workforce-team-item ${isTeamActive ? 'workforce-team-item-active' : ''}`}
                            onClick={() => handleSelectTeam(kcn.code, t.name)}
                          >
                            <div className="workforce-team-top">
                              <span className="workforce-team-name">{t.name}</span>
                              <span className="workforce-team-count">{t.count} người</span>
                            </div>
                            <div className="workforce-team-meta">
                              <span>
                                Tổ trưởng: <strong className="workforce-team-leader">{t.leaderName}</strong>
                              </span>
                              {t.decisionNumber && (
                                <span className="workforce-decision-pill">
                                  QĐ {t.decisionNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {/* Filter Toolbar */}
          <section className="glass-panel workforce-filter-bar">
            <div className="workforce-scope-pills">
              <button
                type="button"
                className={`workforce-scope-pill ${scopeFilter === 'ALL' ? 'workforce-scope-pill-active' : ''}`}
                onClick={() => { setScopeFilter('ALL'); setParkFilter(''); setTeamFilter(''); }}
              >
                <Icon name="users" size={14} />
                <span>Tất cả ({totalEmployeesCount})</span>
              </button>
              <button
                type="button"
                className={`workforce-scope-pill ${scopeFilter === 'OFFICE' ? 'workforce-scope-pill-active' : ''}`}
                onClick={() => { setScopeFilter('OFFICE'); setParkFilter(''); setTeamFilter(''); }}
              >
                <Icon name="building" size={14} />
                <span>Khối Cơ quan / Văn phòng ({officeCount})</span>
              </button>
              <button
                type="button"
                className={`workforce-scope-pill ${scopeFilter === 'FIELD' ? 'workforce-scope-pill-active' : ''}`}
                onClick={() => { setScopeFilter('FIELD'); setParkFilter(''); setTeamFilter(''); }}
              >
                <Icon name="land" size={14} />
                <span>Khối Hiện trường / KCN ({fieldCount})</span>
              </button>
            </div>

            <div className="workforce-filter-row">
              <div className="workforce-selects-group">
                <GlassSelect
                  value={unitFilter}
                  onChange={setUnitFilter}
                  label="Phòng ban / Đơn vị"
                  icon="building"
                  ariaLabel="Lọc theo phòng ban hoặc đơn vị"
                  options={unitOptions}
                />
                {scopeFilter !== 'OFFICE' && (
                  <>
                    <GlassSelect
                      value={parkFilter}
                      onChange={(val) => {
                        setParkFilter(val)
                        if (val) setScopeFilter('FIELD')
                      }}
                      label="Khu công nghiệp"
                      icon="land"
                      ariaLabel="Lọc theo Khu công nghiệp"
                      options={parkOptions}
                    />
                    <GlassSelect
                      value={teamFilter}
                      onChange={(val) => {
                        setTeamFilter(val)
                        if (val) setScopeFilter('FIELD')
                      }}
                      label="Tổ công tác"
                      icon="users"
                      ariaLabel="Lọc theo tổ công tác"
                      options={teamOptions}
                    />
                  </>
                )}
              </div>

              <div className="workforce-search-box">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  placeholder="Tìm họ tên, mã NV (TT-xxx), chức vụ, KCN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Tìm nhân sự"
                />
                {search && (
                  <button
                    type="button"
                    className="icon-button"
                    style={{ width: '1.25rem', height: '1.25rem' }}
                    onClick={() => setSearch('')}
                    aria-label="Xóa tìm kiếm"
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="workforce-filter-status-row">
              <div>
                <span>Hiển thị <strong>{filteredEmployees.length}</strong> / {totalEmployeesCount} nhân sự</span>
                {isFiltered && (
                  <span style={{ marginLeft: '0.65rem', color: 'var(--color-muted)' }}>
                    (Bộ lọc đang áp dụng)
                  </span>
                )}
              </div>
              {isFiltered && (
                <button type="button" className="workforce-reset-btn" onClick={handleResetFilters}>
                  <Icon name="refresh" size={13} />
                  <span>Đặt lại bộ lọc</span>
                </button>
              )}
            </div>
          </section>

          {/* Table Panel */}
          <section className="glass-panel panel table-panel">
            <PanelHeading
              title="Danh sách nhân sự Trung tâm"
              meta={<span className="panel-count">{filteredEmployees.length} hồ sơ</span>}
            />
            {allEmployeesQuery.loading ? (
              <LoadingBlock label="Đang tải danh sách nhân sự..." />
            ) : allEmployeesQuery.error ? (
              <ErrorBlock message={allEmployeesQuery.error} />
            ) : filteredEmployees.length ? (
              <DataTable minWidth="1080px">
                <thead>
                  <tr>
                    <th>Họ và tên</th>
                    <th>Mã NV</th>
                    <th>Đơn vị</th>
                    <th>KCN / Địa bàn</th>
                    <th>Tổ công tác & Quyết định</th>
                    <th>Chức danh / Vị trí</th>
                    <th>Trình độ chuyên môn & LLCT</th>
                    <th>Loại lao động</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <td className="cell-strong">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 650, color: 'var(--color-ink)' }}>{employee.fullName}</span>
                          {employee.notes && (
                            <Badge tone="warning">{employee.notes}</Badge>
                          )}
                        </div>
                        <div className="cell-subtle" style={{ fontSize: '0.72rem' }}>
                          Sinh: {shortDate(employee.birthDate)}
                        </div>
                      </td>
                      <td>
                        <span className="workforce-code-pill">{employee.employeeCode ?? 'Chưa có'}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-ink)' }}>
                        {employee.organizationalUnit ?? 'Chưa phân đơn vị'}
                      </td>
                      <td>
                        {employee.parkName ? (
                          <Badge tone="info">{employee.parkName}</Badge>
                        ) : (
                          <Badge tone="neutral">Trụ sở Trung tâm</Badge>
                        )}
                      </td>
                      <td>
                        {employee.teamName ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                              {employee.teamName}
                            </span>
                            {employee.decisionNumber && (
                              <span className="workforce-decision-pill">
                                QĐ {employee.decisionNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-subtle)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 550, color: 'var(--color-ink)' }}>
                        <div>{employee.workPosition ?? 'Chưa cập nhật'}</div>
                        {employee.notes && (
                          <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600, marginTop: '0.15rem' }}>
                            ({employee.notes})
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-ink)' }}>
                          {employee.professionalQualification ?? 'Chưa cập nhật'}
                        </div>
                        {employee.politicalTheory && (
                          <span className="workforce-theory-tag">
                            LLCT: {employee.politicalTheory}
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge tone={employee.employmentType?.includes('Viên chức') ? 'positive' : 'neutral'}>
                          {employee.employmentType ?? 'HĐLĐ'}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          title="Xem hồ sơ chi tiết"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEmployee(employee)
                          }}
                        >
                          <Icon name="eye" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyBlock label="Không tìm thấy hồ sơ nhân sự phù hợp với bộ lọc" />
            )}
          </section>

          {/* Center Duties Panel */}
          <section className="glass-panel panel center-duties-panel">
            <PanelHeading
              title="Chức năng, nhiệm vụ hiện tại của Trung tâm"
              meta={<Badge tone="info">Theo phạm vi được giao</Badge>}
            />
            <p className="panel-note center-duty-function">
              <strong>Chức năng:</strong> Phối hợp quản lý dữ liệu và hồ sơ thuộc phạm vi được giao; tổ chức số hóa, cập nhật và khai thác cơ sở dữ liệu theo hướng dẫn của Ban Quản lý Khu kinh tế.
            </p>
            <div className="center-duty-list">
              {CENTER_DUTIES.map((duty, index) => (
                <div key={duty}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{duty}</p>
                </div>
              ))}
            </div>
            <p className="inline-note">
              <Icon name="shield" size={16} /> Trung tâm thực hiện trong phạm vi được phân công, không mặc nhiên chủ trì toàn bộ cơ sở dữ liệu của Ban.
            </p>
          </section>
        </>
      ) : (
        <>
          <section className="metrics-grid-4">
            <MetricCard
              icon="activity"
              label="Nhiệm vụ đang thực hiện"
              value={String(activeTasksCount)}
              detail="Đang phối hợp triển khai"
              tone="accent"
            />
            <MetricCard
              icon="alert"
              label="Nhiệm vụ quá hạn"
              value={String(overdueTasksCount)}
              detail={overdueTasksCount > 0 ? 'Cần khẩn trương đôn đốc' : 'Không có việc quá hạn'}
              tone={overdueTasksCount > 0 ? 'accent' : 'neutral'}
            />
            <MetricCard
              icon="shield"
              label="Nhiệm vụ đã hoàn thành"
              value={String(completedTasksCount)}
              detail={`${tasks.length ? Math.round((completedTasksCount / tasks.length) * 100) : 0}% tỷ lệ hoàn tất`}
            />
            <MetricCard
              icon="building"
              label="Đơn vị phối hợp"
              value="Công an, PCTT, Sở XD"
              detail="Nhiệm vụ liên ngành"
            />
          </section>

          <div className="glass-panel panel filter-bar-panel" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <GlassSelect
              value={taskCategoryFilter}
              onChange={setTaskCategoryFilter}
              label="Lĩnh vực"
              icon="shield"
              ariaLabel="Chọn lĩnh vực phối hợp"
              placeholder="Tất cả lĩnh vực"
              options={[
                { value: '', label: 'Tất cả lĩnh vực' },
                { value: 'FIRE_SAFETY', label: 'PCCC & Cứu nạn cứu hộ' },
                { value: 'DISASTER_PREVENTION', label: 'Phòng chống thiên tai & Ngập úng' },
                { value: 'OCCUPATIONAL_SAFETY', label: 'An toàn vệ sinh lao động' },
                { value: 'PUBLIC_SERVICE', label: 'Dịch vụ sự nghiệp công' },
              ]}
            />
          </div>

          <section className="glass-panel panel table-panel">
            <PanelHeading
              title="Sổ theo dõi nhiệm vụ phối hợp liên ngành & dịch vụ công"
              meta={<span className="panel-count">{tasks.length} nhiệm vụ</span>}
            />
            {tasksQuery.loading ? (
              <LoadingBlock label="Đang tải danh sách nhiệm vụ phối hợp" />
            ) : tasksQuery.error ? (
              <ErrorBlock message={tasksQuery.error} />
            ) : tasks.length ? (
              <DataTable minWidth="1050px">
                <thead>
                  <tr>
                    <th>Mã / Tên nhiệm vụ</th>
                    <th>Lĩnh vực</th>
                    <th>Cơ quan yêu cầu / Chủ trì</th>
                    <th>Người phụ trách Trung tâm</th>
                    <th>Hạn hoàn thành</th>
                    <th>Tiến độ</th>
                    <th>Trạng thái</th>
                    {user.roleCode === 'DATA_ADMIN' && <th style={{ width: '130px' }}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="cell-strong">
                        <span>{task.title}</span>
                        <span className="cell-subtle">{task.taskCode}</span>
                      </td>
                      <td>
                        <Badge tone="neutral">{taskCategoryLabel(task.taskCategory)}</Badge>
                      </td>
                      <td>{task.requestingAgency ?? 'Chưa xác định'}</td>
                      <td>{task.coordinatorName ?? 'Chưa phân công'}</td>
                      <td>
                        <span>{task.dueDate ? shortDate(task.dueDate) : 'Thường xuyên'}</span>
                        {task.isOverdue && <> <Badge tone="negative">Quá hạn</Badge></>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ minWidth: '2.5rem', fontSize: '0.8rem', fontWeight: 600 }}>{task.progressPercent}%</span>
                          <div style={{ flex: 1, height: '6px', background: 'var(--color-line)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${task.progressPercent}%`, height: '100%', background: task.progressPercent === 100 ? 'var(--color-positive)' : 'var(--color-accent)' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={taskStatusTone(task.status)}>
                          {taskStatusLabel(task.status)}
                        </Badge>
                      </td>
                      {user.roleCode === 'DATA_ADMIN' && (
                        <td>
                          {task.status !== 'COMPLETED' ? (
                            <button
                              type="button"
                              className="glass-button"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                              onClick={() => handleCompleteTask(task.id)}
                            >
                              <Icon name="check" size={14} /> Hoàn thành
                            </button>
                          ) : (
                            <span className="cell-subtle">Đã xong</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyBlock label="Không có nhiệm vụ nào trong phạm vi này" />
            )}
          </section>
        </>
      )}

      {/* Employee Detail Profile Modal */}
      {selectedEmployee && (
        <div
          role="dialog"
          aria-modal="true"
          className="crud-modal-backdrop"
          onClick={() => setSelectedEmployee(null)}
        >
          <div className="crud-modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="crud-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Hồ sơ nhân sự chi tiết</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                  {selectedEmployee.fullName} • {selectedEmployee.employeeCode ?? 'Chưa có mã'}
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedEmployee(null)}
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="crud-modal-body">
              <div className="workforce-profile-grid">
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Họ và tên</span>
                  <span className="workforce-profile-val">{selectedEmployee.fullName}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Mã nhân sự</span>
                  <span className="workforce-profile-val">{selectedEmployee.employeeCode ?? 'Chưa có'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Ngày sinh</span>
                  <span className="workforce-profile-val">{shortDate(selectedEmployee.birthDate)}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Loại lao động</span>
                  <span className="workforce-profile-val">{selectedEmployee.employmentType ?? 'Chưa có'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Đơn vị công tác</span>
                  <span className="workforce-profile-val">{selectedEmployee.organizationalUnit ?? 'Chưa phân đơn vị'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">KCN / Địa bàn</span>
                  <span className="workforce-profile-val">{selectedEmployee.parkName ?? 'Trụ sở Trung tâm'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Tổ công tác</span>
                  <span className="workforce-profile-val">{selectedEmployee.teamName ?? 'Khối cơ quan'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Quyết định phân công</span>
                  <span className="workforce-profile-val">
                    {selectedEmployee.decisionNumber ? `Quyết định số ${selectedEmployee.decisionNumber}` : 'Theo đề án vị trí việc làm'}
                  </span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Vị trí / Chức danh</span>
                  <span className="workforce-profile-val">{selectedEmployee.workPosition ?? 'Chưa cập nhật'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Trình độ chuyên môn</span>
                  <span className="workforce-profile-val">{selectedEmployee.professionalQualification ?? 'Chưa cập nhật'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Lý luận chính trị</span>
                  <span className="workforce-profile-val">{selectedEmployee.politicalTheory ?? 'Chưa qua đào tạo'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Quản lý nhà nước</span>
                  <span className="workforce-profile-val">{selectedEmployee.stateManagement ?? 'Chưa cập nhật'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Ngoại ngữ</span>
                  <span className="workforce-profile-val">{selectedEmployee.foreignLanguage ?? 'Chưa cập nhật'}</span>
                </div>
                <div className="workforce-profile-item">
                  <span className="workforce-profile-label">Tin học</span>
                  <span className="workforce-profile-val">{selectedEmployee.informatics ?? 'Chưa cập nhật'}</span>
                </div>
                <div className="workforce-profile-item" style={{ gridColumn: 'span 2' }}>
                  <span className="workforce-profile-label">Chức vụ Đảng</span>
                  <span className="workforce-profile-val">{selectedEmployee.partyPosition ?? 'Không'}</span>
                </div>
                {selectedEmployee.notes && (
                  <div className="workforce-profile-item" style={{ gridColumn: 'span 2', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <span className="workforce-profile-label" style={{ color: '#d97706' }}>Ghi chú công tác</span>
                    <span className="workforce-profile-val" style={{ color: '#b45309', fontWeight: 650 }}>
                      {selectedEmployee.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="crud-modal-footer">
              <button
                type="button"
                className="crud-btn-cancel"
                onClick={() => setSelectedEmployee(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )
}
