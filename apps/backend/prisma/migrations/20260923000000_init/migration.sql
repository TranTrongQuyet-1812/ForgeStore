-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- CreateEnum
CREATE TYPE "VaiTro" AS ENUM ('NGUOI_DUNG', 'QUAN_TRI_VIEN');

-- CreateEnum
CREATE TYPE "LoaiThietBi" AS ENUM ('MAY_TINH_WINDOWS', 'DIEN_THOAI_ANDROID', 'KHAC');

-- CreateEnum
CREATE TYPE "NenTangHoTro" AS ENUM ('ANDROID', 'WINDOWS', 'DA_NEN_TANG');

-- CreateEnum
CREATE TYPE "MucDoUyTin" AS ENUM ('AN_TOAN_CAO', 'CAN_LUU_Y', 'CANH_BAO_RUI_RO');

-- CreateEnum
CREATE TYPE "DinhDangTep" AS ENUM ('APK', 'EXE', 'MSI', 'ZIP_PORTABLE', 'KHAC');

-- CreateEnum
CREATE TYPE "KienTrucChip" AS ENUM ('ARM64_V8A', 'ARMEABI_V7A', 'X86_64', 'X86', 'DUNG_CHUNG', 'KHONG_XAC_DINH');

-- CreateEnum
CREATE TYPE "TrangThaiNapRepo" AS ENUM ('THANH_CONG', 'LINK_KHONG_HOP_LE', 'KHONG_CO_RELEASE', 'KHONG_CO_FILE_CAI_DAT', 'THAT_BAI');

-- CreateTable
CREATE TABLE "nguoi_dung" (
    "ma_nguoi_dung" UUID NOT NULL,
    "ma_dinh_danh_github" TEXT,
    "ma_dinh_danh_google" TEXT,
    "ten_dang_nhap" TEXT NOT NULL,
    "ten_hien_thi" TEXT,
    "thu_dien_tu" TEXT,
    "duong_dan_avatar" TEXT,
    "vai_tro" "VaiTro" NOT NULL DEFAULT 'NGUOI_DUNG',
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nguoi_dung_pkey" PRIMARY KEY ("ma_nguoi_dung")
);

-- CreateTable
CREATE TABLE "thiet_bi" (
    "ma_thiet_bi" UUID NOT NULL,
    "ma_nguoi_dung" UUID NOT NULL,
    "dinh_danh_phan_cung" TEXT NOT NULL,
    "ten_thiet_bi" TEXT NOT NULL,
    "loai_thiet_bi" "LoaiThietBi" NOT NULL DEFAULT 'KHAC',
    "ngay_dang_ky" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hoat_dong_lan_cuoi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thiet_bi_pkey" PRIMARY KEY ("ma_thiet_bi")
);

-- CreateTable
CREATE TABLE "phien_dang_nhap" (
    "ma_phien" UUID NOT NULL,
    "ma_nguoi_dung" UUID NOT NULL,
    "ma_thiet_bi" UUID NOT NULL,
    "chuoi_ma_hoa_token" TEXT NOT NULL,
    "dia_chi_ip" TEXT,
    "thoi_gian_het_han" TIMESTAMP(3) NOT NULL,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phien_dang_nhap_pkey" PRIMARY KEY ("ma_phien")
);

-- CreateTable
CREATE TABLE "ung_dung" (
    "ma_ung_dung" UUID NOT NULL,
    "ten_repo_day_du" TEXT NOT NULL,
    "chu_so_huu" TEXT NOT NULL,
    "ten_kho_chua" TEXT NOT NULL,
    "duong_dan_github" TEXT NOT NULL,
    "mo_ta_goc_tieng_anh" TEXT,
    "duong_dan_icon" TEXT,
    "so_sao_github" INTEGER NOT NULL DEFAULT 0,
    "so_luot_fork" INTEGER NOT NULL DEFAULT 0,
    "loai_giay_phep" TEXT,
    "ngon_ngu_chinh" TEXT,
    "danh_sach_chu_de" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "danh_muc_chinh" TEXT NOT NULL DEFAULT 'Tiện ích hệ thống',
    "nen_tang_ho_tro" "NenTangHoTro" NOT NULL DEFAULT 'DA_NEN_TANG',
    "duoc_noi_bat" BOOLEAN NOT NULL DEFAULT false,
    "da_xac_minh" BOOLEAN NOT NULL DEFAULT false,
    "ten_goi_android" TEXT,
    "trang_thai" TEXT NOT NULL DEFAULT 'HOAT_DONG',
    "dong_bo_lan_cuoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ung_dung_pkey" PRIMARY KEY ("ma_ung_dung")
);

-- CreateTable
CREATE TABLE "phan_tich_ai" (
    "ma_phan_tich" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "khau_hieu_tieng_viet" TEXT NOT NULL,
    "tom_tat_tinh_nang_vi" TEXT NOT NULL,
    "diem_uy_tin" INTEGER NOT NULL DEFAULT 80,
    "muc_do_an_toan" "MucDoUyTin" NOT NULL DEFAULT 'AN_TOAN_CAO',
    "da_tham_dinh_jev" BOOLEAN NOT NULL DEFAULT false,
    "yeu_to_rui_ro" JSONB NOT NULL DEFAULT '[]',
    "quyen_han_da_kiem_tra" JSONB NOT NULL DEFAULT '[]',
    "vector_ngu_nghia" vector(768),
    "mo_hinh_tom_tat" TEXT,
    "thoi_gian_phan_tich" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phan_tich_ai_pkey" PRIMARY KEY ("ma_phan_tich")
);

-- CreateTable
CREATE TABLE "ban_phat_hanh" (
    "ma_phat_hanh" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "ma_release_github" BIGINT,
    "ten_phien_ban" TEXT NOT NULL,
    "tieu_de_phat_hanh" TEXT,
    "nhat_ky_thay_doi_goc" TEXT,
    "tom_tat_nang_cap_vi" TEXT,
    "la_ban_thu_nghiem" BOOLEAN NOT NULL DEFAULT false,
    "ngay_phat_hanh" TIMESTAMP(3) NOT NULL,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ban_phat_hanh_pkey" PRIMARY KEY ("ma_phat_hanh")
);

-- CreateTable
CREATE TABLE "tep_cai_dat" (
    "ma_tep" UUID NOT NULL,
    "ma_phat_hanh" UUID NOT NULL,
    "ten_tep" TEXT NOT NULL,
    "duong_dan_tai_ve" TEXT NOT NULL,
    "dung_luong_bytes" BIGINT NOT NULL DEFAULT 0,
    "dinh_dang_tep" "DinhDangTep" NOT NULL DEFAULT 'KHAC',
    "kien_truc_chip" "KienTrucChip" NOT NULL DEFAULT 'KHONG_XAC_DINH',
    "ma_bam_sha256" TEXT,
    "so_luot_tai" INTEGER NOT NULL DEFAULT 0,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tep_cai_dat_pkey" PRIMARY KEY ("ma_tep")
);

-- CreateTable
CREATE TABLE "kho_yeu_thich" (
    "ma_yeu_thich" UUID NOT NULL,
    "ma_nguoi_dung" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "thiet_bi_them" TEXT NOT NULL DEFAULT 'MAY_TINH',
    "ngay_them" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kho_yeu_thich_pkey" PRIMARY KEY ("ma_yeu_thich")
);

-- CreateTable
CREATE TABLE "ung_dung_da_cai" (
    "ma_ban_ghi" UUID NOT NULL,
    "ma_nguoi_dung" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "ma_thiet_bi" UUID NOT NULL,
    "phien_ban_hien_tai" TEXT NOT NULL,
    "ma_tep_da_cai" UUID,
    "duong_dan_thu_muc" TEXT,
    "ngay_cai_dat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat_cuoi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ung_dung_da_cai_pkey" PRIMARY KEY ("ma_ban_ghi")
);

-- CreateTable
CREATE TABLE "danh_gia_ung_dung" (
    "ma_danh_gia" UUID NOT NULL,
    "ma_nguoi_dung" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "so_sao" INTEGER NOT NULL,
    "tieu_de" TEXT,
    "noi_dung_nhan_xet" TEXT NOT NULL,
    "phien_ban_danh_gia" TEXT NOT NULL,
    "thiet_bi_danh_gia" TEXT NOT NULL,
    "so_luot_huu_ich" INTEGER NOT NULL DEFAULT 0,
    "ngay_danh_gia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "danh_gia_ung_dung_pkey" PRIMARY KEY ("ma_danh_gia")
);

-- CreateTable
CREATE TABLE "nhat_ky_nap_repo" (
    "ma_nhat_ky" UUID NOT NULL,
    "ma_nguoi_dung_yeu_cau" UUID,
    "duong_dan_repo_nhap" TEXT NOT NULL,
    "trang_thai" "TrangThaiNapRepo" NOT NULL DEFAULT 'THANH_CONG',
    "thong_bao_loi" TEXT,
    "ma_ung_dung_tao_ra" UUID,
    "ngay_yeu_cau" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_nap_repo_pkey" PRIMARY KEY ("ma_nhat_ky")
);

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_ma_dinh_danh_github_key" ON "nguoi_dung"("ma_dinh_danh_github");

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_ma_dinh_danh_google_key" ON "nguoi_dung"("ma_dinh_danh_google");

-- CreateIndex
CREATE INDEX "thiet_bi_ma_nguoi_dung_idx" ON "thiet_bi"("ma_nguoi_dung");

-- CreateIndex
CREATE UNIQUE INDEX "thiet_bi_ma_nguoi_dung_dinh_danh_phan_cung_key" ON "thiet_bi"("ma_nguoi_dung", "dinh_danh_phan_cung");

-- CreateIndex
CREATE INDEX "phien_dang_nhap_ma_nguoi_dung_idx" ON "phien_dang_nhap"("ma_nguoi_dung");

-- CreateIndex
CREATE INDEX "phien_dang_nhap_ma_thiet_bi_idx" ON "phien_dang_nhap"("ma_thiet_bi");

-- CreateIndex
CREATE UNIQUE INDEX "ung_dung_ten_repo_day_du_key" ON "ung_dung"("ten_repo_day_du");

-- CreateIndex
CREATE INDEX "ung_dung_danh_muc_chinh_so_sao_github_idx" ON "ung_dung"("danh_muc_chinh", "so_sao_github" DESC);

-- CreateIndex
CREATE INDEX "ung_dung_nen_tang_ho_tro_duoc_noi_bat_idx" ON "ung_dung"("nen_tang_ho_tro", "duoc_noi_bat");

-- CreateIndex
CREATE INDEX "ung_dung_so_sao_github_idx" ON "ung_dung"("so_sao_github" DESC);

-- CreateIndex
CREATE INDEX "ung_dung_ten_goi_android_idx" ON "ung_dung"("ten_goi_android");

-- CreateIndex
CREATE UNIQUE INDEX "phan_tich_ai_ma_ung_dung_key" ON "phan_tich_ai"("ma_ung_dung");

-- CreateIndex
CREATE INDEX "ban_phat_hanh_ma_ung_dung_ngay_phat_hanh_idx" ON "ban_phat_hanh"("ma_ung_dung", "ngay_phat_hanh" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ban_phat_hanh_ma_ung_dung_ten_phien_ban_key" ON "ban_phat_hanh"("ma_ung_dung", "ten_phien_ban");

-- CreateIndex
CREATE INDEX "tep_cai_dat_ma_phat_hanh_dinh_dang_tep_kien_truc_chip_idx" ON "tep_cai_dat"("ma_phat_hanh", "dinh_dang_tep", "kien_truc_chip");

-- CreateIndex
CREATE INDEX "kho_yeu_thich_ma_nguoi_dung_ngay_them_idx" ON "kho_yeu_thich"("ma_nguoi_dung", "ngay_them" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "kho_yeu_thich_ma_nguoi_dung_ma_ung_dung_key" ON "kho_yeu_thich"("ma_nguoi_dung", "ma_ung_dung");

-- CreateIndex
CREATE INDEX "ung_dung_da_cai_ma_thiet_bi_idx" ON "ung_dung_da_cai"("ma_thiet_bi");

-- CreateIndex
CREATE INDEX "ung_dung_da_cai_ma_nguoi_dung_idx" ON "ung_dung_da_cai"("ma_nguoi_dung");

-- CreateIndex
CREATE UNIQUE INDEX "ung_dung_da_cai_ma_thiet_bi_ma_ung_dung_key" ON "ung_dung_da_cai"("ma_thiet_bi", "ma_ung_dung");

-- CreateIndex
CREATE INDEX "danh_gia_ung_dung_ma_ung_dung_so_sao_idx" ON "danh_gia_ung_dung"("ma_ung_dung", "so_sao" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "danh_gia_ung_dung_ma_nguoi_dung_ma_ung_dung_phien_ban_danh__key" ON "danh_gia_ung_dung"("ma_nguoi_dung", "ma_ung_dung", "phien_ban_danh_gia");

-- AddForeignKey
ALTER TABLE "thiet_bi" ADD CONSTRAINT "thiet_bi_ma_nguoi_dung_fkey" FOREIGN KEY ("ma_nguoi_dung") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_dang_nhap" ADD CONSTRAINT "phien_dang_nhap_ma_nguoi_dung_fkey" FOREIGN KEY ("ma_nguoi_dung") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_dang_nhap" ADD CONSTRAINT "phien_dang_nhap_ma_thiet_bi_fkey" FOREIGN KEY ("ma_thiet_bi") REFERENCES "thiet_bi"("ma_thiet_bi") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_tich_ai" ADD CONSTRAINT "phan_tich_ai_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_phat_hanh" ADD CONSTRAINT "ban_phat_hanh_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tep_cai_dat" ADD CONSTRAINT "tep_cai_dat_ma_phat_hanh_fkey" FOREIGN KEY ("ma_phat_hanh") REFERENCES "ban_phat_hanh"("ma_phat_hanh") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kho_yeu_thich" ADD CONSTRAINT "kho_yeu_thich_ma_nguoi_dung_fkey" FOREIGN KEY ("ma_nguoi_dung") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kho_yeu_thich" ADD CONSTRAINT "kho_yeu_thich_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ung_dung_da_cai" ADD CONSTRAINT "ung_dung_da_cai_ma_nguoi_dung_fkey" FOREIGN KEY ("ma_nguoi_dung") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ung_dung_da_cai" ADD CONSTRAINT "ung_dung_da_cai_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ung_dung_da_cai" ADD CONSTRAINT "ung_dung_da_cai_ma_thiet_bi_fkey" FOREIGN KEY ("ma_thiet_bi") REFERENCES "thiet_bi"("ma_thiet_bi") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ung_dung_da_cai" ADD CONSTRAINT "ung_dung_da_cai_ma_tep_da_cai_fkey" FOREIGN KEY ("ma_tep_da_cai") REFERENCES "tep_cai_dat"("ma_tep") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "danh_gia_ung_dung" ADD CONSTRAINT "danh_gia_ung_dung_ma_nguoi_dung_fkey" FOREIGN KEY ("ma_nguoi_dung") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "danh_gia_ung_dung" ADD CONSTRAINT "danh_gia_ung_dung_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky_nap_repo" ADD CONSTRAINT "nhat_ky_nap_repo_ma_nguoi_dung_yeu_cau_fkey" FOREIGN KEY ("ma_nguoi_dung_yeu_cau") REFERENCES "nguoi_dung"("ma_nguoi_dung") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky_nap_repo" ADD CONSTRAINT "nhat_ky_nap_repo_ma_ung_dung_tao_ra_fkey" FOREIGN KEY ("ma_ung_dung_tao_ra") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE SET NULL ON UPDATE CASCADE;



-- =============================================================
-- RÀNG BUỘC CHECK BỔ SUNG (D-14 & P2-02.6)
-- =============================================================

-- 1. Đánh giá ứng dụng: Số sao phải từ 1 đến 5
ALTER TABLE "danh_gia_ung_dung" ADD CONSTRAINT "chk_danh_gia_so_sao" CHECK (so_sao >= 1 AND so_sao <= 5);

-- 2. Phân tích AI: Điểm uy tín từ 0 đến 100
ALTER TABLE "phan_tich_ai" ADD CONSTRAINT "chk_phan_tich_diem_uy_tin" CHECK (diem_uy_tin >= 0 AND diem_uy_tin <= 100);

-- 3. Người dùng: Bắt buộc có ít nhất một trong ma_dinh_danh_github hoặc ma_dinh_danh_google (D-14)
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_dinh_danh" CHECK (ma_dinh_danh_github IS NOT NULL OR ma_dinh_danh_google IS NOT NULL);

-- =============================================================
-- CHỈ MỤC HNSW VECTOR NGỮ NGHĨA 768 CHIỀU (P2-03)
-- =============================================================
CREATE INDEX "idx_phan_tich_ai_vector" ON "phan_tich_ai" USING hnsw (vector_ngu_nghia vector_cosine_ops);
