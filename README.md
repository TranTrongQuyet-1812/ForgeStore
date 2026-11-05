# ⚒️ ForgeStore

[![CI](https://github.com/TranTrongQuyet-1812/ForgeStore_Project/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TranTrongQuyet-1812/ForgeStore_Project/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **The Next-Gen Open-Source App Ecosystem**  
> _"Where Open-Source Craftsmanship Meets Seamless Discovery"_

ForgeStore là hệ thống kho ứng dụng mã nguồn mở đa nền tảng (Desktop & Mobile) thế hệ mới, lấy phần mềm từ GitHub Releases, chấm điểm uy tín bằng bộ luật minh bạch, và dùng AI để dịch mô tả, README sang tiếng Việt cùng tìm kiếm theo ngữ nghĩa.

---

## 📚 Tài Liệu Dự Án (Documentation)

- **Tổng quan kiến trúc & Thiết kế hệ thống** _(Tài liệu đặc tả nội bộ)_
- **Thiết kế Cơ sở dữ liệu Thuần Việt (14 Bảng + pgvector + Prisma)** _(Tài liệu đặc tả nội bộ)_
- **Quy hoạch Bộ khung Monorepo** _(Tài liệu đặc tả nội bộ)_

## 🏗️ Kiến Trúc Hệ Thống (Core Pillars)

1. **Desktop App**: Rust (Tauri v2) + React + TypeScript
2. **Mobile App**: React Native (TypeScript) — Tối ưu cho Android 13+
3. **Central Backend**: NestJS + TypeScript + PostgreSQL 14 Bảng (Prisma ORM & pgvector) + Redis Cache Bắt Buộc
4. **Điểm uy tín**: bộ luật cố định, mỗi điểm trừ có lý do đọc được
5. **AI phụ trợ**: Gemini dịch mô tả và README; Gemini Embedding tìm kiếm theo ngữ nghĩa

---

_Tác giả: Trần Trọng Quyết — Đại học Lạc Hồng (LHU)_
