import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { installService } from '../services/install/install-service';
import { libraryService } from '../services/library/library-service';
import { queryClient } from '../services/api/query-client';
import { apiClient } from '../services/api/api-client';
import { useAuthStore } from './useAuthStore';
import type {
  ThamSoCaiDat,
  ThongTinCaiDatApp,
  TrangThaiCaiDat,
} from '../services/install/install-types';

const safeMemoryStorage = {
  getItem: (name: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(name)
        : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(name, value);
      }
    } catch {
      // Bỏ qua lỗi truy cập storage
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    } catch {
      // Bỏ qua lỗi truy cập storage
    }
  },
};

// Dọn dẹp key cũ không còn được phép lưu trữ trạng thái cài đặt vĩnh viễn (A3)
safeMemoryStorage.removeItem('forgestore_installed_apps');

interface InstallState {
  caiDatMap: Record<string, ThongTinCaiDatApp>;

  // Actions
  batDauCaiDat: (params: ThamSoCaiDat) => Promise<boolean>;
  huyCaiDat: (maUngDung: string) => Promise<void>;
  moApp: (maUngDung: string) => Promise<void>;
  goCaiDatLocal: (maUngDung: string) => void;
  xoaTrangThaiTam: () => void;
  capNhatTrangThai: (maUngDung: string, partial: Partial<ThongTinCaiDatApp>) => void;
  layThongTinApp: (maUngDung: string) => ThongTinCaiDatApp | undefined;
}

export const useInstallStore = create<InstallState>()(
  persist(
    (set, get) => ({
      caiDatMap: {},

      capNhatTrangThai: (maUngDung, partial) => {
        set((state) => {
          const current = state.caiDatMap[maUngDung] || {
            maUngDung,
            tenApp: '',
            trangThai: 'CHUA_CAI' as TrangThaiCaiDat,
            phanTram: 0,
            tocDoBps: 0,
            daTaiBytes: 0,
            tongBytes: 0,
            thoiGianCapNhat: Date.now(),
          };

          return {
            caiDatMap: {
              ...state.caiDatMap,
              [maUngDung]: {
                ...current,
                ...partial,
                thoiGianCapNhat: Date.now(),
              },
            },
          };
        });
      },

      layThongTinApp: (maUngDung) => {
        return get().caiDatMap[maUngDung];
      },

      batDauCaiDat: async (params) => {
        const { maUngDung, tenApp } = params;

        // Khởi tạo trạng thái đang tải
        get().capNhatTrangThai(maUngDung, {
          tenApp,
          loaiTep: params.loaiTep,
          trangThai: 'DANG_TAI',
          phanTram: 0,
          tocDoBps: 0,
          daTaiBytes: 0,
          tongBytes: 0,
          thongDiepLoi: undefined,
        });

        try {
          const res = await installService.batDauTaiVaCaiDat(params, (tienDo) => {
            get().capNhatTrangThai(maUngDung, {
              trangThai: tienDo.trangThai,
              phanTram: tienDo.phanTram,
              tocDoBps: tienDo.tocDoBps,
              daTaiBytes: tienDo.daTaiBytes,
              tongBytes: tienDo.tongBytes,
            });
          });

          if (res.thanh_cong) {
            const isPortableZip = params.loaiTep?.toUpperCase().includes('ZIP');

            get().capNhatTrangThai(maUngDung, {
              trangThai: 'DA_CAI_DAT',
              loaiTep: params.loaiTep,
              phanTram: 100,
              tocDoBps: 0,
              duongDanThucThi: res.duong_dan_thuc_thi ?? undefined,
              duongDanThuMuc: isPortableZip ? (res.duong_dan_cai_dat ?? undefined) : undefined,
              registryKey: res.thong_tin_registry?.registry_key ?? undefined,
              registryDisplayName: res.thong_tin_registry?.display_name ?? undefined,
              registryPublisher: res.thong_tin_registry?.publisher ?? undefined,
              registryDisplayVersion: res.thong_tin_registry?.display_version ?? undefined,
            });

            // Ghi nhận cài đặt lên Backend nếu là file cài đặt hệ thống EXE/MSI (P3-10.3 & A1 & A3)
            // Tuyệt đối KHÔNG ghi nhận bản ZIP portable vào Thư viện máy (Nguyên tắc 3 & A1)
            if (!isPortableZip) {
              try {
                const maThietBi = useAuthStore.getState().maThietBi;
                if (maThietBi) {
                  await libraryService.ghiNhanCaiDat(maThietBi, {
                    maUngDung,
                    phienBanHienTai: params.phienBan || '0.0.0',
                    maTepDaCai: params.maTep,
                    duongDanThuMuc: undefined, // DELIV-44.3: Bản EXE/MSI không lưu duongDanThuMuc (lấy từ registry)
                    khoaRegistry: res.thong_tin_registry?.registry_key ?? undefined,
                    tenHienThiRegistry: res.thong_tin_registry?.display_name ?? undefined,
                  });
                  // Cập nhật tức thì cả trang Chi tiết và trang Thư viện qua server query (A3)
                  queryClient.invalidateQueries({ queryKey: ['device-installed-apps'] });
                }
              } catch (syncErr) {
                console.warn(
                  '[useInstallStore] Không thể đồng bộ ghi nhận cài đặt lên backend:',
                  syncErr,
                );
              }
            }

            return true;
          } else {
            get().capNhatTrangThai(maUngDung, {
              trangThai: 'LOI',
              thongDiepLoi: res.thong_diep,
            });
            return false;
          }
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Lỗi không xác định khi tải và cài đặt';

          // Nếu là hủy thì đánh dấu DA_HUY thay vì LOI (P3-FIX)
          if (
            errMsg.includes('DA_HUY') ||
            errMsg.includes('NGUOI_DUNG_HUY') ||
            errMsg.includes('1223') ||
            errMsg.includes('1602') ||
            errMsg.toLowerCase().includes('từ chối') ||
            errMsg.toLowerCase().includes('đã hủy')
          ) {
            get().capNhatTrangThai(maUngDung, {
              trangThai: 'DA_HUY',
              phanTram: 0,
              tocDoBps: 0,
              thongDiepLoi: 'Đã hủy tiến trình cài đặt hoặc từ chối cấp quyền Quản trị viên (UAC).',
            });
          } else {
            get().capNhatTrangThai(maUngDung, {
              trangThai: 'LOI',
              thongDiepLoi: errMsg,
            });
          }
          return false;
        }
      },

      huyCaiDat: async (maUngDung) => {
        await installService.huyTai(maUngDung);
        get().capNhatTrangThai(maUngDung, {
          trangThai: 'DA_HUY',
          phanTram: 0,
          tocDoBps: 0,
        });
      },

      goCaiDatLocal: (maUngDung) => {
        set((state) => {
          const next = { ...state.caiDatMap };
          delete next[maUngDung];
          return { caiDatMap: next };
        });
      },

      xoaTrangThaiTam: () => {
        set({ caiDatMap: {} });
      },

      moApp: async (maUngDung) => {
        const appInfo = get().caiDatMap[maUngDung];
        if (appInfo?.duongDanThucThi) {
          await installService.moUngDung(appInfo.duongDanThucThi);
        } else {
          console.warn(`Không tìm thấy đường dẫn thực thi cho app '${maUngDung}'`);
        }
      },
    }),
    {
      name: 'forgestore_install_tasks',
      storage: createJSONStorage(() => safeMemoryStorage),
      partialize: (state) => ({
        // FE-R7-02: Giữ các tiến trình tải dở dang và bản Portable ZIP đã cài (có duongDanThuMuc)
        // để khi mở lại app người dùng vẫn có thể bấm "Mở Thư Mục Portable"
        caiDatMap: Object.fromEntries(
          Object.entries(state.caiDatMap).filter(
            ([_, v]) =>
              v.trangThai === 'DANG_TAI' ||
              v.trangThai === 'XAC_MINH' ||
              v.trangThai === 'DANG_CAI_DAT' ||
              (v.trangThai === 'DA_CAI_DAT' && !!v.duongDanThuMuc),
          ),
        ),
      }),
      onRehydrateStorage: () => (state) => {
        // FE-R7-01: Reset các Zombie Tasks đang tải dở dang khi tắt/mở app về DA_HUY
        if (state && state.caiDatMap) {
          const next = { ...state.caiDatMap };
          let changed = false;
          for (const [id, item] of Object.entries(next)) {
            if (['DANG_TAI', 'XAC_MINH', 'DANG_CAI_DAT'].includes(item.trangThai)) {
              next[id] = {
                ...item,
                trangThai: 'DA_HUY',
                phanTram: 0,
                tocDoBps: 0,
                thongDiepLoi: 'Tiến trình tải bị gián đoạn do ứng dụng đã đóng.',
              };
              changed = true;
            }
          }
          if (changed) {
            state.caiDatMap = next;
          }
        }
      },
    },
  ),
);

// Tự động dọn sạch các trạng thái tạm khi người dùng đăng xuất (A3)
apiClient.onLogout(() => {
  useInstallStore.getState().xoaTrangThaiTam();
});
