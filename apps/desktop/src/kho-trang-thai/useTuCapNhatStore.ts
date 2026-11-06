import { create } from 'zustand';
import type { Update } from '@tauri-apps/plugin-updater';

/** Trạng thái bản ForgeStore mới (D-37): chỉ báo ở chân thanh bên đọc từ đây. */
interface TuCapNhatState {
  /** Bản mới đang chờ cài, null nếu đã là bản mới nhất */
  banMoi: Update | null;
  dangTai: boolean;
  /** Phần trăm đã tải (0 đến 100), null khi chưa biết dung lượng */
  tienDo: number | null;
  datBanMoi: (ban: Update | null) => void;
  batDauTai: () => void;
  datTienDo: (phanTram: number | null) => void;
  ketThucTai: () => void;
}

export const useTuCapNhatStore = create<TuCapNhatState>((set) => ({
  banMoi: null,
  dangTai: false,
  tienDo: null,
  datBanMoi: (ban) => set({ banMoi: ban }),
  batDauTai: () => set({ dangTai: true, tienDo: null }),
  datTienDo: (phanTram) => set({ tienDo: phanTram }),
  ketThucTai: () => set({ dangTai: false, tienDo: null }),
}));
