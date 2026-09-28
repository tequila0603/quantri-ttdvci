import re
with open('frontend/src/pages/MaintenancePage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("detail={overdueOrders > 0 ? 'Cảnh báo tiến độ' : '100% đúng tiến độ'}", "detail={overdueOrders > 0 ? 'Cảnh báo tiến độ' : (orders.length === 0 ? 'Chưa có dữ liệu' : 'Đang đáp ứng tiến độ')}")

with open('frontend/src/pages/MaintenancePage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Rewrote MaintenancePage texts")
