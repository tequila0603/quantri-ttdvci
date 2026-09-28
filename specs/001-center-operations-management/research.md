# Research Decisions: Hệ thống quản trị hoạt động Trung tâm

**Feature**: `001-center-operations-management`  
**Date**: 2026-08-28  
**Scope**: Quyết định logic phục vụ lập kế hoạch; chưa chọn công nghệ và chưa viết mã.

## 1. Mô hình người dùng và phân quyền

**Decision**: Giai đoạn đầu chỉ có hai tài khoản hoạt động: `DIRECTOR` chỉ đọc và `DATA_ADMIN` nhập/điều chỉnh dữ liệu có nguồn. Nhân sự trong Trung tâm là đối tượng được quản lý, chưa phải người dùng hệ thống.

**Rationale**: Bám sát yêu cầu một tài khoản Giám đốc và một tài khoản Admin; giảm bề mặt quyền và tránh mở rộng quy trình phê duyệt khi chưa được yêu cầu.

**Alternatives considered**:

- Mỗi nhân viên có tài khoản: loại khỏi giai đoạn đầu vì làm phát sinh tự cập nhật, phê duyệt, thông báo và quản trị vòng đời tài khoản.
- Admin toàn quyền kể cả tài khoản/ngưỡng: loại vì xung đột với yêu cầu “chỉ import dữ liệu” và nguyên tắc phân tách nhập liệu với phê duyệt.

## 2. Cách hiểu quyền Admin

**Decision**: Admin được tải tệp, kiểm tra, xác nhận lô import, nhập điều chỉnh có lý do và quản lý danh mục dữ liệu cần thiết để import. Admin không được tự cấp tài khoản, thay đổi vai trò, sửa trực tiếp số đo gốc hoặc phê duyệt quy tắc nghiệp vụ.

**Rationale**: Nếu Admin không được sửa lỗi có kiểm soát thì hệ thống không thể vận hành dữ liệu; nếu Admin có quyền phê duyệt mọi thứ thì mất kiểm soát nguồn và thẩm quyền.

**Alternatives considered**:

- Chỉ tải tệp, không được điều chỉnh: quá cứng, mọi lỗi nhỏ đều phải sửa ở nguồn rồi nạp lại.
- Toàn quyền CRUD: quá rộng và không đúng yêu cầu.

## 3. Nguồn tính doanh thu và công nợ

**Decision**: Doanh thu được tổng hợp từ dòng tài chính/hóa đơn đã xác nhận theo quy tắc kỳ; công nợ được tính ở cấp hóa đơn bằng số phải thu sau điều chỉnh trừ số đã thu. Với thuê dịch vụ hạ tầng, thuê đất nguyên thổ và thuê kết cấu hạ tầng, báo cáo hằng năm dùng `obligation_year` của dòng hóa đơn và khoản thanh toán được phân bổ tới chính dòng/danh mục đó. Không lưu một “tổng công nợ” độc lập làm nguồn chính.

**Rationale**: Cho phép truy ngược từng con số, hiển thị chính xác số doanh nghiệp đã đóng theo từng loại thuê và ngăn sai lệch giữa báo cáo tổng hợp với danh sách hóa đơn.

**Alternatives considered**:

- Admin nhập tổng công nợ từng doanh nghiệp: đơn giản nhưng không đối chiếu được từng hóa đơn.
- Tự chia khoản thanh toán theo tỷ lệ các dòng hóa đơn: loại vì có thể gán sai loại thuê; yêu cầu phân bổ được xác nhận.
- Dùng phần mềm này thay kế toán tổng hợp: vượt phạm vi và tăng rủi ro pháp lý/nghiệp vụ.

## 4. Quản lý nhân sự và nhiệm vụ theo thời gian hiệu lực

**Decision**: Hồ sơ nhân sự, đơn vị, chức danh và chức năng/nhiệm vụ có thời gian hiệu lực. Nhiệm vụ cụ thể có lịch sử trạng thái bất biến; quá hạn là giá trị suy ra từ hạn hoàn thành và trạng thái hiện tại.

**Rationale**: Báo cáo “số người làm việc” cần đúng tại từng thời điểm; nhiệm vụ phải giữ được lịch sử khi nhân sự chuyển đơn vị hoặc nghỉ việc.

**Alternatives considered**:

- Chỉ lưu trạng thái hiện tại: không tái tạo được báo cáo quá khứ.
- Cho chỉnh trực tiếp cờ quá hạn: dễ làm sai logic và khó kiểm toán.

## 5. Tiếp nhận dữ liệu quan trắc

**Decision**: Lưu số đo gốc theo mô hình append-only và định danh nguồn. V1 lấy dữ liệu tự động từ Premier API tại `https://premier.vn/bqlkktpy/cong-bo`; tệp thủ công chỉ là phương án dự phòng được phê duyệt riêng.

**Rationale**: Người dùng đã xác định Premier là nguồn cần kéo API; mô hình canonical observation tách cổng nguồn khỏi dữ liệu nghiệp vụ. Dữ liệu gốc bất biến bảo đảm khả năng truy vết ngay cả khi Premier thay đổi payload hoặc trả dữ liệu trễ.

**Alternatives considered**:

- Kéo trực tiếp từng máy đo: loại ở V1 vì nguồn được chỉ định là Premier API, không phải từng giao thức thiết bị.
- Chỉ import thủ công: không đáp ứng mục tiêu theo dõi định kỳ từ nguồn Premier.
- Cho Admin sửa số đo tại chỗ: loại vì phá vỡ tính toàn vẹn dữ liệu nguồn.

## 5a. Premier API Discovery

**Decision**: Xem URL công bố Premier là nguồn tham chiếu nghiệp vụ, không coi URL giao diện là endpoint API. Trước implementation phải nhận tài liệu hoặc quyền truy cập để xác định endpoint, phương thức, xác thực, schema, phân trang, cursor/watermark, rate limit và timezone.

**Rationale**: Trang không cung cấp endpoint API công khai trong quá trình kiểm tra; kết quả truy cập cho thấy cổng có đăng nhập. Không được suy đoán URL API hoặc lưu credential trong plan/source.

**Alternatives considered**:

- Crawl HTML trang công bố: loại vì dễ vỡ, không phải hợp đồng API và có thể bỏ qua quyền truy cập.
- Gọi API không có tài liệu: loại vì không có căn cứ về schema, quyền và giới hạn gọi.

## 6. Trạng thái quan trắc và ngưỡng

**Decision**: Tách trạng thái chất lượng dữ liệu (`đủ`, `thiếu`, `trùng`, `không hợp lệ`, `thiết bị lỗi`) khỏi đánh giá giá trị (`bình thường`, `vượt ngưỡng`, `chưa xác định`). Ngưỡng có phiên bản và thời gian hiệu lực; Admin chỉ nạp ngưỡng đã được xác nhận.

**Rationale**: Mất dữ liệu không đồng nghĩa giá trị bằng 0; thay đổi ngưỡng không được làm mất bối cảnh lịch sử.

**Alternatives considered**:

- Một cột trạng thái chung: không phân biệt lỗi dữ liệu với vượt chuẩn.
- Ghi đè ngưỡng hiện tại: khiến kết quả lịch sử thay đổi không kiểm soát.

## 7. Quy trình import

**Decision**: Mọi import đi qua `upload → validate → preview → confirm → commit`. Lô có checksum/mã lô; dòng dữ liệu có khóa nghiệp vụ; chỉ dữ liệu hợp lệ đã xác nhận mới tham gia báo cáo.

**Rationale**: Đây là điểm kiểm soát chính vì Admin là đầu mối nhập toàn bộ dữ liệu. Cơ chế hai lớp chống trùng ngăn cộng đôi khi nạp lại tệp.

**Alternatives considered**:

- Import trực tiếp vào dữ liệu chính: khó hoàn tác và dễ tạo báo cáo sai giữa chừng.
- Xóa lô cũ rồi nhập lại: mất lịch sử và có thể làm báo cáo tạm thời thiếu dữ liệu.

## 8. Kiến trúc triển khai tương lai

**Decision**: Khi được phép code, dùng một webapp nội bộ theo kiến trúc modular monolith với cơ sở dữ liệu quan hệ; tách module logic theo `identity`, `workforce`, `tasks`, `finance`, `monitoring`, `imports`, `reports`, `audit`. Chưa chọn ngôn ngữ/framework trong giai đoạn này.

**Rationale**: Một Trung tâm với hai tài khoản không cần microservices. Dữ liệu có nhiều quan hệ và yêu cầu giao dịch/đối chiếu phù hợp lưu trữ quan hệ.

**Alternatives considered**:

- Microservices: chi phí vận hành và đồng bộ không tương xứng quy mô.
- Spreadsheet làm hệ thống chính: thiếu phân quyền, kiểm toán và toàn vẹn liên kết.
- NoSQL làm kho chính: không có lợi thế rõ ràng cho hóa đơn, công nợ và quan hệ nhân sự/nhiệm vụ.

## 9. Biên trách nhiệm dữ liệu của Trung tâm

**Decision**: Hệ thống ghi nhận Trung tâm là đơn vị trực tiếp quản lý/cập nhật hoặc phối hợp cung cấp dữ liệu trong phạm vi được giao; không tự gán Trung tâm là cơ quan chủ quản toàn bộ dữ liệu môi trường/hạ tầng. Văn thư có thể làm đầu mối tổng hợp/số hóa; chuyên môn chịu trách nhiệm xác nhận nội dung.

**Rationale**: Phân biệt đầu mối dữ liệu với chủ thể xác nhận nghiệp vụ, phù hợp phân công hành chính đã được rà soát trước đây.

**Alternatives considered**:

- Giao văn thư xác nhận toàn bộ nội dung: không phù hợp thẩm quyền chuyên môn.
- Mặc định Trung tâm chủ trì mọi CSDL: có nguy cơ vượt phạm vi nhiệm vụ được giao.

## 10. An toàn, kiểm toán và phục hồi

**Decision**: Bắt buộc kiểm soát đăng nhập, giới hạn thử sai, phiên hết hạn, phân quyền phía máy chủ, nhật ký thay đổi, sao lưu và diễn tập phục hồi. Không ghi bí mật hoặc dữ liệu nhạy cảm vào log.

**Rationale**: Hệ thống chứa dữ liệu nhân sự, tài chính và quan trắc; đây là các biện pháp tối thiểu không được giản lược dù chỉ có hai tài khoản.

**Alternatives considered**:

- Chỉ ẩn nút trên giao diện: không phải kiểm soát quyền thực sự.
- Sao lưu nhưng không thử phục hồi: không chứng minh được khả năng khôi phục khi xảy ra sự cố.

## Decisions Deferred Until Before Implementation

Các mục sau không chặn plan logic nhưng phải được xác nhận trước khi code:

1. Quy tắc ngày/kỳ ghi nhận doanh thu và ngày chốt công nợ.
2. Danh sách đơn vị/tổ/đội và chuẩn mã nhân sự/doanh nghiệp/hóa đơn hiện hành.
3. Hãng máy, giao thức, thông số, tần suất và quyền truy cập của từng trạm.
4. Bộ ngưỡng được phê duyệt, đơn vị xác nhận và cách xử lý khi thiếu căn cứ.
5. Thời hạn lưu trữ, vị trí triển khai nội bộ, mục tiêu phục hồi và trách nhiệm vận hành.
