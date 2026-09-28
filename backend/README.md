# Center Operations REST API

REST API cho hệ thống quản trị Trung tâm Dịch vụ công ích.

## Chạy bằng Docker

Từ thư mục project:

```powershell
docker compose up -d --build
docker compose ps
```

Kiểm tra:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000/ready -UseBasicParsing
```

## API hiện có

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/reports/summary?year=2026`
- `GET /api/v1/reports/lease-annual?year=2026`
- `GET /api/v1/reports/receivables`
- `GET /api/v1/workforce/units`
- `GET /api/v1/workforce/employees`
- `GET /api/v1/monitoring/observations`
- `GET /api/v1/monitoring/sync-runs`
- `GET /api/v1/admin/imports`
- `GET /api/v1/admin/audit-events`

Các endpoint nghiệp vụ cần session cookie. `/health` và `/ready` là endpoint vận hành.

## Tài khoản

Khi API khởi động, schema chỉ được phục hồi tự động nếu PostgreSQL chưa có schema hay bảng ứng dụng; database có trạng thái dở dang sẽ làm API dừng để tránh ghi đè. Đây chỉ phục hồi cấu trúc; không chép dữ liệu nghiệp vụ hoặc seed từ Docker. Để tạo tài khoản ban đầu, đặt `CENTER_INITIAL_ACCOUNT_JSON` làm biến bí mật trên nền tảng triển khai, chứa đúng một tài khoản với username, display name, role (`DIRECTOR` hoặc `DATA_ADMIN`) và bcrypt hash. Sau khi triển khai tạo tài khoản, xóa biến này khỏi cấu hình triển khai. Không đưa mật khẩu/hash vào mã nguồn hoặc log.
