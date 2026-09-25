import { create } from 'zustand';
import { updaterService } from '../services/updater/updater-service';
import type { CheckUpdatesItemDto } from '@forgestore/types';

interface UpdaterState {
  soLuongBanCapNhat: number;
  danhSachCapNhat: CheckUpdatesItemDto[];
  dangKiemTra: boolean;
  thoiGianKiemTraCuoi: number | null;

  kiemTraCapNhat: (
    deviceId: string,
    danhSach?: Array<{ maUngDung: string; phienBanHienTai: string }>,
  ) => Promise<number>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useUpdaterStore = create<UpdaterState>((set) => ({
  soLuongBanCapNhat: 0,
  danhSachCapNhat: [],
  dangKiemTra: false,
  thoiGianKiemTraCuoi: null,

  kiemTraCapNhat: async (deviceId, danhSach = []) => {
    // Chặn gọi API nếu deviceId không phải là UUID v4 hợp lệ (tránh 400 Bad Request)
    if (!deviceId || !UUID_REGEX.test(deviceId)) {
      console.warn(
        `[useUpdaterStore] Bỏ qua kiểm tra cập nhật: deviceId không phải UUID hợp lệ (${deviceId})`,
      );
      set({ dangKiemTra: false });
      return 0;
    }

    set({ dangKiemTra: true });
    try {
      const res = await updaterService.kiemTraCapNhat(deviceId, danhSach);
      const updates = res.danhSachCapNhat.filter((item) => item.coBanCapNhat);
      const count = updates.length;

      set({
        soLuongBanCapNhat: count,
        danhSachCapNhat: updates,
        thoiGianKiemTraCuoi: Date.now(),
        dangKiemTra: false,
      });

      return count;
    } catch (err) {
      console.warn('[useUpdaterStore] Lỗi kiểm tra cập nhật:', err);
      set({ dangKiemTra: false });
      return 0;
    }
  },
}));
