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

export const useUpdaterStore = create<UpdaterState>((set) => ({
  soLuongBanCapNhat: 0,
  danhSachCapNhat: [],
  dangKiemTra: false,
  thoiGianKiemTraCuoi: null,

  kiemTraCapNhat: async (deviceId, danhSach = []) => {
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
