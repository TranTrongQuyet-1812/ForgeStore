-- DropIndex
DROP INDEX "ung_vien_repo_trang_thai_idx";

-- CreateIndex
CREATE INDEX "ung_dung_diem_thinh_hanh_idx" ON "ung_dung"("diem_thinh_hanh" DESC);

-- CreateIndex
CREATE INDEX "ung_dung_nen_tang_ho_tro_danh_muc_chinh_diem_thinh_hanh_idx" ON "ung_dung"("nen_tang_ho_tro", "danh_muc_chinh", "diem_thinh_hanh" DESC);

-- CreateIndex
CREATE INDEX "ung_dung_trang_thai_lan_kiem_tiep_theo_idx" ON "ung_dung"("trang_thai", "lan_kiem_tiep_theo");

-- CreateIndex
CREATE INDEX "ung_vien_repo_trang_thai_ngay_tao_idx" ON "ung_vien_repo"("trang_thai", "ngay_tao" ASC);
