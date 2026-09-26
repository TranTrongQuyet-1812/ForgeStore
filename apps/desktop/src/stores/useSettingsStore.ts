import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  /** Thư mục lưu trữ các ứng dụng portable (.zip), nếu rỗng thì dùng mặc định */
  thuMucPortable: string;

  /** Cập nhật thư mục lưu bản portable */
  setThuMucPortable: (duongDan: string) => void;

  /** Đặt lại thư mục portable về mặc định của hệ thống */
  datLaiMacDinh: () => void;

  /** Kích hoạt hộp thoại hệ thống để người dùng chọn thư mục */
  chonThuMucQuaDialog: () => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      thuMucPortable: '',

      setThuMucPortable: (duongDan: string) => {
        set({ thuMucPortable: duongDan.trim() });
      },

      datLaiMacDinh: () => {
        set({ thuMucPortable: '' });
      },

      chonThuMucQuaDialog: async () => {
        try {
          const isTauri =
            typeof window !== 'undefined' &&
            ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

          if (isTauri) {
            const { invoke } = await import('@tauri-apps/api/core');
            const hienTai = get().thuMucPortable || undefined;
            const res = await invoke<string | null>('chon_thu_muc', {
              thuMucMacDinh: hienTai,
            });

            if (res) {
              set({ thuMucPortable: res });
              return res;
            }
            return null;
          } else {
            // Giả lập trên Web dev
            const mockPath = 'D:\\ForgeStore_PortableApps';
            set({ thuMucPortable: mockPath });
            return mockPath;
          }
        } catch (err) {
          console.error('[useSettingsStore] Lỗi khi mở hộp thoại chọn thư mục:', err);
          return null;
        }
      },
    }),
    {
      name: 'forgestore_settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
