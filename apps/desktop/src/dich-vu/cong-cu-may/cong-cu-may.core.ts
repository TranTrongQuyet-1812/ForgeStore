/**
 * Logic thuần kiểm tra và cảnh báo công cụ dòng lệnh trên máy (P3B-31).
 * Cố định thông tin cho npm, pip, docker, winget, scoop.
 * Không tự cài, không sửa PATH, chỉ đưa ra cảnh báo nhẹ kèm liên kết chính thức.
 */

import { trichTenGoiTuLenhTho } from '@forgestore/types';

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
 * Thông tin cảnh báo trả về khi máy thiếu công cụ (P3B-31).
 */
export interface ThongTinCanhBaoThieuCongCu {
  readonly trinhQuanLy: string;
  readonly tenHienThi: string;
  readonly lienKetChinhThuc: string;
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
 * Quyết định hiển thị cảnh báo khi thiếu công cụ trên máy (P3B-31).
 * Chỉ trả về cảnh báo khi ketQua === false và trinhQuanLy nằm trong danh sách hỗ trợ.
 * Nếu ketQua là true, null, undefined hoặc trình lạ thì trả về null (im lặng).
 */
export function canhBaoThieuCongCu(
  trinhQuanLy?: string | null,
  ketQua?: boolean | null,
): ThongTinCanhBaoThieuCongCu | null {
  if (ketQua !== false || !trinhQuanLy) {
    return null;
  }

  const maTrinh = trinhQuanLy.trim().toLowerCase();
  const thongTin = BANG_CONG_CU[maTrinh];
  if (!thongTin) {
    return null;
  }

  // Nếu chính winget bị thiếu, không gợi ý lệnh winget install
  const lenhGoiY = maTrinh === 'winget' ? undefined : thongTin.lenhGoiY;

  return {
    trinhQuanLy: thongTin.trinhQuanLy,
    tenHienThi: thongTin.tenHienThi,
    lienKetChinhThuc: thongTin.lienKetChinhThuc,
    thongDiep: `Máy bạn chưa có ${thongTin.tenHienThi} nên lệnh này có thể không chạy được. Cài ${thongTin.tenHienThi} xong, hãy mở Terminal mới rồi chạy lại lệnh.`,
    lenhGoiY,
  };
}
