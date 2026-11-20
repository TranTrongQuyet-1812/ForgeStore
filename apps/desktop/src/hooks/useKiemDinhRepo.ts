import { useCallback, useEffect, useRef, useState } from 'react';
import type { InspectRepoResponseDto, UngDungChiTietDto } from '@forgestore/types';
import { layThongBaoLoi } from '../dich-vu/api/thong-bao-loi';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { useXacThucStore } from '../kho-trang-thai/useXacThucStore';

export const THOI_GIAN_CHO_MO_CHI_TIET_MS = 800;
export const LOI_CAN_DANG_NHAP_KIEM_DINH =
  'Hãy đăng nhập để thêm ứng dụng mới từ GitHub vào ForgeStore.';

export function chuanHoaDuongDanKiemDinh(duongDan: string): string {
  const sach = duongDan.trim();
  if (!sach) return '';
  return sach.startsWith('http') ? sach : `https://github.com/${sach}`;
}

export interface TrangThaiKiemDinhRepo {
  dangKiemDinh: boolean;
  loiKiemDinh: string | null;
  ketQuaThanhCong: InspectRepoResponseDto | null;
}

export interface TuyChonBoDieuKhienKiemDinh {
  kiemTraDangNhap: () => boolean;
  goiApiKiemDinh: (urlChuanHoa: string) => Promise<InspectRepoResponseDto>;
  khiThanhCong: (ungDung: UngDungChiTietDto) => void;
  capNhatTrangThai: (phan: Partial<TrangThaiKiemDinhRepo>) => void;
  thoiGianChoMs?: number;
}

/**
 * Tách bộ điều phối kiểm định repo thành hàm thuần khung JS để test được đầy đủ vòng đời và hủy timer khi gỡ.
 */
export function taoBoDieuKhienKiemDinhRepo(tuyChon: TuyChonBoDieuKhienKiemDinh) {
  let dangChay = false;
  let daGoBo = false;
  let henGioMo: ReturnType<typeof setTimeout> | null = null;
  const thoiGianCho = tuyChon.thoiGianChoMs ?? THOI_GIAN_CHO_MO_CHI_TIET_MS;

  const xoaHenGio = () => {
    if (henGioMo !== null) {
      clearTimeout(henGioMo);
      henGioMo = null;
    }
  };

  const batDau = () => {
    daGoBo = false;
  };

  const huy = () => {
    daGoBo = true;
    xoaHenGio();
  };

  const xoaTrangThai = () => {
    xoaHenGio();
    tuyChon.capNhatTrangThai({ loiKiemDinh: null, ketQuaThanhCong: null });
  };

  const kiemDinh = async (duongDan: string): Promise<void> => {
    const urlChuanHoa = chuanHoaDuongDanKiemDinh(duongDan);
    if (!urlChuanHoa || dangChay || daGoBo) return;

    // Thêm app mới vào kho cần đăng nhập (máy chủ từ chối khách), báo trước thay vì để lộ lỗi kỹ thuật.
    if (!tuyChon.kiemTraDangNhap()) {
      tuyChon.capNhatTrangThai({
        ketQuaThanhCong: null,
        loiKiemDinh: LOI_CAN_DANG_NHAP_KIEM_DINH,
      });
      return;
    }

    dangChay = true;
    tuyChon.capNhatTrangThai({
      dangKiemDinh: true,
      loiKiemDinh: null,
      ketQuaThanhCong: null,
    });

    try {
      const res = await tuyChon.goiApiKiemDinh(urlChuanHoa);
      if (daGoBo) return;

      if (res.trangThai === 'THANH_CONG' && res.ungDung) {
        const ungDung = res.ungDung;
        tuyChon.capNhatTrangThai({ ketQuaThanhCong: res });
        xoaHenGio();
        henGioMo = setTimeout(() => {
          henGioMo = null;
          if (!daGoBo) {
            tuyChon.khiThanhCong(ungDung);
          }
        }, thoiGianCho);
      } else {
        const loiMacDinh =
          res.trangThai === 'LINK_KHONG_HOP_LE'
            ? 'Liên kết GitHub không hợp lệ hoặc kho lưu trữ không công khai.'
            : 'Không thể nạp ứng dụng từ liên kết này.';
        tuyChon.capNhatTrangThai({ loiKiemDinh: res.thongBao || loiMacDinh });
      }
    } catch (err: unknown) {
      if (!daGoBo) {
        tuyChon.capNhatTrangThai({
          loiKiemDinh: layThongBaoLoi(err, 'Lỗi kết nối khi kiểm tra repository.'),
        });
      }
    } finally {
      dangChay = false;
      if (!daGoBo) {
        tuyChon.capNhatTrangThai({ dangKiemDinh: false });
      }
    }
  };

  return { batDau, huy, xoaTrangThai, kiemDinh };
}

export interface UseKiemDinhRepoOptions {
  khiThanhCong: (ungDung: UngDungChiTietDto) => void;
}

export interface UseKiemDinhRepoResult {
  dangKiemDinh: boolean;
  loiKiemDinh: string | null;
  ketQuaThanhCong: InspectRepoResponseDto | null;
  kiemDinh: (duongDan: string) => Promise<void>;
  xoaTrangThai: () => void;
}

/** Hook dùng chung luồng Paste & Play: kiểm định repo GitHub, chờ 800 ms rồi mở chi tiết, tự dọn timer khi gỡ. */
export function useKiemDinhRepo(options: UseKiemDinhRepoOptions): UseKiemDinhRepoResult {
  const isAuthenticated = useXacThucStore((s) => s.isAuthenticated);
  const [dangKiemDinh, setDangKiemDinh] = useState(false);
  const [loiKiemDinh, setLoiKiemDinh] = useState<string | null>(null);
  const [ketQuaThanhCong, setKetQuaThanhCong] = useState<InspectRepoResponseDto | null>(null);

  const daDangNhapRef = useRef(isAuthenticated);
  daDangNhapRef.current = isAuthenticated;

  const khiThanhCongRef = useRef(options.khiThanhCong);
  khiThanhCongRef.current = options.khiThanhCong;

  const dieuKhienRef = useRef<ReturnType<typeof taoBoDieuKhienKiemDinhRepo> | null>(null);
  if (!dieuKhienRef.current) {
    dieuKhienRef.current = taoBoDieuKhienKiemDinhRepo({
      kiemTraDangNhap: () => daDangNhapRef.current,
      goiApiKiemDinh: (url) => khoUngDungService.kiemDinhRepo(url),
      khiThanhCong: (ungDung) => khiThanhCongRef.current(ungDung),
      capNhatTrangThai: (phan) => {
        if ('dangKiemDinh' in phan && phan.dangKiemDinh !== undefined) {
          setDangKiemDinh(phan.dangKiemDinh);
        }
        if ('loiKiemDinh' in phan) {
          setLoiKiemDinh(phan.loiKiemDinh ?? null);
        }
        if ('ketQuaThanhCong' in phan) {
          setKetQuaThanhCong(phan.ketQuaThanhCong ?? null);
        }
      },
    });
  }

  useEffect(() => {
    const dieuKhien = dieuKhienRef.current;
    dieuKhien?.batDau();
    return () => {
      dieuKhien?.huy();
    };
  }, []);

  const kiemDinh = useCallback(async (duongDan: string) => {
    await dieuKhienRef.current?.kiemDinh(duongDan);
  }, []);

  const xoaTrangThai = useCallback(() => {
    dieuKhienRef.current?.xoaTrangThai();
  }, []);

  return {
    dangKiemDinh,
    loiKiemDinh,
    ketQuaThanhCong,
    kiemDinh,
    xoaTrangThai,
  };
}
