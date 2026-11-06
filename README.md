# ⚒️ ForgeStore

[![CI](https://github.com/TranTrongQuyet-1812/ForgeStore_Project/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TranTrongQuyet-1812/ForgeStore_Project/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Kho ứng dụng mã nguồn mở, đọc bằng tiếng Việt.**

ForgeStore gom các phần mềm mã nguồn mở từ GitHub Releases vào một cửa hàng gọn gàng: tìm bằng tiếng Việt, đọc mô tả và README đã dịch sẵn, xem điểm uy tín kèm lý do, rồi cài ngay trên máy. AI chỉ là phần phụ trợ (dịch và tìm kiếm); phần cốt lõi là bộ luật rõ ràng, ai cũng kiểm lại được.

---

## ✨ Tính năng chính

- **Duyệt và tìm kiếm**: 9 danh mục, lọc theo nền tảng, sắp xếp theo sao, mới cập nhật hoặc đang thịnh hành. Gõ tiếng Việt vẫn tìm ra kết quả tiếng Anh nhờ dịch câu tìm và tìm theo ngữ nghĩa.
- **Đọc hiểu nhanh**: mô tả ngắn và README được dịch sang tiếng Việt, giữ nguyên tên repo, tên ứng dụng và khối mã.
- **Điểm uy tín minh bạch**: chấm bằng bộ luật cố định (lần cập nhật gần nhất, kho đã lưu trữ, giấy phép, số sao...), mỗi điểm trừ đều có lý do đọc được. Không dùng AI để chấm.
- **Cài đặt thật sự**: tải đúng tệp cài theo máy, hoặc hiện sẵn lệnh cài (winget, scoop, npm, pip, docker) để sao chép. Ứng dụng không tự chạy lệnh thay người dùng.
- **Thư viện theo thiết bị**: theo dõi ứng dụng đã cài, cập nhật, gỡ cài đặt.
- **Tài khoản**: đăng nhập bằng GitHub hoặc Google, yêu thích và đánh giá ứng dụng.
- **Bộ lọc chất lượng**: chỉ nhận kho có từ 1.000 sao, có bản phát hành hoặc cách cài rõ ràng, giấy phép phù hợp.

## 🏗️ Kiến trúc

| Thành phần                      | Công nghệ                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Desktop** (`apps/desktop`)    | Tauri v2 (Rust) + React 19 + TypeScript + Tailwind CSS                                                      |
| **Backend** (`apps/backend`)    | NestJS 11 + TypeScript + Prisma 6                                                                           |
| **Cơ sở dữ liệu**               | PostgreSQL (14 bảng, tiện ích pgvector cho tìm kiếm ngữ nghĩa)                                              |
| **Bộ nhớ đệm**                  | Redis (có phương án dự phòng trong bộ nhớ)                                                                  |
| **Mã dùng chung** (`packages/`) | `@forgestore/types` (kiểu dữ liệu, DTO), `@forgestore/ui-tokens` (màu, thiết kế)                            |
| **AI phụ trợ**                  | Gemini dịch mô tả và README; Gemini Embedding cho tìm kiếm ngữ nghĩa; Cloudflare, Groq, NVIDIA dịch câu tìm |

Backend theo mô hình Controller → Service. Phần Mobile (React Native) để sau, chưa nằm trong kho mã này.

## 📂 Cấu trúc thư mục

```
apps/
  backend/    API NestJS, schema Prisma, các tác vụ nền
  desktop/    Ứng dụng Tauri + React
packages/
  types/      Kiểu dữ liệu và DTO dùng chung
  ui-tokens/  Màu sắc, thiết kế, preset Tailwind
infra/        Worker dịch trên Cloudflare
```

## 🚀 Chạy thử trên máy

Yêu cầu: Node.js 20 trở lên, pnpm, PostgreSQL có pgvector, Redis. Riêng Desktop cần thêm Rust và các công cụ build của Tauri.

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env   # điền biến môi trường của bạn
pnpm build:packages
pnpm dev:backend     # chạy API
pnpm dev:desktop     # chạy ứng dụng Desktop
```

Không đưa mật khẩu, khóa API hay token vào mã nguồn; mọi giá trị nhạy cảm nằm trong `.env` (đã được bỏ qua khỏi git).

## ✅ Kiểm tra chất lượng

CI chạy đúng các lệnh dưới đây, nên nên chạy xanh cả năm trước khi gửi code:

```bash
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
```

## 🔒 Bảo mật

Backend đã được quét bằng OWASP ZAP (chế độ an toàn, các route công khai) và không phát hiện lỗ hổng nghiêm trọng. Phát hiện lỗ hổng, vui lòng báo riêng cho tác giả thay vì đăng công khai.

---

_Giấy phép [MIT](LICENSE)_
