# Font đóng gói trong app

App không tải font từ internet nên chạy được khi mất mạng và không gửi IP người dùng cho bên thứ ba.

- **Google Sans** (chữ giao diện) và **JetBrains Mono** (chữ mã, số): nguồn Google Fonts, giấy phép SIL Open Font License 1.1 (theo siêu dữ liệu trong kho google/fonts, thư mục ofl/).
- Chỉ giữ ba bộ ký tự cần cho tiếng Việt: latin, latin-ext, vietnamese. Mỗi file là font biến đổi, dùng được các độ đậm 400 đến 700.
- Khai báo @font-face ở src/styles/fonts.css.
