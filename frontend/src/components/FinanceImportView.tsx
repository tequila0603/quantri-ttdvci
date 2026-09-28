import React, { useState, useRef, useMemo } from 'react'
import { fetchApi, User, formatCurrency, ImportBatch } from '../utils/shared'
import { Icon } from './ui/Icon'
import { Badge } from './ui/Badge'
import { DataTable } from './ui/DataTable'
import { PanelHeading } from './ui/PanelHeading'
import { MetricCard } from './ui/MetricCard'

type PreviewRow = {
  sourceRow: number
  status: 'VALID' | 'ERROR' | 'DUPLICATE'
  errorCode?: string
  errorField?: string
  message?: string
}

export function FinanceImportView({ user, onComplete }: { user: User, onComplete: () => void }) {
  const [kind, setKind] = useState('annual_lease')
  const [year, setYear] = useState(new Date().getFullYear())
  const [file, setFile] = useState<File | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewData, setPreviewData] = useState<{
    batchId: string
    sourceFile: string
    totalRows: number
    acceptedRows: number
    rejectedRows: number
    duplicateRows: number
    totalAmount: number
    previewRows: PreviewRow[]
    errors: PreviewRow[]
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleDownloadTemplate = () => {
    window.location.href = `/api/v1/admin/imports/finance/templates/${kind}`
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setPreviewData(null)
      setError('')
    }
  }
  
  const handleCheck = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('importKind', kind)
      formData.append('reportingYear', year.toString())
      
      const res = await fetch('/api/v1/admin/imports/finance/preview', {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        setPreviewData(json.data)
      } else {
        setError(json.error?.message || 'Lỗi không xác định')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleConfirm = async () => {
    if (!previewData) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<any>(`/admin/imports/finance/${previewData.batchId}/confirm`, { method: 'POST' })
      if (res.success) {
        setFile(null)
        setPreviewData(null)
        onComplete()
      } else {
        setError(res.error?.message || 'Lỗi xác nhận')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleCancel = async () => {
    if (previewData) {
      try {
        await fetchApi<any>(`/admin/imports/finance/${previewData.batchId}/cancel`, { method: 'POST' })
      } catch (e) {}
    }
    setFile(null)
    setPreviewData(null)
    setError('')
  }
  
  return (
    <div className="glass-panel panel">
      <PanelHeading title="Nhập dữ liệu tài chính" />
      
      {!previewData ? (
        <div className="import-setup" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Loại dữ liệu</label>
              <select className="glass-select" value={kind} onChange={e => setKind(e.target.value)} style={{ width: '100%' }}>
                <option value="annual_lease">Nghĩa vụ thuê hằng năm</option>
                <option value="invoice">Hóa đơn</option>
                <option value="payment">Thanh toán</option>
                <option value="project_disbursement">Kế hoạch vốn và giải ngân dự án</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Năm / Kỳ báo cáo</label>
              <select className="glass-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100%' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>Năm {y}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <button type="button" className="glass-button" onClick={handleDownloadTemplate}>
              <Icon name="download" size={16} /> Tải tệp mẫu
            </button>
          </div>
          
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: '8px', padding: '2rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .csv" onChange={handleFileChange} />
            <Icon name="upload" size={24} />
            <p><strong>{file ? file.name : 'Chọn hoặc kéo thả tệp XLSX/CSV vào đây'}</strong></p>
            {file && <p style={{ fontSize: '0.85rem', color: 'var(--color-subtle)' }}>{(file.size / 1024).toFixed(1)} KB</p>}
          </div>
          
          {error && <div style={{ color: 'var(--color-negative)', padding: '0.75rem', background: 'rgba(235,87,87,0.1)', borderRadius: '6px' }}>{error}</div>}
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="glass-button glass-button-primary" disabled={!file || loading} onClick={handleCheck}>
              {loading ? 'Đang xử lý...' : 'Kiểm tra dữ liệu'}
            </button>
          </div>
        </div>
      ) : (
        <div className="import-preview" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dashboard-grid-4col">
            <MetricCard icon="file" label="Tổng số dòng" value={previewData.totalRows.toString()} detail="Dòng" />
            <MetricCard icon="check" label="Hợp lệ" value={previewData.acceptedRows.toString()} detail="Dòng" tone="accent" />
            <MetricCard icon="alert" label="Lỗi / Trùng" value={(previewData.rejectedRows).toString()} detail="Dòng" tone="accent" />
            <MetricCard icon="dollar" label="Tổng số tiền" value={formatCurrency(previewData.totalAmount)} detail="VNĐ" tone="accent" />
          </div>
          
          {error && <div style={{ color: 'var(--color-negative)', padding: '0.75rem', background: 'rgba(235,87,87,0.1)', borderRadius: '6px' }}>{error}</div>}
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <DataTable minWidth="800px">
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Trạng thái</th>
                  <th>Mã lỗi</th>
                  <th>Cột lỗi</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {previewData.previewRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.sourceRow}</td>
                    <td>
                      <Badge tone={r.status === 'VALID' ? 'positive' : r.status === 'DUPLICATE' ? 'warning' : 'negative'}>{r.status}</Badge>
                    </td>
                    <td className="cell-subtle">{r.errorCode || '-'}</td>
                    <td className="cell-subtle">{r.errorField || '-'}</td>
                    <td>{r.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="glass-button" disabled={loading} onClick={handleCancel}>Hủy & Chọn lại</button>
            <button type="button" className="glass-button glass-button-primary" disabled={loading || previewData.rejectedRows > 0} onClick={handleConfirm}>
              {loading ? 'Đang xác nhận...' : 'Xác nhận nhập dữ liệu'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
