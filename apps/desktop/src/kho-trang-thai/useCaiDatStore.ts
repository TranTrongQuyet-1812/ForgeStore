import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from './useThongBaoStore';

export type LoaiTerminal = 'windows-terminal' | 'powershell' | 'cmd';

interface SettingsState {
  /** Thư mục lưu trữ các ứng dụng portable (.zip), nếu rỗng thì dùng mặc định */
  thuMucPortable: string;

  /** Trình dòng lệnh (Terminal) ưa thích: windows-terminal | powershell | cmd (P3B-18 & D-27) */
  trinhTerminal: LoaiTerminal;

  /** Thư mục làm việc mặc định của Terminal, nếu rỗng thì dùng thư mục người dùng %USERPROFILE% (D-27) */
  thuMucLamViecTerminal: string;

  /** Cập nhật thư mục lưu bản portable */
  setThuMucPortable: (duongDan: string) => void;

  /** Đặt lại thư mục portable về mặc định của hệ thống */
  datLaiMacDinh: () => void;

  /** Kích hoạt hộp thoại hệ thống để người dùng chọn thư mục portable */
  chonThuMucQuaDialog: () => Promise<string | null>;

  /** Cập nhật trình dòng lệnh ưa thích (D-27) */
  setTrinhTerminal: (trinh: LoaiTerminal) => void;

  /** Cập nhật thư mục làm việc của Terminal (D-27) */
  setThuMucLamViecTerminal: (duongDan: string) => void;

  /** Đặt lại thư mục làm việc của Terminal về mặc định (%USERPROFILE%) */
  datLaiMacDinhTerminal: () => void;

  /** Kích hoạt hộp thoại hệ thống để người dùng chọn thư mục làm việc cho Terminal */
  chonThuMucTerminalQuaDialog: () => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      thuMucPortable: '',
      trinhTerminal: 'windows-terminal',
      thuMucLamViecTerminal: '',

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
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          // L-07: Hiển thị lý do từ chối thư mục hệ thống hoặc không có quyền ghi, giữ nguyên giá trị cũ
          toast.error(errMsg || 'Thư mục không hợp lệ hoặc không có quyền ghi.');
          console.error('[useSettingsStore] Lỗi khi mở hộp thoại chọn thư mục:', err);
          return null;
        }
      },

      setTrinhTerminal: (trinh: LoaiTerminal) => {
        set({ trinhTerminal: trinh });
      },

      setThuMucLamViecTerminal: (duongDan: string) => {
        set({ thuMucLamViecTerminal: duongDan.trim() });
      },

      datLaiMacDinhTerminal: () => {
        set({ thuMucLamViecTerminal: '' });
      },

      chonThuMucTerminalQuaDialog: async () => {
        try {
          const isTauri =
            typeof window !== 'undefined' &&
            ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

          if (isTauri) {
            const { invoke } = await import('@tauri-apps/api/core');
            const hienTai = get().thuMucLamViecTerminal || undefined;
            const res = await invoke<string | null>('chon_thu_muc', {
              thuMucMacDinh: hienTai,
            });

            if (res) {
              set({ thuMucLamViecTerminal: res });
              return res;
            }
            return null;
          } else {
            const mockPath = 'C:\\Users\\Developer\\Projects';
            set({ thuMucLamViecTerminal: mockPath });
            return mockPath;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          toast.error(errMsg || 'Thư mục không hợp lệ hoặc không có quyền truy cập.');
          console.error('[useSettingsStore] Lỗi khi chọn thư mục làm việc Terminal:', err);
          return null;
        }
      },
    }),
    {
      name: 'forgestore_settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: unknown, _version: number) => {
        const state =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Partial<SettingsState>)
            : {};
        return {
          thuMucPortable: state.thuMucPortable || '',
          trinhTerminal: state.trinhTerminal || 'windows-terminal',
          thuMucLamViecTerminal: state.thuMucLamViecTerminal || '',
        };
      },
    },
  ),
);
