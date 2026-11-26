/**
 * Logic thuần kiểm tra và cảnh báo công cụ dòng lệnh trên máy (P3B-31, P3B-45).
 * Cố định thông tin cho npm, pip, docker, winget, scoop.
 * Không tự cài, không sửa PATH, chỉ đưa ra cảnh báo nhẹ kèm liên kết chính thức hoặc nhắc mở phần mềm.
 */

import { trichTenGoiTuLenhTho } from '@forgestore/types';

/** Trạng thái công cụ dòng lệnh trả về từ lệnh Rust `kiem_tra_cong_cu_may` (P3B-45). */
export type TrangThaiCongCuMay = 'SAN_SANG' | 'CHUA_CAI' | 'CHUA_CHAY';

/**
 * Thông tin định nghĩa công cụ quản lý gói trên máy trạm (P3B-31).
 */
export interface ThongTinCongCu {
  /** Mã trình quản lý gói */
  readonly trinhQuanLy: string;
  /** Tên hiển thị người dùng dễ hiểu */
  readonly tenHienThi: string;
  /** Liên kết tải trang chính thức (luôn bắt đầu bằng https://) */
  readonly lienKetChinhThuc: string;
  /** Lệnh gợi ý cài đặt qua winget (nếu có) */
  readonly lenhGoiY?: string;
}

/**
 * Thông tin cảnh báo trả về khi máy thiếu công cụ hoặc Docker Desktop chưa chạy (P3B-31, P3B-45).
 */
export interface ThongTinCanhBaoThieuCongCu {
  readonly trinhQuanLy: string;
  readonly tenHienThi: string;
  readonly trangThai: 'CHUA_CAI' | 'CHUA_CHAY';
  readonly lienKetChinhThuc?: string;
  readonly thongDiep: string;
  readonly lenhGoiY?: string;
}

/**
 * Bảng thông tin cố định các công cụ quản lý gói được hỗ trợ (P3B-31).
 */
export const BANG_CONG_CU: Record<string, ThongTinCongCu> = {
  npm: {
    trinhQuanLy: 'npm',
    tenHienThi: 'Node.js',
    lienKetChinhThuc: 'https://nodejs.org/en/download',
    lenhGoiY: 'winget install OpenJS.NodeJS.LTS',
  },
  pip: {
    trinhQuanLy: 'pip',
    tenHienThi: 'Python',
    lienKetChinhThuc: 'https://www.python.org/downloads/',
    lenhGoiY: 'winget install Python.Python.3.12',
  },
  docker: {
    trinhQuanLy: 'docker',
    tenHienThi: 'Docker Desktop',
    lienKetChinhThuc: 'https://www.docker.com/products/docker-desktop/',
    lenhGoiY: 'winget install Docker.DockerDesktop',
  },
  winget: {
    trinhQuanLy: 'winget',
    tenHienThi: 'Công cụ winget (App Installer)',
    lienKetChinhThuc: 'https://apps.microsoft.com/detail/9nblggh4nns1',
  },
  scoop: {
    trinhQuanLy: 'scoop',
    tenHienThi: 'Scoop',
    lienKetChinhThuc: 'https://scoop.sh',
  },
};

/**
 * Trích xuất mã trình quản lý gói từ phương thức cài đặt CLI (P3B-31).
 * Gom logic suy luận dùng chung giữa TrangChiTiet, NhanDaCaiTrenMay và CanhBaoThieuCongCu.
 */
export function layTrinhQuanLyCachCai(
  phuongThuc?: {
    nhom?: string;
    trinhQuanLy?: string;
    buoc?: Array<{ lenh?: string }>;
  } | null,
): string | undefined {
  if (!phuongThuc) return undefined;

  if (phuongThuc.trinhQuanLy) {
    return phuongThuc.trinhQuanLy.trim().toLowerCase();
  }

  const nhomLow = ((phuongThuc.nhom || '') as string).toLowerCase();
  if (nhomLow.includes('winget')) return 'winget';
  if (nhomLow.includes('scoop')) return 'scoop';
  if (nhomLow.includes('npm')) return 'npm';
  if (nhomLow.includes('pip')) return 'pip';
  if (nhomLow.includes('docker')) return 'docker';

  if (phuongThuc.buoc?.[0]?.lenh) {
    const trich = trichTenGoiTuLenhTho(phuongThuc.buoc[0].lenh);
    if (trich?.trinhQuanLy) {
      return trich.trinhQuanLy.toLowerCase();
    }
  }

  return undefined;
}

/**
 * Chuẩn hóa kết quả kiểm tra (hỗ trợ cả kiểu chuỗi mới P3B-45 lẫn boolean cũ P3B-31).
 */
function chuanHoaTrangThaiCongCu(
  ketQua?: TrangThaiCongCuMay | boolean | null,
): TrangThaiCongCuMay | null {
  if (ketQua === true || ketQua === 'SAN_SANG') return 'SAN_SANG';
  if (ketQua === false || ketQua === 'CHUA_CAI') return 'CHUA_CAI';
  if (ketQua === 'CHUA_CHAY') return 'CHUA_CHAY';
  return null;
}

/**
 * Quyết định hiển thị cảnh báo khi thiếu công cụ hoặc công cụ chưa chạy trên máy (P3B-31, P3B-45).
 * Chỉ trả về cảnh báo khi trạng thái là CHUA_CAI hoặc CHUA_CHAY và trình quản lý thuộc danh sách hỗ trợ.
 * Nếu là SAN_SANG, null, undefined hoặc trình lạ thì trả về null (im lặng).
 */
export function canhBaoThieuCongCu(
  trinhQuanLy?: string | null,
  ketQua?: TrangThaiCongCuMay | boolean | null,
): ThongTinCanhBaoThieuCongCu | null {
  const trangThai = chuanHoaTrangThaiCongCu(ketQua);
  if ((trangThai !== 'CHUA_CAI' && trangThai !== 'CHUA_CHAY') || !trinhQuanLy) {
    return null;
  }

  const maTrinh = trinhQuanLy.trim().toLowerCase();
  const thongTin = BANG_CONG_CU[maTrinh];
  if (!thongTin) {
    return null;
  }

  if (trangThai === 'CHUA_CHAY') {
    return {
      trinhQuanLy: thongTin.trinhQuanLy,
      tenHienThi: thongTin.tenHienThi,
      trangThai: 'CHUA_CHAY',
      lienKetChinhThuc: undefined,
      thongDiep:
        'Máy bạn đã có Docker Desktop nhưng phần mềm chưa chạy. Hãy mở Docker Desktop, chờ khởi động xong (lần đầu có thể cần bật WSL và khởi động lại máy) rồi chạy lại lệnh.',
      lenhGoiY: undefined,
    };
  }

  // Nếu chính winget bị thiếu, không gợi ý lệnh winget install
  const lenhGoiY = maTrinh === 'winget' ? undefined : thongTin.lenhGoiY;
  const thongDiep =
    maTrinh === 'docker'
      ? 'Máy bạn chưa có Docker Desktop nên lệnh này có thể không chạy được. Cài xong, hãy mở Docker Desktop (lần đầu máy có thể yêu cầu bật WSL và khởi động lại) rồi chạy lại lệnh.'
      : `Máy bạn chưa có ${thongTin.tenHienThi} nên lệnh này có thể không chạy được. Cài ${thongTin.tenHienThi} xong, hãy mở Terminal mới rồi chạy lại lệnh.`;

  return {
    trinhQuanLy: thongTin.trinhQuanLy,
    tenHienThi: thongTin.tenHienThi,
    trangThai: 'CHUA_CAI',
    lienKetChinhThuc: thongTin.lienKetChinhThuc,
    thongDiep,
    lenhGoiY,
  };
}

/**
 * Nhận diện cách cài đặt có dùng `docker compose` hoặc `docker-compose` (P3B-45).
 * Các lệnh này cần tệp `docker-compose.yml` của dự án trong thư mục chạy lệnh.
 */
export function coLenhDockerCompose(buoc?: Array<{ lenh?: string }> | null): boolean {
  if (!buoc || buoc.length === 0) {
    return false;
  }
  return buoc.some(
    (item) => typeof item.lenh === 'string' && /\bdocker(?:[\s-]+)compose\b/i.test(item.lenh),
  );
}
