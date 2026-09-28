import re
with open('frontend/src/pages/OverviewPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix KPI 5: Disbursement
old_kpi5 = r'''<div className="dashboard-kpi-top">
              <span className="dashboard-kpi-title">Đã giải ngân DA</span>
              <div className={`dashboard-kpi-icon ${overallDisbursementRate >= 60 ? 'dashboard-kpi-icon-positive' : overallDisbursementRate >= 40 ? 'dashboard-kpi-icon-info' : 'dashboard-kpi-icon-warning'}`}>
                <Icon name="chart" size={17} />
              </div>
            </div>
            <div className="dashboard-kpi-value">
              {projectsQuery.data ? compactCurrency(totalDisbursed) : (projectsQuery.loading ? 'Đang tải' : '—')}
            </div>
            <div className="dashboard-kpi-footer">
              <span>{projectsQuery.data ? `Đạt ${overallDisbursementRate.toFixed(1)}% kế hoạch vốn` : 'Tỷ lệ giải ngân'}</span>
              <span className="arrow-icon"><Icon name="arrow" size={14} /></span>
            </div>'''

new_kpi5 = r'''<div className="dashboard-kpi-top">
              <span className="dashboard-kpi-title">Giải ngân dự án</span>
              <div className="dashboard-kpi-icon dashboard-kpi-icon-neutral">
                <Icon name="chart" size={17} />
              </div>
            </div>
            <div className="dashboard-kpi-value" style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>
              Chưa có dữ liệu
            </div>
            <div className="dashboard-kpi-footer">
              <span>Hệ thống chưa ghi nhận giải ngân thực tế</span>
            </div>'''
c = c.replace(old_kpi5, new_kpi5)

# Fix OverviewDisbursementChart usage
old_chart1 = r'''<article className="dashboard-panel">
            <PanelHeading
              title="Tiến độ Giải ngân Kế hoạch Vốn"
              meta={link('finance', 'Chi tiết dự án', { parkCode: dashboardPark, tab: 'projects' })}
            />
            <p className="dashboard-caption">So sánh vốn kế hoạch duyệt và số tiền đã giải ngân thực tế theo từng KCN</p>
            {sectionState(projectsQuery, (
              <OverviewDisbursementChart
                projects={projects}
                parks={allParks}
                selectedPark={dashboardPark}
                onNavigate={onNavigate}
              />
            ))}
          </article>'''

new_chart1 = r'''<article className="dashboard-panel">
            <PanelHeading
              title="KCN nào đang chậm giải ngân?"
              meta={link('finance', 'Chi tiết dự án', { parkCode: dashboardPark, tab: 'projects' })}
            />
            <p className="dashboard-caption">So sánh kế hoạch, vốn phân bổ và giải ngân thực tế</p>
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              Chưa có dữ liệu giải ngân thực tế để đánh giá tiến độ.
            </div>
          </article>'''
c = c.replace(old_chart1, new_chart1)

# Chart 2 title
c = c.replace('title="Cơ cấu Trạng thái Công trình Hạ tầng"', 'title="Công trình nào cần bảo dưỡng?"')

# Chart 3 title 
c = c.replace('title="Quy mô Doanh nghiệp theo KCN"', 'title="KCN nào có nhiều doanh nghiệp nhất?"')
c = c.replace('title="Tiến độ Lệnh bảo dưỡng Hạ tầng"', 'title="Đơn vị nào có nhiều công việc quá hạn?"')

with open('frontend/src/pages/OverviewPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
