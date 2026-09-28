# Requirements Quality Checklist: Hệ thống quản trị hoạt động Trung tâm Dịch vụ công ích

**Purpose**: Rà soát chất lượng đặc tả chức năng và use case trước bước lập kế hoạch/triển khai
**Created**: 2026-09-03
**Feature**: [spec.md](../spec.md)
**Review status**: Ready for planning; chưa phải xác nhận triển khai

## Phạm vi và tính đúng nghiệp vụ

- [x] Đặc tả bao phủ đủ 8 nhóm nhiệm vụ được cung cấp: hạ tầng; dịch vụ hạ tầng; môi trường; kiểm tra công trình bảo vệ môi trường; tài sản/công trình; hỗ trợ quản lý nhà nước; đầu tư/xây dựng; tài chính/dịch vụ.
- [x] Phạm vi KKT/KCN và vai trò của Trung tâm được giới hạn, không suy diễn quyền quản lý ngoài phạm vi được giao.
- [x] Hai tài khoản giai đoạn đầu được nêu rõ: Giám đốc chỉ đọc và Admin dữ liệu nhập/kiểm soát.
- [x] Các vai trò cán bộ chuyên môn được mô tả như tác nhân nghiệp vụ, không tự suy diễn thành tài khoản đăng nhập.
- [x] Chức năng doanh nghiệp/lô thuê được chốt đúng: cột “Lô thuê”, nội dung là địa chỉ lô đang thuê.

## Dashboard và tài chính

- [x] Dashboard chỉ tập trung số liệu điều hành tổng hợp, cảnh báo, xu hướng và truy vết.
- [x] Phân tích nguồn thu chi tiết được đặt tại trang Tài chính.
- [x] Số tiền thuê lấy từ file được định nghĩa là “Đã thu”, không phải “Phải thu”.
- [x] Phải thu chỉ xuất phát từ nghĩa vụ/hóa đơn hợp lệ.
- [x] Công thức còn nợ được định nghĩa từ phải thu, khoản thu phân bổ và điều chỉnh hợp lệ.
- [x] Khoản thu chưa phân bổ không bị tự chia hoặc dùng để suy đoán công nợ theo loại thuê.
- [x] Báo cáo ba nhóm thuê theo doanh nghiệp/năm được nêu rõ.

## Môi trường và PDF

- [x] Phạm vi PDF chỉ yêu cầu tổng lượng nước thải và tổng kg rác đã xử lý.
- [x] Có luồng riêng cho PDF có lớp văn bản và PDF scan.
- [x] Có xem trước, độ tin cậy, hàng chờ kiểm tra và xác nhận thủ công.
- [x] Có quy đổi về m³/kg nhưng vẫn giữ giá trị và đơn vị gốc.
- [x] Tệp gốc, trang nguồn, checksum, doanh nghiệp, kỳ và lịch sử sửa được truy vết.
- [x] Dữ liệu thiếu không bị biến thành số 0.
- [x] Import trùng và bản ghi thiếu doanh nghiệp/kỳ có xử lý rõ.

## Tính đầy đủ của use case

- [x] Có use case truy cập, dashboard, lọc, truy vết và xuất báo cáo.
- [x] Có use case dữ liệu nền, import, xác nhận, điều chỉnh và audit.
- [x] Có use case tài sản, bàn giao, vận hành, kiểm tra, sự cố, bảo trì và nghiệm thu.
- [x] Có use case dịch vụ hạ tầng, phương án giá, hợp đồng, sản lượng và cảnh báo hợp đồng.
- [x] Có use case môi trường, quan trắc, ngưỡng, cảnh báo và xử lý cảnh báo.
- [x] Có use case đề xuất, dự án, bàn giao công trình và tài sản hình thành.
- [x] Có use case tài chính, nguồn thu, đã thu, hóa đơn, phân bổ, công nợ, tự chủ và báo cáo.
- [x] Có use case nhiệm vụ phối hợp, PCCC, thiên tai, dịch vụ sự nghiệp công và quá hạn.

## Chất lượng yêu cầu

- [x] Mọi yêu cầu dùng ngôn ngữ kiểm thử được và không chứa marker `[NEEDS CLARIFICATION]`.
- [x] Yêu cầu không khóa vào framework, thư viện hoặc nhà cung cấp cụ thể.
- [x] Các trạng thái “chưa có dữ liệu”, “chưa xác nhận”, “chưa phân bổ”, “mất dữ liệu” và “vượt ngưỡng” được tách khỏi số 0/bình thường.
- [x] Các trường hợp biên về PDF, tiền thuê, hóa đơn, thiết bị, ngưỡng, tài sản và nhiệm vụ đã được nêu.
- [x] Tiêu chí thành công đo được và gắn với các luồng quan trọng.
- [x] Mỗi số tổng hợp có yêu cầu truy vết về nguồn.
- [x] Có ranh giới in-scope/out-of-scope và giả định để làm cơ sở lập plan.

## Ghi chú trước khi lập kế hoạch

- Cần đơn vị xác nhận phương án giá, kỳ doanh thu, loại chứng từ hợp lệ, ngày chốt công nợ, ngưỡng môi trường và thời hạn lưu trữ.
- Cần cung cấp mẫu PDF thật đại diện cho cả PDF văn bản và PDF scan để lập bộ kiểm thử nhận dạng.
- Cần chốt danh mục tài sản/công trình, trạng thái bảo trì và mẫu biên bản bàn giao trước khi thiết kế dữ liệu chi tiết.
- Checklist này xác nhận chất lượng yêu cầu; không có nghĩa là mã nguồn đã được triển khai hoặc đã qua kiểm thử runtime.
