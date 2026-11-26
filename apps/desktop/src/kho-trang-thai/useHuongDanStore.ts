import { create } from 'zustand';

interface HuongDanState {
  /** Bộ đếm tăng mỗi khi người dùng bấm "Xem lại hướng dẫn nhanh" để kích hoạt lại tour từ Bước 1. */
  yeuCauChayLai: number;
  kichHoatXemLaiHuongDan: () => void;
}

export const useHuongDanStore = create<HuongDanState>((set) => ({
  yeuCauChayLai: 0,
  kichHoatXemLaiHuongDan: () => set((state) => ({ yeuCauChayLai: state.yeuCauChayLai + 1 })),
}));
