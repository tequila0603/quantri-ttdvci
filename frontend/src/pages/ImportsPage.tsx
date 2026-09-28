import { useState } from "react";
import { User, Page, ImportBatch, useApiData, formatDate } from "../utils/shared";
import { Icon } from "../components/ui/Icon";
import { Badge } from "../components/ui/Badge";
import { LoadingBlock } from "../components/ui/LoadingBlock";
import { EmptyBlock } from "../components/ui/EmptyBlock";
import { ErrorBlock } from "../components/ui/ErrorBlock";
import { PageTitle } from "../components/ui/PageTitle";
import { PanelHeading } from "../components/ui/PanelHeading";
import { DataTable } from "../components/ui/DataTable";
import { FinanceImportView } from "../components/FinanceImportView";

export function ImportsPage({ user }: { user: User }) {
  const query = useApiData<Page<ImportBatch>>('/admin/imports?limit=100', user);
  const rows = query.data?.data ?? [];
  const [isImportOpen, setIsImportOpen] = useState(true);
  const pageActions = (
    <div className="monitoring-page-actions">
      <button type="button" className="glass-button glass-button-primary" onClick={() => setIsImportOpen((value) => !value)} aria-expanded={isImportOpen} aria-controls="finance-import-form">
        <Icon name="upload" size={16} /> {isImportOpen ? 'Ẩn khu vực import' : 'Import dữ liệu'}
      </button>
      <button type="button" className="glass-button" onClick={query.refresh}><Icon name="refresh" size={16} /> Làm mới</button>
    </div>
  );
  
  return (
    <div className="content-stack">
      <PageTitle title="Import" detail={`${rows.length} lô dữ liệu được ghi nhận`} action={pageActions} />
      
      <div className="permission-strip glass-panel">
        <Icon name="shield" size={17} />
        <span>Admin dữ liệu có quyền theo dõi nguồn và dấu vết import. Giám đốc không truy cập khu vực này.</span>
      </div>
      
      {isImportOpen && <div id="finance-import-form"><FinanceImportView user={user} onComplete={() => { setIsImportOpen(false); query.refresh(); }} /></div>}
      
      <section className="glass-panel panel table-panel">
        <PanelHeading title="Lịch sử lô import" meta={<span className="panel-count">Audit nguồn dữ liệu</span>} />
        {query.loading ? <LoadingBlock /> : query.error ? <ErrorBlock message={query.error} /> : rows.length ? 
          <DataTable minWidth="840px">
            <thead>
              <tr>
                <th>Tệp nguồn</th>
                <th>Loại dữ liệu</th>
                <th>Kỳ</th>
                <th>Trạng thái</th>
                <th>Dòng hợp lệ</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="cell-strong">{row.sourceFile}</td>
                  <td>{row.importKind}</td>
                  <td>{row.reportingPeriod || '-'}</td>
                  <td>
                    <Badge tone={row.status === 'CONFIRMED' || row.status === 'SUCCESS' ? 'positive' : row.status === 'FAILED' ? 'negative' : 'warning'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td>{row.acceptedRows != null ? `${row.acceptedRows}/${row.totalRows}` : '-'}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable> : <EmptyBlock label="Chưa có lô import nào được ghi nhận" />
        }
      </section>
    </div>
  )
}
