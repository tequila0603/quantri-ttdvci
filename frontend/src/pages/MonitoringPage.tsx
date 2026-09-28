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

export function MonitoringThresholdMeter({ metric }: { metric: PremierMetric }) {
    const limitInfo = useMemo(() => parseLimitInfo(metric.limitText), [metric.limitText]);
    if (metric.value === null || !limitInfo) return null
    let percent = 0;
    let isNear = false;
    const isExceeded = metric.status === 'EXCEEDED';
    if (limitInfo.isRange && limitInfo.min !== undefined && limitInfo.max !== undefined) {
    const span = limitInfo.max - limitInfo.min
    percent = span > 0 ? Math.min(Math.max(((metric.value - limitInfo.min) / span) * 100, 4), 100) : 50
    isNear = metric.value <= limitInfo.min + span * 0.1 || metric.value >= limitInfo.max - span * 0.1
    } else if (limitInfo.max !== undefined && limitInfo.max > 0) {
    percent = Math.min(Math.max((metric.value / limitInfo.max) * 100, 3), 100)
    isNear = percent >= 80 && percent <= 100
    }

    const fillTone = isExceeded
            ? 'var(--color-negative)'
            : isNear
              ? 'var(--color-warning)'
              : 'var(--color-positive)';
    const ratioLabel = limitInfo.isRange
            ? `Dải an toàn [${limitInfo.min} – ${limitInfo.max}]`
            : `${percent.toFixed(1)}% ngưỡng QCVN`;
    return (
    <div className="monitoring-meter" title={ratioLabel}>
      <div className="monitoring-meter-track">
        <div className="monitoring-meter-fill" style={{ width: `${percent}%`, background: fillTone }} />
      </div>
      <div className="monitoring-meter-meta">
        <span>{limitInfo.isRange ? limitInfo.min : '0'}</span>
        <span className="monitoring-meter-center">{ratioLabel}</span>
        <span>{limitInfo.isRange ? limitInfo.max : `< ${limitInfo.max}`}</span>
      </div>
    </div>
    )
}

export function MonitoringMetricTile({ metric, compact = false }: { metric: PremierMetric; compact?: boolean }) {
    const tone = monitoringStatusTone(metric.status);
    return (
    <article className={`monitoring-metric-tile monitoring-metric-${metric.status.toLowerCase()} ${compact ? 'monitoring-metric-compact' : ''}`}>
      <div className="monitoring-metric-top">
        <div className="monitoring-metric-heading">
          <span className="monitoring-metric-name">{metric.displayName}</span>
          <span className="monitoring-metric-code">{metric.code}</span>
        </div>
        <Badge tone={tone}>{monitoringStatusLabel(metric.status)}</Badge>
      </div>
      <div className="monitoring-metric-value-box">
        <strong>{formatMonitoringValue(metric.value)} <small>{metric.unit ?? ''}</small></strong>
      </div>
      <MonitoringThresholdMeter metric={metric} />
      <span className="monitoring-limit">
        {metric.limitText ? `Quy chuẩn: ${metric.limitText}` : 'Thông số vận hành không đặt ngưỡng'}
      </span>
    </article>
    )
}

export function MonitoringTrendChart({
      points,
      parameter,
      stationName,
      parameters,
      selectedParamCode,
      onSelectParamCode,
    }: {
          points: TrendPoint[]
          parameter: { code: string; displayName: string; unit: string | null }
          stationName: string
          parameters: Array<{ code: string; displayName: string; unit: string | null }>
          selectedParamCode: string
          onSelectParamCode: (code: string) => void
        }) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const validPoints = useMemo(() => points.filter((p): p is TrendPoint & { value: number } => p.value !== null), [points]);
    const values = validPoints.map((p) => p.value);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 10;
    const avgValue = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    const limitInfo = useMemo(() => parseLimitInfo(points[0]?.limitText), [points]);
    const width = 760;
    const height = 230;
    const padLeft = 52;
    const padRight = 32;
    const padTop = 32;
    const padBottom = 42;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const maxThreshold = limitInfo?.max;
    const yMin = Math.max(0, Math.min(minValue * 0.85, 0));
    const yMax = Math.max(
            maxThreshold ? maxThreshold * 1.08 : maxValue * 1.15,
            maxValue * 1.15,
            yMin + 1,
          );
    const coords = useMemo(() => {
            if (!points.length) return []
            return points.map((point, index) => {
              const x = padLeft + (index / Math.max(points.length - 1, 1)) * plotWidth
              const y = point.value === null
                ? height - padBottom
                : padTop + plotHeight - ((point.value - yMin) / (yMax - yMin)) * plotHeight
              return { ...point, x, y }
            })
          }, [points, yMin, yMax, padLeft, plotWidth, padTop, plotHeight, height, padBottom]);
    const validCoords = coords.filter((c) => c.value !== null);
    const polylinePoints = validCoords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPath = validCoords.length > 1
            ? `M ${validCoords[0].x.toFixed(1)},${height - padBottom} ` +
              validCoords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
              ` L ${validCoords[validCoords.length - 1].x.toFixed(1)},${height - padBottom} Z`
            : '';
    const limitY = maxThreshold !== undefined && maxThreshold <= yMax
            ? padTop + plotHeight - ((maxThreshold - yMin) / (yMax - yMin)) * plotHeight
            : null;
    const activePoint = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : coords[coords.length - 1];
    return (
    <div className="monitoring-trend-box">
      <div className="monitoring-trend-head">
        <div className="monitoring-trend-title-area">
          <span className="monitoring-kicker">BIỂU ĐỒ DIỄN BIẾN 30 NGÀY</span>
          <h4>{parameter.displayName} · {stationName}</h4>
        </div>
        {activePoint && activePoint.value !== null && (
          <div className="monitoring-trend-active-pill">
            <span>Ngày {shortDate(activePoint.date)}:</span>
            <strong>{formatMonitoringValue(activePoint.value)} <small>{parameter.unit ?? ''}</small></strong>
            <Badge tone={monitoringStatusTone(activePoint.status)}>{monitoringStatusLabel(activePoint.status)}</Badge>
          </div>
        )}
      </div>

      {/* Parameter selector pills */}
      <div className="monitoring-param-pills-bar">
        <div className="monitoring-param-pills" role="tablist" aria-label="Chọn thông số quan trắc">
          {parameters.map((p) => (
            <button
              type="button"
              key={p.code}
              role="tab"
              aria-selected={p.code === selectedParamCode}
              className={`monitoring-param-pill ${p.code === selectedParamCode ? 'monitoring-param-pill-active' : ''}`}
              onClick={() => onSelectParamCode(p.code)}
            >
              <span>{p.displayName}</span>
              {p.unit && <small>({p.unit})</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="monitoring-trend-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="monitoring-trend-svg" aria-label={`Biểu đồ diễn biến ${parameter.displayName}`}>
          <defs>
            <linearGradient id="monitoringTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.26" />
              <stop offset="85%" stopColor="var(--color-accent)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio)
            const tickVal = yMin + (yMax - yMin) * ratio
            return (
              <g key={ratio} className="monitoring-grid-line-group">
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="var(--color-line)" strokeDasharray="3 3" />
                <text x={padLeft - 10} y={y + 3.5} textAnchor="end" className="monitoring-svg-label">
                  {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(tickVal)}
                </text>
              </g>
            )
          })}

          {/* Threshold QCVN limit line with opaque background badge on the left */}
          {limitY !== null && (
            <g className="monitoring-svg-limit-group">
              <line
                x1={padLeft}
                y1={limitY}
                x2={width - padRight}
                y2={limitY}
                stroke="var(--color-negative)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.85"
              />
              <rect
                x={padLeft + 8}
                y={limitY - 17}
                width={155}
                height={17}
                rx={4}
                fill="var(--color-surface)"
                stroke="var(--color-negative-border)"
                strokeWidth="1"
              />
              <text
                x={padLeft + 14}
                y={limitY - 5}
                className="monitoring-svg-limit-label"
              >
                Quy chuẩn QCVN: {maxThreshold} {parameter.unit ?? ''}
              </text>
            </g>
          )}

          {/* Area fill & curve */}
          {areaPath && <path d={areaPath} fill="url(#monitoringTrendGradient)" />}
          {polylinePoints && (
            <polyline
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          )}

          {/* Interactive dots */}
          {coords.map((c, idx) => {
            if (c.value === null) return null
            const isSelected = hoverIndex === idx
            return (
              <circle
                key={c.date}
                cx={c.x}
                cy={c.y}
                r={isSelected ? 6 : 3.5}
                fill={isSelected ? 'var(--color-ink)' : 'var(--color-surface)'}
                stroke={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
                strokeWidth={isSelected ? 2.5 : 1.8}
                className="monitoring-trend-dot"
                onMouseEnter={() => setHoverIndex(idx)}
                onClick={() => setHoverIndex(idx)}
              />
            )
          })}

          {/* X axis dates */}
          {coords.filter((_, i) => i % Math.max(Math.ceil(coords.length / 7), 1) === 0 || i === coords.length - 1).map((c) => (
            <text key={`x-${c.date}`} x={c.x} y={height - 12} textAnchor="middle" className="monitoring-svg-x-label">
              {c.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>

      <div className="monitoring-trend-stats">
        <div className="monitoring-trend-stat-item">
          <span>Hiện tại ({points[points.length - 1]?.date ? shortDate(points[points.length - 1].date) : ''})</span>
          <strong>{formatMonitoringValue(points[points.length - 1]?.value ?? null)} <small>{parameter.unit ?? ''}</small></strong>
        </div>
        <div className="monitoring-trend-stat-item">
          <span>Trung bình 30 ngày</span>
          <strong>{formatMonitoringValue(avgValue)} <small>{parameter.unit ?? ''}</small></strong>
        </div>
        <div className="monitoring-trend-stat-item">
          <span>Đỉnh cao nhất (Max)</span>
          <strong>{formatMonitoringValue(maxValue)} <small>{parameter.unit ?? ''}</small></strong>
        </div>
        <div className="monitoring-trend-stat-item">
          <span>Thấp nhất (Min)</span>
          <strong>{formatMonitoringValue(minValue)} <small>{parameter.unit ?? ''}</small></strong>
        </div>
        <div className="monitoring-trend-stat-item">
          <span>Giới hạn QCVN</span>
          <strong>{limitInfo ? (limitInfo.max ? `< ${limitInfo.max}` : `${limitInfo.min} – ${limitInfo.max}`) : 'Không đặt'} <small>{parameter.unit ?? ''}</small></strong>
        </div>
      </div>
    </div>
    )
}

export function MonitoringPage({ user, timeFilter, initialPark }: { user: User; timeFilter: GlobalTimeFilter; initialPark?: string }) {
    const publicQuery = useApiData<PremierPublicData>('/monitoring/public', user);
    const [activeStationCode, setActiveStationCode] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'overview' | 'trend' | 'log' | 'waste_pdf'>('overview');
    const [selectedParamCode, setSelectedParamCode] = useState<string>('COD');
    const [searchLog, setSearchLog] = useState<string>('');
    const [logComplianceFilter, setLogComplianceFilter] = useState<'all' | 'NORMAL' | 'EXCEEDED'>('all');
    const [logPage, setLogPage] = useState<number>(1);
    const pageSize = 12;
    const wasteQuery = useApiData<WasteRecord[]>(`/waste/records?year=${timeFilter.year}`, user);
    const pdfQueueQuery = useApiData<PdfDocument[]>('/waste/pdf-queue', user);

    async function handleConfirmPdf(docId: string, status: 'CONFIRMED' | 'REJECTED') {
        if (user.roleCode !== 'DATA_ADMIN') return
        try {
          await fetchApi(`/waste/pdf-queue/${docId}/confirm`, {
            method: 'POST',
            body: JSON.stringify({ status }),
          })
          pdfQueueQuery.refresh()
          wasteQuery.refresh()
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Không thể cập nhật')
        }
    }

    const data = publicQuery.data;
    const stations = data?.stations ?? [];
    useEffect(() => {
    if (initialPark && stations.length) {
      const match = stations.find((s) => {
        if (initialPark === 'KCN_AN_PHU' && (s.code.includes('AP') || s.name.includes('An Phú'))) return true
        if (initialPark === 'KCN_HOA_HIEP_1' && (s.code.includes('HH') || s.name.includes('Hòa Hiệp'))) return true
        if (initialPark === 'KCN_DONG_BAC_SONG_CAU_KV1' && (s.code.includes('DBSC') || s.name.includes('Sông Cầu'))) return true
        return false
      })
      if (match) setActiveStationCode(match.code)
    }
    }, [initialPark, stations])
    useEffect(() => {
    if (activeStationCode !== 'all' && stations.length && !stations.some((s) => s.code === activeStationCode)) {
      setActiveStationCode('all')
    }
    }, [activeStationCode, stations])
    const selectedStation = activeStationCode === 'all'
            ? undefined
            : stations.find((s) => s.code === activeStationCode);
    const selectedSnapshot = selectedStation
            ? data?.current.find((row) => row.stationCode === selectedStation.code)
            : undefined;
    const statusCounts = useMemo(() => {
            return (data?.current ?? []).flatMap((snapshot) => snapshot.metrics).reduce<Record<PremierMetricStatus, number>>(
              (counts, metric) => ({ ...counts, [metric.status]: counts[metric.status] + 1 }),
              { NORMAL: 0, EXCEEDED: 0, NO_LIMIT: 0, MISSING: 0 },
            )
          }, [data?.current]);
    const totalDischargedToday = useMemo(() => {
            return (data?.current ?? []).reduce((acc, snapshot) => {
              const metric = snapshot.metrics.find((m) => m.code === 'FLOW_OUT_DAY')
              return acc + (metric?.value ?? 0)
            }, 0)
          }, [data?.current]);
    const totalInflowToday = useMemo(() => {
            return (data?.current ?? []).reduce((acc, snapshot) => {
              const metric = snapshot.metrics.find((m) => m.code === 'FLOW_IN_DAY')
              return acc + (metric?.value ?? 0)
            }, 0)
          }, [data?.current]);
    const checkedMetricsCount = statusCounts.NORMAL + statusCounts.EXCEEDED;
    const complianceRate = checkedMetricsCount > 0
            ? Math.round((statusCounts.NORMAL / checkedMetricsCount) * 100)
            : 100;
    const stationCards = useMemo(() => {
            return stations.map((station) => {
              const snapshot = data?.current.find((row) => row.stationCode === station.code)
              const ph = snapshot?.metrics.find((m) => m.code === 'PH')
              const cod = snapshot?.metrics.find((m) => m.code === 'COD')
              const tss = snapshot?.metrics.find((m) => m.code === 'TSS')
              const flowDay = snapshot?.metrics.find((m) => m.code === 'FLOW_OUT_DAY')
              const exceededCount = snapshot?.metrics.filter((m) => m.status === 'EXCEEDED').length ?? 0
              return {
                station,
                snapshot,
                ph,
                cod,
                tss,
                flowDay,
                exceededCount,
              }
            })
          }, [data?.current, stations]);
    const selectedParam = useMemo(() => {
            return data?.parameters.find((p) => p.code === selectedParamCode) ?? {
              code: 'COD',
              displayName: 'COD',
              unit: 'mg/L',
            }
          }, [data?.parameters, selectedParamCode]);
    const trendPoints = useMemo<TrendPoint[]>(() => {
            if (!data?.history.length) return []
            const targetCode = activeStationCode === 'all' ? (stations[0]?.code ?? '') : activeStationCode
            const stationHistory = data.history.filter((row) => row.stationCode === targetCode)
            const sorted = [...stationHistory].sort((a, b) => a.observedOn.localeCompare(b.observedOn))
            return sorted.map((snapshot) => {
              const metric = snapshot.metrics.find((m) => m.code === selectedParamCode)
              return {
                date: snapshot.observedOn,
                formattedDate: shortDate(snapshot.observedOn),
                value: metric?.value ?? null,
                limitText: metric?.limitText ?? null,
                status: metric?.status ?? 'MISSING',
              }
            })
          }, [data?.history, activeStationCode, stations, selectedParamCode]);
    const trendStationName = activeStationCode === 'all'
            ? (stations[0]?.name ?? 'Tất cả KCN')
            : (selectedStation?.name ?? '');
    const logRows = useMemo(() => {
            if (!data?.history.length) return []
            let rows = [...data.history]
            if (activeStationCode !== 'all') {
              rows = rows.filter((r) => r.stationCode === activeStationCode)
            }
            if (searchLog.trim()) {
              const q = searchLog.trim().toLowerCase()
              rows = rows.filter((r) => r.observedOn.includes(q) || r.stationName.toLowerCase().includes(q))
            }
            if (logComplianceFilter === 'EXCEEDED') {
              rows = rows.filter((r) => r.metrics.some((m) => m.status === 'EXCEEDED'))
            } else if (logComplianceFilter === 'NORMAL') {
              rows = rows.filter((r) => !r.metrics.some((m) => m.status === 'EXCEEDED'))
            }
            return rows.sort((a, b) => b.observedOn.localeCompare(a.observedOn))
          }, [data?.history, activeStationCode, searchLog, logComplianceFilter]);
    const totalLogPages = Math.max(1, Math.ceil(logRows.length / pageSize));
    const paginatedLogRows = useMemo(() => {
            const start = (logPage - 1) * pageSize
            return logRows.slice(start, start + pageSize)
          }, [logRows, logPage, pageSize]);
    useEffect(() => {
    setLogPage(1)
    }, [activeStationCode, searchLog, logComplianceFilter])
    const coreMetrics = selectedSnapshot?.metrics.filter((m) => ['PH', 'COD', 'TSS', 'NH4', 'TEMP'].includes(m.code)) ?? [];
    const flowMetrics = selectedSnapshot?.metrics.filter((m) => m.code.startsWith('FLOW_')) ?? [];
    return (
    <div className="content-stack monitoring-page">
      <PageTitle
        title="Quan trắc Môi trường"
        detail={`Số liệu quan trắc nước thải tự động từ Cổng công bố Ban Quản lý Khu kinh tế Phú Yên (premier.vn) · ${timeFilter.periodLabel}`}
        action={(
          <div className="monitoring-page-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{timeFilter.displayRange}</Badge>
            <a
              className="glass-button glass-button-link"
              href={data?.source.url ?? 'https://premier.vn/bqlkktpy/cong-bo'}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="externalLink" size={15} /> Mở nguồn Premier
            </a>
            <button
              type="button"
              className="glass-button"
              onClick={publicQuery.refresh}
              disabled={publicQuery.loading}
            >
              <Icon name="refresh" size={15} /> {publicQuery.loading ? 'Đang đọc số liệu' : 'Làm mới số liệu'}
            </button>
          </div>
        )}
      />

      {publicQuery.error && (
        <ErrorBlock message={`${publicQuery.error}. Hệ thống đang bảo đảm vận hành dự phòng từ bộ đệm gần nhất.`} />
      )}

      {publicQuery.loading && !data ? (
        <LoadingBlock label="Đang tải dữ liệu quan trắc công khai từ premier.vn" />
      ) : data ? (
        <>
          {/* Source Status Bar */}
          <section className="glass-panel monitoring-source-bar">
            <div className="monitoring-source-main">
              <span className="monitoring-source-icon"><Icon name="droplets" size={19} /></span>
              <div>
                <strong>Cổng công bố thông tin Quan trắc Môi trường KCN Phú Yên</strong>
                <span>Hệ thống tiếp nhận dữ liệu quan trắc tự động liên tục 24/7 theo QCVN 40:2011/BTNMT</span>
              </div>
            </div>
            <div className="monitoring-source-meta">
              <Badge tone="positive">Trực tuyến 24/7</Badge>
              <span>Đồng bộ: {formatDate(data.source.currentMeasuredAt || data.source.fetchedAt)}</span>
            </div>
          </section>

          {/* Executive KPI Strip */}
          <section className="monitoring-metrics-grid">
            <MetricCard
              icon="land"
              label="Trạm quan trắc tự động"
              value={`${stations.length} trạm KCN`}
              detail="An Phú · Đông Bắc Sông Cầu · Hòa Hiệp 1"
              tone="accent"
            />
            <MetricCard
              icon="shield"
              label="Tuân thủ quy chuẩn QCVN"
              value={`${complianceRate}% Đạt chuẩn`}
              detail={statusCounts.EXCEEDED > 0 ? `${statusCounts.EXCEEDED} chỉ tiêu vượt ngưỡng` : '0 chỉ tiêu vượt quy chuẩn'}
            />
            <MetricCard
              icon="droplets"
              label="Lưu lượng xả thải ngày"
              value={`${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(totalDischargedToday)} m³/ngày`}
              detail={`Đầu vào tiếp nhận: ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(totalInflowToday)} m³/ngày`}
            />
            <MetricCard
              icon="calendar"
              label="Khoảng số liệu công bố"
              value={data.source.availableFrom && data.source.availableTo ? `${shortDate(data.source.availableFrom)} – ${shortDate(data.source.availableTo)}` : '30 ngày gần nhất'}
              detail="Báo cáo tự động chu kỳ 30 ngày"
            />
          </section>

          {/* Station Selector Cards */}
          <section className="glass-panel panel monitoring-station-selector-panel">
            <div className="panel-heading">
              <div>
                <span className="monitoring-kicker">ĐIỂM QUAN TRẮC NƯỚC THẢI TẬP TRUNG</span>
                <h3>Chọn Trạm Khu Công Nghiệp</h3>
              </div>
              <div className="segmented-control" role="tablist" aria-label="Lọc phạm vi điểm quan trắc">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStationCode === 'all'}
                  className={activeStationCode === 'all' ? 'segment-active' : ''}
                  onClick={() => setActiveStationCode('all')}
                >
                  <Icon name="grid" size={15} /> Toàn Khu kinh tế
                </button>
              </div>
            </div>

            <div className="monitoring-station-overview-strip">
              {stationCards.map(({ station, snapshot, ph, cod, tss, flowDay, exceededCount }) => {
                const isSelected = activeStationCode === station.code
                return (
                  <button
                    type="button"
                    key={station.code}
                    className={`monitoring-station-summary-card ${isSelected ? 'monitoring-station-summary-card-active' : ''}`}
                    onClick={() => setActiveStationCode(station.code)}
                  >
                    <div className="monitoring-station-card-head">
                      <span>{station.name}</span>
                      <Badge tone={exceededCount > 0 ? 'negative' : 'positive'}>
                        {exceededCount > 0 ? `${exceededCount} vượt ngưỡng` : 'Đạt chuẩn'}
                      </Badge>
                    </div>
                    <div className="monitoring-station-card-pills">
                      <div className="monitoring-station-card-pill">
                        <span>pH</span>
                        <strong>{formatMonitoringValue(ph?.value ?? null)}</strong>
                      </div>
                      <div className="monitoring-station-card-pill">
                        <span>COD</span>
                        <strong>{formatMonitoringValue(cod?.value ?? null)} <small>mg/L</small></strong>
                      </div>
                      <div className="monitoring-station-card-pill">
                        <span>TSS</span>
                        <strong>{formatMonitoringValue(tss?.value ?? null)} <small>mg/L</small></strong>
                      </div>
                      <div className="monitoring-station-card-pill">
                        <span>Xả ngày</span>
                        <strong>{formatMonitoringValue(flowDay?.value ?? null)} <small>m³</small></strong>
                      </div>
                    </div>
                    <div className="monitoring-station-card-foot">
                      <span>{snapshot ? (snapshot.readingMode === 'CURRENT' ? 'Thời gian thực' : 'Bản ghi 30 ngày') : 'Chưa có'}</span>
                      <span>{snapshot ? shortDate(snapshot.observedOn) : '—'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Main Content Workspace: Navigation Segment */}
          <section className="glass-panel panel monitoring-workspace-panel">
            <div className="monitoring-workspace-heading">
              <div>
                <span className="monitoring-kicker">
                  {activeStationCode === 'all' ? 'TỔNG HỢP TOÀN KHU KINH TẾ PHÚ YÊN' : (selectedStation?.name ?? '')}
                </span>
                <h3>
                  {viewMode === 'overview' && (activeStationCode === 'all' ? 'Bảng đối chiếu thông số các trạm KCN' : 'Bảng thông số vận hành thời gian thực')}
                  {viewMode === 'trend' && 'Phân tích xu hướng & diễn biến 30 ngày'}
                  {viewMode === 'log' && 'Sổ nhật ký dữ liệu quan trắc môi trường'}
                </h3>
              </div>

              <div className="monitoring-workspace-controls">
                <div className="segmented-control" role="tablist" aria-label="Chế độ hiển thị quan trắc">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'overview'}
                    className={viewMode === 'overview' ? 'segment-active' : ''}
                    onClick={() => setViewMode('overview')}
                  >
                    <Icon name="gauge" size={15} /> Thời gian thực
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'trend'}
                    className={viewMode === 'trend' ? 'segment-active' : ''}
                    onClick={() => setViewMode('trend')}
                  >
                    <Icon name="trendingUp" size={15} /> Biểu đồ 30 ngày
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'log'}
                    className={viewMode === 'log' ? 'segment-active' : ''}
                    onClick={() => setViewMode('log')}
                  >
                    <Icon name="calendar" size={15} /> Nhật ký chi tiết
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'waste_pdf'}
                    className={viewMode === 'waste_pdf' ? 'segment-active' : ''}
                    onClick={() => setViewMode('waste_pdf')}
                  >
                    <Icon name="receipt" size={15} /> Chất thải & Báo cáo PDF
                  </button>
                </div>
              </div>
            </div>

            {/* TAB 1: OVERVIEW */}
            {viewMode === 'overview' && (
              <>
                {activeStationCode === 'all' ? (
                  /* Cross-station comparison table */
                  <div className="monitoring-comparison-section">
                    <div className="monitoring-reading-meta">
                      <span><strong>Đối chiếu số liệu giữa các Khu công nghiệp</strong> · Cập nhật mới nhất</span>
                      <Badge tone={statusCounts.EXCEEDED > 0 ? 'negative' : 'positive'}>
                        {statusCounts.EXCEEDED > 0 ? 'Có chỉ tiêu cần chú ý' : 'Toàn bộ đạt tiêu chuẩn'}
                      </Badge>
                    </div>

                    <DataTable minWidth="880px">
                      <thead>
                        <tr>
                          <th>Chỉ tiêu quan trắc</th>
                          <th>Đơn vị</th>
                          <th>Quy chuẩn kiểm soát</th>
                          {stations.map((s) => (
                            <th key={s.code} className="align-right">{s.name}</th>
                          ))}
                          <th className="align-right">Đánh giá chung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.parameters.map((param) => {
                          const stationValues = stations.map((s) => {
                            const snap = data.current.find((r) => r.stationCode === s.code)
                            const m = snap?.metrics.find((x) => x.code === param.code)
                            return { station: s, metric: m }
                          })
                          const anyExceeded = stationValues.some((v) => v.metric?.status === 'EXCEEDED')
                          const commonLimit = stationValues[0]?.metric?.limitText ?? 'Không giới hạn'

                          return (
                            <tr key={param.code}>
                              <td className="cell-strong">
                                <span>{param.displayName}</span>
                                <span className="cell-subtle">{param.code}</span>
                              </td>
                              <td>{param.unit ?? '—'}</td>
                              <td>{commonLimit}</td>
                              {stationValues.map(({ station, metric }) => (
                                <td key={station.code} className="align-right cell-strong">
                                  <span>{formatMonitoringValue(metric?.value ?? null)}</span>
                                  {metric && metric.status !== 'NO_LIMIT' && metric.value !== null && (
                                    <span style={{ marginLeft: '0.35rem' }}>
                                      <Badge tone={monitoringStatusTone(metric.status)}>
                                        {monitoringStatusLabel(metric.status)}
                                      </Badge>
                                    </span>
                                  )}
                                </td>
                              ))}
                              <td className="align-right">
                                <Badge tone={anyExceeded ? 'negative' : 'positive'}>
                                  {anyExceeded ? 'Cần kiểm tra' : 'Đạt chuẩn'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </DataTable>
                  </div>
                ) : selectedSnapshot ? (
                  /* Single station detailed dashboard */
                  <div className="monitoring-station-detail-view">
                    <div className="monitoring-reading-meta">
                      <span>
                        <strong>{selectedStation?.name}</strong> · {selectedSnapshot.readingMode === 'CURRENT' ? 'Thời gian thực' : 'Bản ghi 30 ngày'} · {formatDate(selectedSnapshot.measuredAt)}
                      </span>
                      <Badge tone={selectedSnapshot.metrics.some((m) => m.status === 'EXCEEDED') ? 'negative' : 'positive'}>
                        {selectedSnapshot.metrics.some((m) => m.status === 'EXCEEDED') ? 'Có chỉ tiêu vượt ngưỡng' : 'Đạt quy chuẩn QCVN 40:2011'}
                      </Badge>
                    </div>

                    <div className="monitoring-section-title">
                      <span className="monitoring-kicker">CHỈ TIÊU CHẤT LƯỢNG NƯỚC THẢI ĐẦU RA</span>
                      <small>So sánh liên tục với ngưỡng giới hạn quy chuẩn quốc gia</small>
                    </div>
                    <div className="monitoring-metric-grid">
                      {coreMetrics.map((metric) => (
                        <MonitoringMetricTile metric={metric} key={metric.code} />
                      ))}
                    </div>

                    <div className="monitoring-flow-strip">
                      <div className="monitoring-flow-heading">
                        <span>Lưu lượng nước thải tiếp nhận & xả thải</span>
                        <small>Thông số đo lưu lượng tức thời và lưu lượng tổng kế trong ngày</small>
                      </div>
                      <div className="monitoring-flow-grid">
                        {flowMetrics.map((metric) => (
                          <div className="monitoring-flow-item" key={metric.code}>
                            <span>{metric.displayName}</span>
                            <strong>{formatMonitoringValue(metric.value)} <small>{metric.unit ?? ''}</small></strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyBlock label="Chưa có dữ liệu cho trạm quan trắc đã chọn" />
                )}
              </>
            )}

            {/* TAB 2: TREND CHART */}
            {viewMode === 'trend' && (
              <div className="monitoring-trend-section">
                {trendPoints.length ? (
                  <MonitoringTrendChart
                    points={trendPoints}
                    parameter={selectedParam}
                    stationName={trendStationName}
                    parameters={data.parameters}
                    selectedParamCode={selectedParamCode}
                    onSelectParamCode={setSelectedParamCode}
                  />
                ) : (
                  <EmptyBlock label="Chưa có dữ liệu lịch sử cho chỉ tiêu này" />
                )}
              </div>
            )}

            {/* TAB 3: LOG TABLE */}
            {viewMode === 'log' && (
              <div className="monitoring-log-section">
                <div className="monitoring-table-toolbar">
                  <div className="search-field">
                    <Icon name="search" size={16} />
                    <input
                      value={searchLog}
                      onChange={(e) => setSearchLog(e.target.value)}
                      placeholder="Tìm theo ngày (vd: 2026-09) hoặc tên KCN"
                      aria-label="Tìm nhật ký quan trắc"
                    />
                  </div>

                  <div className="monitoring-table-tools">
                    <div className="segmented-control" role="tablist" aria-label="Lọc trạng thái tuân thủ">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={logComplianceFilter === 'all'}
                        className={logComplianceFilter === 'all' ? 'segment-active' : ''}
                        onClick={() => setLogComplianceFilter('all')}
                      >
                        Tất cả ({logRows.length})
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={logComplianceFilter === 'EXCEEDED'}
                        className={logComplianceFilter === 'EXCEEDED' ? 'segment-active' : ''}
                        onClick={() => setLogComplianceFilter('EXCEEDED')}
                      >
                        Vượt ngưỡng
                      </button>
                    </div>
                  </div>
                </div>

                {paginatedLogRows.length ? (
                  <>
                    <DataTable minWidth="980px">
                      <thead>
                        <tr>
                          <th>Ngày đo</th>
                          <th>Điểm quan trắc</th>
                          <th>pH</th>
                          <th>COD <small>(mg/L)</small></th>
                          <th>TSS <small>(mg/L)</small></th>
                          <th>Amoni <small>(mg/L)</small></th>
                          <th>Nhiệt độ <small>(°C)</small></th>
                          <th className="align-right">Q xả ngày <small>(m³/ngày)</small></th>
                          <th className="align-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogRows.map((snapshot) => {
                          const ph = snapshot.metrics.find((m) => m.code === 'PH')
                          const cod = snapshot.metrics.find((m) => m.code === 'COD')
                          const tss = snapshot.metrics.find((m) => m.code === 'TSS')
                          const nh4 = snapshot.metrics.find((m) => m.code === 'NH4')
                          const temp = snapshot.metrics.find((m) => m.code === 'TEMP')
                          const flowOutDay = snapshot.metrics.find((m) => m.code === 'FLOW_OUT_DAY')
                          const isExceeded = snapshot.metrics.some((m) => m.status === 'EXCEEDED')

                          return (
                            <tr key={`${snapshot.stationCode}-${snapshot.observedOn}`}>
                              <td className="cell-strong">{shortDate(snapshot.observedOn)}</td>
                              <td>{snapshot.stationName}</td>
                              <td>{formatMonitoringValue(ph?.value ?? null)}</td>
                              <td className="cell-strong">{formatMonitoringValue(cod?.value ?? null)}</td>
                              <td>{formatMonitoringValue(tss?.value ?? null)}</td>
                              <td>{formatMonitoringValue(nh4?.value ?? null)}</td>
                              <td>{formatMonitoringValue(temp?.value ?? null)}</td>
                              <td className="align-right cell-strong">{formatMonitoringValue(flowOutDay?.value ?? null)}</td>
                              <td className="align-right">
                                <Badge tone={isExceeded ? 'negative' : 'positive'}>
                                  {isExceeded ? 'Vượt chuẩn' : 'Đạt chuẩn'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </DataTable>

                    {/* Pagination */}
                    <div className="monitoring-pagination">
                      <span>Hiển thị {((logPage - 1) * pageSize) + 1}–{Math.min(logPage * pageSize, logRows.length)} trong tổng số {logRows.length} bản ghi</span>
                      <div className="monitoring-pagination-buttons">
                        <button
                          type="button"
                          className="glass-button"
                          disabled={logPage <= 1}
                          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                        >
                          Trang trước
                        </button>
                        <span className="monitoring-page-indicator">Trang {logPage} / {totalLogPages}</span>
                        <button
                          type="button"
                          className="glass-button"
                          disabled={logPage >= totalLogPages}
                          onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                        >
                          Trang sau
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyBlock label="Không tìm thấy bản ghi quan trắc phù hợp với bộ lọc" />
                )}
              </div>
            )}

            {/* TAB 4: WASTE & PDF REPORT INGESTION */}
            {viewMode === 'waste_pdf' && (
              <div className="monitoring-waste-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div className="metrics-grid-4">
                  <MetricCard
                    icon="droplets"
                    label="Tổng nước thải doanh nghiệp"
                    value={`${new Intl.NumberFormat('vi-VN').format((wasteQuery.data ?? []).reduce((sum, r) => sum + r.wastewaterM3, 0))} m³`}
                    detail={`${wasteQuery.data?.length ?? 0} kỳ báo cáo đã xác nhận`}
                    tone="accent"
                  />
                  <MetricCard
                    icon="receipt"
                    label="Tổng chất thải rắn xử lý"
                    value={`${new Intl.NumberFormat('vi-VN').format((wasteQuery.data ?? []).reduce((sum, r) => sum + r.solidWasteKg, 0))} kg`}
                    detail="Rác sinh hoạt & công nghiệp"
                  />
                  <MetricCard
                    icon="shield"
                    label="Hồ sơ PDF đã duyệt"
                    value={String((pdfQueueQuery.data ?? []).filter((p) => p.status === 'CONFIRMED').length)}
                    detail="Độ tin cậy > 90%"
                  />
                  <MetricCard
                    icon="alert"
                    label="Hàng chờ kiểm tra PDF"
                    value={String((pdfQueueQuery.data ?? []).filter((p) => p.status === 'PENDING_REVIEW').length)}
                    detail="Cần Admin xác nhận"
                    tone={(pdfQueueQuery.data ?? []).some((p) => p.status === 'PENDING_REVIEW') ? 'accent' : 'neutral'}
                  />
                </div>

                {/* Sub-panel 1: Waste Records */}
                <div className="glass-panel panel table-panel">
                  <PanelHeading
                    title="Khối lượng nước thải & chất thải theo doanh nghiệp"
                    meta={<span className="panel-count">{wasteQuery.data?.length ?? 0} bản ghi</span>}
                  />
                  {wasteQuery.loading ? (
                    <LoadingBlock label="Đang tải khối lượng chất thải doanh nghiệp" />
                  ) : wasteQuery.error ? (
                    <ErrorBlock message={wasteQuery.error} />
                  ) : (wasteQuery.data ?? []).length ? (
                    <DataTable minWidth="980px">
                      <thead>
                        <tr>
                          <th>Doanh nghiệp</th>
                          <th>KCN</th>
                          <th>Kỳ báo cáo</th>
                          <th className="align-right">Nước thải (m³)</th>
                          <th className="align-right">Chất thải rắn (kg)</th>
                          <th>Nguồn dữ liệu</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wasteQuery.data ?? []).map((rec) => (
                          <tr key={rec.id}>
                            <td className="cell-strong">
                              <span>{rec.enterpriseName}</span>
                            </td>
                            <td>{rec.parkName}</td>
                            <td>{rec.reportingQuarter ? `Quý ${rec.reportingQuarter}/${rec.reportingYear}` : `Năm ${rec.reportingYear}`}</td>
                            <td className="align-right cell-strong">{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(rec.wastewaterM3)} m³</td>
                            <td className="align-right">{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(rec.solidWasteKg)} kg</td>
                            <td>
                              <Badge tone="neutral">{rec.sourceType === 'PDF_REPORT' ? 'Báo cáo PDF' : 'Kiểm tra'}</Badge>
                            </td>
                            <td>
                              <Badge tone={rec.status === 'CONFIRMED' ? 'positive' : 'warning'}>
                                {rec.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ duyệt'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : (
                    <EmptyBlock label="Chưa có dữ liệu chất thải doanh nghiệp" />
                  )}
                </div>

                {/* Sub-panel 2: PDF Verification Queue */}
                <div className="glass-panel panel table-panel">
                  <PanelHeading
                    title="Hàng chờ kiểm tra & bóc tách tệp PDF báo cáo doanh nghiệp"
                    meta={<span className="panel-count">{pdfQueueQuery.data?.length ?? 0} hồ sơ PDF</span>}
                  />
                  {pdfQueueQuery.loading ? (
                    <LoadingBlock label="Đang tải hàng chờ bóc tách PDF" />
                  ) : pdfQueueQuery.error ? (
                    <ErrorBlock message={pdfQueueQuery.error} />
                  ) : (pdfQueueQuery.data ?? []).length ? (
                    <DataTable minWidth="1050px">
                      <thead>
                        <tr>
                          <th>Tên tệp PDF / Mã nhận diện</th>
                          <th>Doanh nghiệp / KCN</th>
                          <th>Kỳ</th>
                          <th className="align-right">Nước thải bóc tách</th>
                          <th className="align-right">Rác bóc tách</th>
                          <th>Độ tin cậy</th>
                          <th>Dạng tệp</th>
                          <th>Trạng thái</th>
                          {user.roleCode === 'DATA_ADMIN' && <th>Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(pdfQueueQuery.data ?? []).map((doc) => (
                          <tr key={doc.id}>
                            <td className="cell-strong">
                              <span>{doc.fileName}</span>
                              <span className="cell-subtle cell-hash" title={doc.sha256}>{doc.sha256.slice(0, 16)}...</span>
                            </td>
                            <td>
                              <span>{doc.enterpriseName}</span>
                              <span className="cell-subtle">{doc.parkName}</span>
                            </td>
                            <td>{doc.reportingPeriod}</td>
                            <td className="align-right cell-strong">
                              {doc.extractedWastewaterM3 !== null ? `${new Intl.NumberFormat('vi-VN').format(doc.extractedWastewaterM3)} m³` : 'Chưa có'}
                            </td>
                            <td className="align-right">
                              {doc.extractedWasteKg !== null ? `${new Intl.NumberFormat('vi-VN').format(doc.extractedWasteKg)} kg` : 'Chưa có'}
                            </td>
                            <td>
                              <Badge tone={doc.confidenceScore >= 0.9 ? 'positive' : doc.confidenceScore >= 0.8 ? 'info' : 'warning'}>
                                {Math.round(doc.confidenceScore * 100)}%
                              </Badge>
                            </td>
                            <td>
                              <span className="cell-subtle">{doc.isScanned ? 'Bản scan (ảnh)' : 'Văn bản số'}</span>
                            </td>
                            <td>
                              <Badge tone={doc.status === 'CONFIRMED' ? 'positive' : doc.status === 'REJECTED' ? 'negative' : 'warning'}>
                                {doc.status === 'CONFIRMED' ? 'Đã xác nhận' : doc.status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt'}
                              </Badge>
                            </td>
                            {user.roleCode === 'DATA_ADMIN' && (
                              <td>
                                {doc.status === 'PENDING_REVIEW' ? (
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                      type="button"
                                      className="glass-button"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                      onClick={() => handleConfirmPdf(doc.id, 'CONFIRMED')}
                                    >
                                      <Icon name="check" size={13} /> Duyệt
                                    </button>
                                    <button
                                      type="button"
                                      className="glass-button"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: 'var(--color-negative)' }}
                                      onClick={() => handleConfirmPdf(doc.id, 'REJECTED')}
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                ) : (
                                  <span className="cell-subtle">Đã xử lý</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : (
                    <EmptyBlock label="Không có tệp PDF nào trong hàng chờ" />
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Regulatory footnote */}
          <div className="glass-panel panel monitoring-footer-note">
            <div className="inline-note">
              <Icon name="shield" size={17} />
              <div>
                <strong>Căn cứ pháp lý và Quy chuẩn kỹ thuật:</strong> Số liệu được kết nối và hiển thị tự động từ Trạm quan trắc nước thải tập trung tại các KCN Phú Yên theo quy định tại Nghị định số 08/2022/NĐ-CP và Thông tư số 10/2021/TT-BTNMT của Bộ Tài nguyên và Môi trường. Giới hạn quy chuẩn áp dụng theo QCVN 40:2011/BTNMT và quy định tiếp nhận nước thải của Ban Quản lý Khu kinh tế Phú Yên. Nguồn công bố: <a href={data.source.url} target="_blank" rel="noreferrer">premier.vn/bqlkktpy/cong-bo</a>.
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyBlock label="Chưa nhận được dữ liệu công khai từ Premier" />
      )}
    </div>
    )
}
