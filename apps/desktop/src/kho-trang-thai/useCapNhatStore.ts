import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capNhatService } from '../dich-vu/cap-nhat/cap-nhat.service';
import { soSanhPhienBan, type CheckUpdatesItemDto } from '@forgestore/types';

interface UpdaterState {
  soLuongBanCapNhat: number;
  danhSachCapNhat: CheckUpdatesItemDto[];
  danhSachBoQuaVersion: Record<string, string>; // Bản đồ ánh xạ { [maUngDung]: phienBanBoQua }
  dangKiemTra: boolean;
  thoiGianKiemTraCuoi: number | null;

  kiemTraCapNhat: (
    deviceId: string,
    danhSach?: Array<{ maUngDung: string; phienBanHienTai: string }>,
  ) => Promise<number | null>;
  boQuaPhienBan: (maUngDung: string, phienBan: string) => void;
  khoiPhucPhienBan: (maUngDung: string) => void;
  kiemTraDaBoQua: (maUngDung: string, phienBanMoi?: string) => boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeStorage = {
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

export const useCapNhatStore = create<UpdaterState>()(
  persist(
    (set, get) => ({
      soLuongBanCapNhat: 0,
      danhSachCapNhat: [],
      danhSachBoQuaVersion: {},
      dangKiemTra: false,
      thoiGianKiemTraCuoi: null,

      boQuaPhienBan: (maUngDung, phienBan) => {
        set((state) => {
          const nextBoQua = {
            ...(state.danhSachBoQuaVersion || {}),
            [maUngDung]: phienBan,
          };
          const filtered = state.danhSachCapNhat.filter((item) => {
            if (item.maUngDung !== maUngDung) return true;
            return item.phienBanMoiNhat !== phienBan;
          });
          return {
            danhSachBoQuaVersion: nextBoQua,
            danhSachCapNhat: filtered,
            soLuongBanCapNhat: filtered.length,
          };
        });
      },

      khoiPhucPhienBan: (maUngDung) => {
        set((state) => {
          const nextBoQua = { ...(state.danhSachBoQuaVersion || {}) };
          delete nextBoQua[maUngDung];
          return { danhSachBoQuaVersion: nextBoQua };
        });
      },

      kiemTraDaBoQua: (maUngDung, phienBanMoi) => {
        if (!phienBanMoi) return false;
        const boQuaVer = (get().danhSachBoQuaVersion || {})[maUngDung];
        if (!boQuaVer) return false;

        // P3B-17.2: Tự hết tác dụng khi có bản mới hơn
        if (soSanhPhienBan(boQuaVer, phienBanMoi) > 0) {
          get().khoiPhucPhienBan(maUngDung);
          return false;
        }

        return boQuaVer === phienBanMoi;
      },

      kiemTraCapNhat: async (deviceId, danhSach = []) => {
        // Chặn gọi API nếu deviceId không phải là UUID v4 hợp lệ (tránh 400 Bad Request)
        if (!deviceId || !UUID_REGEX.test(deviceId)) {
          console.warn(
            `[useCapNhatStore] Bỏ qua kiểm tra cập nhật: deviceId không phải UUID hợp lệ (${deviceId})`,
          );
          set({ dangKiemTra: false });
          return null;
        }

        set({ dangKiemTra: true });
        try {
          const res = await capNhatService.kiemTraCapNhat(deviceId, danhSach);
          // Lọc bỏ các bản cập nhật đã được người dùng chọn bỏ qua (P3B-17.2)
          const updates = res.danhSachCapNhat.filter((item) => {
            if (!item.coBanCapNhat) return false;
            return !get().kiemTraDaBoQua(item.maUngDung, item.phienBanMoiNhat);
          });
          const count = updates.length;

          set({
            soLuongBanCapNhat: count,
            danhSachCapNhat: updates,
            thoiGianKiemTraCuoi: Date.now(),
            dangKiemTra: false,
          });

          return count;
        } catch (err) {
          console.warn('[useCapNhatStore] Lỗi kiểm tra cập nhật:', err);
          set({ dangKiemTra: false });
          return null;
        }
      },
    }),
    {
      name: 'forgestore_ignored_updates',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        danhSachBoQuaVersion: state.danhSachBoQuaVersion,
      }),
    },
  ),
);
