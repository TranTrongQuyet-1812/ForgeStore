import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTuCapNhatStore } from '../../kho-trang-thai/useTuCapNhatStore';

const { check, confirmDialog, toast } = vi.hoisted(() => ({
  check: vi.fn(),
  confirmDialog: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@tauri-apps/plugin-updater', () => ({ check }));
vi.mock('../../kho-trang-thai/useHopThoaiStore', () => ({ confirmDialog }));
vi.mock('../../kho-trang-thai/useThongBaoStore', () => ({ toast }));
vi.mock('../logger/desktop-logger', () => ({ desktopLogger: { ghiLogWarn: vi.fn() } }));
vi.mock('../xac-thuc/luu-tru-token', () => ({ isTauri: () => true }));

import { caiBanMoi, kiemTraNen, kiemTraThuCong } from './tu-cap-nhat.service';

type SuKien =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

function banMoi(version: string, suKien: SuKien[] = []) {
  return {
    version,
    downloadAndInstall: vi.fn(async (khiCoSuKien?: (e: SuKien) => void) => {
      suKien.forEach((e) => khiCoSuKien?.(e));
    }),
  };
}

describe('tự cập nhật ForgeStore (D-37)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTuCapNhatStore.setState({ banMoi: null, dangTai: false, tienDo: null });
  });

  describe('kiemTraNen (chạy nền)', () => {
    it('có bản mới thì chỉ ghi vào kho để chỉ báo hiện, không bật hộp thoại hay thông báo', async () => {
      check.mockResolvedValue(banMoi('0.2.0'));

      await kiemTraNen();

      expect(useTuCapNhatStore.getState().banMoi?.version).toBe('0.2.0');
      expect(confirmDialog).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('chưa có bản mới thì giữ kho trống và im lặng', async () => {
      check.mockResolvedValue(null);

      await kiemTraNen();

      expect(useTuCapNhatStore.getState().banMoi).toBeNull();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('lỗi mạng thì im lặng và không làm mất chỉ báo bản mới đã có', async () => {
      useTuCapNhatStore.setState({ banMoi: banMoi('0.2.0') as never });
      check.mockRejectedValue(new Error('network'));

      await kiemTraNen();

      expect(toast.error).not.toHaveBeenCalled();
      expect(useTuCapNhatStore.getState().banMoi?.version).toBe('0.2.0');
    });
  });

  describe('kiemTraThuCong (bấm ở Cài đặt)', () => {
    it('chưa có bản mới thì báo đang dùng bản mới nhất', async () => {
      check.mockResolvedValue(null);

      await kiemTraThuCong();

      expect(toast.success).toHaveBeenCalledOnce();
      expect(confirmDialog).not.toHaveBeenCalled();
    });

    it('có bản mới và người dùng đồng ý thì tải và cài', async () => {
      const ban = banMoi('0.2.0');
      check.mockResolvedValue(ban);
      confirmDialog.mockResolvedValue(true);

      await kiemTraThuCong();

      expect(ban.downloadAndInstall).toHaveBeenCalledOnce();
    });

    it('người dùng chọn "Để sau" thì không cài, chỉ báo vẫn còn ở thanh bên', async () => {
      const ban = banMoi('0.2.0');
      check.mockResolvedValue(ban);
      confirmDialog.mockResolvedValue(false);

      await kiemTraThuCong();

      expect(ban.downloadAndInstall).not.toHaveBeenCalled();
      expect(useTuCapNhatStore.getState().banMoi?.version).toBe('0.2.0');
    });

    it('lỗi mạng thì báo lỗi cho người dùng', async () => {
      check.mockRejectedValue(new Error('network'));

      await kiemTraThuCong();

      expect(toast.error).toHaveBeenCalledOnce();
    });
  });

  describe('caiBanMoi (bấm vào chỉ báo)', () => {
    it('cài ngay không hỏi lại và cập nhật phần trăm theo dung lượng đã tải', async () => {
      const phanTram: Array<number | null> = [];
      const ban = banMoi('0.2.0', [
        { event: 'Started', data: { contentLength: 200 } },
        { event: 'Progress', data: { chunkLength: 50 } },
        { event: 'Progress', data: { chunkLength: 100 } },
        { event: 'Finished' },
      ]);
      useTuCapNhatStore.setState({ banMoi: ban as never });
      useTuCapNhatStore.subscribe((s) => phanTram.push(s.tienDo));

      await caiBanMoi();

      expect(confirmDialog).not.toHaveBeenCalled();
      expect(phanTram).toContain(25);
      expect(phanTram).toContain(75);
      expect(useTuCapNhatStore.getState().dangTai).toBe(true);
    });

    it('thất bại thì mở lại nút và báo lỗi, người dùng bấm thử lại được', async () => {
      const ban = banMoi('0.2.0');
      ban.downloadAndInstall.mockRejectedValue(new Error('disk full'));
      useTuCapNhatStore.setState({ banMoi: ban as never });

      await caiBanMoi();

      expect(toast.error).toHaveBeenCalledOnce();
      expect(useTuCapNhatStore.getState().dangTai).toBe(false);
    });

    it('đang tải thì bấm thêm không tải lần hai', async () => {
      const ban = banMoi('0.2.0');
      useTuCapNhatStore.setState({ banMoi: ban as never, dangTai: true });

      await caiBanMoi();

      expect(ban.downloadAndInstall).not.toHaveBeenCalled();
    });

    it('chưa có bản mới thì không làm gì', async () => {
      await caiBanMoi();

      expect(useTuCapNhatStore.getState().dangTai).toBe(false);
    });
  });
});
