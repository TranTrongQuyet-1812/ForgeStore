import { beforeEach, describe, expect, it, vi } from 'vitest';

const check = vi.fn();
const confirmDialog = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock('@tauri-apps/plugin-updater', () => ({ check }));
vi.mock('../../kho-trang-thai/useHopThoaiStore', () => ({ confirmDialog }));
vi.mock('../../kho-trang-thai/useThongBaoStore', () => ({ toast }));
vi.mock('../logger/desktop-logger', () => ({ desktopLogger: { ghiLogWarn: vi.fn() } }));
vi.mock('../xac-thuc/luu-tru-token', () => ({ isTauri: () => true }));

// Nạp lại module mỗi test để trạng thái "đã hỏi phiên bản" và cờ đang chạy không dính giữa các test
async function nap() {
  vi.resetModules();
  return import('./tu-cap-nhat.service');
}

function banMoi(version: string) {
  return { version, downloadAndInstall: vi.fn().mockResolvedValue(undefined) };
}

describe('kiemTraVaHoiCapNhat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bấm tay mà chưa có bản mới thì báo đang dùng bản mới nhất', async () => {
    check.mockResolvedValue(null);
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(true);

    expect(toast.success).toHaveBeenCalledOnce();
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it('chạy nền mà chưa có bản mới thì im lặng', async () => {
    check.mockResolvedValue(null);
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(false);

    expect(toast.success).not.toHaveBeenCalled();
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it('có bản mới và người dùng đồng ý thì tải và cài', async () => {
    const ban = banMoi('0.2.0');
    check.mockResolvedValue(ban);
    confirmDialog.mockResolvedValue(true);
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(false);

    expect(ban.downloadAndInstall).toHaveBeenCalledOnce();
  });

  it('người dùng chọn "Để sau" thì không cài, và chạy nền không hỏi lại cùng phiên bản', async () => {
    const ban = banMoi('0.2.0');
    check.mockResolvedValue(ban);
    confirmDialog.mockResolvedValue(false);
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(false);
    await kiemTraVaHoiCapNhat(false);

    expect(ban.downloadAndInstall).not.toHaveBeenCalled();
    expect(confirmDialog).toHaveBeenCalledOnce();
  });

  it('bấm tay thì vẫn hỏi lại dù trước đó đã chọn "Để sau"', async () => {
    check.mockResolvedValue(banMoi('0.2.0'));
    confirmDialog.mockResolvedValue(false);
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(false);
    await kiemTraVaHoiCapNhat(true);

    expect(confirmDialog).toHaveBeenCalledTimes(2);
  });

  it('lỗi mạng: bấm tay thì báo lỗi, chạy nền thì im lặng', async () => {
    check.mockRejectedValue(new Error('network'));
    const { kiemTraVaHoiCapNhat } = await nap();

    await kiemTraVaHoiCapNhat(false);
    expect(toast.error).not.toHaveBeenCalled();

    await kiemTraVaHoiCapNhat(true);
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
