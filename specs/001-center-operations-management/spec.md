# Feature Specification: Hệ thống quản trị hoạt động Trung tâm Dịch vụ công ích

**Feature Branch**: `001-center-operations-management` (thư mục đặc tả; chưa tạo nhánh Git)

**Created**: 2026-09-03

**Status**: Draft — đặc tả nghiệp vụ thống nhất, chưa triển khai mã nguồn

**Input**: Chức năng, nhiệm vụ của Trung tâm; yêu cầu dashboard, tài chính, doanh nghiệp/lô thuê, nhân sự, nhiệm vụ, hạ tầng, môi trường, dự án và import báo cáo PDF.

## 1. Mục tiêu và nguyên tắc nghiệp vụ

Hệ thống là nơi tập hợp dữ liệu để Trung tâm quản lý, vận hành, khai thác và báo cáo các kết cấu hạ tầng, dịch vụ hạ tầng, dịch vụ môi trường, tài sản, dự án, nhân sự, nhiệm vụ và hoạt động tài chính trong phạm vi được giao.

Các nguyên tắc bắt buộc:

- Dashboard phục vụ điều hành tổng quan: số liệu chính, cảnh báo, xu hướng và liên kết truy vết; không thay thế báo cáo phân tích nguồn thu.
- Trang Tài chính phục vụ phân tích chi tiết: nguồn thu, đã thu, phải thu, công nợ, hóa đơn, khoản thu, điều chỉnh và báo cáo theo doanh nghiệp/kỳ.
- Số tiền thuê lấy từ file nguồn hiện tại được hiểu là **Đã thu**, không phải **Phải thu**. Số liệu này không được tự suy ra hóa đơn hoặc công nợ nếu chưa có chứng từ nghĩa vụ tương ứng.
- Không có dữ liệu không đồng nghĩa với số 0. Dữ liệu thiếu, lỗi, chưa xác nhận và chưa phân bổ phải có trạng thái riêng.
- Mọi số liệu tổng hợp phải truy ngược được tới bản ghi, tệp, trang PDF, hóa đơn hoặc lô import nguồn.
- Giai đoạn đầu chỉ kích hoạt hai tài khoản đăng nhập: `DIRECTOR` và `DATA_ADMIN`. Các vai trò chuyên môn khác là vai trò chịu trách nhiệm nghiệp vụ để phân công, chưa mặc nhiên là tài khoản đăng nhập.

## 2. Bản đồ chức năng tổng thể

| Mã | Nhóm chức năng | Phạm vi chính | Kết quả điều hành |
|---|---|---|---|
| F01 | Quản trị truy cập và dữ liệu nền | Tài khoản, quyền, đơn vị, nhân sự, doanh nghiệp, kỳ báo cáo, danh mục | Dữ liệu có chủ thể, phạm vi và trạng thái rõ ràng |
| F02 | Quản lý, vận hành hạ tầng | Hạ tầng kỹ thuật, thoát nước mưa/nước thải, điện chiếu sáng, cây xanh, cảnh quan, công trình | Biết tài sản nào đang vận hành, hư hỏng hoặc cần xử lý |
| F03 | Duy tu, bảo dưỡng và an toàn công trình | Kiểm tra hiện trạng, sự cố, nguy cơ mất an toàn, kế hoạch và lệnh bảo trì | Công việc được lập kế hoạch, giao, nghiệm thu và theo dõi quá hạn |
| F04 | Cung cấp dịch vụ hạ tầng | Danh mục dịch vụ, phương án giá, hợp đồng, doanh nghiệp, sản lượng và thực hiện dịch vụ | Theo dõi dịch vụ đã cam kết, đã cung cấp và cần thu |
| F05 | Dịch vụ môi trường | Xử lý nước thải, thu gom/xử lý/vận chuyển chất thải, vệ sinh, cây xanh/cảnh quan, quan trắc | Theo dõi khối lượng xử lý, chất lượng và cảnh báo môi trường |
| F06 | Quản lý tài sản, dự án và phát triển hạ tầng | Đề xuất, kế hoạch, dự án đầu tư, sửa chữa/nâng cấp, bàn giao/tiếp nhận | Tài sản hình thành từ dự án được tiếp nhận và đưa vào quản lý |
| F07 | Tài chính và cung cấp dịch vụ | Nguồn thu, đã thu, phải thu, hóa đơn, công nợ, tự chủ tài chính, kế toán/báo cáo | Số liệu tài chính đúng bản chất và đối chiếu được |
| F08 | Hỗ trợ quản lý nhà nước và báo cáo | Phối hợp an toàn, PCCC, thiên tai, môi trường; dịch vụ sự nghiệp công; báo cáo/audit | Có hồ sơ phối hợp, báo cáo đúng kỳ và dấu vết kiểm tra |

### 2.1. Phân bổ số liệu và biểu đồ theo trang

**Dashboard — tổng quan điều hành**:

- Thẻ số liệu: tài sản/công trình, tài sản đang vận hành, hạng mục đến hạn bảo trì, sự cố đang mở, hợp đồng đang hiệu lực, **Tổng đã thu**, tổng công nợ còn lại, cảnh báo môi trường và nhiệm vụ đang xử lý/quá hạn.
- Biểu đồ tình trạng tài sản/công trình.
- Biểu đồ kế hoạch duy tu/bảo dưỡng: hoàn thành, đang thực hiện, quá hạn.
- Biểu đồ sự cố theo thời gian và mức độ.
- Biểu đồ sản lượng/kết quả dịch vụ hạ tầng và môi trường.
- Biểu đồ xu hướng **đã thu** theo tháng/kỳ ở mức tổng quan.
- Biểu đồ tuổi công nợ ở mức tổng quan, không thay thế bảng hóa đơn.
- Biểu đồ/khối cảnh báo quan trắc: bình thường, vượt ngưỡng, mất/thiếu dữ liệu, thiết bị lỗi.
- Biểu đồ trạng thái nhiệm vụ: chưa thực hiện, đang thực hiện, hoàn thành, tạm dừng/quá hạn.

**Trang Tài chính — phân tích nguồn thu và công nợ**:

- Bảng/biểu đồ nguồn thu theo bảy nhóm danh mục và theo năm/kỳ.
- Xu hướng **Đã thu** theo tháng/kỳ, doanh nghiệp và danh mục.
- Phân tích **Phải thu – Đã thu – Còn nợ** theo doanh nghiệp, hóa đơn và kỳ nghĩa vụ.
- Tuổi công nợ và danh sách quá hạn.
- Báo cáo riêng ba nhóm thuê theo doanh nghiệp/năm: thuê dịch vụ hạ tầng, thuê đất nguyên thổ và thuê kết cấu hạ tầng.
- Bảng khoản thu chưa phân bổ, hóa đơn hủy/thay thế và các khoản dư cần đối soát.

Phân rã nguồn thu chi tiết, danh sách hóa đơn và bảng khoản thu không hiển thị như nội dung chính của Dashboard; Dashboard chỉ dẫn tới trang Tài chính khi người dùng cần xem sâu.

## 3. User Scenarios & Testing

### User Story 1 - Giám đốc xem dashboard điều hành tổng hợp (Priority: P1)

Giám đốc đăng nhập và xem một bức tranh tổng hợp theo năm, kỳ, KKT/KCN hoặc phạm vi được giao: tài sản, vận hành, bảo trì, sự cố, hợp đồng, dịch vụ, môi trường, nhiệm vụ và tài chính.

**Why this priority**: Đây là màn hình giúp lãnh đạo phát hiện ngay việc cần quyết định hoặc chỉ đạo xử lý.

**Independent Test**: Nạp dữ liệu mẫu của nhiều nhóm nghiệp vụ, chọn một kỳ và kiểm tra các thẻ, biểu đồ, cảnh báo, bảng chi tiết cùng dùng một phạm vi lọc và truy được về nguồn.

**Acceptance Scenarios**:

1. **Given** có dữ liệu nhiều kỳ và nhiều KCN, **When** Giám đốc chọn năm/kỳ/phạm vi, **Then** toàn bộ thẻ, biểu đồ, cảnh báo và bảng chi tiết chỉ hiển thị dữ liệu trong cùng phạm vi.
2. **Given** có tài sản cần bảo trì, sự cố mở, hợp đồng đang hiệu lực, cảnh báo môi trường và nhiệm vụ quá hạn, **When** mở dashboard, **Then** các chỉ số được tách thành nhóm vận hành, môi trường, nhiệm vụ và tài chính, không trộn lẫn ý nghĩa.
3. **Given** có số liệu thuê đã thu từ file nguồn, **When** xem thẻ tài chính trên dashboard, **Then** thẻ ghi rõ “Tổng đã thu”, không ghi “Tổng phải thu”.
4. **Given** Giám đốc chọn một thẻ hoặc điểm dữ liệu, **When** yêu cầu xem chi tiết, **Then** hệ thống mở danh sách bản ghi nguồn tương ứng mà không cho sửa dữ liệu.

### User Story 2 - Admin quản lý dữ liệu nền và import có kiểm soát (Priority: P1)

Admin nạp dữ liệu có cấu trúc, kiểm tra, xem trước, xác nhận hoặc lập lô điều chỉnh. Hệ thống giữ nguồn, chống trùng và ghi nhật ký.

**Why this priority**: Mọi dashboard và báo cáo chỉ đáng tin khi dữ liệu đầu vào có cấu trúc và truy vết.

**Independent Test**: Import một tệp hợp lệ, một tệp sai và một tệp trùng; kiểm tra kết quả xem trước, trạng thái lô, lỗi theo dòng/cột, việc không cộng đôi và lịch sử điều chỉnh.

**Acceptance Scenarios**:

1. **Given** tệp đúng mẫu, **When** Admin tải lên và xác nhận, **Then** hệ thống ghi nhận lô import cùng loại dữ liệu, nguồn, thời điểm, người thực hiện, số dòng thành công/lỗi và mã truy vết.
2. **Given** tệp thiếu trường bắt buộc, sai đơn vị, sai kỳ, số tiền âm không có căn cứ hoặc sai mã liên kết, **When** kiểm tra, **Then** dòng lỗi không được sử dụng trong báo cáo và lỗi chỉ rõ vị trí cần sửa.
3. **Given** tệp hoặc khóa nghiệp vụ đã tồn tại, **When** Admin import lại, **Then** hệ thống cảnh báo trùng và không cộng đôi số liệu.
4. **Given** dữ liệu đã xác nhận cần sửa, **When** Admin nhập lô điều chỉnh, **Then** hệ thống giữ giá trị trước/sau, lý do, người thực hiện và nguồn thay đổi.

### User Story 3 - Quản lý tài sản và vận hành kết cấu hạ tầng (Priority: P1)

Cán bộ phụ trách theo dõi danh mục tài sản/công trình được giao, vị trí, trạng thái, đơn vị quản lý, hoạt động vận hành, chỉ số hiện trạng và lịch sử bàn giao.

**Why this priority**: Đây là nhiệm vụ trực tiếp của Trung tâm và là nền tảng để lập kế hoạch duy tu, sửa chữa, khai thác dịch vụ.

**Independent Test**: Tạo hồ sơ một công trình, tiếp nhận từ biên bản bàn giao, ghi nhật ký vận hành, lập kiểm tra hiện trạng và mở một sự cố; kiểm tra toàn bộ lịch sử liên quan.

**Acceptance Scenarios**:

1. **Given** có công trình thuộc phạm vi quản lý, **When** mở hồ sơ, **Then** hệ thống hiển thị loại, vị trí, KKT/KCN, trạng thái, đơn vị quản lý, hồ sơ bàn giao và lịch sử vận hành.
2. **Given** kiểm tra phát hiện hư hỏng hoặc nguy cơ mất an toàn, **When** cán bộ lập ghi nhận, **Then** hệ thống tạo sự cố/đề xuất xử lý, gắn mức độ, người phụ trách, thời hạn và bằng chứng.
3. **Given** có hệ thống thoát nước mưa, nước thải, điện chiếu sáng, cây xanh hoặc cảnh quan, **When** xem danh mục vận hành, **Then** mỗi hạng mục có trạng thái hoạt động và lịch kiểm tra riêng.

### User Story 4 - Lập và theo dõi duy tu, bảo dưỡng, sửa chữa (Priority: P1)

Cán bộ lập kế hoạch duy tu/bảo dưỡng/sửa chữa, phân công, theo dõi tiến độ, cập nhật chi phí/dự toán và nghiệm thu kết quả.

**Why this priority**: Bảo đảm công trình vận hành an toàn và các hư hỏng được xử lý theo kế hoạch, không chỉ ghi nhận sau khi xảy ra sự cố.

**Independent Test**: Lập một kế hoạch có nhiều hạng mục, giao người phụ trách, cập nhật một hạng mục hoàn thành và một hạng mục quá hạn; kiểm tra cảnh báo và lịch sử.

**Acceptance Scenarios**:

1. **Given** công trình có chu kỳ bảo trì hoặc đề xuất sửa chữa được duyệt, **When** lập kế hoạch, **Then** hệ thống ghi phạm vi, thời gian, ưu tiên, dự toán/nguồn lực, người phụ trách và trạng thái.
2. **Given** hạng mục chưa hoàn thành sau hạn, **When** dashboard hoặc báo cáo chạy, **Then** hạng mục được đánh dấu quá hạn và không tự chuyển thành hoàn thành.
3. **Given** công việc đã thực hiện, **When** cán bộ gửi kết quả, **Then** hồ sơ có bằng chứng, ngày hoàn thành, chi phí thực tế, người nghiệm thu và kết luận.

### User Story 5 - Quản lý dịch vụ hạ tầng, doanh nghiệp và hợp đồng (Priority: P1)

Trung tâm quản lý danh mục dịch vụ, doanh nghiệp/nhà đầu tư, hợp đồng cung cấp dịch vụ, lô thuê, sản lượng hoặc kỳ sử dụng và tình trạng thực hiện.

**Why this priority**: Đây là cơ sở để Trung tâm cung cấp dịch vụ và tạo số liệu nguồn thu có căn cứ.

**Independent Test**: Tạo doanh nghiệp có một hoặc nhiều lô thuê, hợp đồng và kỳ sử dụng; kiểm tra tên cột “Lô thuê”, nội dung là địa chỉ lô đang thuê, và trạng thái hợp đồng.

**Acceptance Scenarios**:

1. **Given** doanh nghiệp có một hoặc nhiều địa chỉ lô đang thuê, **When** xem danh sách doanh nghiệp, **Then** cột hiển thị “Lô thuê” và hiển thị đúng dữ liệu địa chỉ lô thuê đang thuê từ nguồn.
2. **Given** hợp đồng đang hiệu lực, sắp hết hạn hoặc đã kết thúc, **When** lọc danh sách, **Then** hệ thống phân loại đúng theo thời hạn và hiển thị cảnh báo hợp đồng sắp hết hạn.
3. **Given** kỳ dịch vụ có khối lượng hoặc biên bản hoàn thành, **When** ghi nhận kết quả, **Then** hệ thống liên kết doanh nghiệp, hợp đồng, dịch vụ, kỳ, khối lượng và nguồn chứng minh.

### User Story 6 - Theo dõi và import số liệu môi trường (Priority: P1)

Cán bộ môi trường theo dõi vận hành xử lý nước thải, thu gom/xử lý/vận chuyển chất thải, vệ sinh, cây xanh/cảnh quan và dữ liệu quan trắc. Với hàng trăm PDF của doanh nghiệp, hệ thống chỉ cần lấy tổng lượng nước thải và tổng kg rác đã xử lý.

**Why this priority**: Đây là nhóm nhiệm vụ cốt lõi, có khối lượng hồ sơ lớn và cần giảm nhập tay nhưng vẫn giữ kiểm soát nghiệp vụ.

**Independent Test**: Import PDF có lớp văn bản và PDF scan; kiểm tra hệ thống lấy đúng hai chỉ tiêu, quy đổi đơn vị, gắn doanh nghiệp/kỳ/trang, yêu cầu xem lại bản ghi độ tin cậy thấp và không coi thiếu dữ liệu là 0.

**Acceptance Scenarios**:

1. **Given** PDF có lớp văn bản, **When** tải lô hồ sơ, **Then** hệ thống đọc nội dung trực tiếp, nhận diện doanh nghiệp/kỳ và lấy tổng nước thải cùng kg rác xử lý.
2. **Given** PDF là bản scan, **When** xử lý, **Then** hệ thống chuyển nội dung thành dữ liệu đọc được, lưu trang nguồn và độ tin cậy; bản ghi độ tin cậy thấp phải chờ Admin kiểm tra.
3. **Given** đơn vị là lít, tấn hoặc đơn vị khác được cho phép, **When** phân tích, **Then** hệ thống quy đổi về m³ đối với nước thải và kg đối với rác, đồng thời lưu giá trị/đơn vị gốc.
4. **Given** tệp thiếu một trong hai chỉ tiêu hoặc không xác định được doanh nghiệp/kỳ, **When** xem trước, **Then** hệ thống đánh dấu thiếu/chưa xác định, không tự điền bằng 0 và không đưa vào tổng đã xác nhận.
5. **Given** cùng doanh nghiệp và kỳ đã có dữ liệu từ cùng nguồn hoặc cùng mã hồ sơ, **When** import lại, **Then** hệ thống cảnh báo trùng và không nhân đôi khối lượng.

### User Story 7 - Quản lý tài chính, nguồn thu và công nợ (Priority: P1)

Cán bộ tài chính theo dõi nguồn thu chi tiết tại trang Tài chính; phân biệt rõ số đã thu, phải thu và còn nợ; đối chiếu hóa đơn, khoản thu và ba nhóm thuê theo doanh nghiệp/năm.

**Why this priority**: Phân biệt đúng bản chất các khoản tiền là điều kiện để báo cáo tài chính không gây hiểu nhầm.

**Independent Test**: Nạp nguồn file thuê đã thu, một số hóa đơn phải thu, khoản thanh toán phân bổ và điều chỉnh; đối chiếu các chỉ tiêu bằng phép tính độc lập.

**Acceptance Scenarios**:

1. **Given** file nguồn ghi nhận số tiền thuê đã thu, **When** import và xem dashboard/tài chính, **Then** số tiền nằm trong “Đã thu”, không nằm trong “Phải thu” chỉ vì có mặt trong file.
2. **Given** hóa đơn hợp lệ có số phải thu, khoản thu và điều chỉnh, **When** tính công nợ, **Then** `Còn nợ = Phải thu hợp lệ - Đã thu phân bổ - Điều chỉnh hợp lệ`, không âm và có thể truy tới hóa đơn.
3. **Given** khoản thu chưa gắn hóa đơn hoặc chưa phân bổ dòng hóa đơn, **When** xem báo cáo, **Then** khoản đó được đánh dấu chưa phân bổ, không tự chia cho các loại thuê.
4. **Given** doanh nghiệp có ba nhóm thuê trong cùng năm, **When** xem báo cáo, **Then** hiển thị riêng thuê dịch vụ hạ tầng, thuê đất nguyên thổ và thuê kết cấu hạ tầng cùng số đã thu, phải thu, còn nợ và chứng từ.
5. **Given** Giám đốc đang ở dashboard, **When** cần xem nguồn thu, **Then** hệ thống dẫn sang trang Tài chính; dashboard không hiển thị bảng phân rã nguồn thu thay cho trang chuyên môn.

### User Story 8 - Quản lý đầu tư, xây dựng, tài sản hình thành từ dự án (Priority: P2)

Cán bộ lập đề xuất sửa chữa/cải tạo/nâng cấp/phát triển hạ tầng, theo dõi dự án, các mốc thực hiện và việc bàn giao/tiếp nhận công trình.

**Why this priority**: Bảo đảm hoạt động phát triển hạ tầng gắn liền với tài sản được quản lý sau đầu tư.

**Independent Test**: Tạo đề xuất, chuyển thành kế hoạch/dự án, cập nhật mốc, lập hồ sơ bàn giao và kiểm tra công trình xuất hiện trong danh mục tài sản vận hành.

**Acceptance Scenarios**:

1. **Given** có nhu cầu nâng cấp hạ tầng, **When** lập đề xuất, **Then** hồ sơ có lý do, phạm vi, mức ưu tiên, dự toán, nguồn lực, căn cứ và người đề xuất.
2. **Given** dự án được phê duyệt hoặc giao thực hiện, **When** cập nhật tiến độ, **Then** hệ thống theo dõi mốc, trạng thái, chi phí, hồ sơ và vấn đề phát sinh.
3. **Given** công trình hoàn thành, **When** lập biên bản bàn giao/tiếp nhận, **Then** hệ thống tạo hoặc cập nhật tài sản, đính kèm hồ sơ và ghi đơn vị chịu trách nhiệm quản lý.

### User Story 9 - Theo dõi nhiệm vụ hỗ trợ quản lý nhà nước và báo cáo (Priority: P2)

Trung tâm ghi nhận nhiệm vụ phối hợp về an toàn, vệ sinh môi trường, PCCC, phòng chống thiên tai và dịch vụ sự nghiệp công; phân công, theo dõi, lưu bằng chứng và xuất báo cáo.

**Why this priority**: Các nhiệm vụ phối hợp cần có đầu mối, hạn xử lý và bằng chứng để phục vụ kiểm tra, báo cáo.

**Independent Test**: Giao một nhiệm vụ phối hợp, cập nhật tiến độ, đính kèm văn bản/kết quả, để quá hạn và xuất báo cáo; kiểm tra lịch sử và trạng thái.

**Acceptance Scenarios**:

1. **Given** có yêu cầu phối hợp từ cơ quan/đơn vị liên quan, **When** tạo nhiệm vụ, **Then** hệ thống ghi đơn vị yêu cầu, nội dung, người phụ trách, người phối hợp, hạn và trạng thái.
2. **Given** nhiệm vụ quá hạn hoặc được mở lại, **When** xem danh sách, **Then** hệ thống cảnh báo và giữ toàn bộ lịch sử trạng thái/lý do.
3. **Given** báo cáo theo kỳ được tạo, **When** xuất file, **Then** báo cáo ghi kỳ dữ liệu, bộ lọc, thời điểm tạo, người tạo, trạng thái xác nhận và liên kết nguồn.

## 4. Danh mục Use Case dự kiến

### 4.1. Tác nhân

| Tác nhân | Vai trò trong hệ thống |
|---|---|
| Giám đốc (`DIRECTOR`) | Xem dashboard, báo cáo, cảnh báo và chi tiết truy vết; không thay đổi dữ liệu |
| Admin dữ liệu (`DATA_ADMIN`) | Import, kiểm tra, xác nhận, điều chỉnh dữ liệu có nguồn và quản trị danh mục trong phạm vi được giao |
| Cán bộ vận hành | Chủ trì ghi nhận vận hành, kiểm tra, sự cố, duy tu và nghiệm thu; ở giai đoạn đầu được Admin nhập thay |
| Cán bộ môi trường | Theo dõi xử lý môi trường, quan trắc, hồ sơ PDF và cảnh báo; ở giai đoạn đầu được Admin nhập thay |
| Cán bộ tài chính | Quản lý nguồn thu, hóa đơn, khoản thu, phân bổ và công nợ; ở giai đoạn đầu được Admin nhập thay |
| Cán bộ dự án/tài sản | Quản lý đề xuất, dự án, bàn giao và tài sản; ở giai đoạn đầu được Admin nhập thay |
| Đơn vị phối hợp/cơ quan có thẩm quyền | Cung cấp, xác nhận hoặc tiếp nhận thông tin phối hợp; không mặc nhiên có tài khoản |
| Nguồn dữ liệu bên ngoài | Cung cấp dữ liệu quan trắc hoặc tệp báo cáo doanh nghiệp; hệ thống phải lưu nguồn và trạng thái nhận |

### 4.2. Use case theo nhóm chức năng

| Mã | Use case | Tác nhân chính | Kết quả |
|---|---|---|---|
| UC-001 | Đăng nhập, kết thúc phiên, đổi mật khẩu | Giám đốc/Admin | Phiên hợp lệ, đúng quyền, có nhật ký |
| UC-002 | Xem dashboard điều hành | Giám đốc | Thẻ, biểu đồ, cảnh báo theo phạm vi lọc |
| UC-003 | Lọc dashboard theo năm/kỳ/KKT/KCN | Giám đốc | Các thành phần dùng cùng một phạm vi |
| UC-004 | Truy xuống dữ liệu nguồn | Giám đốc | Danh sách bản ghi, hóa đơn, tệp hoặc sự cố liên quan |
| UC-005 | Xuất báo cáo tổng quan | Giám đốc/Admin | Tệp có kỳ, bộ lọc, người tạo và thời điểm |
| UC-006 | Quản lý đơn vị, tổ/đội và nhân sự | Admin | Hồ sơ nhân sự, chức danh, trạng thái, thời gian hiệu lực |
| UC-007 | Quản lý chức năng/nhiệm vụ thường xuyên | Admin | Chức năng gắn với vị trí/người và thời gian hiệu lực |
| UC-008 | Quản lý doanh nghiệp/nhà đầu tư | Admin | Hồ sơ định danh thống nhất, tránh phân mảnh công nợ |
| UC-009 | Quản lý kỳ báo cáo và danh mục nghiệp vụ | Admin | Kỳ, danh mục, trạng thái chốt và cấu hình dùng chung |
| UC-010 | Import dữ liệu có cấu trúc | Admin | Lô import được kiểm tra trước khi ghi nhận |
| UC-011 | Xem trước, xác nhận hoặc từ chối lô import | Admin | Chỉ dòng hợp lệ đã xác nhận được dùng trong báo cáo |
| UC-012 | Lập lô điều chỉnh và xem lịch sử | Admin | Có giá trị trước/sau, lý do và người thực hiện |
| UC-013 | Tra cứu danh mục tài sản/công trình | Admin/Cán bộ tài sản | Hồ sơ công trình, vị trí, trạng thái và hồ sơ liên quan |
| UC-014 | Tiếp nhận/bàn giao tài sản, công trình | Admin/Cán bộ dự án | Biên bản, bên giao/nhận và thời điểm quản lý |
| UC-015 | Ghi nhật ký vận hành hạ tầng | Cán bộ vận hành | Trạng thái vận hành, chỉ số, ca/kỳ và bằng chứng |
| UC-016 | Kiểm tra, đánh giá hiện trạng công trình | Cán bộ vận hành | Phiếu kiểm tra, mức độ, hư hỏng và kiến nghị |
| UC-017 | Ghi nhận sự cố và nguy cơ mất an toàn | Cán bộ vận hành | Sự cố mở, mức độ, đầu mối, thời hạn và biện pháp |
| UC-018 | Lập kế hoạch duy tu/bảo dưỡng/sửa chữa | Cán bộ vận hành/Admin | Kế hoạch, hạng mục, lịch, nguồn lực và ưu tiên |
| UC-019 | Giao và theo dõi lệnh công việc | Cán bộ vận hành/Admin | Người phụ trách, tiến độ, quá hạn và bằng chứng |
| UC-020 | Nghiệm thu và đóng công việc bảo trì | Cán bộ vận hành/Admin | Kết quả, chi phí, nghiệm thu và lịch sử |
| UC-021 | Quản lý danh mục dịch vụ và phương án giá | Admin/Cán bộ tài chính | Dịch vụ, đơn giá, hiệu lực và căn cứ |
| UC-022 | Quản lý hợp đồng cung cấp dịch vụ | Admin/Cán bộ tài chính | Hợp đồng, kỳ hạn, phạm vi, giá và trạng thái |
| UC-023 | Ghi nhận khối lượng/kết quả dịch vụ | Cán bộ vận hành/Admin | Dịch vụ thực hiện gắn doanh nghiệp, kỳ và chứng từ |
| UC-024 | Cảnh báo hợp đồng sắp hết hạn | Admin/Giám đốc | Danh sách hợp đồng cần xử lý |
| UC-025 | Theo dõi vận hành xử lý nước thải tập trung | Cán bộ môi trường | Trạm, ca/kỳ, trạng thái và hồ sơ vận hành |
| UC-026 | Ghi nhận thu gom/xử lý nước thải | Cán bộ môi trường/Admin | Khối lượng, đơn vị chuẩn, kỳ và nguồn |
| UC-027 | Ghi nhận thu gom/vận chuyển/xử lý chất thải | Cán bộ môi trường/Admin | Khối lượng rác, tuyến/kỳ, trạng thái và chứng từ |
| UC-028 | Theo dõi cây xanh, cảnh quan, vệ sinh môi trường | Cán bộ môi trường/Admin | Khu vực, kế hoạch, khối lượng và kết quả |
| UC-029 | Kiểm tra công trình bảo vệ môi trường | Cán bộ môi trường | Phiếu kiểm tra, tình trạng, vi phạm/kiến nghị |
| UC-030 | Nhận dữ liệu quan trắc từ nguồn được cấp | Admin/Hệ thống | Số đo gốc, trạng thái nhận, độ mới và lỗi đồng bộ |
| UC-031 | Quản lý trạm, thiết bị, thông số và ngưỡng | Admin/Cán bộ môi trường | Danh mục có hiệu lực, đơn vị và căn cứ |
| UC-032 | Phân loại vượt ngưỡng/mất dữ liệu/thiết bị lỗi | Hệ thống/Cán bộ môi trường | Cảnh báo có giá trị, thời điểm, nguồn và trạng thái |
| UC-033 | Lập biên bản và theo dõi xử lý cảnh báo môi trường | Cán bộ môi trường/Admin | Người xử lý, hạn, biện pháp, kết quả và bằng chứng |
| UC-034 | Tải lô PDF báo cáo doanh nghiệp | Admin/Cán bộ môi trường | Lô file, checksum, doanh nghiệp/kỳ dự kiến và trạng thái |
| UC-035 | Đọc trực tiếp PDF có lớp văn bản | Hệ thống | Trích xuất tổng nước thải và kg rác xử lý |
| UC-036 | Đọc PDF scan và nhận dạng số liệu | Hệ thống | Văn bản nhận dạng, trang nguồn, độ tin cậy và lỗi |
| UC-037 | Xem trước và sửa bản ghi PDF độ tin cậy thấp | Admin | Bản ghi được kiểm tra, sửa có lý do hoặc từ chối |
| UC-038 | Xác nhận/ghi nhận số liệu PDF | Admin | Chỉ dữ liệu đã xác nhận mới vào báo cáo môi trường |
| UC-039 | Lập đề xuất và kế hoạch phát triển hạ tầng | Cán bộ dự án/Admin | Đề xuất, căn cứ, phạm vi, dự toán và trạng thái duyệt |
| UC-040 | Theo dõi dự án đầu tư/xây dựng | Cán bộ dự án/Admin | Mốc, tiến độ, chi phí, hồ sơ và vấn đề |
| UC-041 | Bàn giao công trình sau dự án | Cán bộ dự án/Admin | Tài sản được tạo/cập nhật và giao đơn vị quản lý |
| UC-042 | Quản lý danh mục nguồn thu | Cán bộ tài chính/Admin | Nguồn thu theo danh mục và kỳ tại trang Tài chính |
| UC-043 | Import số tiền thuê từ file với trạng thái “Đã thu” | Cán bộ tài chính/Admin | Số đã thu theo doanh nghiệp/năm/loại thuê, không suy ra phải thu |
| UC-044 | Quản lý hóa đơn và số phải thu | Cán bộ tài chính/Admin | Nghĩa vụ hợp lệ, kỳ hạn, trạng thái và dòng hóa đơn |
| UC-045 | Ghi nhận và phân bổ khoản thu | Cán bộ tài chính/Admin | Khoản thu gắn hóa đơn/dòng hóa đơn hoặc trạng thái chưa phân bổ |
| UC-046 | Tính và tra cứu công nợ theo hóa đơn | Cán bộ tài chính/Giám đốc | Phải thu, đã thu, còn nợ, quá hạn và chứng từ |
| UC-047 | Báo cáo ba nhóm thuê theo doanh nghiệp/năm | Cán bộ tài chính/Giám đốc | Thuê dịch vụ hạ tầng, đất nguyên thổ, kết cấu hạ tầng |
| UC-048 | Lập phương án giá và theo dõi tự chủ tài chính | Cán bộ tài chính/Admin | Giá/đơn giá, nguồn lực, khoản thu/chi và kỳ báo cáo |
| UC-049 | Lập báo cáo kế toán, thống kê, công khai, quyết toán | Cán bộ tài chính/Admin | Báo cáo theo kỳ, trạng thái xác nhận và nguồn |
| UC-050 | Giao, cập nhật và kết thúc nhiệm vụ | Admin/Cán bộ phụ trách | Tiến độ, trạng thái, người phối hợp và bằng chứng |
| UC-051 | Theo dõi nhiệm vụ quá hạn/mở lại | Giám đốc/Admin | Cảnh báo và lịch sử trạng thái |
| UC-052 | Quản lý nhiệm vụ phối hợp an toàn, PCCC, thiên tai | Admin/Cán bộ phối hợp | Đầu mối, nội dung, hạn, kết quả và đơn vị liên quan |
| UC-053 | Theo dõi dịch vụ sự nghiệp công hỗ trợ quản lý nhà nước | Admin/Cán bộ chuyên môn | Nhiệm vụ, sản phẩm, căn cứ giao và kết quả |
| UC-054 | Xuất báo cáo theo mẫu/phạm vi | Giám đốc/Admin | Báo cáo có phạm vi, thời điểm, người tạo và trạng thái dữ liệu |
| UC-055 | Tra cứu nhật ký và nguồn dữ liệu | Admin/Giám đốc chỉ đọc | Dấu vết import, điều chỉnh, truy cập, xuất và thay đổi |

### 4.3. Luồng use case trọng yếu

#### UC-034 đến UC-038 — Import PDF môi trường

1. Admin chọn một lô PDF và khai báo kỳ/phạm vi nếu chưa có trong tệp.
2. Hệ thống kiểm tra checksum và bản ghi trùng; lưu file gốc không thay đổi.
3. Với PDF có lớp văn bản, hệ thống đọc văn bản; với PDF scan, hệ thống nhận dạng nội dung.
4. Hệ thống tìm các nhãn nghiệp vụ tương ứng tổng lượng nước thải và lượng rác đã xử lý; không cần lấy các chỉ tiêu khác cho báo cáo tổng hợp này.
5. Hệ thống chuẩn hóa về m³ và kg, đồng thời giữ giá trị/đơn vị gốc, số trang, đoạn/điểm nguồn và độ tin cậy.
6. Admin xem trước, sửa bản ghi chưa chắc chắn, bổ sung doanh nghiệp/kỳ còn thiếu hoặc từ chối bản ghi.
7. Chỉ bản ghi đã xác nhận được tính vào báo cáo; bản ghi thiếu dữ liệu vẫn được lưu trạng thái để xử lý tiếp.

#### UC-043 đến UC-047 — Tài chính và ba nhóm thuê

1. Admin import file nguồn thuê; hệ thống ghi số tiền của file vào trường/nghiệp vụ “Đã thu”.
2. Admin import hóa đơn hợp lệ nếu cần xác định nghĩa vụ “Phải thu”.
3. Khoản thu được gắn vào hóa đơn/dòng hóa đơn khi có chứng từ phân bổ; khoản chưa gắn giữ trạng thái “Chưa phân bổ”.
4. Hệ thống tính “Còn nợ” chỉ từ nghĩa vụ phải thu hợp lệ và khoản thanh toán/điều chỉnh hợp lệ.
5. Trang Tài chính hiển thị phân tích nguồn thu, hóa đơn, khoản thu, công nợ, tuổi nợ và ba nhóm thuê theo doanh nghiệp/năm.
6. Dashboard chỉ hiển thị các chỉ số tài chính điều hành như Tổng đã thu và Tổng công nợ còn lại, kèm liên kết sang chi tiết.

#### UC-002 đến UC-005 — Dashboard và báo cáo

1. Người dùng chọn phạm vi báo cáo.
2. Hệ thống hiển thị các thẻ chính: tài sản, vận hành, bảo trì, sự cố, hợp đồng, đã thu, công nợ, môi trường và nhiệm vụ.
3. Biểu đồ thể hiện xu hướng/thực trạng vận hành, môi trường, nhiệm vụ và tài chính ở mức tổng quan.
4. Chi tiết nguồn thu được mở tại trang Tài chính; chi tiết tài sản, môi trường hoặc nhiệm vụ mở tại phân hệ tương ứng.
5. Người dùng có quyền xuất báo cáo hoặc chỉ xem; báo cáo lưu bộ lọc, thời điểm, người tạo và trạng thái dữ liệu.

## 5. Edge Cases

- PDF có lớp văn bản nhưng bố cục bảng bị vỡ, nhiều cột, nhiều kỳ hoặc nhiều doanh nghiệp trong cùng tệp.
- PDF scan mờ, xoay trang, nhiều dấu tiếng Việt, số có dấu chấm/phẩy khác nhau hoặc bị nhận dạng nhầm.
- Tệp thiếu tổng nước thải, thiếu kg rác, thiếu doanh nghiệp/kỳ hoặc có nhiều giá trị ứng viên.
- Cùng doanh nghiệp có nhiều địa chỉ lô thuê; địa chỉ cũ đã kết thúc không được hiển thị như lô đang thuê.
- Doanh nghiệp đổi tên nhưng giữ mã định danh; không tạo thành hai công nợ độc lập.
- Một hóa đơn có nhiều dòng dịch vụ và khoản thu chưa được phân bổ; không tự đoán tỷ lệ phân bổ.
- File thuê ghi số tiền đã thu nhưng không có hóa đơn; không đưa số đó vào phải thu/còn nợ.
- Hóa đơn nghĩa vụ của năm trước được thanh toán năm sau; báo cáo tách năm nghĩa vụ, ngày thực thu và số dư tại ngày chốt.
- Khoản thu lớn hơn nghĩa vụ phải thu; hệ thống hiển thị dư/đối soát cần xử lý, không cho công nợ âm.
- Tài sản hoặc công trình chưa có biên bản bàn giao đầy đủ; được lưu trạng thái chưa hoàn tất, không coi là đã tiếp nhận hoàn chỉnh.
- Thiết bị quan trắc đổi mã, mất kết nối, gửi trễ, trùng dữ liệu hoặc thay đổi đơn vị đo.
- Ngưỡng môi trường thay đổi theo thời gian; số đo quá khứ dùng phiên bản ngưỡng có hiệu lực tại thời điểm đo.
- Lô import chỉ thành công một phần; chỉ dòng hợp lệ đã xác nhận được dùng trong tổng hợp.
- Nhiệm vụ kiêm nhiệm nhiều người, bị tạm dừng, hủy, mở lại hoặc hoàn thành sau hạn; lịch sử không bị mất.
- Không có dữ liệu kỳ được chọn; giao diện hiển thị “Chưa có dữ liệu”, không hiển thị số 0 như một kết quả đã xác nhận.

## 6. Requirements

### Functional Requirements

#### A. Truy cập, dữ liệu nền và audit

- **FR-001**: Hệ thống MUST chỉ kích hoạt hai tài khoản đăng nhập giai đoạn đầu: một `DIRECTOR` và một `DATA_ADMIN`.
- **FR-002**: `DIRECTOR` MUST chỉ được xem dashboard, báo cáo, cảnh báo và chi tiết truy vết; MUST NOT được thêm, sửa, xóa, import hoặc cấu hình nghiệp vụ.
- **FR-003**: `DATA_ADMIN` MUST được import, kiểm tra, xác nhận và điều chỉnh dữ liệu có nguồn; MUST NOT tự cấp tài khoản, đổi quyền Giám đốc hoặc phê duyệt thay cơ quan có thẩm quyền.
- **FR-004**: Hệ thống MUST ghi nhật ký đăng nhập, import, xác nhận, điều chỉnh, xuất báo cáo và thay đổi cấu hình với tài khoản, thời điểm, đối tượng, hành động, giá trị trước/sau và nguồn liên quan.
- **FR-005**: Hệ thống MUST có khóa tài khoản, đổi mật khẩu an toàn, giới hạn đăng nhập sai và kết thúc phiên không hoạt động.
- **FR-006**: Hệ thống MUST quản lý đơn vị/tổ/đội, nhân sự, chức danh, trạng thái làm việc, chức năng thường xuyên và thời gian hiệu lực.
- **FR-007**: Hệ thống MUST quản lý doanh nghiệp bằng mã định danh ổn định; cho phép lưu tên, địa chỉ, KKT/KCN, thông tin liên hệ và lịch sử thay đổi.
- **FR-008**: Hệ thống MUST quản lý năm/tháng/quý/kỳ nghiệp vụ, trạng thái mở/chốt và ngày chốt dữ liệu.
- **FR-009**: Mọi số liệu nghiệp vụ MUST gắn với kỳ, phạm vi, trạng thái xác nhận, nguồn và khóa chống trùng.

#### B. Quản lý hạ tầng, tài sản và vận hành

- **FR-010**: Hệ thống MUST quản lý tài sản/công trình theo loại, mã, vị trí, KKT/KCN, đơn vị quản lý, thời gian đưa vào sử dụng, trạng thái và hồ sơ liên quan.
- **FR-011**: Hệ thống MUST hỗ trợ nhóm hạ tầng gồm thoát nước mưa, thoát nước thải, điện chiếu sáng, cây xanh, cảnh quan và công trình kỹ thuật khác.
- **FR-012**: Hệ thống MUST lưu biên bản bàn giao/tiếp nhận, bên giao/nhận, ngày, tình trạng và tài liệu kèm theo.
- **FR-013**: Hệ thống MUST lưu nhật ký vận hành, kiểm tra, chỉ số/kết quả, người thực hiện, thời điểm và bằng chứng.
- **FR-014**: Hệ thống MUST cho phép ghi nhận hiện trạng, hư hỏng, sự cố, nguy cơ mất an toàn, mức độ, nguyên nhân dự kiến, kiến nghị và người xử lý.
- **FR-015**: Hệ thống MUST cho phép lập kế hoạch duy tu, bảo dưỡng, sửa chữa thường xuyên và nâng cấp theo phạm vi, lịch, ưu tiên, dự toán, nguồn lực và trạng thái.
- **FR-016**: Hệ thống MUST theo dõi lệnh công việc từ giao việc đến hoàn thành/nghiệm thu, gồm người phụ trách, phối hợp, hạn, tiến độ, chi phí, bằng chứng và kết luận.
- **FR-017**: Công việc quá hạn MUST được tính từ hạn và trạng thái; người dùng MUST NOT sửa trực tiếp cờ quá hạn.
- **FR-018**: Việc đóng hoặc nghiệm thu công việc MUST yêu cầu kết quả, thời điểm, người xác nhận và bằng chứng; việc mở lại MUST yêu cầu lý do.

#### C. Cung cấp dịch vụ hạ tầng và doanh nghiệp

- **FR-019**: Hệ thống MUST quản lý danh mục dịch vụ hạ tầng, phương án giá/đơn giá, căn cứ và thời gian hiệu lực.
- **FR-020**: Hệ thống MUST quản lý hợp đồng cung cấp dịch vụ với doanh nghiệp/nhà đầu tư, phạm vi, giá, kỳ hạn, trạng thái và tài liệu.
- **FR-021**: Hệ thống MUST ghi nhận kết quả/khối lượng dịch vụ theo doanh nghiệp, hợp đồng, dịch vụ, kỳ, đơn vị, biên bản và trạng thái xác nhận.
- **FR-022**: Hệ thống MUST hiển thị cột doanh nghiệp là **“Lô thuê”**; nội dung MUST là các địa chỉ lô đang thuê, lấy từ dữ liệu lô còn hiệu lực và không hiển thị lô đã kết thúc nếu không được lọc lịch sử.
- **FR-023**: Hệ thống MUST cảnh báo hợp đồng sắp hết hạn, hết hạn hoặc thiếu hồ sơ bắt buộc.
- **FR-024**: Dữ liệu dịch vụ phải truy ngược được tới doanh nghiệp, hợp đồng, kỳ và nguồn ghi nhận.

#### D. Dịch vụ môi trường và quan trắc

- **FR-025**: Hệ thống MUST quản lý vận hành hệ thống xử lý nước thải tập trung và các hoạt động thu gom/xử lý nước thải.
- **FR-026**: Hệ thống MUST quản lý thu gom, vận chuyển, xử lý chất thải; dịch vụ vệ sinh; chăm sóc cây xanh và duy trì cảnh quan.
- **FR-027**: Số liệu môi trường MUST có chỉ tiêu, giá trị, đơn vị gốc, giá trị chuẩn hóa, kỳ, doanh nghiệp/trạm/khu vực, nguồn và trạng thái xác nhận.
- **FR-028**: Báo cáo PDF doanh nghiệp trong phạm vi này MUST tập trung tối thiểu vào tổng lượng nước thải và tổng kg rác đã xử lý; không bắt buộc trích xuất toàn bộ chỉ tiêu khác.
- **FR-029**: Hệ thống MUST ưu tiên đọc nội dung trực tiếp của PDF có lớp văn bản và MUST chuyển sang nhận dạng đối với PDF scan.
- **FR-030**: Hệ thống MUST lưu tệp PDF gốc, mã nhận diện tệp, trang nguồn, nội dung/giá trị trích xuất, độ tin cậy, người sửa và lịch sử xác nhận.
- **FR-031**: Hệ thống MUST chuẩn hóa nước thải về m³ và chất thải về kg, đồng thời giữ giá trị/đơn vị ban đầu.
- **FR-032**: Bản ghi thiếu chỉ tiêu, không xác định được doanh nghiệp/kỳ hoặc có độ tin cậy thấp MUST được đánh dấu để kiểm tra; MUST NOT tự coi là 0 hoặc tự xác nhận.
- **FR-033**: Hệ thống MUST phát hiện trùng theo doanh nghiệp, kỳ, nguồn, mã hồ sơ hoặc mã nhận diện tệp; import lại MUST NOT nhân đôi số liệu.
- **FR-034**: Hệ thống MUST quản lý trạm xử lý, thiết bị, thông số, đơn vị, tần suất dự kiến, trạng thái kết nối và thời gian hiệu lực.
- **FR-035**: Mỗi số đo quan trắc MUST có trạm, thiết bị, thông số, giá trị, đơn vị, thời điểm đo, thời điểm nhận và định danh nguồn.
- **FR-036**: Dữ liệu quan trắc gốc MUST được bảo toàn; hiệu chỉnh phải là bản ghi bổ sung có lý do, người xác nhận và liên kết số đo gốc.
- **FR-037**: Hệ thống MUST phân biệt tối thiểu `BÌNH THƯỜNG`, `VƯỢT NGƯỠNG`, `MẤT/THIẾU DỮ LIỆU`, `THIẾT BỊ LỖI` và `CHƯA XÁC ĐỊNH`.
- **FR-038**: Ngưỡng môi trường MUST có phạm vi, đơn vị, căn cứ, phiên bản và thời gian hiệu lực; việc đánh giá số đo quá khứ phải dùng đúng phiên bản có hiệu lực.
- **FR-039**: Hệ thống MUST lưu trạng thái nhận dữ liệu từ nguồn quan trắc, thời điểm đồng bộ, lỗi, độ mới và không xóa số liệu đã nhận khi nguồn tạm gián đoạn.

#### E. Đầu tư, xây dựng và quản lý tài sản hình thành

- **FR-040**: Hệ thống MUST quản lý đề xuất sửa chữa, cải tạo, nâng cấp và phát triển hạ tầng với lý do, phạm vi, căn cứ, ưu tiên, dự toán và trạng thái.
- **FR-041**: Hệ thống MUST theo dõi dự án đầu tư/xây dựng theo mốc, tiến độ, nguồn lực, chi phí, hồ sơ, vấn đề và đơn vị chịu trách nhiệm.
- **FR-042**: Hệ thống MUST hỗ trợ liên kết dự án với công trình/tài sản sau khi hoàn thành.
- **FR-043**: Hồ sơ bàn giao/tiếp nhận MUST ghi nhận tình trạng, hồ sơ hoàn công/tài liệu liên quan, đơn vị quản lý sau bàn giao và các hạng mục còn tồn tại.

#### F. Tài chính, nguồn thu và công nợ

- **FR-044**: Hệ thống MUST quản lý nguồn thu chi tiết tại trang Tài chính, không dùng dashboard làm nơi phân tích đầy đủ nguồn thu.
- **FR-045**: Hệ thống MUST hỗ trợ tối thiểu bảy nhóm nguồn thu hiện có: xử lý nước thải; xử lý rác; vận chuyển rác; dịch vụ khác; thuê dịch vụ hạ tầng; thuê đất nguyên thổ; thuê kết cấu hạ tầng. Danh mục phải cho phép cấu hình theo phương án giá được duyệt.
- **FR-046**: Giá trị tiền thuê lấy từ file nguồn hiện tại MUST được ghi nhận là **Đã thu**; MUST NOT được gắn nhãn hoặc cộng vào **Phải thu** nếu không có nghĩa vụ/hóa đơn hợp lệ.
- **FR-047**: Hệ thống MUST quản lý hóa đơn, dòng hóa đơn, doanh nghiệp, danh mục, kỳ nghĩa vụ, hạn thanh toán, trạng thái, hủy/thay thế và tài liệu.
- **FR-048**: Hệ thống MUST quản lý khoản thu, ngày thực thu, nguồn tiền, chứng từ, điều chỉnh và trạng thái phân bổ.
- **FR-049**: Khoản thu cho hóa đơn nhiều dòng MUST được phân bổ tới dòng/danh mục; nếu chưa phân bổ, hệ thống MUST giữ trạng thái “Chưa phân bổ” và không tự suy đoán.
- **FR-050**: Hệ thống MUST tính `Còn nợ = Phải thu hợp lệ - Đã thu phân bổ - Điều chỉnh hợp lệ`; công nợ không được âm, phần dư phải được tách để đối soát.
- **FR-051**: Hệ thống MUST tách năm/kỳ nghĩa vụ, ngày thực thu và ngày chốt công nợ.
- **FR-052**: Hệ thống MUST cung cấp báo cáo theo doanh nghiệp/hóa đơn/trạng thái quá hạn, tuổi nợ, số phải thu, đã thu, còn nợ và chứng từ nguồn.
- **FR-053**: Hệ thống MUST cung cấp báo cáo theo năm cho ba nhóm thuê: thuê dịch vụ hạ tầng, thuê đất nguyên thổ và thuê kết cấu hạ tầng; mỗi nhóm có số đã thu, phải thu, còn nợ và danh sách chứng từ.
- **FR-054**: Dashboard MUST chỉ hiển thị các số liệu tài chính điều hành như Tổng đã thu và Tổng công nợ còn lại; biểu đồ/bảng phân rã nguồn thu MUST nằm tại trang Tài chính.
- **FR-055**: Hệ thống MUST hỗ trợ phương án giá/đơn giá, khoản thu, cân đối nguồn lực tự chủ tài chính và báo cáo kế toán, thống kê, công khai tài chính, quyết toán theo quy định nghiệp vụ được phê duyệt.

#### G. Nhiệm vụ hỗ trợ, báo cáo và chất lượng dữ liệu

- **FR-056**: Hệ thống MUST quản lý nhiệm vụ với mã, nội dung, người phụ trách, phối hợp, ngày giao, hạn, ưu tiên, trạng thái, tiến độ, ghi chú và bằng chứng.
- **FR-057**: Luồng trạng thái tối thiểu MUST gồm `CHƯA THỰC HIỆN`, `ĐANG THỰC HIỆN`, `HOÀN THÀNH`; cho phép `TẠM DỪNG`, `HỦY`, `MỞ LẠI` kèm lý do và lịch sử.
- **FR-058**: Hệ thống MUST hỗ trợ nhiệm vụ phối hợp về an toàn, vệ sinh môi trường, PCCC, phòng chống thiên tai và nhiệm vụ khác theo phân công.
- **FR-059**: Hệ thống MUST quản lý dịch vụ sự nghiệp công hỗ trợ quản lý nhà nước, căn cứ giao, sản phẩm/kết quả, đơn vị phối hợp và tình trạng hoàn thành.
- **FR-060**: Bộ lọc dashboard/báo cáo MUST áp dụng nhất quán cho thẻ, biểu đồ, bảng chi tiết và tệp xuất.
- **FR-061**: Mỗi số tổng hợp MUST truy ngược được tới danh sách bản ghi nguồn; dữ liệu chưa xác nhận MUST được phân biệt với dữ liệu đã xác nhận.
- **FR-062**: Import MUST có các bước tải lên, kiểm tra cấu trúc, xem trước, báo lỗi theo dòng/cột, xác nhận và tổng kết.
- **FR-063**: Hệ thống MUST chống import trùng bằng mã lô, checksum và khóa nghiệp vụ; chạy lại cùng dữ liệu không được làm thay đổi tổng hợp.
- **FR-064**: Xóa dữ liệu đã xác nhận MUST được thay bằng trạng thái vô hiệu hoặc bút toán đảo; bản ghi nguồn và audit không được xóa.
- **FR-065**: Hệ thống MUST bảo vệ dữ liệu nhân sự, tài chính, môi trường và hồ sơ gốc khỏi truy cập trái phép; dữ liệu xuất phải áp dụng đúng quyền.
- **FR-066**: Báo cáo xuất MUST có thời điểm, kỳ, phạm vi lọc, người tạo, trạng thái xác nhận và nguồn dữ liệu.
- **FR-067**: Hệ thống MUST có cơ chế sao lưu, phục hồi và kiểm tra phục hồi trước khi vận hành chính thức.

## 7. Key Entities

- **User Account**: Tài khoản, vai trò, trạng thái, xác thực và lịch sử đăng nhập.
- **Organizational Unit**: Phòng, tổ, đội hoặc đơn vị nội bộ.
- **Employee**: Người làm việc, mã, chức danh, đơn vị, trạng thái và thời gian hiệu lực.
- **Function/Duty**: Chức năng, nhiệm vụ thường xuyên, vị trí/người áp dụng và thời gian hiệu lực.
- **Task Assignment**: Nhiệm vụ cụ thể, người phụ trách/phối hợp, hạn, trạng thái, tiến độ và bằng chứng.
- **Enterprise**: Doanh nghiệp/nhà đầu tư, mã định danh, tên, địa chỉ và KKT/KCN.
- **Rental Lot**: Lô thuê, địa chỉ, doanh nghiệp, thời gian hiệu lực, trạng thái đang thuê/kết thúc và nguồn.
- **Reporting Period**: Năm/tháng/quý/kỳ nghiệp vụ, ngày chốt và trạng thái.
- **Infrastructure Asset**: Tài sản/công trình, loại, vị trí, tình trạng, đơn vị quản lý và hồ sơ.
- **Handover Record**: Biên bản bàn giao/tiếp nhận và tài liệu liên quan.
- **Operation Log**: Nhật ký vận hành, kỳ/ca, chỉ số, kết quả và người thực hiện.
- **Inspection**: Kiểm tra hiện trạng, phát hiện, mức độ, kiến nghị và bằng chứng.
- **Incident**: Sự cố, nguy cơ, mức độ, trạng thái xử lý, thời hạn và kết quả.
- **Maintenance Plan**: Kế hoạch duy tu/bảo dưỡng/sửa chữa, hạng mục, lịch, nguồn lực và trạng thái.
- **Work Order**: Lệnh công việc, người thực hiện, tiến độ, chi phí, nghiệm thu và lịch sử.
- **Service Category**: Nhóm dịch vụ/nguồn thu, trạng thái và hiệu lực.
- **Price Scheme**: Phương án giá/đơn giá, căn cứ, phạm vi và thời gian hiệu lực.
- **Service Contract**: Hợp đồng, doanh nghiệp, dịch vụ, kỳ hạn, giá, trạng thái và tài liệu.
- **Service Delivery**: Khối lượng/kết quả dịch vụ, doanh nghiệp, hợp đồng, kỳ và chứng từ.
- **Environmental Facility**: Trạm/hệ thống xử lý nước thải hoặc công trình bảo vệ môi trường.
- **Wastewater Record**: Tổng lượng nước thải, đơn vị gốc/chuẩn hóa, doanh nghiệp, kỳ và nguồn.
- **Waste Treatment Record**: Tổng kg rác đã xử lý, đơn vị gốc/chuẩn hóa, doanh nghiệp, kỳ và nguồn.
- **Monitoring Station/Device**: Trạm, thiết bị, thông số, kết nối và hiệu lực.
- **Observation**: Số đo gốc, thời điểm, giá trị, đơn vị, nguồn và trạng thái chất lượng.
- **Threshold Rule**: Ngưỡng, phạm vi, đơn vị, căn cứ, phiên bản và hiệu lực.
- **Environmental Alert**: Cảnh báo vượt ngưỡng, thiếu dữ liệu, thiết bị lỗi và xử lý liên quan.
- **PDF Source Document**: Tệp gốc, checksum, trang, nội dung nhận dạng, độ tin cậy và trạng thái xác nhận.
- **Project/Investment Proposal**: Đề xuất, dự án, phạm vi, mốc, chi phí, hồ sơ và trạng thái.
- **Invoice**: Hóa đơn, doanh nghiệp, kỳ nghĩa vụ, dòng dịch vụ, số phải thu, hạn và trạng thái.
- **Payment/Adjustment**: Khoản đã thu, ngày thực thu, phân bổ, điều chỉnh, chứng từ và trạng thái.
- **Import Batch**: Lô import, loại dữ liệu, tệp, checksum, kết quả kiểm tra và trạng thái.
- **Audit Event**: Nhật ký bất biến của truy cập, import, điều chỉnh, xuất và cấu hình.

## 8. Success Criteria

### Measurable Outcomes

- **SC-001**: Giám đốc xem được bức tranh điều hành của một kỳ trong tối đa 10 giây sau khi dữ liệu đã sẵn sàng và truy tới bản ghi nguồn trong không quá 3 thao tác.
- **SC-002**: 100% thẻ và biểu đồ dashboard trong cùng một lần xem dùng đúng năm/kỳ/phạm vi đã chọn.
- **SC-003**: 100% giá trị tiền thuê từ bộ file kiểm thử được hiển thị là “Đã thu”; không giá trị nào bị suy thành “Phải thu” khi thiếu hóa đơn nghĩa vụ.
- **SC-004**: 100% báo cáo ba nhóm thuê theo doanh nghiệp/năm đối chiếu đúng với dữ liệu hóa đơn, phân bổ khoản thu và điều chỉnh nguồn.
- **SC-005**: Lô 10.000 dòng có cấu trúc được kiểm tra và trả kết quả thành công/lỗi trong tối đa 2 phút ở quy mô dự kiến.
- **SC-006**: Lô PDF kiểm thử gồm văn bản và scan nhận diện đúng tổng nước thải/tổng kg rác theo bộ dữ liệu chuẩn; 100% bản ghi độ tin cậy thấp được đưa vào hàng chờ kiểm tra.
- **SC-007**: 100% bản ghi PDF thiếu chỉ tiêu hoặc thiếu doanh nghiệp/kỳ không bị tính như số 0 và không vào tổng đã xác nhận.
- **SC-008**: 100% tài sản, công trình, sự cố và công việc bảo trì trong bộ kiểm thử có thể truy ra hồ sơ nguồn và lịch sử thay đổi.
- **SC-009**: 100% nhiệm vụ quá hạn trong bộ kiểm thử được nhận diện đúng; nhiệm vụ hoàn thành đúng hạn không bị đánh dấu quá hạn.
- **SC-010**: 100% số đo vượt ngưỡng, mất/thiếu dữ liệu, trùng và thiết bị lỗi trong bộ kiểm thử được phân loại đúng.
- **SC-011**: 100% thao tác thay đổi dữ liệu đã xác nhận có audit tới tài khoản, thời điểm, nguồn, lý do và giá trị trước/sau.
- **SC-012**: Tài khoản Giám đốc không thực hiện được bất kỳ thao tác thay đổi dữ liệu nào trong toàn bộ kiểm thử quyền.

## 9. Assumptions

- Giai đoạn đầu chỉ có hai tài khoản đăng nhập: Giám đốc và Admin dữ liệu; Admin là đầu mối nhập thay cho các cán bộ chuyên môn nếu chưa mở tài khoản theo vai trò.
- Phạm vi dữ liệu là KKT và các KCN được Trung tâm giao quản lý; hệ thống không mặc nhiên xác lập quyền quản lý ngoài phạm vi đó.
- Quy tắc kỳ doanh thu, ngày chốt công nợ, loại chứng từ hợp lệ, phương án giá, ngưỡng môi trường và thời hạn lưu trữ phải được đơn vị có thẩm quyền xác nhận trước khi triển khai.
- File tiền thuê hiện tại được cung cấp với ý nghĩa số đã thu; nếu về sau nguồn file có ý nghĩa khác, phải đổi quy tắc nguồn và ghi nhận phiên bản, không âm thầm đổi nhãn.
- PDF có thể là PDF văn bản hoặc PDF scan; việc nhận dạng cần cho phép kiểm tra thủ công khi chất lượng không đủ.
- Hệ thống chỉ tổng hợp tối thiểu tổng nước thải và kg rác đã xử lý từ PDF; các chỉ tiêu môi trường khác chỉ bổ sung khi có yêu cầu nghiệp vụ và mẫu dữ liệu được duyệt.
- Nguồn quan trắc bên ngoài phải cung cấp được định danh bản ghi, thời điểm, đơn vị, trạng thái nhận và cơ chế xác thực; khi nguồn gián đoạn, dữ liệu cũ vẫn được giữ.
- Dữ liệu tiền tệ mặc định là đồng Việt Nam; ngoại tệ và quy tắc tỷ giá là phạm vi bổ sung.
- Hệ thống ưu tiên phục vụ nội bộ trên trình duyệt; cổng tự phục vụ bên ngoài chưa thuộc giai đoạn này.

## 10. Scope Boundaries

### In Scope

- Dashboard điều hành tổng hợp và bộ lọc thống nhất.
- Trang Tài chính với nguồn thu chi tiết, đã thu, phải thu, công nợ, hóa đơn, khoản thu và báo cáo ba nhóm thuê.
- Quản lý doanh nghiệp và hiển thị cột **Lô thuê** theo địa chỉ lô đang thuê.
- Hồ sơ nhân sự, chức năng/nhiệm vụ, nhiệm vụ được giao, phối hợp, tiến độ và báo cáo.
- Danh mục tài sản/công trình, vận hành, kiểm tra, sự cố, duy tu, bảo dưỡng, sửa chữa và nghiệm thu.
- Danh mục dịch vụ hạ tầng, doanh nghiệp, hợp đồng, khối lượng và kết quả cung cấp dịch vụ.
- Dịch vụ môi trường, tổng nước thải, tổng kg rác xử lý, PDF text/scan, xem trước, độ tin cậy, xác nhận và truy vết.
- Trạm, thiết bị, quan trắc, ngưỡng, cảnh báo và trạng thái đồng bộ.
- Đề xuất, kế hoạch, dự án, bàn giao/tiếp nhận công trình và tài sản hình thành.
- Nhiệm vụ phối hợp quản lý nhà nước, PCCC, thiên tai, vệ sinh môi trường và dịch vụ sự nghiệp công.
- Import, chống trùng, audit, sao lưu/phục hồi và xuất báo cáo.

### Out of Scope for This Planning Phase

- Chấm công, tính lương, bảo hiểm, tuyển dụng và đánh giá thi đua đầy đủ.
- Kế toán tổng hợp, sổ cái, kê khai thuế hoặc thay thế phần mềm hóa đơn/kế toán chuyên dụng.
- Điều khiển từ xa thiết bị quan trắc hoặc tự động thay đổi cấu hình công trình.
- Cổng tự phục vụ cho doanh nghiệp, nhân viên, người dân hoặc cơ quan phối hợp.
- Tự động phê duyệt phương án giá, ngưỡng môi trường, dự án hoặc chứng từ tài chính.
- Tự động trích xuất toàn bộ thông số môi trường ngoài hai chỉ tiêu PDF đã nêu.
- Chọn nhà cung cấp OCR, framework, ngôn ngữ, hạ tầng triển khai hoặc tạo dữ liệu thật trong bước đặc tả.
- Viết mã nguồn, migration hoặc thay đổi giao diện trong bước tổng hợp đặc tả này.
