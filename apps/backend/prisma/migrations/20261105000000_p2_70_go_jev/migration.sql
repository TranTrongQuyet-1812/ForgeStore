-- P2-70: gỡ Jev (TypeSafe AI). Điểm uy tín chỉ còn do bộ luật quyết.
-- Dữ liệu đã được tính lại bằng luật trước khi xóa cột (điểm và lý do trừ điểm trong yeu_to_rui_ro),
-- nên hai cột này không còn mã nào đọc. Không đụng chỉ mục HNSW (D-16).
ALTER TABLE "phan_tich_ai" DROP COLUMN "da_tham_dinh_jev",
DROP COLUMN "trang_thai_tham_dinh_jev";

DROP TYPE "TrangThaiThamDinhJev";
