-- AlterTable
ALTER TABLE "ung_dung_da_cai" 
  ADD COLUMN IF NOT EXISTS "khoa_registry" TEXT,
  ADD COLUMN IF NOT EXISTS "ten_hien_thi_registry" TEXT;
