import re
with open('frontend/src/pages/OverviewPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix 1: "100% chỉ số đạt chuẩn QCVN 40:2011/BTNMT" in text
c = c.replace("{exceededMetricsCount === 0 ? '100% chỉ số đạt chuẩn QCVN' : `${exceededMetricsCount} thông số vượt ngưỡng`}", "{exceededMetricsCount > 0 ? `${exceededMetricsCount} thông số vượt ngưỡng` : (stations.length === 0 ? 'Chưa đủ dữ liệu' : 'Tất cả chỉ tiêu đạt chuẩn')}")

# Fix 1b: in flow description
c = c.replace("100% chỉ số đạt chuẩn QCVN 40:2011/BTNMT.", "")

# Fix "100% hoạt động"
c = c.replace("{dashboardPark ? `${parkName} • 100% hoạt động` : 'Toàn hệ thống • 3 KCN'}", "{dashboardPark ? `${parkName}` : 'Toàn hệ thống • 3 KCN'}")

# Fix D: "Không có dự án thì không hiển thị 'Tất cả dự án đáp ứng tiến độ'"
c = c.replace("detail={delayedCount > 0 ? 'Cần đẩy nhanh tiến độ' : 'Tất cả dự án đáp ứng tiến độ'}", "detail={delayedCount > 0 ? 'Cần đẩy nhanh tiến độ' : (projects.length === 0 ? 'Chưa có dữ liệu dự án' : 'Đang đáp ứng tiến độ')}")

# Fix "Tiến độ bảo trì ổn định" (actually "100% đúng tiến độ")
c = c.replace("detail={overdueOrders > 0 ? 'Cảnh báo tiến độ' : '100% đúng tiến độ'}", "detail={overdueOrders > 0 ? 'Cảnh báo tiến độ' : (orders.length === 0 ? 'Chưa có dữ liệu' : 'Đang đáp ứng tiến độ')}")

with open('frontend/src/pages/OverviewPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Rewrote simple texts")
