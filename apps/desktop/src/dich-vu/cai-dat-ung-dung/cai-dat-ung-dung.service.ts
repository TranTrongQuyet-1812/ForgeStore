import type {
  KetQuaCaiDatRust,
  KetQuaTaiRust,
  ThamSoCaiDat,
  TienDoTaiFrontend,
  TienDoTaiPayload,
  ThongTinUngDungRegistry,
} from './kieu-cai-dat-ung-dung';
import { desktopLogger } from '../logger/desktop-logger';

/**
 * Service điều phối động cơ tải nhị phân và cài đặt Windows (P3-08..P3-11)
 */
export class CaiDatUngDungService {
  private laMoiTruongTauri(): boolean {
    return (
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
  }

  /**
   * Kích hoạt toàn bộ quy trình: Tải stream -> Băm SHA-256 -> Xác minh -> Chạy bộ cài
   */
  async batDauTaiVaCaiDat(
    params: ThamSoCaiDat,
    onProgress: (tienDo: TienDoTaiFrontend) => void,
  ): Promise<KetQuaCaiDatRust> {
    const idTai = params.maUngDung;
    await desktopLogger.ghiLogInfo(
      `Bắt đầu quy trình tải và cài đặt [${params.tenApp}] (${params.tenTep})`,
      'CaiDatUngDungService',
    );

    if (this.laMoiTruongTauri()) {
      return this.thucThiTauriNative(params, idTai, onProgress);
    } else {
      return this.giaLapWebDev(params, idTai, onProgress);
    }
  }

  /**
   * Hủy tiến trình tải tệp hiện tại
   */
  async huyTai(idTai: string): Promise<boolean> {
    await desktopLogger.ghiLogInfo(
      `Yêu cầu hủy tiến trình tải tệp cho tác vụ [${idTai}]`,
      'CaiDatUngDungService',
    );
    if (this.laMoiTruongTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('huy_tai_tep', { idTai });
      } catch (err) {
        console.error('Lỗi khi gọi huy_tai_tep native:', err);
        return false;
      }
    } else {
      // Giả lập hủy tiến trình trên môi trường Web dev
      return true;
    }
  }

  /**
   * Mở ứng dụng đã cài đặt qua đường dẫn thực thi (.exe)
   */
  async moUngDung(duongDanThucThi?: string | null, thuMucChoPhep?: string): Promise<void> {
    if (!duongDanThucThi || !duongDanThucThi.trim()) {
      console.warn('[CaiDatUngDungService] moUngDung bị bỏ qua vì đường dẫn rỗng');
      return;
    }
    const cleanPath = duongDanThucThi.trim();
    if (this.laMoiTruongTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<void>('mo_ung_dung', {
        duongDanThucThi: cleanPath,
        thuMucChoPhep: thuMucChoPhep || null,
      });
    } else {
      console.info(`[WebDev Preview] Giả lập mở ứng dụng tại: ${cleanPath}`);
    }
  }

  /**
   * Mở thư mục chứa bản portable trong File Explorer (A1, TC-09, SEC-02)
   */
  async moThuMuc(duongDanThuMuc?: string | null): Promise<void> {
    if (!duongDanThuMuc || !duongDanThuMuc.trim()) {
      console.warn('[CaiDatUngDungService] moThuMuc bị bỏ qua vì đường dẫn rỗng');
      return;
    }
    const cleanPath = duongDanThuMuc.trim();
    if (this.laMoiTruongTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mo_thu_muc', { duongDan: cleanPath });
      } catch (err) {
        console.warn('Lỗi khi mở thư mục qua Tauri command, thử lại bằng revealItemInDir:', err);
        try {
          const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
          await revealItemInDir(cleanPath);
        } catch (revealErr) {
          console.error('Không thể mở thư mục qua File Explorer:', revealErr);
        }
      }
    } else {
      console.info(`[WebDev Preview] Giả lập mở thư mục tại: ${cleanPath}`);
    }
  }

  /**
   * Thực thi bằng Tauri v2 Rust Native
   */
  private async thucThiTauriNative(
    params: ThamSoCaiDat,
    idTai: string,
    onProgress: (tienDo: TienDoTaiFrontend) => void,
  ): Promise<KetQuaCaiDatRust> {
    const { Channel, invoke } = await import('@tauri-apps/api/core');

    // 1. Tạo channel nhận tiến độ từ Rust (P3-08.2)
    const channel = new Channel<TienDoTaiPayload>();
    channel.onmessage = (payload) => {
      onProgress({
        idTai: payload.id_tai,
        daTaiBytes: payload.da_tai_bytes,
        tongBytes: payload.tong_bytes ?? 0,
        phanTram: payload.phan_tram,
        tocDoBps: payload.toc_do_bps,
        trangThai: payload.trang_thai as TienDoTaiFrontend['trangThai'],
        thongDiep: payload.thong_diep ?? undefined,
      });
    };

    // 2. Gọi lệnh tải và tính SHA-256 nguyên tử (P3-08 & P3-09)
    await desktopLogger.ghiLogInfo(
      `Bắt đầu tải file [${params.tenTep}] từ ${params.url} (SHA-256 dự kiến: ${params.sha256DuKien || 'Không có'})`,
      'CaiDatUngDungService',
    );

    let ketQuaTai: KetQuaTaiRust;
    try {
      ketQuaTai = await invoke<KetQuaTaiRust>('tai_tep_cai_dat', {
        idTai,
        url: params.url,
        tenTep: params.tenTep,
        sha256DuKien: params.sha256DuKien || null,
        onProgress: channel,
      });
      await desktopLogger.ghiLogInfo(
        `Tải thành công [${params.tenTep}] (${ketQuaTai.kich_thuoc_bytes} bytes). SHA-256 thực tế: ${ketQuaTai.sha256_tinh_duoc}`,
        'CaiDatUngDungService',
      );
    } catch (taiErr) {
      await desktopLogger.ghiLogError(
        `Lỗi khi tải file [${params.tenTep}]: ${taiErr}`,
        'CaiDatUngDungService',
      );
      throw taiErr;
    }

    // 3. Thông báo chuyển sang trạng thái cài đặt (P3-10)
    onProgress({
      idTai,
      daTaiBytes: ketQuaTai.kich_thuoc_bytes,
      tongBytes: ketQuaTai.kich_thuoc_bytes,
      phanTram: 100,
      tocDoBps: 0,
      trangThai: 'DANG_CAI_DAT',
      thongDiep: 'Đang thực thi bộ cài đặt...',
    });

    // 4. Gọi lệnh cài đặt (chạy .exe, .msi hoặc giải nén .zip)
    await desktopLogger.ghiLogInfo(
      `Khởi chạy cài đặt [${params.tenApp}] bằng tệp ${params.tenTep} (định dạng: ${params.loaiTep})`,
      'CaiDatUngDungService',
    );

    let ketQuaCaiDat: KetQuaCaiDatRust;
    try {
      ketQuaCaiDat = await invoke<KetQuaCaiDatRust>('cai_dat_ung_dung', {
        duongDanTep: ketQuaTai.duong_dan_tep,
        loaiTep: params.loaiTep,
        tenApp: params.tenApp,
        thuMucDich: params.thuMucDich || null,
      });

      if (ketQuaCaiDat.thanh_cong) {
        await desktopLogger.ghiLogInfo(
          `Cài đặt thành công [${params.tenApp}]. File thực thi: ${ketQuaCaiDat.duong_dan_thuc_thi || 'N/A'}`,
          'CaiDatUngDungService',
        );
      } else {
        await desktopLogger.ghiLogWarn(
          `Cài đặt thất bại hoặc bị hủy [${params.tenApp}]: ${ketQuaCaiDat.thong_diep}`,
          'CaiDatUngDungService',
        );
      }
    } catch (caiErr) {
      await desktopLogger.ghiLogError(
        `Lỗi khi thực thi cài đặt [${params.tenApp}]: ${caiErr}`,
        'CaiDatUngDungService',
      );
      throw caiErr;
    }

    // 5. Báo hoàn tất
    onProgress({
      idTai,
      daTaiBytes: ketQuaTai.kich_thuoc_bytes,
      tongBytes: ketQuaTai.kich_thuoc_bytes,
      phanTram: 100,
      tocDoBps: 0,
      trangThai: 'DA_CAI_DAT',
      thongDiep: ketQuaCaiDat.thong_diep,
    });

    return ketQuaCaiDat;
  }

  /**
   * Giả lập tiến trình khi chạy trên Web dev preview (chưa build native)
   */
  private async giaLapWebDev(
    params: ThamSoCaiDat,
    idTai: string,
    onProgress: (tienDo: TienDoTaiFrontend) => void,
  ): Promise<KetQuaCaiDatRust> {
    const totalBytes = 45 * 1024 * 1024; // 45 MB mock
    const steps = 10;

    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const loaded = Math.round((totalBytes / steps) * i);
      const percent = Math.round((i / steps) * 100);

      onProgress({
        idTai,
        daTaiBytes: loaded,
        tongBytes: totalBytes,
        phanTram: percent,
        tocDoBps: 4_500_000,
        trangThai: 'DANG_TAI',
      });
    }

    // Xác minh SHA-256
    onProgress({
      idTai,
      daTaiBytes: totalBytes,
      tongBytes: totalBytes,
      phanTram: 100,
      tocDoBps: 0,
      trangThai: 'XAC_MINH',
      thongDiep: 'Đang kiểm tra tệp tải về...',
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Đang cài đặt
    onProgress({
      idTai,
      daTaiBytes: totalBytes,
      tongBytes: totalBytes,
      phanTram: 100,
      tocDoBps: 0,
      trangThai: 'DANG_CAI_DAT',
      thongDiep: 'Đang giải nén bộ cài đặt...',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Hoàn tất
    onProgress({
      idTai,
      daTaiBytes: totalBytes,
      tongBytes: totalBytes,
      phanTram: 100,
      tocDoBps: 0,
      trangThai: 'DA_CAI_DAT',
      thongDiep: 'Cài đặt thành công!',
    });

    return {
      thanh_cong: true,
      loai_cai_dat: params.loaiTep,
      thong_diep: `Đã cài đặt ${params.tenApp} thành công (WebDev preview).`,
      duong_dan_cai_dat: 'C:\\ForgeStore\\apps\\' + params.tenApp,
      duong_dan_thuc_thi: 'C:\\ForgeStore\\apps\\' + params.tenApp + '\\' + params.tenApp + '.exe',
    };
  }

  /**
   * Kiểm tra thông tin cài đặt của ứng dụng trong Windows Registry (A4, Vấn đề 1)
   */
  async kiemTraAppRegistry(
    tenApp: string,
    registryKey?: string,
    displayName?: string,
  ): Promise<ThongTinUngDungRegistry | null> {
    if (this.laMoiTruongTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<ThongTinUngDungRegistry | null>('kiem_tra_ung_dung_da_cai_registry', {
          tenApp,
          registryKey: registryKey || null,
          displayName: displayName || null,
        });
      } catch (err) {
        console.warn(`[CaiDatUngDungService] Lỗi khi kiểm tra registry cho ${tenApp}:`, err);
        return null;
      }
    }
    return null;
  }

  /**
   * Chờ app thật sự biến mất khỏi Registry sau khi bộ gỡ trả về.
   * Bộ gỡ NSIS (mặc định của Electron) tự chép ra thư mục tạm rồi thoát ngay với mã 0, trong khi cửa sổ gỡ thật
   * vẫn đang chờ người dùng; nếu tin mã thoát mà xóa bản ghi thì người dùng bấm Hủy vẫn mất app khỏi Thư viện.
   * Trả true nếu đã gỡ hẳn trong thời gian chờ.
   */
  async choGoXong(
    tenApp: string,
    registryKey?: string,
    displayName?: string,
    giayToiDa = 120,
    msMoiLan = 3000,
  ): Promise<boolean> {
    const hetHan = Date.now() + giayToiDa * 1000;
    for (;;) {
      if (!(await this.kiemTraAppRegistry(tenApp, registryKey, displayName))) return true;
      if (Date.now() + msMoiLan > hetHan) return false;
      await new Promise((resolve) => setTimeout(resolve, msMoiLan));
    }
  }

  /**
   * Chạy tiến trình gỡ cài đặt chính chủ của phần mềm qua UninstallString từ Registry (A4, SEC-01)
   */
  async goCaiDatQuaRegistry(
    tenApp: string,
    uninstallString?: string,
    registryKey?: string,
  ): Promise<boolean> {
    await desktopLogger.ghiLogInfo(
      `Kích hoạt gỡ cài đặt [${tenApp}] qua Registry (Khóa: ${registryKey || 'N/A'})`,
      'CaiDatUngDungService',
    );
    if (this.laMoiTruongTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<boolean>('go_cai_dat_ung_dung_qua_registry', {
        tenApp,
        uninstallString: uninstallString || null,
        registryKey: registryKey || null,
      });
      if (res) {
        await desktopLogger.ghiLogInfo(
          `Gỡ cài đặt thành công cho [${tenApp}]`,
          'CaiDatUngDungService',
        );
      } else {
        await desktopLogger.ghiLogWarn(
          `Tiến trình gỡ cài đặt [${tenApp}] kết thúc không thành công hoặc bị người dùng hủy`,
          'CaiDatUngDungService',
        );
      }
      return res;
    }
    // Dự phòng khi xem trước trên môi trường Web dev
    return true;
  }

  /**
   * Khởi chạy ứng dụng native từ Registry qua DisplayIcon hoặc InstallLocation (L-01)
   */
  async moUngDungTuRegistry(khoaRegistry: string, tenApp?: string): Promise<boolean> {
    if (!khoaRegistry || !khoaRegistry.trim()) {
      return false;
    }
    if (this.laMoiTruongTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('mo_ung_dung_tu_registry', {
        khoaRegistry: khoaRegistry.trim(),
        tenApp: tenApp || null,
      });
      return true;
    }
    // Dự phòng khi xem trước trên môi trường Web dev
    return true;
  }
}

export const caiDatUngDungService = new CaiDatUngDungService();
