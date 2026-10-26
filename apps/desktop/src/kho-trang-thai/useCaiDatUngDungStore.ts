import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { installService } from '../dich-vu/cai-dat-ung-dung/cai-dat-ung-dung.service';
import { libraryService } from '../dich-vu/thu-vien/thu-vien.service';
import { queryClient } from '../dich-vu/api/query-client';
import { apiClient } from '../dich-vu/api/api-client';
import { useAuthStore } from './useXacThucStore';
import { taoMauTenTepWildcard } from '@forgestore/types';
import type {
  ThamSoCaiDat,
  ThongTinCaiDatApp,
  TrangThaiCaiDat,
} from '../dich-vu/cai-dat-ung-dung/kieu-cai-dat-ung-dung';

export type { ThongTinCaiDatApp, ThamSoCaiDat, TrangThaiCaiDat };
export type CaiDatTienTrinh = ThongTinCaiDatApp;

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
  bienTheMap: Record<string, { mauBienThe: string; tenTep: string }>;

  // Actions
  batDauCaiDat: (params: ThamSoCaiDat) => Promise<boolean>;
  huyCaiDat: (maUngDung: string) => Promise<void>;
  moApp: (maUngDung: string) => Promise<void>;
  goCaiDatLocal: (maUngDung: string) => void;
  xoaTrangThaiTam: () => void;
  capNhatTrangThai: (maUngDung: string, partial: Partial<ThongTinCaiDatApp>) => void;
  layThongTinApp: (maUngDung: string) => ThongTinCaiDatApp | undefined;
  luuBienThe: (maUngDung: string, tenTep: string, phienBan?: string) => void;
  layBienThe: (maUngDung: string) => string | undefined;
}

export const useInstallStore = create<InstallState>()(
  persist(
    (set, get) => ({
      caiDatMap: {},
      bienTheMap: {},

      luuBienThe: (maUngDung, tenTep, phienBan) => {
        const mauBienThe = taoMauTenTepWildcard(tenTep, phienBan);
        set((state) => ({
          bienTheMap: {
            ...state.bienTheMap,
            [maUngDung]: { mauBienThe, tenTep },
          },
        }));
      },

      layBienThe: (maUngDung) => {
        return get().bienTheMap[maUngDung]?.mauBienThe;
      },

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
            const mauBienThe = taoMauTenTepWildcard(params.tenTep, params.phienBan);
            get().luuBienThe(maUngDung, params.tenTep, params.phienBan);

            get().capNhatTrangThai(maUngDung, {
              trangThai: 'DA_CAI_DAT',
              loaiTep: params.loaiTep,
              phanTram: 100,
              tocDoBps: 0,
              mauBienThe,
              tenTepDaCai: params.tenTep,
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

          // Nếu là hủy thì đánh dấu DA_HUY thay vì LOI (P3-FIX & L-09: Tách hủy tải vs từ chối UAC)
          const currentTrangThai = get().caiDatMap[maUngDung]?.trangThai;
          const isUacOrCancel =
            errMsg.includes('DA_HUY') ||
            errMsg.includes('NGUOI_DUNG_HUY') ||
            errMsg.includes('1223') ||
            errMsg.includes('1602') ||
            errMsg.toLowerCase().includes('từ chối') ||
            errMsg.toLowerCase().includes('đã hủy');

          if (isUacOrCancel) {
            const isDownloading = currentTrangThai === 'DANG_TAI';
            get().capNhatTrangThai(maUngDung, {
              trangThai: 'DA_HUY',
              phanTram: 0,
              tocDoBps: 0,
              thongDiepLoi: isDownloading
                ? 'Đã hủy tiến trình tải.'
                : 'Đã hủy tiến trình cài đặt hoặc từ chối cấp quyền Quản trị viên (UAC).',
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
        const currentTrangThai = get().caiDatMap[maUngDung]?.trangThai;
        await installService.huyTai(maUngDung);
        get().capNhatTrangThai(maUngDung, {
          trangThai: 'DA_HUY',
          phanTram: 0,
          tocDoBps: 0,
          thongDiepLoi:
            currentTrangThai === 'DANG_TAI'
              ? 'Đã hủy tiến trình tải.'
              : 'Đã hủy tiến trình cài đặt.',
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
        bienTheMap: state.bienTheMap,
        // L-08: Chỉ lưu các tiến trình dở dang để merge reset sang DA_HUY khi khởi động lại app.
        // Bản Portable ZIP không lưu kẹt DA_CAI_DAT trong storage.
        caiDatMap: Object.fromEntries(
          Object.entries(state.caiDatMap).filter(
            ([_, v]) =>
              v.trangThai === 'DANG_TAI' ||
              v.trangThai === 'XAC_MINH' ||
              v.trangThai === 'DANG_CAI_DAT',
          ),
        ),
      }),
      merge: (persistedState, currentState) => {
        // FE-R7-01 / EC-03: Reset các Zombie Tasks đang tải dở dang khi tắt/mở app về DA_HUY
        // Sửa trực tiếp trên persistedState trước khi gộp vào store, triệt tiêu lỗi TDZ useInstallStore.setState
        const typed = persistedState as Partial<InstallState> | undefined;
        if (!typed) {
          return currentState;
        }

        const next = { ...(typed.caiDatMap || {}) };
        for (const [id, item] of Object.entries(next)) {
          if (['DANG_TAI', 'XAC_MINH', 'DANG_CAI_DAT'].includes(item.trangThai)) {
            next[id] = {
              ...item,
              trangThai: 'DA_HUY',
              phanTram: 0,
              tocDoBps: 0,
              thongDiepLoi: 'Tiến trình tải bị gián đoạn do ứng dụng đã đóng.',
            };
          }
        }

        return {
          ...currentState,
          ...typed,
          caiDatMap: next,
          bienTheMap: {
            ...(currentState.bienTheMap || {}),
            ...(typed.bienTheMap || {}),
          },
        };
      },
    },
  ),
);

// Tự động dọn sạch các trạng thái tạm khi người dùng đăng xuất (A3)
apiClient.onLogout(() => {
  useInstallStore.getState().xoaTrangThaiTam();
});
