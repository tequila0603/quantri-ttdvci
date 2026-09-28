# Quickstart Validation Guide

**Feature**: `001-center-operations-management`  
**Status**: Plan-only acceptance guide; theo yêu cầu hiện chưa có ứng dụng hoặc lệnh chạy.

## Purpose

Tài liệu này mô tả các kịch bản bắt buộc phải chạy khi implementation tồn tại. Nó không chứa code, migration hoặc test suite. Chi tiết quyền, dữ liệu và công thức nằm trong [contracts](contracts/) và [data model](data-model.md).

## Prerequisites for Future Validation

1. Có môi trường kiểm thử tách khỏi dữ liệu thật.
2. Có đúng hai tài khoản test: Director và Data Admin.
3. Có bộ tệp mẫu đã được nghiệp vụ xác nhận cho workforce, tasks, enterprises, invoices và payments; có fixture phản hồi Premier API cho monitoring.
4. Có bảng kết quả đối chiếu độc lập cho doanh thu/công nợ.
5. Có fixture phản hồi Premier API cho ít nhất hai trạm, hai thiết bị và chuỗi số đo gồm normal, exceeded, duplicate, invalid, late, missing gap, pagination và provider error.
6. Có bản sao lưu trước khi bắt đầu kiểm thử phục hồi.

## Future Run Commands

Chưa xác định vì stack công nghệ chưa được chọn và user yêu cầu chưa code. Khi implementation bắt đầu, thay mục này bằng các lệnh thực tế để:

- khởi động ứng dụng kiểm thử;
- nạp fixtures được phê duyệt;
- chạy unit/integration/acceptance/security checks;
- chạy backup và restore verification.

Không được báo “quickstart passed” trước khi các lệnh thật được bổ sung và chạy thành công.

## Scenario 1 — Director Is Strictly Read-only

1. Đăng nhập Director.
2. Mở dashboard, đổi kỳ/bộ lọc và drill-down.
3. Thử gọi mọi hành động ghi bằng UI và đường truy cập trực tiếp.

**Expected**:

- Có thể xem báo cáo và nguồn.
- Không có nút import/edit/delete.
- Mọi request ghi bị từ chối và dữ liệu không đổi.
- Audit ghi nhận access denial an toàn.

## Scenario 2 — Import Validation and Idempotency

1. Admin tải tệp có 8 dòng hợp lệ, 1 dòng sai mã và 1 dòng trùng.
2. Kiểm tra preview và xác nhận partial batch.
3. Import lại cùng tệp.

**Expected**:

- Preview hiển thị đúng accepted/rejected/duplicate với row/field/error.
- Chỉ dòng hợp lệ đã xác nhận tham gia báo cáo.
- Lần import lại không cộng đôi.
- ImportBatch, row results và audit đầy đủ.

## Scenario 3 — Workforce Snapshot and Task History

1. Nạp một nhân sự đang làm việc, một người đã nghỉ và một người chuyển đơn vị giữa kỳ.
2. Nạp nhiệm vụ chưa làm, đang làm, hoàn thành, quá hạn và được mở lại.
3. Xem báo cáo tại hai ngày chốt khác nhau.

**Expected**:

- Headcount đúng theo hiệu lực từng ngày.
- Không cộng đôi người kiêm nhiệm.
- Overdue được suy ra đúng.
- Lịch sử hoàn thành/mở lại và bằng chứng được bảo toàn.

## Scenario 4 — Revenue and Receivables Reconciliation

1. Nạp hóa đơn cho đủ bảy danh mục, gồm ba loại thuê có `obligation_year`, hóa đơn trả một phần, quá hạn, hủy và thay thế.
2. Nạp nhiều khoản thanh toán, gồm phân bổ tới dòng hóa đơn và một khoản chưa phân bổ của hóa đơn nhiều danh mục.
3. So sánh báo cáo doanh nghiệp–năm–loại thuê và dashboard công nợ với bảng đối chiếu độc lập.

**Expected**:

- Doanh thu mỗi danh mục/period khớp tuyệt đối.
- Số phải đóng, đã đóng và còn nợ của ba loại thuê khớp theo từng doanh nghiệp và năm nghĩa vụ.
- Khoản chưa phân bổ không bị tự tính vào loại thuê nào.
- Hóa đơn hủy/thay thế không cộng đôi.
- Outstanding từng invoice và enterprise khớp công thức contract.
- Drill-down liệt kê đúng invoice/payment/adjustment nguồn.

## Scenario 5 — Monitoring Data Quality

1. Chạy đồng bộ fixture Premier API có số đo hợp lệ, trùng khóa, sai đơn vị, đến muộn, phân trang và khoảng mất dữ liệu.
2. Mô phỏng 401, 429, timeout/5xx và thay đổi schema.
3. Áp dụng một threshold rule đã duyệt và để một parameter chưa có rule.
4. Thử sửa trực tiếp raw observation bằng Admin.

**Expected**:

- Trùng không tạo observation thứ hai.
- Checkpoint giúp lần chạy lại không bỏ sót và không nhân đôi dữ liệu.
- Sai đơn vị không được tự chuyển đổi khi thiếu quy tắc.
- Gap không trở thành giá trị 0.
- Exceeded/normal dùng đúng threshold version; thiếu rule trả `UNKNOWN`.
- Lỗi auth/schema không bị retry vô hạn; freshness và sync status hiển thị đúng.
- Raw observation không thể sửa; correction tạo bản ghi riêng.

## Scenario 6 — Filter Consistency and Data Freshness

1. Chọn một year, service category, enterprise và station.
2. So card, chart, table, drill-down và export.
3. Chọn kỳ chưa đủ dữ liệu.

**Expected**:

- Tất cả thành phần dùng cùng filter context.
- Export có metadata đầy đủ.
- Kỳ partial được gắn nhãn; nguồn thiếu hiển thị “chưa có dữ liệu”.

## Scenario 7 — Backup and Restore

1. Tạo backup sau khi hoàn thành các kịch bản trên.
2. Mô phỏng môi trường trống/hỏng theo runbook được duyệt.
3. Restore và chạy lại đối chiếu.

**Expected**:

- Khôi phục đủ hai tài khoản, master data, nghiệp vụ, observations, import batches và audit.
- Báo cáo trước/sau restore khớp.
- Thời gian phục hồi nằm trong mục tiêu được đơn vị phê duyệt.

## Exit Criteria

- Tất cả expected outcomes đạt.
- Không còn lỗi quyền mức nghiêm trọng/cao.
- Doanh thu và công nợ đối chiếu 100% với nguồn mẫu.
- Import lại không làm đổi tổng.
- Monitoring không nhầm missing/unknown thành normal hoặc zero.
- Restore đã được thực hiện, không chỉ kiểm tra sự tồn tại của file backup.
