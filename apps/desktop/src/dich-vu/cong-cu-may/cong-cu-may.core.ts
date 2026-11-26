/**
 * Logic thuần kiểm tra và cảnh báo công cụ dòng lệnh trên máy (P3B-31, P3B-45, P3B-45.3d).
 * Cố định thông tin cho npm, pip, docker, winget, scoop, cargo, conda, go (và npx ánh xạ sang npm).
 * Không tự cài, không sửa PATH, chỉ đưa ra cảnh báo nhẹ kèm liên kết chính thức hoặc nhắc mở phần mềm.
 */

import {
  DANH_SACH_TRINH_QUAN_LY_GOI,
  type MaTrinhQuanLyGoi,
  trichTenGoiTuLenhTho,
} from '@forgestore/types';

/** Trạng thái công cụ dòng lệnh trả về từ lệnh Rust `kiem_tra_cong_cu_may` (P3B-45, P3B-45.3c). */
export type TrangThaiCongCuMay = 'SAN_SANG' | 'CHUA_CAI' | 'CHUA_CHAY' | 'THIEU_WSL';

/**
 * Thông tin định nghĩa công cụ quản lý gói trên máy trạm (P3B-31, P3B-45.3d).
 */
export interface ThongTinCongCu {
  /** Mã trình quản lý gói */
  readonly trinhQuanLy: string;
  /** Tên hiển thị người dùng dễ hiểu */
  readonly tenHienThi: string;
  /** Liên kết tải trang chính thức (luôn bắt đầu bằng https://) */
  readonly lienKetChinhThuc: string;
  /** Lệnh gợi ý cài đặt nhanh (winget hoặc PowerShell chính thức, nếu có) */
  readonly lenhGoiY?: string;
  /** Nhãn đứng trước lệnh gợi ý (mặc định: "Hoặc cài nhanh:") */
  readonly nhanLenhGoiY?: string;
}

/**
 * Thông tin cảnh báo trả về khi máy thiếu công cụ hoặc Docker Desktop chưa chạy (P3B-31, P3B-45).
 */
export interface ThongTinCanhBaoThieuCongCu {
  readonly trinhQuanLy: string;
  readonly tenHienThi: string;
  readonly trangThai: 'CHUA_CAI' | 'CHUA_CHAY' | 'THIEU_WSL';
  readonly lienKetChinhThuc?: string;
  readonly thongDiep: string;
  readonly lenhGoiY?: string;
  readonly nhanLenhGoiY?: string;
}

/**
 * Bảng thông tin cố định các công cụ dòng lệnh được hỗ trợ kiểm tra (P3B-31, P3B-45.3d).
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
    lenhGoiY:
      'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser; Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression',
    nhanLenhGoiY: 'Hoặc cài nhanh (PowerShell):',
  },
  cargo: {
    trinhQuanLy: 'cargo',
    tenHienThi: 'Rust (Cargo)',
    lienKetChinhThuc: 'https://rustup.rs/',
    lenhGoiY: 'winget install Rustlang.Rustup',
  },
  conda: {
    trinhQuanLy: 'conda',
    tenHienThi: 'Miniconda (Conda)',
    lienKetChinhThuc: 'https://docs.conda.io/en/latest/miniconda.html',
    lenhGoiY: 'winget install Anaconda.Miniconda3',
  },
  go: {
    trinhQuanLy: 'go',
    tenHienThi: 'Go',
    lienKetChinhThuc: 'https://go.dev/dl/',
    lenhGoiY: 'winget install GoLang.Go',
  },
};

/**
 * Chuẩn hóa mã công cụ kiểm tra máy: gộp `npx` về `npm` (cùng thuộc Node.js) và chỉ giữ mã hợp lệ (P3B-45.3d).
 */
export function chuanHoaMaCongCuKiemTra(trinhQuanLy?: string | null): string | undefined {
  if (!trinhQuanLy) return undefined;
  const ma = trinhQuanLy.trim().toLowerCase();
  if (!ma) return undefined;
  const maChuan = ma === 'npx' ? 'npm' : ma;
  return BANG_CONG_CU[maChuan] ? maChuan : undefined;
}

/**
 * Trích xuất mã trình quản lý gói từ phương thức cài đặt CLI (P3B-31, P3B-45.3e).
 * Gom logic suy luận dùng chung giữa TrangChiTiet, NhanDaCaiTrenMay và CanhBaoThieuCongCu.
 */
export function layTrinhQuanLyCachCai(
  phuongThuc?: {
    nhom?: string;
    trinhQuanLy?: string | null;
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
  if (nhomLow.includes('cargo')) return 'cargo';
  if (nhomLow.includes('conda')) return 'conda';

  if (phuongThuc.buoc?.[0]?.lenh) {
    const trich = trichTenGoiTuLenhTho(phuongThuc.buoc[0].lenh);
    if (trich?.trinhQuanLy) {
      return trich.trinhQuanLy.toLowerCase();
    }
  }

  return undefined;
}

/**
 * Thông tin cặp trình quản lý + tên gói hợp lệ để ghi nhận vào Thư viện máy (P3B-45.3e).
 */
export interface ThongTinGhiNhanCli {
  readonly trinhQuanLy: MaTrinhQuanLyGoi;
  readonly tenGoi: string;
}

/**
 * Kiểm tra trình quản lý gói có hỗ trợ lưu vào Thư viện máy và sinh lệnh gỡ an toàn hay không (P3B-45.3e).
 * Chỉ trả về true khi mã nằm trong manifest chính thức và có mẫu lệnh gỡ khác rỗng (loại npx, go, chuỗi lạ).
 */
export function hoTroGhiNhanThuVienCli(trinhQuanLy?: string | null): boolean {
  if (!trinhQuanLy) return false;
  const ma = trinhQuanLy.trim().toLowerCase() as MaTrinhQuanLyGoi;
  const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[ma];
  return Boolean(manifest && manifest.mauLenhGo.trim().length > 0);
}

/**
 * Xác định trình quản lý và tên gói hợp lệ để lưu vào Thư viện máy từ cách cài đang chọn (P3B-45.3e).
 * Tuyệt đối không fallback sang winget; trả về null nếu cách cài chưa hỗ trợ ghi nhận và tạo lệnh gỡ.
 */
export function xacDinhThongTinGhiNhanCli(
  phuongThuc?: {
    nhom?: string;
    trinhQuanLy?: string | null;
    tenGoi?: string | null;
    buoc?: Array<{ lenh?: string }>;
  } | null,
  tenGoiDuPhong?: string | null,
): ThongTinGhiNhanCli | null {
  if (!phuongThuc) return null;

  const tenGoiCoSan = phuongThuc.tenGoi?.trim() || undefined;
  const lenhDau = phuongThuc.buoc?.[0]?.lenh;
  // Ưu tiên bóc từ lệnh thô khi dữ liệu DB chưa điền tenGoi (ví dụ các repo CARGO, CONDA hiện có)
  const trich = !tenGoiCoSan && lenhDau ? trichTenGoiTuLenhTho(lenhDau) : null;

  const trinhQuanLy = (trich?.trinhQuanLy || layTrinhQuanLyCachCai(phuongThuc))
    ?.trim()
    .toLowerCase();
  if (!trinhQuanLy || !hoTroGhiNhanThuVienCli(trinhQuanLy)) {
    return null;
  }

  const tenGoi = tenGoiCoSan || trich?.tenGoi || tenGoiDuPhong?.trim() || '';
  if (!tenGoi) {
    return null;
  }

  return {
    trinhQuanLy: trinhQuanLy as MaTrinhQuanLyGoi,
    tenGoi,
  };
}

/**
 * Xác định công cụ cần kiểm tra máy cho khung cảnh báo (P3B-45.3d).
 * Tách riêng khỏi `layTrinhQuanLyCachCai` để mở rộng go mà không làm lệch enum gửi backend.
 */
export function layCongCuKiemTraCachCai(
  phuongThuc?: {
    nhom?: string;
    trinhQuanLy?: string | null;
    buoc?: Array<{ lenh?: string }>;
  } | null,
): string | undefined {
  const tuTrinhCoSan = chuanHoaMaCongCuKiemTra(layTrinhQuanLyCachCai(phuongThuc));
  if (tuTrinhCoSan) return tuTrinhCoSan;

  const nhomLow = (phuongThuc?.nhom || '').trim().toLowerCase();
  if (nhomLow.includes('cargo')) return 'cargo';
  if (nhomLow.includes('conda')) return 'conda';
  // So khớp ranh giới cho Go để không bắt nhầm chuỗi chứa "go" như "google".
  if (nhomLow === 'go' || nhomLow.startsWith('go-') || nhomLow.startsWith('go_')) return 'go';

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
  if (ketQua === 'THIEU_WSL') return 'THIEU_WSL';
  return null;
}

/**
 * Quyết định hiển thị cảnh báo khi thiếu công cụ, thiếu WSL hoặc công cụ chưa chạy trên máy (P3B-31, P3B-45).
 * Chỉ trả về cảnh báo khi trạng thái là CHUA_CAI, CHUA_CHAY hoặc THIEU_WSL và trình quản lý thuộc danh sách hỗ trợ.
 * Nếu là SAN_SANG, null, undefined hoặc trình lạ thì trả về null (im lặng).
 */
export function canhBaoThieuCongCu(
  trinhQuanLy?: string | null,
  ketQua?: TrangThaiCongCuMay | boolean | null,
): ThongTinCanhBaoThieuCongCu | null {
  const trangThai = chuanHoaTrangThaiCongCu(ketQua);
  if (
    (trangThai !== 'CHUA_CAI' && trangThai !== 'CHUA_CHAY' && trangThai !== 'THIEU_WSL') ||
    !trinhQuanLy
  ) {
    return null;
  }

  const maTrinh = chuanHoaMaCongCuKiemTra(trinhQuanLy);
  if (!maTrinh) {
    return null;
  }
  const thongTin = BANG_CONG_CU[maTrinh];

  if (trangThai === 'THIEU_WSL') {
    // Trạng thái THIEU_WSL chỉ áp dụng cho Docker Desktop; trình khác bỏ qua để tránh báo sai.
    if (maTrinh !== 'docker') return null;
    return {
      trinhQuanLy: thongTin.trinhQuanLy,
      tenHienThi: thongTin.tenHienThi,
      trangThai: 'THIEU_WSL',
      lienKetChinhThuc: undefined,
      thongDiep:
        'Máy bạn đã có Docker Desktop nhưng chưa cài WSL (môi trường chạy Linux cho Docker trên Windows). Hãy mở PowerShell bằng quyền Quản trị viên, chạy lệnh bên dưới rồi khởi động lại máy.',
      lenhGoiY: 'wsl --install --no-distribution',
    };
  }

  if (trangThai === 'CHUA_CHAY') {
    // Trạng thái CHUA_CHAY chỉ áp dụng cho Docker Desktop; các trình khác bỏ qua để tránh báo sai thông điệp.
    if (maTrinh !== 'docker') return null;
    return {
      trinhQuanLy: thongTin.trinhQuanLy,
      tenHienThi: thongTin.tenHienThi,
      trangThai: 'CHUA_CHAY',
      lienKetChinhThuc: undefined,
      thongDiep:
        'Máy bạn đã có Docker Desktop nhưng phần mềm chưa chạy. Hãy mở Docker Desktop, chờ khởi động xong rồi chạy lại lệnh.',
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
    nhanLenhGoiY: thongTin.nhanLenhGoiY,
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
