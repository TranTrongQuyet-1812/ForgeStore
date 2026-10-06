-- CreateEnum
CREATE TYPE "LyDoLoaiUngVien" AS ENUM ('KHONG_CO_BAN_PHAT_HANH', 'KHONG_CO_FILE_CAI', 'CHI_CO_CAI_CLI', 'DA_LUU_TRU', 'GIAY_PHEP_KHONG_MO', 'LOI_KHI_SANG_LOC');

-- AlterTable
ALTER TABLE "ung_vien_repo" DROP COLUMN "ly_do_loai",
ADD COLUMN     "ly_do_loai" "LyDoLoaiUngVien";
