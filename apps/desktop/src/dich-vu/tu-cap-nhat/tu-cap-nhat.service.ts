import { toast } from '../../kho-trang-thai/useThongBaoStore';
import { confirmDialog } from '../../kho-trang-thai/useHopThoaiStore';
import { useTuCapNhatStore } from '../../kho-trang-thai/useTuCapNhatStore';
import { desktopLogger } from '../logger/desktop-logger';
import { isTauri } from '../xac-thuc/luu-tru-token';

// Đợi app mở xong rồi mới kiểm, để việc kiểm không tranh mạng với lúc tải danh sách ứng dụng (D-37)
const CHO_LAN_DAU_MS = 15_000;
const CHU_KY_KIEM_MS = 6 * 60 * 60 * 1000;

let dangKiem = false;

export async function layPhienBanHienTai(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return null;
  }
}

/** Hỏi GitHub có bản mới không rồi ghi vào kho trạng thái để chỉ báo ở thanh bên tự hiện. */
async function kiemTraBanMoi() {
  const { check } = await import('@tauri-apps/plugin-updater');
  const ban = await check();
  useTuCapNhatStore.getState().datBanMoi(ban);
  return ban;
}

/** Kiểm nền (khi mở app và mỗi 6 giờ): không bật hộp thoại, không báo lỗi, chỉ cập nhật chỉ báo. */
export async function kiemTraNen(): Promise<void> {
  if (!isTauri() || dangKiem) return;
  dangKiem = true;
  try {
    await kiemTraBanMoi();
  } catch (err) {
    void desktopLogger.ghiLogWarn(
      `Kiểm tra cập nhật ForgeStore thất bại: ${(err as Error).message}`,
      'TuCapNhat',
    );
  } finally {
    dangKiem = false;
  }
}

/** Người dùng bấm "Kiểm tra cập nhật" ở Cài đặt: luôn báo kết quả, có bản mới thì hỏi trước khi cài. */
export async function kiemTraThuCong(): Promise<void> {
  if (!isTauri() || dangKiem) return;
  dangKiem = true;
  let phienBanMoi: string | null = null;
  try {
    phienBanMoi = (await kiemTraBanMoi())?.version ?? null;
    if (!phienBanMoi) toast.success('Bạn đang dùng bản ForgeStore mới nhất.');
  } catch (err) {
    void desktopLogger.ghiLogWarn(
      `Kiểm tra cập nhật ForgeStore thất bại: ${(err as Error).message}`,
      'TuCapNhat',
    );
    toast.error('Không kiểm tra được bản mới. Hãy kiểm tra mạng rồi thử lại.');
  } finally {
    dangKiem = false;
  }
  if (!phienBanMoi) return;

  const dongY = await confirmDialog({
    title: 'Có bản ForgeStore mới',
    description: `Phiên bản ${phienBanMoi} đã sẵn sàng. Cập nhật ngay? ForgeStore sẽ tự đóng và mở lại sau khi cài xong.`,
    confirmLabel: 'Cập nhật ngay',
    cancelLabel: 'Để sau',
    variant: 'primary',
    icon: 'info',
  });
  if (dongY) await caiBanMoi();
}

/** Tải và cài bản mới (người dùng đã bấm đồng ý). Trên Windows app tự đóng khi bộ cài bắt đầu chạy. */
export async function caiBanMoi(): Promise<void> {
  const kho = useTuCapNhatStore.getState();
  const ban = kho.banMoi;
  if (!ban || kho.dangTai) return;

  kho.batDauTai();
  let tongByte = 0;
  let daTai = 0;
  try {
    await ban.downloadAndInstall((suKien) => {
      if (suKien.event === 'Started') {
        tongByte = suKien.data.contentLength ?? 0;
      } else if (suKien.event === 'Progress') {
        daTai += suKien.data.chunkLength;
        if (tongByte > 0) {
          useTuCapNhatStore
            .getState()
            .datTienDo(Math.min(100, Math.round((daTai / tongByte) * 100)));
        }
      }
    });
  } catch (err) {
    void desktopLogger.ghiLogWarn(
      `Cài bản ForgeStore mới thất bại: ${(err as Error).message}`,
      'TuCapNhat',
    );
    toast.error('Không cập nhật được. Hãy kiểm tra mạng rồi thử lại.');
    useTuCapNhatStore.getState().ketThucTai();
  }
}

/** Bật lịch kiểm tự động (khi mở app, rồi mỗi 6 giờ). Trả về hàm tắt lịch. */
export function khoiDongTuCapNhat(): () => void {
  if (!isTauri()) return () => undefined;
  const lanDau = setTimeout(() => void kiemTraNen(), CHO_LAN_DAU_MS);
  const dinhKy = setInterval(() => void kiemTraNen(), CHU_KY_KIEM_MS);
  return () => {
    clearTimeout(lanDau);
    clearInterval(dinhKy);
  };
}
