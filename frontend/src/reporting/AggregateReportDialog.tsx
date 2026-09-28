import { useEffect, useRef, useState } from 'react'
import './aggregate-report.css'

type ParkOption = { code: string; name: string }

type ReportColumn = { key: string; label: string; align?: 'left' | 'center' | 'right' }
type ReportTable = {
  title: string
  unit?: string | null
  columns: ReportColumn[]
  rows: Array<Record<string, string>>
  totalRow?: Record<string, string> | null
}
type ReportSection = { id: string; title: string; paragraphs: string[]; tables: ReportTable[] }
type AggregateReport = {
  scope: {
    periodLabel: string
    fromDate: string
    toDate: string
    parkName: string
    generatedAt: string
  }
  sourceCoverage?: Array<{ label: string; status: string; detail?: string }>
  overview: Array<{ label: string; value: string; unit: string }>
  sections: ReportSection[]
  findings: Array<{ id: string; title: string; evidence: string; cause: string }>
  recommendations: Array<{ findingId: string; text: string }>
}

type ReportRequest = {
  year: number
  periodLabel: string
  fromDate: string
  toDate: string
  parkCode: string | null
  sections: string[]
  expectedFingerprint?: string
}

const SECTION_OPTIONS = [
  { value: 'overview', label: 'Tình hình chung' },
  { value: 'enterprises', label: 'Doanh nghiệp' },
  { value: 'infrastructure', label: 'Hạ tầng' },
  { value: 'maintenance', label: 'Duy tu, bảo dưỡng' },
  { value: 'incidents', label: 'Sự cố' },
  { value: 'monitoring', label: 'Quan trắc' },
  { value: 'finance', label: 'Tài chính' },
] as const

const API_ROOT = import.meta.env.VITE_API_ROOT ?? '/api/v1'

function isoDateLabel(value: string): string {
  const [year, month, day] = value.split('-')
  return day && month && year ? `${day}/${month}/${year}` : value
}

function filenameFromDisposition(value: string | null): string {
  const match = value?.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  return match ? decodeURIComponent(match[1].replace(/\"/g, '').trim()) : 'bao-cao-tong-hop.docx'
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
  return body?.error?.message ?? 'Không thể xử lý báo cáo'
}

export function AggregateReportDialog({
  open,
  onClose,
  year,
  periodLabel,
  fromDate,
  toDate,
  parkCode,
  parks,
}: {
  open: boolean
  onClose: () => void
  year: number
  periodLabel?: string
  fromDate?: string
  toDate?: string
  parkCode: string
  parks: ParkOption[]
}) {
  const firstSectionRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<ReportRequest>(() => ({
    year,
    periodLabel: periodLabel || `Năm ${year}`,
    fromDate: fromDate || `${year}-01-01`,
    toDate: toDate || `${year}-12-31`,
    parkCode: parkCode || null,
    sections: SECTION_OPTIONS.map((item) => item.value),
  }))
  const [preview, setPreview] = useState<{ fingerprint: string; report: AggregateReport } | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm((current) => ({
      ...current,
      year,
      periodLabel: periodLabel || `Năm ${year}`,
      fromDate: fromDate || `${year}-01-01`,
      toDate: toDate || `${year}-12-31`,
      parkCode: parkCode || null,
    }))
    setPreview(null)
    setError(null)
    window.setTimeout(() => firstSectionRef.current?.focus(), 0)
  }, [open, parkCode, year, periodLabel, fromDate, toDate])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !loading && !downloading) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [downloading, loading, onClose, open])

  if (!open) return null
  const selectedParkName = form.parkCode
    ? parks.find((park) => park.code === form.parkCode)?.name ?? 'KCN đang chọn'
    : 'Toàn bộ KCN'

  const validate = (): string | null => {
    if (!form.periodLabel.trim()) return 'Chưa có kỳ báo cáo từ Dashboard.'
    if (!form.fromDate || !form.toDate || form.fromDate > form.toDate) return 'Khoảng thời gian trên Dashboard không hợp lệ.'
    if (!form.fromDate.startsWith(`${form.year}-`) || !form.toDate.startsWith(`${form.year}-`)) return 'Khoảng thời gian phải nằm trong năm đang chọn trên Dashboard.'
    if (!form.sections.length) return 'Vui lòng chọn ít nhất một phân hệ.'
    return null
  }

  const previewReport = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_ROOT}/reports/aggregate/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const body = await response.json() as { success: boolean; data: { fingerprint: string; model: AggregateReport } }
      setPreview({ fingerprint: body.data.fingerprint, report: body.data.model })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo bản xem trước')
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async () => {
    if (!preview) return
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch(`${API_ROOT}/reports/aggregate/docx`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expectedFingerprint: preview.fingerprint }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filenameFromDisposition(response.headers.get('Content-Disposition'))
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải báo cáo')
      setPreview(null)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="crud-modal-backdrop aggregate-report-backdrop" role="dialog" aria-modal="true" aria-labelledby="aggregate-report-title" onMouseDown={(event) => event.target === event.currentTarget && !loading && !downloading && onClose()}>
      <div className="crud-modal-card aggregate-report-dialog">
        <div className="crud-modal-header">
          <div>
            <h3 id="aggregate-report-title">Xuất báo cáo tổng hợp</h3>
            <p>Chọn mục báo cáo, xem trước nội dung rồi tải DOCX.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Đóng" onClick={onClose} disabled={loading || downloading}>×</button>
        </div>

        <div className="aggregate-report-layout">
          <div className="crud-modal-body aggregate-report-form">
            <section className="report-form-section">
              <h4>Phân hệ đưa vào báo cáo</h4>
              <p className="report-scope-summary">Kỳ và phạm vi lấy từ Dashboard: {form.periodLabel} · {isoDateLabel(form.fromDate)}–{isoDateLabel(form.toDate)} · {selectedParkName}</p>
              <fieldset className="report-section-options">
                <legend>Mục cần tổng hợp</legend>
                {SECTION_OPTIONS.map((item, index) => <label key={item.value}><input ref={index === 0 ? firstSectionRef : undefined} type="checkbox" checked={form.sections.includes(item.value)} onChange={(event) => { setForm((current) => ({ ...current, sections: event.target.checked ? [...current.sections, item.value] : current.sections.filter((value) => value !== item.value) })); setPreview(null) }} />{item.label}</label>)}
              </fieldset>
            </section>

            {error && <div className="report-form-error" role="alert">{error}</div>}
            <div className="aggregate-report-actions">
              <button type="button" className="glass-button" onClick={onClose} disabled={loading || downloading}>Hủy</button>
              <button type="button" className="glass-button glass-button-primary" onClick={previewReport} disabled={loading || downloading}>{loading ? 'Đang tổng hợp...' : 'Xem trước báo cáo'}</button>
              <button type="button" className="glass-button glass-button-primary" onClick={downloadReport} disabled={!preview || loading || downloading}>{downloading ? 'Đang tạo DOCX...' : 'Tải DOCX'}</button>
            </div>
          </div>

          <div className="aggregate-report-preview" aria-live="polite">
            {preview ? <ReportPreview report={preview.report} /> : <div className="report-preview-empty"><strong>Chưa có bản xem trước</strong><span>Chọn mục báo cáo rồi nhấn “Xem trước báo cáo”.</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportPreview({ report }: { report: AggregateReport }) {
  const { scope } = report
  const overviewSection = report.sections.find((section) => section.id === 'overview')
  return (
    <article className="report-paper">
      <h1>BÁO CÁO</h1>
      <h2>Tình hình hoạt động trong {scope.periodLabel} tại {scope.parkName}</h2>

      {(report.overview.length > 0 || overviewSection) && <section>{overviewSection?.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{report.overview.length > 0 && <table><thead><tr><th>STT</th><th>Chỉ tiêu</th><th>Đơn vị tính</th><th>Giá trị</th></tr></thead><tbody>{report.overview.map((item, index) => <tr key={`${item.label}-${index}`}><td>{index + 1}</td><td>{item.label}</td><td>{item.unit}</td><td className="numeric">{item.value}</td></tr>)}</tbody></table>}</section>}

      {report.sections.some((section) => section.id !== 'overview') && <section>{report.sections.filter((section) => section.id !== 'overview').map((section) => <div key={section.id}>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{section.tables.map((table, tableIndex) => <div className="report-preview-table" key={`${section.id}-${tableIndex}`}><h4>{table.title}</h4><table><thead><tr>{table.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{table.columns.map((column) => <td key={column.key} className={column.align === 'right' ? 'numeric' : column.align === 'center' ? 'center' : ''}>{row[column.key] ?? 'Chưa có dữ liệu'}</td>)}</tr>)}{table.totalRow && <tr className="report-total-row">{table.columns.map((column) => <td key={column.key} className={column.align === 'right' ? 'numeric' : column.align === 'center' ? 'center' : ''}>{table.totalRow?.[column.key] ?? ''}</td>)}</tr>}</tbody></table>{table.unit && <div className="report-table-unit">Đơn vị tính: {table.unit}</div>}</div>)}</div>)}</section>}

      <section>{report.findings.length ? report.findings.map((item, index) => <p key={item.id}><strong>{index + 1}. {item.title}:</strong> {item.evidence} Nguyên nhân: {item.cause}</p>) : <p>Tại thời điểm chốt dữ liệu không ghi nhận tồn tại thuộc các tiêu chí thống kê của báo cáo.</p>}</section>
      <section>{report.recommendations.length ? report.recommendations.map((item, index) => <p key={`${item.findingId}-${index}`}>{index + 1}. {item.text}</p>) : <p>Không phát sinh đề xuất từ các tiêu chí thống kê của báo cáo.</p>}</section>

    </article>
  )
}
