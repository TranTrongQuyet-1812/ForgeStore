import type { UngDungDaCaiDto } from '@forgestore/types';
import { isTauri } from '../xac-thuc/luu-tru-token';
import { thuVienService } from './thu-vien.service';
import {
  TRINH_DOC_PHIEN_BAN,
  TRINH_KIEM_DA_CAI,
  quyetDinhDongBoCli,
  type KetQuaHoiMay,
} from './dong-bo-cli.core';

/** Hỏi lệnh Rust chỉ-đọc; không hỏi được (lỗi, máy chưa có trình quản lý) thì coi như không biết, không báo lỗi. */
async function hoiMay<T>(lenh: string, trinhQuanLy: string, tenGoi: string): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return (await invoke<T | null>(lenh, { trinhQuanLy, tenGoi })) ?? null;
  } catch {
    return null;
  }
}

async function doMay(trinhQuanLy: string, tenGoi: string): Promise<KetQuaHoiMay> {
  // Lần lượt, không song song: cả hai lệnh đều bật một tiến trình trình quản lý gói (npm, pip) trên máy người dùng
  const daCai = TRINH_KIEM_DA_CAI.includes(trinhQuanLy)
    ? await hoiMay<boolean>('kiem_tra_goi_da_cai', trinhQuanLy, tenGoi)
    : null;
  const phienBanThat = TRINH_DOC_PHIEN_BAN.includes(trinhQuanLy)
    ? await hoiMay<string>('doc_phien_ban_goi_da_cai', trinhQuanLy, tenGoi)
    : null;
  return { daCai, phienBanThat };
}

/**
 * Đối chiếu MỘT ứng dụng cài bằng dòng lệnh với máy này (P3B-30): thấy gói thật sự có thì tự xác nhận,
 * đọc được phiên bản thật thì ghi lên máy chủ để báo cập nhật theo số thật. Trả `true` nếu có gì đổi.
 * ForgeStore chỉ đọc, không chạy lệnh cài hay gỡ nào.
 */
export async function dongBoUngDungCli(maThietBi: string, ban: UngDungDaCaiDto): Promise<boolean> {
  if (!isTauri() || !ban.trinhQuanLyGoi || !ban.tenGoiCli) return false;

  const may = await doMay(ban.trinhQuanLyGoi, ban.tenGoiCli);
  const quyetDinh = quyetDinhDongBoCli(ban, may);

  let coDoi = false;
  if (quyetDinh.xacNhan) {
    coDoi = (await thuVienService.xacNhanCaiDatCli(maThietBi, ban.maUngDung)) !== null;
  }
  if (quyetDinh.phienBanMoi) {
    const ok = await thuVienService.capNhatPhienBanCli(
      maThietBi,
      ban.maUngDung,
      quyetDinh.phienBanMoi,
    );
    coDoi = coDoi || ok;
  }
  return coDoi;
}

/** Đối chiếu lần lượt từng ứng dụng (tránh bật nhiều tiến trình cùng lúc); trả số ứng dụng có thay đổi. */
export async function dongBoCacUngDungCli(
  maThietBi: string,
  danhSach: UngDungDaCaiDto[],
): Promise<number> {
  let soDoi = 0;
  for (const ban of danhSach) {
    if (await dongBoUngDungCli(maThietBi, ban)) soDoi += 1;
  }
  return soDoi;
}
