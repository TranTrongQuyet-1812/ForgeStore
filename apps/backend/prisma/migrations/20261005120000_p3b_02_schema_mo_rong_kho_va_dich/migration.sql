-- CreateEnum
CREATE TYPE "TrangThaiDichReadme" AS ENUM ('DANG_DICH', 'HOAN_TAT', 'THAT_BAI', 'DA_CU');

-- CreateEnum
CREATE TYPE "TrangThaiUngVienRepo" AS ENUM ('CHO_SANG_LOC', 'BI_LOAI', 'DA_NAP');

-- AlterTable
ALTER TABLE "ban_phat_hanh" ADD COLUMN     "nhat_ky_thay_doi_vi" TEXT;

-- AlterTable
ALTER TABLE "phan_tich_ai" ALTER COLUMN "tom_tat_tinh_nang_vi" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ung_dung" ADD COLUMN     "ban_moi_nhat_android" TEXT,
ADD COLUMN     "ban_moi_nhat_windows" TEXT,
ADD COLUMN     "diem_thinh_hanh" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dinh_dang_co_san" "DinhDangTep"[] DEFAULT ARRAY[]::"DinhDangTep"[],
ADD COLUMN     "etag_readme" TEXT,
ADD COLUMN     "etag_releases" TEXT,
ADD COLUMN     "etag_repo" TEXT,
ADD COLUMN     "kien_truc_co_san" "KienTrucChip"[] DEFAULT ARRAY[]::"KienTrucChip"[],
ADD COLUMN     "lan_kiem_tiep_theo" TIMESTAMP(3),
ADD COLUMN     "ma_bam_mo_ta" TEXT,
ADD COLUMN     "mo_ta_vi" TEXT,
ADD COLUMN     "muc_do_nong" TEXT NOT NULL DEFAULT 'BINH_THUONG',
ADD COLUMN     "pushed_at" TIMESTAMP(3),
ADD COLUMN     "readme_sha" TEXT;

-- CreateTable
CREATE TABLE "ban_dich_readme" (
    "ma_ban_dich" UUID NOT NULL,
    "ma_ung_dung" UUID NOT NULL,
    "ngon_ngu" TEXT NOT NULL DEFAULT 'vi',
    "readme_sha" TEXT NOT NULL,
    "noi_dung_dich" TEXT NOT NULL,
    "mo_hinh_dich" TEXT NOT NULL,
    "trang_thai" "TrangThaiDichReadme" NOT NULL DEFAULT 'HOAN_TAT',
    "thoi_gian_dich" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ban_dich_readme_pkey" PRIMARY KEY ("ma_ban_dich")
);

-- CreateTable
CREATE TABLE "bo_nho_dich_chung" (
    "ma_bam" TEXT NOT NULL,
    "ngon_ngu" TEXT NOT NULL DEFAULT 'vi',
    "doan_goc" TEXT NOT NULL,
    "doan_dich" TEXT NOT NULL,
    "mo_hinh_dich" TEXT NOT NULL,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bo_nho_dich_chung_pkey" PRIMARY KEY ("ma_bam","ngon_ngu")
);

-- CreateTable
CREATE TABLE "ung_vien_repo" (
    "ma_ung_vien" UUID NOT NULL,
    "ten_repo_day_du" TEXT NOT NULL,
    "nguon_kham_pha" TEXT NOT NULL,
    "trang_thai" "TrangThaiUngVienRepo" NOT NULL DEFAULT 'CHO_SANG_LOC',
    "ly_do_loai" TEXT,
    "ngay_tao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngay_cap_nhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ung_vien_repo_pkey" PRIMARY KEY ("ma_ung_vien")
);

-- CreateIndex
CREATE UNIQUE INDEX "ban_dich_readme_ma_ung_dung_ngon_ngu_key" ON "ban_dich_readme"("ma_ung_dung", "ngon_ngu");

-- CreateIndex
CREATE UNIQUE INDEX "ung_vien_repo_ten_repo_day_du_key" ON "ung_vien_repo"("ten_repo_day_du");

-- CreateIndex
CREATE INDEX "ung_vien_repo_trang_thai_idx" ON "ung_vien_repo"("trang_thai");

-- AddForeignKey
ALTER TABLE "ban_dich_readme" ADD CONSTRAINT "ban_dich_readme_ma_ung_dung_fkey" FOREIGN KEY ("ma_ung_dung") REFERENCES "ung_dung"("ma_ung_dung") ON DELETE CASCADE ON UPDATE CASCADE;
