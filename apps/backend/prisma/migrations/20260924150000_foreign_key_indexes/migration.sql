-- CreateIndex
CREATE INDEX IF NOT EXISTS "kho_yeu_thich_ma_ung_dung_idx" ON "kho_yeu_thich"("ma_ung_dung");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ung_dung_da_cai_ma_ung_dung_idx" ON "ung_dung_da_cai"("ma_ung_dung");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ung_dung_da_cai_ma_tep_da_cai_idx" ON "ung_dung_da_cai"("ma_tep_da_cai");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "nhat_ky_nap_repo_ma_nguoi_dung_yeu_cau_idx" ON "nhat_ky_nap_repo"("ma_nguoi_dung_yeu_cau");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "nhat_ky_nap_repo_ma_ung_dung_tao_ra_idx" ON "nhat_ky_nap_repo"("ma_ung_dung_tao_ra");
