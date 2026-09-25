import { create } from 'zustand';
import { installService } from '../services/install/install-service';
import type {
  ThamSoCaiDat,
  ThongTinCaiDatApp,
  TrangThaiCaiDat,
} from '../services/install/install-types';

interface InstallState {
  caiDatMap: Record<string, ThongTinCaiDatApp>;

  // Actions
  batDauCaiDat: (params: ThamSoCaiDat) => Promise<boolean>;
  huyCaiDat: (maUngDung: string) => Promise<void>;
  moApp: (maUngDung: string) => Promise<void>;
  capNhatTrangThai: (maUngDung: string, partial: Partial<ThongTinCaiDatApp>) => void;
  layThongTinApp: (maUngDung: string) => ThongTinCaiDatApp | undefined;
}

export const useInstallStore = create<InstallState>((set, get) => ({
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
        get().capNhatTrangThai(maUngDung, {
          trangThai: 'DA_CAI_DAT',
          phanTram: 100,
          tocDoBps: 0,
          duongDanThucThi: res.duong_dan_thuc_thi ?? undefined,
        });
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

      // Nếu là hủy thì đánh dấu DA_HUY thay vì LOI
      if (errMsg.includes('DA_HUY')) {
        get().capNhatTrangThai(maUngDung, {
          trangThai: 'DA_HUY',
          phanTram: 0,
          tocDoBps: 0,
          thongDiepLoi: undefined,
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

  moApp: async (maUngDung) => {
    const appInfo = get().caiDatMap[maUngDung];
    if (appInfo?.duongDanThucThi) {
      await installService.moUngDung(appInfo.duongDanThucThi);
    } else {
      console.warn(`Không tìm thấy đường dẫn thực thi cho app '${maUngDung}'`);
    }
  },
}));
