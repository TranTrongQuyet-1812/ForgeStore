# ⚒️ ForgeStore

> **The Next-Gen Open-Source App Ecosystem**  
> *"Where Open-Source Craftsmanship Meets Seamless Discovery"*

ForgeStore là hệ thống kho ứng dụng mã nguồn mở đa nền tảng (Desktop & Mobile) thế hệ mới, tích hợp trí tuệ nhân tạo (Dual-AI: Jev AI + Gemini) nhằm tự động đánh giá độ tin cậy, phân loại danh mục và bản địa hóa tính năng phần mềm từ các kho lưu trữ GitHub Releases.

---

## 📚 Tài Liệu Dự Án (Documentation)
- **Tổng quan kiến trúc & Thiết kế hệ thống** *(Tài liệu đặc tả nội bộ)*
- **Thiết kế Cơ sở dữ liệu Thuần Việt (11 Bảng + pgvector + Prisma)** *(Tài liệu đặc tả nội bộ)*
- **Quy hoạch Bộ khung Monorepo** *(Tài liệu đặc tả nội bộ)*

## 🏗️ Kiến Trúc Hệ Thống (Core Pillars)
1. **Desktop App**: Rust (Tauri v2) + React + TypeScript
2. **Mobile App**: React Native (TypeScript) — Tối ưu cho Android 13+
3. **Central Backend**: NestJS + TypeScript + PostgreSQL 11 Bảng (Prisma ORM & pgvector) + Redis Cache Bắt Buộc
4. **AI Pipeline**: Jev AI (System 1 - Decision Engine) + Gemini (System 2 - Summarizer)

---
*Tác giả: Trần Trọng Quyết — Đại học Lạc Hồng (LHU)*
