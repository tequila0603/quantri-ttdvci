# Reporting Contract

## Common Report Metadata

Mọi báo cáo và tệp xuất phải hiển thị:

- tên báo cáo;
- thời điểm tạo;
- vai trò/người tạo;
- kỳ dữ liệu và bộ lọc;
- trạng thái dữ liệu (`PARTIAL`, `CONFIRMED`, `LOCKED`);
- thời điểm cập nhật cuối cùng của từng nguồn chính.

## Dashboard Filters

| Filter | Applies to |
|---|---|
| Year/reporting period | Workforce snapshot, revenue, receivables, tasks, monitoring |
| Obligation year and cutoff date | Annual lease paid/outstanding report |
| Organizational unit | Workforce and tasks |
| Service category | Revenue and invoice detail |
| Enterprise | Invoice and receivable detail |
| Industrial zone/station | Monitoring cards and trends |
| Data status | Include/exclude partial/unconfirmed data |

Một bộ lọc được chọn phải áp dụng nhất quán cho card, chart, table và export.

## Metric Definitions

### Số người làm việc

Đếm `Employee` có trạng thái được quy định là đang làm việc và có hiệu lực tại ngày chốt. Không đếm hồ sơ đã kết thúc trước ngày chốt; không cộng đôi người kiêm nhiệm nhiều đơn vị.

### Doanh thu theo danh mục

Tổng `InvoiceLine.line_amount` và điều chỉnh hợp lệ của chứng từ đủ điều kiện theo quy tắc kỳ đã được phê duyệt, nhóm theo bảy `ServiceCategory`. Hóa đơn hủy/thay thế không được cộng đôi.

### Ba khoản thuê hằng năm theo doanh nghiệp

Áp dụng cho `thuê dịch vụ hạ tầng`, `thuê đất nguyên thổ` và `thuê kết cấu hạ tầng`. Báo cáo có một dòng cho mỗi `doanh nghiệp + năm nghĩa vụ + loại thuê` tại ngày chốt được chọn, gồm:

- số phải đóng của năm từ các dòng hóa đơn hợp lệ;
- số đã đóng cho nghĩa vụ đó từ khoản thanh toán đã phân bổ tới dòng hóa đơn;
- số còn nợ tại ngày chốt;
- trạng thái đủ/chưa đủ/chưa phân bổ/quá hạn;
- danh sách hóa đơn, ngày hóa đơn, hạn thanh toán, ngày đã đóng và chứng từ khoản thu.

Khoản thanh toán của hóa đơn nhiều danh mục nhưng chưa phân bổ tới dòng hóa đơn không được tự gán cho một loại thuê. Báo cáo phải hiển thị riêng “khoản thu chưa phân bổ”.

### Công nợ doanh nghiệp

`Tổng phải thu hợp lệ - tổng khoản thanh toán đã phân bổ - điều chỉnh giảm/reversal hợp lệ`, nhóm theo doanh nghiệp và hóa đơn. Quá hạn khi `due_date < ngày báo cáo` và số còn nợ > 0. Công nợ ba loại thuê phải đối chiếu được với cùng các dòng hóa đơn và phân bổ dùng trong báo cáo “đã đóng hằng năm”.

### Tình hình nhiệm vụ

Đếm nhiệm vụ theo trạng thái hiện tại và cờ quá hạn suy ra. Hiển thị tối thiểu: tổng, chưa thực hiện, đang thực hiện, hoàn thành, tạm dừng, quá hạn.

### Quan trắc

Theo trạm/thông số/kỳ: số điểm đo hợp lệ, tỷ lệ đủ dữ liệu, số lần vượt ngưỡng, khoảng mất dữ liệu, trạng thái thiết bị gần nhất. Không trộn `UNKNOWN` vào `NORMAL`.

## Drill-down Contract

Mỗi số tổng hợp phải mở được danh sách nguồn gồm khóa bản ghi, thời điểm/kỳ, nguồn/lô import, trạng thái và phép tính đóng góp. Director chỉ xem; không có hành động ghi từ màn hình truy vết.

## Data Freshness Contract

- Dashboard hiển thị thời điểm cập nhật cuối cùng theo module.
- Kỳ chưa chốt phải gắn nhãn rõ `DỮ LIỆU CHƯA HOÀN CHỈNH`.
- Thiếu nguồn dữ liệu phải hiển thị “chưa có dữ liệu”, không thay bằng 0.
