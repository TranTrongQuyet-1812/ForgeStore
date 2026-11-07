import type { UngDungDaCaiDto } from '@forgestore/types';
import { isTauri } from '../xac-thuc/luu-tru-token';
import { thuVienService } from './thu-vien.service';
import { quyetDinhDongBoCli, type KetQuaHoiMay } from './dong-bo-cli.core';

/**
 * Khoảng nghỉ giữa hai lần hỏi máy cho cùng một ứng dụng (10 phút) để tránh gọi lệnh quá nhiều.
 * Khi người dùng mở lại Thư viện nhiều lần trong thời gian ngắn, không bật lại tiến trình CLI.
 */
export const KHOANG_NGHI_MS = 10 * 60 * 1000;

/** Lưu mốc thời gian (ms) đồng bộ gần nhất theo từng ứng dụng trên thiết bị (khóa: `maThietBi:maUngDung`). */
const lichSuDongBo = new Map<string, number>();

/** Hỗ trợ dọn sạch bộ nhớ đệm lịch sử đồng bộ phục vụ kiểm thử unit test. */
export function xoaLichSuDongBoChoTest(): void {
  lichSuDongBo.clear();
}

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
  // Với npm: chỉ gọi lệnh đọc phiên bản (đọc được thì coi là đã cài daCai = true), không gọi kiem_tra_goi_da_cai
  // để bớt tiến trình bật npm.cmd ls -g hai lần mỗi gói (P3B-30)
  if (trinhQuanLy === 'npm') {
    const phienBanThat = await hoiMay<string>('doc_phien_ban_goi_da_cai', trinhQuanLy, tenGoi);
    return {
      daCai: phienBanThat !== null ? true : null,
      phienBanThat,
    };
  }

  // Với winget: vẫn gọi kiem_tra_goi_da_cai như cũ (winget chưa đọc được phiên bản)
  if (trinhQuanLy === 'winget') {
    const daCai = await hoiMay<boolean>('kiem_tra_goi_da_cai', trinhQuanLy, tenGoi);
    return { daCai, phienBanThat: null };
  }

  // Với pip: chỉ đọc phiên bản như cũ (chưa có lệnh kiểm tra nhanh riêng)
  if (trinhQuanLy === 'pip') {
    const phienBanThat = await hoiMay<string>('doc_phien_ban_goi_da_cai', trinhQuanLy, tenGoi);
    return { daCai: null, phienBanThat };
  }

  return { daCai: null, phienBanThat: null };
}

/**
 * Đối chiếu MỘT ứng dụng cài bằng dòng lệnh với máy này (P3B-30): thấy gói thật sự có thì tự xác nhận,
 * đọc được phiên bản thật thì ghi lên máy chủ để báo cập nhật theo số thật. Trả `true` nếu có gì đổi.
 * ForgeStore chỉ đọc, không chạy lệnh cài hay gỡ nào.
 */
export async function dongBoUngDungCli(maThietBi: string, ban: UngDungDaCaiDto): Promise<boolean> {
  if (!isTauri() || !ban.trinhQuanLyGoi || !ban.tenGoiCli) return false;

  const khoa = `${maThietBi}:${ban.maUngDung}`;
  const bayGio = Date.now();
  const lanTruoc = lichSuDongBo.get(khoa);
  if (lanTruoc !== undefined && bayGio - lanTruoc < KHOANG_NGHI_MS) {
    return false;
  }
  lichSuDongBo.set(khoa, bayGio);

  const may = await doMay(ban.trinhQuanLyGoi, ban.tenGoiCli);
  const quyetDinh = quyetDinhDongBoCli(ban, may);

  // P3B-30 vòng 2: nếu bản ghi đang chờ xác nhận mà máy trả "chưa thấy" (daCai !== true và không có phiên bản thật),
  // xóa mốc nghỉ để lần mở sau (người dùng vừa chạy lệnh cài xong) hỏi lại ngay thay vì phải đợi 10 phút.
  const coPhienBanThat = may.phienBanThat !== null && may.phienBanThat !== '';
  const thayGoi = may.daCai === true || coPhienBanThat;
  if (ban.trangThaiXacNhan === 'CHO_XAC_NHAN' && !thayGoi) {
    lichSuDongBo.delete(khoa);
  }

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
