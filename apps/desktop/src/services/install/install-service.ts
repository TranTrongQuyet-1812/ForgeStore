import type {
  KetQuaCaiDatRust,
  KetQuaTaiRust,
  ThamSoCaiDat,
  TienDoTaiFrontend,
  TienDoTaiPayload,
  ThongTinUngDungRegistry,
} from './install-types';

/**
 * Service điều phối động cơ tải nhị phân và cài đặt Windows (P3-08..P3-11)
 */
export class InstallService {
  private isTauriEnv(): boolean {
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

    if (this.isTauriEnv()) {
      return this.thucThiTauriNative(params, idTai, onProgress);
    } else {
      return this.giaLapWebDev(params, idTai, onProgress);
    }
  }

  /**
   * Hủy tiến trình tải tệp hiện tại
   */
  async huyTai(idTai: string): Promise<boolean> {
    if (this.isTauriEnv()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('huy_tai_tep', { idTai });
      } catch (err) {
        console.error('Lỗi khi gọi huy_tai_tep native:', err);
        return false;
      }
    } else {
      // Mock Web dev cancellation
      return true;
    }
  }

  /**
   * Mở ứng dụng đã cài đặt qua đường dẫn thực thi (.exe)
   */
  async moUngDung(duongDanThucThi: string, thuMucChoPhep?: string): Promise<void> {
    if (this.isTauriEnv()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<void>('mo_ung_dung', {
        duongDanThucThi,
        thuMucChoPhep: thuMucChoPhep || null,
      });
    } else {
      console.info(`[WebDev Preview] Giả lập mở ứng dụng tại: ${duongDanThucThi}`);
    }
  }

  /**
   * Mở thư mục chứa bản portable trong File Explorer (A1, TC-09, SEC-02)
   */
  async moThuMuc(duongDanThuMuc: string): Promise<void> {
    if (this.isTauriEnv()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mo_thu_muc', { duongDan: duongDanThuMuc });
      } catch (err) {
        console.warn('Lỗi khi mở thư mục qua Tauri command, thử lại bằng revealItemInDir:', err);
        try {
          const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
          await revealItemInDir(duongDanThuMuc);
        } catch (revealErr) {
          console.error('Không thể mở thư mục qua File Explorer:', revealErr);
        }
      }
    } else {
      console.info(`[WebDev Preview] Giả lập mở thư mục tại: ${duongDanThuMuc}`);
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
    const ketQuaTai = await invoke<KetQuaTaiRust>('tai_tep_cai_dat', {
      idTai,
      url: params.url,
      tenTep: params.tenTep,
      sha256DuKien: params.sha256DuKien || null,
      onProgress: channel,
    });

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
    const ketQuaCaiDat = await invoke<KetQuaCaiDatRust>('cai_dat_ung_dung', {
      duongDanTep: ketQuaTai.duong_dan_tep,
      loaiTep: params.loaiTep,
      tenApp: params.tenApp,
      thuMucDich: params.thuMucDich || null,
    });

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
      thongDiep: 'Đang xác minh mã băm SHA-256...',
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
    if (this.isTauriEnv()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<ThongTinUngDungRegistry | null>('kiem_tra_ung_dung_da_cai_registry', {
          tenApp,
          registryKey: registryKey || null,
          displayName: displayName || null,
        });
      } catch (err) {
        console.warn(`[InstallService] Lỗi khi kiểm tra registry cho ${tenApp}:`, err);
        return null;
      }
    }
    return null;
  }

  /**
   * Chạy tiến trình gỡ cài đặt chính chủ của phần mềm qua UninstallString từ Registry (A4, SEC-01)
   */
  async goCaiDatQuaRegistry(
    tenApp: string,
    uninstallString?: string,
    registryKey?: string,
  ): Promise<boolean> {
    if (this.isTauriEnv()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('go_cai_dat_ung_dung_qua_registry', {
        tenApp,
        uninstallString: uninstallString || null,
        registryKey: registryKey || null,
      });
    }
    // Web dev preview fallback
    return true;
  }
}

export const installService = new InstallService();
