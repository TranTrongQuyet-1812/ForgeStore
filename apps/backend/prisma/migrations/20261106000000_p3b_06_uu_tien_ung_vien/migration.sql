-- P3B-06.4: mã lý do loại của bộ lọc dùng chung (chỉ thêm, giữ nguyên mã cũ)
ALTER TYPE "LyDoLoaiUngVien" ADD VALUE 'IT_SAO';
ALTER TYPE "LyDoLoaiUngVien" ADD VALUE 'LA_FORK';
ALTER TYPE "LyDoLoaiUngVien" ADD VALUE 'KHONG_CON_CAP_NHAT';
ALTER TYPE "LyDoLoaiUngVien" ADD VALUE 'TRONG_DANH_SACH_CHAN';

-- P3B-06.1 và P3B-06.7: độ ưu tiên và số lần thử của ứng viên
ALTER TABLE "ung_vien_repo" ADD COLUMN "do_uu_tien" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "so_lan_thu" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ung_vien_repo_trang_thai_do_uu_tien_ngay_tao_idx" ON "ung_vien_repo"("trang_thai", "do_uu_tien", "ngay_tao" ASC);
