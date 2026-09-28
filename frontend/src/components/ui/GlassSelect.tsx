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
import { Icon } from "./Icon";
import { Badge } from "./Badge";
import { LoadingBlock } from "./LoadingBlock";
import { EmptyBlock } from "./EmptyBlock";
import { ErrorBlock } from "./ErrorBlock";
import { PageTitle } from "./PageTitle";
import { PanelHeading } from "./PanelHeading";
import { MetricCard } from "./MetricCard";
import { DataTable } from "./DataTable";

export function GlassSelect({
      value,
      options,
      onChange,
      label,
      icon,
      ariaLabel,
      placeholder = 'Chọn một mục',
      loading = false,
      disabled = false,
      error = false,
      success = false,
      className = '',
    }: {
          value: string
          options: GlassSelectOption[]
          onChange: (value: string) => void
          label: string
          icon: IconName
          ariaLabel: string
          placeholder?: string
          loading?: boolean
          disabled?: boolean
          error?: boolean
          success?: boolean
          className?: string
        }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const id = useId().replace(/:/g, '');
    const selectedIndex = options.findIndex((option) => option.value === value);
    const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
    const unavailable = disabled || loading;
    const state = loading ? 'loading' : disabled ? 'disabled' : error ? 'error' : success ? 'success' : open ? 'open' : 'default';
    useEffect(() => {
    setActiveIndex(Math.max(selectedIndex, 0))
    }, [selectedIndex, options.length])
    useEffect(() => {
    if (!open) return undefined
    if (selectedIndex >= 0) {
      requestAnimationFrame(() => {
        const optionEl = document.getElementById(`${id}-option-${selectedIndex}`)
        optionEl?.scrollIntoView({ block: 'nearest' })
      })
    }
    function closeOnOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
    }, [open, selectedIndex, id])

    function selectOption(option: GlassSelectOption) {
        onChange(option.value)
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'Escape') {
          if (open) {
            event.preventDefault()
            setOpen(false)
          }
          return
        }

        if (unavailable || !options.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) {
            setOpen(true)
            setActiveIndex(Math.max(selectedIndex, 0))
            return
          }
          setActiveIndex((current) => event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0))
          return
        }

        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          setOpen(true)
          setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (open && options[activeIndex]) selectOption(options[activeIndex])
          else setOpen(true)
        }
    }

    return (
    <div ref={rootRef} className={`glass-select ${open ? 'glass-select-open' : ''} ${className}`.trim()} data-state={state}>
      <button
        ref={triggerRef}
        type="button"
        className="glass-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && options[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
        aria-busy={loading || undefined}
        disabled={unavailable}
        onClick={() => !unavailable && setOpen((current) => !current)}
        onBlur={(event) => {
          if (event.relatedTarget && !rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false)
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="glass-select-icon"><Icon name={icon} size={15} /></span>
        <span className="glass-select-label">{label}</span>
        <span className="glass-select-value">{loading ? 'Đang tải' : selectedOption?.label ?? placeholder}</span>
        <span className="glass-select-caret"><Icon name="chevron" size={14} /></span>
      </button>
      <div id={`${id}-listbox`} className="glass-select-menu" role="listbox" aria-label={ariaLabel} aria-hidden={!open}>
        {options.map((option, index) => (
          <div
            id={`${id}-option-${index}`}
            className={`glass-select-option ${index === activeIndex ? 'glass-select-option-active' : ''}`}
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectOption(option)}
          >
            <span>{option.label}</span>
            {option.value === value && <Icon name="check" size={15} />}
          </div>
        ))}
      </div>
    </div>
    )
}
