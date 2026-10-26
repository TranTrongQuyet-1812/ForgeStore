/**
 * Dịch vụ thu thập thông tin phần cứng thiết bị cho Desktop Client (P3-04.5)
 *
 * Quy chuẩn:
 * 1. Đọc MachineGuid từ Windows Registry: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 * 2. Băm SHA-256 mã hex thường (64 ký tự) trước khi gửi lên Backend.
 * 3. Tên thiết bị: Tên máy trạm Windows (COMPUTERNAME).
 * 4. Loại thiết bị: MAY_TINH_WINDOWS.
 */

import { LoaiThietBi } from '@forgestore/types';
import { isTauri } from '../xac-thuc/luu-tru-token';

export interface DeviceInfo {
  dinhDanhPhanCung: string;
  tenThietBi: string;
  loaiThietBi: LoaiThietBi;
}

interface NativeDeviceInfo {
  dinh_danh_phan_cung: string;
  ten_thiet_bi: string;
  loai_thiet_bi: string;
}

const DEV_FALLBACK_DEVICE_ID = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const thietBiService = {
  /**
   * Lấy thông tin thiết bị máy trạm hiện tại
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const nativeInfo = await invoke<NativeDeviceInfo>('lay_thong_tin_thiet_bi');
        return {
          dinhDanhPhanCung: nativeInfo.dinh_danh_phan_cung,
          tenThietBi: nativeInfo.ten_thiet_bi,
          loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
        };
      } catch (err) {
        console.error(
          '[DeviceService] Không thể đọc thông tin thiết bị native từ Windows Registry:',
          err,
        );
      }
    }

    // Web Dev Fallback
    return {
      dinhDanhPhanCung: DEV_FALLBACK_DEVICE_ID,
      tenThietBi: 'ForgeStore Windows Dev PC',
      loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
    };
  },
};
