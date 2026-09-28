# Permission Contract

## Role Matrix

| Capability | Director | Data Admin |
|---|---:|---:|
| Đăng nhập/đổi mật khẩu của chính mình | Yes | Yes |
| Xem dashboard và báo cáo | Yes | Preview only as needed for import validation |
| Xem chi tiết nguồn tạo số tổng hợp | Yes | Yes for imported data validation |
| Xuất báo cáo | Yes | No by default |
| Import dữ liệu | No | Yes |
| Xem trước/xác nhận lô import | No | Yes |
| Nhập điều chỉnh có lý do | No | Yes |
| Sửa/xóa số đo quan trắc gốc | No | No |
| Quản trị tài khoản/vai trò | No | No |
| Phê duyệt ngưỡng/quy tắc nghiệp vụ | No | No |
| Xem nhật ký kiểm toán | Read-only summary | Own/import-related events |

## Enforcement Rules

1. Quyền phải được kiểm tra ở ranh giới xử lý dữ liệu, không chỉ ẩn nút giao diện.
2. `DIRECTOR` bị từ chối với mọi yêu cầu làm thay đổi trạng thái dữ liệu.
3. `DATA_ADMIN` chỉ được thay đổi dữ liệu thông qua luồng import/adjustment có audit.
4. Không có chức năng tự đăng ký, mời người dùng hoặc tạo tài khoản thứ ba trong v1.
5. Việc khôi phục/mở khóa tài khoản phải theo quy trình quản trị vận hành bên ngoài ứng dụng và được ghi nhận.

## Authorization Acceptance Checks

- Mỗi thao tác ghi được thử bằng cả hai vai trò; Director luôn nhận kết quả từ chối và dữ liệu không đổi.
- URL hoặc hành động bị ẩn vẫn bị từ chối nếu gọi trực tiếp.
- Admin không thể tự nâng quyền bằng sửa request, import hoặc thay đổi trường role.
- Sự kiện từ chối quyền được ghi log an toàn, không lộ dữ liệu nhạy cảm.
