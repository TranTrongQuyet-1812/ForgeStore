-- Dọn dẹp dòng DU_PHONG cũ theo P3B-10 & Quyết định D-17
UPDATE "phan_tich_ai"
SET "mo_hinh_tom_tat" = NULL, "tom_tat_tinh_nang_vi" = NULL
WHERE "mo_hinh_tom_tat" = 'DU_PHONG';
