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

Database đã có hai role `DIRECTOR` và `DATA_ADMIN`, nhưng chưa tạo username/password thật. Không đặt mật khẩu mặc định trong source; tài khoản sẽ được tạo ở bước bootstrap riêng.
