import { HeDieuHanhCli, NhomCachCai } from '@forgestore/types';

const NHAN_NHOM_CACH_CAI: Record<NhomCachCai, string> = {
  [NhomCachCai.WINGET]: 'WinGet',
  [NhomCachCai.SCOOP]: 'Scoop',
  [NhomCachCai.PIP]: 'pip',
  [NhomCachCai.CONDA]: 'Conda',
  [NhomCachCai.NPM]: 'npm',
  [NhomCachCai.CARGO]: 'Cargo',
  [NhomCachCai.GO]: 'Go',
  [NhomCachCai.DOCKER]: 'Docker',
  [NhomCachCai.NGUON]: 'Từ mã nguồn',
};

const NHAN_HE_DIEU_HANH: Record<HeDieuHanhCli, string> = {
  [HeDieuHanhCli.WINDOWS]: 'Windows',
  [HeDieuHanhCli.LINUX_MAC]: 'Linux và macOS',
  [HeDieuHanhCli.DUNG_CHUNG]: 'Mọi hệ điều hành',
};

function lamSachNhanLa(value: string): string {
  // Giá trị mới từ API vẫn cần dễ đọc và không để mã IN HOA có dấu gạch dưới lọt ra màn hình.
  const text = value.replace(/[_-]+/g, ' ').trim().toLocaleLowerCase('vi');
  return text ? text.charAt(0).toLocaleUpperCase('vi') + text.slice(1) : '';
}

export function layNhanNhomCachCai(value: string): string {
  return NHAN_NHOM_CACH_CAI[value as NhomCachCai] ?? lamSachNhanLa(value);
}

/**
 * Backend ghép sẵn tên cách cài dạng "Cài đặt qua <MÃ NHÓM>" (vd "Cài đặt qua NGUON").
 * Dữ liệu cũ đã lưu vẫn mang mã thô nên đổi ngay lúc hiển thị; tên tự đặt khác giữ nguyên.
 */
export function layTenCachCai(ten: string, nhom: string): string {
  const laTenMacDinh =
    ten.trim().toLocaleLowerCase('vi') === `cài đặt qua ${nhom}`.toLocaleLowerCase('vi');
  if (!laTenMacDinh) return ten;
  return nhom === NhomCachCai.NGUON ? 'Cài từ mã nguồn' : `Cài đặt qua ${layNhanNhomCachCai(nhom)}`;
}

export function layNhanHeDieuHanh(value: string): string {
  return NHAN_HE_DIEU_HANH[value as HeDieuHanhCli] ?? lamSachNhanLa(value);
}
