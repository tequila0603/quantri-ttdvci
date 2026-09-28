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

export function LoginView({ onLogin }: { onLogin: (user: User) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [shaking, setShaking] = useState(false);

    function triggerShake() {
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
    }

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!username.trim() || !password) {
          setError('Vui lòng nhập tên đăng nhập và mật khẩu')
          triggerShake()
          return
        }

        setSubmitting(true)
        setError(null)
        try {
          const user = await fetchApi<User>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: username.trim(), password }),
          })
          onLogin(user)
        } catch (reason: unknown) {
          setError(reason instanceof Error ? reason.message : 'Đăng nhập không thành công')
          triggerShake()
        } finally {
          setSubmitting(false)
        }
    }

    return (
    <main className="login-page">
      <div className="login-ambient login-ambient-1" aria-hidden="true" />
      <div className="login-ambient login-ambient-2" aria-hidden="true" />
      <section className={`login-card glass-panel ${shaking ? 'login-card-shake' : ''}`}>
        <div className="login-brand-header">
          <div className="login-brand-mark" aria-hidden="true">
            <span>T</span>
          </div>
          <div className="login-brand-text">
            <h1 className="login-title">Đăng nhập</h1>
            <p className="login-subtitle">Trung tâm Dịch vụ công ích</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-field-group">
            <label htmlFor="login-username" className="login-label">
              Tên đăng nhập
            </label>
            <div className="login-input-box">
              <span className="login-input-icon">
                <Icon name="user" size={16} />
              </span>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={submitting}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập tên tài khoản"
                className="login-input"
              />
            </div>
          </div>

          <div className="login-field-group">
            <label htmlFor="login-password" className="login-label">
              Mật khẩu
            </label>
            <div className="login-input-box">
              <span className="login-input-icon">
                <Icon name="lock" size={16} />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={submitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                className="login-input"
              />
              <button
                type="button"
                className="login-toggle-pw"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error-alert" role="alert" aria-live="assertive">
              <Icon name="alert" size={15} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="login-submit-btn"
          >
            {submitting ? (
              <span className="login-spinner" aria-hidden="true" />
            ) : null}
            <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
            {!submitting && (
              <span className="login-btn-arrow">
                <Icon name="arrow" size={16} />
              </span>
            )}
          </button>
        </form>
      </section>
    </main>
    )
}
