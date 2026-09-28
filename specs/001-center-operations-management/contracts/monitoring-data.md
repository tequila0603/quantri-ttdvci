# Monitoring Ingestion Contract

## Premier Source

- **Business source**: `https://premier.vn/bqlkktpy/cong-bo`
- **V1 source mode**: Scheduled pull from the authorized Premier API behind this portal.
- **Important boundary**: The URL above is a business portal/page reference, not an assumed API endpoint. The exact API base URL, route, HTTP method, authentication, response schema, pagination, rate limit and timezone must be supplied or confirmed by Premier/authorized owner before implementation.
- **Security**: Credentials/tokens are runtime secrets; never place them in source code, plan files, logs or exported reports.

## Canonical Observation Message

| Field | Required | Rule |
|---|---:|---|
| `source_system` | Yes | Định danh Premier API/nguồn phản hồi |
| `source_record_key` | Yes | Khóa ổn định để chống trùng |
| `station_code` | Yes | Phải tồn tại và có hiệu lực |
| `device_code` | Yes | Thuộc đúng trạm tại thời điểm đo |
| `parameter_code` | Yes | Ánh xạ tới thông số chuẩn |
| `raw_value` | Yes | Giá trị số nguồn gửi |
| `raw_unit` | Yes | Không tự đổi nếu chưa có quy tắc |
| `measured_at` | Yes | Có múi giờ hoặc nguồn timezone đã cấu hình |
| `received_at` | Yes | Không trước measured time trừ sai lệch đồng hồ được đánh dấu |
| `device_status` | No | Nếu nguồn cung cấp |
| `quality_flag` | No | Giữ cờ nguồn và tính cờ nội bộ riêng |
| `sync_run_code` | Yes | Định danh lần đồng bộ Premier; thay cho mã lô tệp khi nhận API |

## Sync Contract

| Field | Rule |
|---|---|
| source portal | Premier portal above |
| sync mode | Scheduled pull; optional Admin-triggered retry if allowed |
| checkpoint | Persist provider cursor, page/token or last successful watermark |
| idempotency key | Provider record id; fallback to canonical observation key only when confirmed safe |
| raw payload | Store immutable payload plus response metadata and checksum |
| sync status | `SUCCESS`, `PARTIAL`, `AUTH_ERROR`, `RATE_LIMITED`, `PROVIDER_ERROR`, `SCHEMA_ERROR`, `STALE` |
| retry | Exponential/backoff policy for transient errors; never retry permanent schema/auth errors indefinitely |
| freshness | Record last attempt, last success, oldest unprocessed timestamp and current lag |
| pagination | Must complete all pages without losing or duplicating records; exact method depends on Premier contract |

## Failure Handling

- `401/403`: pause automatic retries, mark credential/authorization failure and notify Admin.
- `429`: honor provider retry-after/rate limit and preserve checkpoint.
- `5xx`/network timeout: retry within bounded policy; retain last good data and mark stale.
- Schema/required-field change: quarantine affected response, do not commit it as valid observations, retain raw response and error details.
- Partial sync: show imported count, failed page/record and checkpoint so the next run resumes safely.

## Ingestion Outcomes

| Outcome | Meaning | Report behavior |
|---|---|---|
| `ACCEPTED` | Dữ liệu hợp lệ và chưa tồn tại | Dùng cho xu hướng/đánh giá |
| `DUPLICATE` | Trùng khóa nguồn | Không tạo số đo thứ hai |
| `INVALID` | Sai mã, kiểu hoặc đơn vị | Không dùng; lưu lỗi tiếp nhận |
| `LATE` | Đến muộn ngoài cửa sổ dự kiến | Có thể dùng sau xác nhận; đánh dấu |
| `DEVICE_FAULT` | Nguồn báo lỗi thiết bị | Không đánh giá như giá trị bình thường |

## Immutability

- Bản ghi được chấp nhận không bị update/delete bởi Admin.
- Hiệu chỉnh tạo `ObservationCorrection`, giữ số đo gốc và căn cứ.
- Thay đổi ngưỡng tạo phiên bản mới; không ghi đè ngưỡng đã dùng.

## Gap Detection

Với mỗi thiết bị/thông số đang hoạt động, hệ thống so khoảng cách thời gian với `expected_interval_seconds` và dung sai được cấu hình. Khoảng thiếu tạo trạng thái gap; không sinh số đo giả bằng 0.

## Threshold Evaluation

1. Chuẩn hóa đơn vị chỉ khi có quy tắc chuyển đổi được duyệt.
2. Chọn `ThresholdRule` đã phê duyệt và có hiệu lực theo thông số, trạm và thời điểm.
3. Nếu không có quy tắc phù hợp, kết quả là `UNKNOWN`.
4. Lưu phiên bản ngưỡng được dùng để kết quả có thể tái tạo.

## Connection Discovery Required Before Implementation

Cho từng trạm phải lập bảng kiểm kê: hãng/model, serial, thông số, tần suất, múi giờ, giao thức/cổng, xác thực, định dạng payload, chính sách retry, quyền truy cập và người chịu trách nhiệm xác nhận dữ liệu.
