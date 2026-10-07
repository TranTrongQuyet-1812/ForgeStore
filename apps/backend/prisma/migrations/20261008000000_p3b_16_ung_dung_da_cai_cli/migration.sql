-- AlterTable
ALTER TABLE "ung_dung_da_cai" 
  ADD COLUMN IF NOT EXISTS "trinh_quan_ly_goi" TEXT,
  ADD COLUMN IF NOT EXISTS "ten_goi_cli" TEXT,
  ADD COLUMN IF NOT EXISTS "lenh_go_cli" TEXT,
  ADD COLUMN IF NOT EXISTS "trang_thai_xac_nhan" TEXT DEFAULT 'DA_XAC_NHAN',
  ADD COLUMN IF NOT EXISTS "thoi_gian_het_han" TIMESTAMP(3);
