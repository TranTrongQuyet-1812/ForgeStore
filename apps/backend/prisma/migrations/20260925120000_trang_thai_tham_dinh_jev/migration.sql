-- CreateEnum
CREATE TYPE "TrangThaiThamDinhJev" AS ENUM ('DA_THAM_DINH', 'KHONG_CAN_THIET', 'CHUA_THAM_DINH');

-- AlterTable
ALTER TABLE "phan_tich_ai" 
  ADD COLUMN "trang_thai_tham_dinh_jev" "TrangThaiThamDinhJev" NOT NULL DEFAULT 'KHONG_CAN_THIET',
  ADD COLUMN "so_lan_thu_lai" INTEGER NOT NULL DEFAULT 0;
