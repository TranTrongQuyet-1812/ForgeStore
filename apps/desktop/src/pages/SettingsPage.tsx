import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  FolderArchive,
  FolderOpen,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { deviceService, type DeviceInfo } from '../services/device/device-service';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const { thuMucPortable, datLaiMacDinh, chonThuMucQuaDialog } = useSettingsStore();
  const { maThietBi } = useAuthStore();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchDownloadSize = async () => {
    const isTauri =
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const bytes = await invoke<number>('lay_dung_luong_thu_muc_downloads');
        setDownloadSize(bytes);
      } catch (err) {
        console.warn('Không thể lấy dung lượng thư mục downloads:', err);
      }
    }
  };

  const handleCleanDownloads = async () => {
    const isTauri =
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        setIsCleaning(true);
        const { invoke } = await import('@tauri-apps/api/core');
        const freed = await invoke<number>('don_dep_thu_muc_downloads');
        await fetchDownloadSize();
        if (freed > 0) {
          alert(`Đã dọn dẹp ${formatBytes(freed)} tệp cài đặt tạm thời.`);
        } else {
          alert('Thư mục tải về đã sạch sẽ, không có tệp thừa cần dọn.');
        }
      } catch (err) {
        console.error('Lỗi khi dọn dẹp downloads:', err);
      } finally {
        setIsCleaning(false);
      }
    } else {
      setDownloadSize(0);
      alert('Đã dọn dẹp bộ nhớ tạm (môi trường web test).');
    }
  };

  const formatBytes = (bytes?: number | null): string => {
    if (bytes === null || bytes === undefined) return 'Đang tính...';
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    deviceService.getDeviceInfo().then((info) => {
      setDeviceInfo(info);
    });
    fetchDownloadSize();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full select-none">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted" />
          <span>Cài Đặt Ứng Dụng</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Tùy biến giao diện, cấu hình kết nối Backend và thông tin thiết bị
        </p>
      </div>

      {/* Cấu hình Giao diện / Theme */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <h3 className="text-sm font-semibold font-display text-primary">Chế độ hiển thị (Theme)</h3>
        <p className="text-xs text-secondary">
          Kiến trúc CSS Variables cho phép chuyển đổi mượt mà giữa Dark Mode dịu mắt và Light Mode
          ngà sữa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
              theme === 'dark'
                ? 'bg-surface-elevated border-accent-forge ring-1 ring-accent-forge'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#0B0F19] border border-border flex items-center justify-center text-primary">
              <Moon className="w-5 h-5 text-accent-ai" />
            </div>
            <div>
              <div className="text-xs font-semibold text-primary">Dark Mode (Than chì dịu mắt)</div>
              <div className="text-[11px] text-muted">
                Nền #0B0F19, triệt tiêu #000000 chống lóa
              </div>
            </div>
          </div>

          <div
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
              theme === 'light'
                ? 'bg-surface-elevated border-accent-forge ring-1 ring-accent-forge'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#F8F7F4] border border-border flex items-center justify-center text-slate-800">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs font-semibold text-primary">Light Mode (Trắng ngà sữa)</div>
              <div className="text-[11px] text-muted">Nền #F8F7F4 ấm cúng, không chói mắt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cấu hình Thư mục lưu bản Portable (A1) */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-accent-forge" />
              <span>Thư mục lưu bản Portable (.zip)</span>
            </h3>
            <p className="text-xs text-secondary mt-1">
              Các ứng dụng dạng nén giải nén độc lập và không can thiệp sâu vào hệ thống hay lưu vào
              Thư viện máy.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono text-muted uppercase">Đường dẫn giải nén:</span>
            <div
              className="font-mono text-xs text-primary font-medium truncate mt-0.5"
              title={thuMucPortable || 'Mặc định hệ thống'}
            >
              {thuMucPortable || '%LOCALAPPDATA%\\ForgeStore\\apps (Mặc định hệ thống)'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => chonThuMucQuaDialog()}
              className="btn-tactile px-3 py-1.5 rounded-lg bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Chọn thư mục...</span>
            </button>
            {thuMucPortable && (
              <button
                onClick={() => datLaiMacDinh()}
                className="btn-tactile px-2.5 py-1.5 rounded-lg bg-surface border border-border text-muted hover:text-primary text-xs font-mono flex items-center gap-1"
                title="Khôi phục thư mục mặc định"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mặc định</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dọn dẹp bộ nhớ tạm & Tệp tải về (L-05) */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-accent-forge" />
              <span>Dọn dẹp tệp tải về</span>
            </h3>
            <p className="text-xs text-secondary mt-1">
              Các bộ cài đặt tạm thời được lưu trong thư mục tải về. Bạn có thể dọn dẹp để giải
              phóng dung lượng ổ cứng bất cứ lúc nào.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono text-muted uppercase">
              Dung lượng bộ nhớ tạm:
            </span>
            <div className="font-mono text-xs text-primary font-medium truncate mt-0.5">
              {formatBytes(downloadSize)}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCleanDownloads}
              disabled={isCleaning || downloadSize === 0}
              className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                downloadSize === 0
                  ? 'bg-surface border border-border text-muted cursor-not-allowed'
                  : 'bg-rose-500/90 hover:bg-rose-600 text-white'
              }`}
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
              <span>{isCleaning ? 'Đang dọn dẹp...' : 'Dọn dẹp file tải về'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thông tin phần cứng & Định danh máy (FE-V3-07) */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
        <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
          <Laptop className="w-4 h-4 text-accent-forge" />
          <span>Thông tin thiết bị</span>
        </h3>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-border/50 text-secondary">
            <span>Tên thiết bị:</span>
            <span className="font-mono text-primary font-medium">
              {deviceInfo?.tenThietBi || 'Đang nhận diện...'}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50 text-secondary">
            <span>Nền tảng hệ điều hành:</span>
            <span className="font-mono text-primary font-medium">Windows x64 (Tauri v2)</span>
          </div>
          <div className="flex justify-between py-1.5 text-secondary">
            <span>Machine GUID:</span>
            <span className="font-mono text-muted text-[11px]">
              {deviceInfo?.dinhDanhPhanCung
                ? `${deviceInfo.dinhDanhPhanCung.slice(0, 8)}...${deviceInfo.dinhDanhPhanCung.slice(-4)}`
                : maThietBi
                  ? `${maThietBi.slice(0, 8)}...${maThietBi.slice(-4)}`
                  : 'Chưa định danh'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
