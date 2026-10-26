import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../kho-trang-thai/useXacThucStore';
import { useInstallStore, type CaiDatTienTrinh } from '../kho-trang-thai/useCaiDatUngDungStore';
import { libraryService } from '../dich-vu/thu-vien/thu-vien.service';
import type { UngDungDaCaiDto } from '@forgestore/types';

export interface TrangThaiCaiDatApp {
  trangThai: 'CHUA_CAI' | 'DANG_TAI' | 'XAC_MINH' | 'DANG_CAI_DAT' | 'DA_CAI_DAT';
  label: string;
  phanTram?: number;
}

/**
 * Hàm thuần kiểm tra xem ứng dụng đã cài đặt trên máy hay chưa (L-02)
 * Đối soát ID, tên kho chứa slug, hoặc repo handle với danh sách thiết bị Backend và RAM
 */
export function kiemTraAppDaCaiHelper(params: {
  installedList: UngDungDaCaiDto[];
  caiDatMap: Record<string, CaiDatTienTrinh>;
  appIdOrKey?: string;
  repoHandle?: string;
  isAuthenticated: boolean;
}): boolean {
  const { installedList, caiDatMap, appIdOrKey, repoHandle, isAuthenticated } = params;
  if (!appIdOrKey && !repoHandle) return false;

  const keys = [appIdOrKey, repoHandle]
    .filter((k): k is string => Boolean(k && k.trim()))
    .map((k) => k.toLowerCase().trim());

  // 1. Kiểm tra đối chiếu với danh sách thiết bị từ Backend (khi đã đăng nhập)
  if (isAuthenticated && installedList.length > 0) {
    const matchInBackend = installedList.some((item) => {
      const idLower = item.maUngDung.toLowerCase();
      const slugLower = item.ungDung?.tenKhoChua?.toLowerCase();
      const repoLower = item.ungDung?.tenRepoDayDu?.toLowerCase();

      return keys.some((k) => k === idLower || k === slugLower || k === repoLower);
    });

    if (matchInBackend) return true;
  }

  // 2. Kiểm tra trong RAM useInstallStore (hỗ trợ cả khách hoặc vừa cài xong chưa sync)
  for (const k of keys) {
    const local = caiDatMap[k];
    if (local?.trangThai === 'DA_CAI_DAT') return true;
  }

  return false;
}

/**
 * Hàm thuần xác định trạng thái cài đặt chi tiết kèm nhãn và tiến trình % (L-02)
 */
export function layTrangThaiCaiDatHelper(params: {
  installedList: UngDungDaCaiDto[];
  caiDatMap: Record<string, CaiDatTienTrinh>;
  appIdOrKey?: string;
  repoHandle?: string;
  isAuthenticated: boolean;
}): TrangThaiCaiDatApp {
  const { caiDatMap, appIdOrKey, repoHandle } = params;
  const keys = [appIdOrKey, repoHandle].filter((k): k is string => Boolean(k && k.trim()));

  // Ưu tiên kiểm tra tiến trình đang chạy trong RAM
  for (const k of keys) {
    const local = caiDatMap[k];
    if (local) {
      if (local.trangThai === 'DANG_TAI') {
        return {
          trangThai: 'DANG_TAI',
          label: `Đang tải ${local.phanTram ?? 0}%`,
          phanTram: local.phanTram,
        };
      }
      if (local.trangThai === 'XAC_MINH') {
        return { trangThai: 'XAC_MINH', label: 'Đang xác minh...' };
      }
      if (local.trangThai === 'DANG_CAI_DAT') {
        return { trangThai: 'DANG_CAI_DAT', label: 'Đang cài đặt...' };
      }
    }
  }

  // Kiểm tra xem đã cài đặt chưa
  if (kiemTraAppDaCaiHelper(params)) {
    return { trangThai: 'DA_CAI_DAT', label: '✓ Đã cài' };
  }

  return { trangThai: 'CHUA_CAI', label: 'Cài đặt' };
}

/**
 * Hook dùng chung tra cứu trạng thái ứng dụng đã cài đặt trên thiết bị hiện tại (L-02)
 * Đồng bộ qua chung React Query key ['device-installed-apps', user?.maNguoiDung, maThietBi]
 * Kết hợp dữ liệu RAM từ useInstallStore để phản hồi tức thì khi đang tải/cài
 */
export function useDeviceInstalledApps() {
  const { user, isAuthenticated, maThietBi } = useAuthStore();
  const caiDatMap = useInstallStore((s) => s.caiDatMap);

  const {
    data: installedList = [],
    isLoading,
    refetch,
  } = useQuery<UngDungDaCaiDto[]>({
    queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
    queryFn: () =>
      maThietBi ? libraryService.layDanhSachAppDaCai(maThietBi) : Promise.resolve([]),
    enabled: Boolean(isAuthenticated && maThietBi),
    staleTime: 1000 * 60 * 2,
  });

  const kiemTraAppDaCai = (appIdOrKey?: string, repoHandle?: string): boolean => {
    return kiemTraAppDaCaiHelper({
      installedList,
      caiDatMap,
      appIdOrKey,
      repoHandle,
      isAuthenticated,
    });
  };

  const layTrangThaiCaiDat = (appIdOrKey?: string, repoHandle?: string): TrangThaiCaiDatApp => {
    return layTrangThaiCaiDatHelper({
      installedList,
      caiDatMap,
      appIdOrKey,
      repoHandle,
      isAuthenticated,
    });
  };

  return {
    installedList,
    isLoading,
    refetch,
    kiemTraAppDaCai,
    layTrangThaiCaiDat,
  };
}
