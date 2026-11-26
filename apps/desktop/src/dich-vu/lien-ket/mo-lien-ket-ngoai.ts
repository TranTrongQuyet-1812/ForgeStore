import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Mở liên kết bên ngoài bằng trình duyệt mặc định của hệ thống qua Tauri opener
 * để liên kết không bị mở kẹt trong WebView; tự lùi về `window.open` khi chạy Web Preview.
 */
export async function moLienKetNgoai(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  try {
    await openUrl(url);
  } catch {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
