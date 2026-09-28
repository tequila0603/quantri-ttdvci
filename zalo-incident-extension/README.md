# Hướng dẫn Cài đặt & Sử dụng Tiện ích Đẩy Sự cố Zalo Web

Tiện ích mở rộng Chrome/Edge giúp tiếp nhận sự cố kỹ thuật từ tin nhắn **Zalo Web (`chat.zalo.me`)** chỉ với 1 cú click chuột và đồng bộ trực tiếp lên **Bảng điều hành Dashboard của Trung tâm**.

---

## 1. Hướng dẫn Cài đặt vào Trình duyệt (Chỉ làm 1 lần)

1. Mở trình duyệt **Google Chrome** hoặc **Microsoft Edge**.
2. Trên thanh địa chỉ, nhập:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Ở góc trên cùng bên phải, gạt công tắc bật **Chế độ dành cho nhà phát triển (Developer mode)**.
4. Bấm vào nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục:
   `C:\Users\tequila\Documents\ChatGPT\Work\my-project\zalo-incident-extension`
6. Tiện ích **"Đẩy sự cố Zalo sang Trung tâm DVCI"** sẽ xuất hiện trên thanh công cụ trình duyệt.

---

## 2. Hướng dẫn Sử dụng Hàng ngày

1. Mở trang **Zalo Web** (`https://chat.zalo.me`) trên Chrome/Edge.
2. Khi có cán bộ/kỹ thuật viên nhắn tin báo sự cố trong nhóm (Ví dụ: *"KCN Hòa Hiệp đường D3 bị sụt lún mặt đường, xe tải đi qua khó khăn"*):
   - Dùng chuột **bôi đen dòng tin nhắn đó**.
   - **Click chuột phải** $\rightarrow$ Chọn **"⚡ Tạo sự cố hệ thống từ nội dung này"**.
3. Một bảng thông tin nổi sẽ xuất hiện ngay trên màn hình Zalo:
   - Hệ thống tự nhận diện Khu công nghiệp (KCN Hòa Hiệp 1).
   - Nội dung mô tả đã được tự động điền sẵn.
   - Bạn có thể chỉnh sửa lại tiêu đề hoặc chọn mức độ nghiêm trọng (*Thấp / Trung bình / Cao / Khẩn cấp*).
4. Bấm nút **"Lưu lên Dashboard"**:
   - Hệ thống sẽ sinh mã sự cố chính thức (ví dụ: `SC-2026-004`).
   - Sự cố xuất hiện tức thì trong **Khu vực Cảnh báo Đỏ** trên Dashboard tổng quan để Ban Giám đốc chỉ đạo xử lý.

---

## 3. Cấu hình Kết nối (Nếu máy chủ đổi địa chỉ)

- Bấm vào biểu tượng tiện ích hình mảnh ghép (Extensions) trên thanh trình duyệt $\rightarrow$ Chọn **"Zalo to Incident Hub"**.
- Mặc định:
  - **Địa chỉ API Server**: `http://localhost:3000/api/v1`
  - **Khóa bảo mật**: nhập đúng giá trị `EXTENSION_API_KEY` đang cấu hình trên máy chủ; tiện ích không tự điền khóa mặc định.
- Bấm **"Lưu Cấu Hình"** khi có thay đổi.
