import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InspectRepoResponseDto, UngDungChiTietDto } from '@forgestore/types';
import {
  LOI_CAN_DANG_NHAP_KIEM_DINH,
  THOI_GIAN_CHO_MO_CHI_TIET_MS,
  chuanHoaDuongDanKiemDinh,
  taoBoDieuKhienKiemDinhRepo,
  type TrangThaiKiemDinhRepo,
} from './useKiemDinhRepo';

function taoChiTietMau(): UngDungChiTietDto {
  return {
    maUngDung: 'app-bat',
    tenRepoDayDu: 'sharkdp/bat',
    chuSoHuu: 'sharkdp',
    tenKhoChua: 'bat',
    duongDanGithub: 'https://github.com/sharkdp/bat',
    soSaoGithub: 50000,
    danhMucChinh: 'Tiện ích hệ thống',
    nenTangHoTro: 'WINDOWS',
    duocNoiBat: false,
    daXacMinh: true,
    daLuuTru: false,
    soLuotFork: 1200,
    danhSachPhatHanh: [],
    huongDanCaiDatCli: null,
  };
}

function taoBanThu(daDangNhap = true) {
  const trangThai: TrangThaiKiemDinhRepo = {
    dangKiemDinh: false,
    loiKiemDinh: null,
    ketQuaThanhCong: null,
  };
  const goiApiKiemDinh = vi.fn<(url: string) => Promise<InspectRepoResponseDto>>();
  const khiThanhCong = vi.fn<(ungDung: UngDungChiTietDto) => void>();

  const dieuKhien = taoBoDieuKhienKiemDinhRepo({
    kiemTraDangNhap: () => daDangNhap,
    goiApiKiemDinh,
    khiThanhCong,
    capNhatTrangThai: (phan) => Object.assign(trangThai, phan),
  });
  dieuKhien.batDau();

  return { trangThai, goiApiKiemDinh, khiThanhCong, dieuKhien };
}

describe('useKiemDinhRepo (P3B-43)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('chuẩn hóa owner/repo thành URL GitHub đầy đủ và giữ nguyên link https', () => {
    expect(chuanHoaDuongDanKiemDinh('sharkdp/bat')).toBe('https://github.com/sharkdp/bat');
    expect(chuanHoaDuongDanKiemDinh('  https://github.com/sharkdp/bat  ')).toBe(
      'https://github.com/sharkdp/bat',
    );
    expect(chuanHoaDuongDanKiemDinh('   ')).toBe('');
  });

  it('chưa đăng nhập: đặt đúng thông báo mời đăng nhập và không gọi API', async () => {
    const { trangThai, goiApiKiemDinh, dieuKhien } = taoBanThu(false);

    await dieuKhien.kiemDinh('sharkdp/bat');

    expect(goiApiKiemDinh).not.toHaveBeenCalled();
    expect(trangThai.loiKiemDinh).toBe(LOI_CAN_DANG_NHAP_KIEM_DINH);
    expect(trangThai.ketQuaThanhCong).toBeNull();
    expect(trangThai.dangKiemDinh).toBe(false);
  });

  it('thành công: chuẩn hóa URL, lưu kết quả và đợi đúng 800 ms mới gọi khiThanhCong', async () => {
    const { trangThai, goiApiKiemDinh, khiThanhCong, dieuKhien } = taoBanThu(true);
    const app = taoChiTietMau();
    goiApiKiemDinh.mockResolvedValueOnce({
      trangThai: 'THANH_CONG',
      ungDung: app,
    });

    await dieuKhien.kiemDinh('sharkdp/bat');

    expect(goiApiKiemDinh).toHaveBeenCalledWith('https://github.com/sharkdp/bat');
    expect(trangThai.dangKiemDinh).toBe(false);
    expect(trangThai.loiKiemDinh).toBeNull();
    expect(trangThai.ketQuaThanhCong?.trangThai).toBe('THANH_CONG');

    vi.advanceTimersByTime(THOI_GIAN_CHO_MO_CHI_TIET_MS - 1);
    expect(khiThanhCong).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(khiThanhCong).toHaveBeenCalledTimes(1);
    expect(khiThanhCong).toHaveBeenCalledWith(app);
  });

  it('xử lý LINK_KHONG_HOP_LE với thông báo mặc định hoặc thongBao từ server', async () => {
    const { trangThai, goiApiKiemDinh, khiThanhCong, dieuKhien } = taoBanThu(true);
    goiApiKiemDinh.mockResolvedValueOnce({ trangThai: 'LINK_KHONG_HOP_LE' });

    await dieuKhien.kiemDinh('https://github.com/invalid/repo');
    expect(trangThai.loiKiemDinh).toBe(
      'Liên kết GitHub không hợp lệ hoặc kho lưu trữ không công khai.',
    );

    goiApiKiemDinh.mockResolvedValueOnce({
      trangThai: 'KHONG_CO_RELEASE',
      thongBao: 'Kho này chưa có bản phát hành.',
    });
    await dieuKhien.kiemDinh('https://github.com/no/release');
    expect(trangThai.loiKiemDinh).toBe('Kho này chưa có bản phát hành.');

    vi.runAllTimers();
    expect(khiThanhCong).not.toHaveBeenCalled();
  });

  it('lỗi mạng khi gọi API: dùng câu tiếng Việt dễ hiểu qua layThongBaoLoi', async () => {
    const { trangThai, goiApiKiemDinh, dieuKhien } = taoBanThu(true);
    goiApiKiemDinh.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await dieuKhien.kiemDinh('sharkdp/bat');

    expect(trangThai.dangKiemDinh).toBe(false);
    expect(trangThai.loiKiemDinh).toBeTruthy();
    expect(trangThai.loiKiemDinh).not.toContain('Failed to fetch');
  });

  it('dọn bộ đếm 800 ms khi component bị gỡ (huy) để không mở trang sau khi rời đi', async () => {
    const { goiApiKiemDinh, khiThanhCong, dieuKhien } = taoBanThu(true);
    goiApiKiemDinh.mockResolvedValueOnce({
      trangThai: 'THANH_CONG',
      ungDung: taoChiTietMau(),
    });

    await dieuKhien.kiemDinh('sharkdp/bat');
    dieuKhien.huy();
    vi.advanceTimersByTime(THOI_GIAN_CHO_MO_CHI_TIET_MS + 100);

    expect(khiThanhCong).not.toHaveBeenCalled();
  });

  it('xoaTrangThai hủy bộ đếm đang chờ và xóa lỗi/kết quả thành công', async () => {
    const { trangThai, goiApiKiemDinh, khiThanhCong, dieuKhien } = taoBanThu(true);
    goiApiKiemDinh.mockResolvedValueOnce({
      trangThai: 'THANH_CONG',
      ungDung: taoChiTietMau(),
    });

    await dieuKhien.kiemDinh('sharkdp/bat');
    expect(trangThai.ketQuaThanhCong).not.toBeNull();

    dieuKhien.xoaTrangThai();
    expect(trangThai.ketQuaThanhCong).toBeNull();
    expect(trangThai.loiKiemDinh).toBeNull();

    vi.advanceTimersByTime(THOI_GIAN_CHO_MO_CHI_TIET_MS + 100);
    expect(khiThanhCong).not.toHaveBeenCalled();
  });
});
