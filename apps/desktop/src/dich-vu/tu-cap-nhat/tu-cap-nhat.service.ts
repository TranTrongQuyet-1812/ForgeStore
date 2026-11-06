import { toast } from '../../kho-trang-thai/useThongBaoStore';
import { confirmDialog } from '../../kho-trang-thai/useHopThoaiStore';
import { desktopLogger } from '../logger/desktop-logger';
import { isTauri } from '../xac-thuc/luu-tru-token';

// Đợi app mở xong rồi mới kiểm, để việc kiểm không tranh mạng với lúc tải danh sách ứng dụng (D-37)
const CHO_LAN_DAU_MS = 15_000;
const CHU_KY_KIEM_MS = 6 * 60 * 60 * 1000;

let dangChay = false;
// Mỗi phiên bản chỉ hỏi một lần trong một lần mở app, để bấm "Để sau" rồi không bị hỏi lại mỗi 6 giờ
const daHoiPhienBan = new Set<string>();

export async function layPhienBanHienTai(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return null;
  }
}

/**
 * Kiểm tra bản ForgeStore mới và hỏi người dùng trước khi cài (không cài ngầm).
 * `thuCong` = người dùng tự bấm nút: luôn báo kết quả. Chạy nền thì im lặng khi không có bản mới hoặc lỗi mạng.
 */
export async function kiemTraVaHoiCapNhat(thuCong: boolean): Promise<void> {
  if (!isTauri() || dangChay) return;
  dangChay = true;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const banMoi = await check();

    if (!banMoi) {
      if (thuCong) toast.success('Bạn đang dùng bản ForgeStore mới nhất.');
      return;
    }
    if (!thuCong && daHoiPhienBan.has(banMoi.version)) return;
    daHoiPhienBan.add(banMoi.version);

    const dongY = await confirmDialog({
      title: 'Có bản ForgeStore mới',
      description: `Phiên bản ${banMoi.version} đã sẵn sàng. Cập nhật ngay? ForgeStore sẽ tự đóng và mở lại sau khi cài xong.`,
      confirmLabel: 'Cập nhật ngay',
      cancelLabel: 'Để sau',
      variant: 'primary',
      icon: 'info',
    });
    if (!dongY) return;

    toast.info('Đang tải bản mới, vui lòng đợi một chút...');
    await banMoi.downloadAndInstall();
  } catch (err) {
    void desktopLogger.ghiLogWarn(
      `Kiểm tra cập nhật ForgeStore thất bại: ${(err as Error).message}`,
      'TuCapNhat',
    );
    if (thuCong) {
      toast.error('Không kiểm tra được bản mới. Hãy kiểm tra mạng rồi thử lại.');
    }
  } finally {
    dangChay = false;
  }
}

/** Bật lịch kiểm tự động (khi mở app, rồi mỗi 6 giờ). Trả về hàm tắt lịch. */
export function khoiDongTuCapNhat(): () => void {
  if (!isTauri()) return () => undefined;
  const lanDau = setTimeout(() => void kiemTraVaHoiCapNhat(false), CHO_LAN_DAU_MS);
  const dinhKy = setInterval(() => void kiemTraVaHoiCapNhat(false), CHU_KY_KIEM_MS);
  return () => {
    clearTimeout(lanDau);
    clearInterval(dinhKy);
  };
}
