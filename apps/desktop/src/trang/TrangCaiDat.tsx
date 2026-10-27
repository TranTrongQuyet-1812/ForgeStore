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
  Terminal,
  Check,
  FileText,
  Copy,
} from 'lucide-react';
import { useGiaoDienStore } from '../kho-trang-thai/useGiaoDienStore';
import { useCaiDatStore } from '../kho-trang-thai/useCaiDatStore';
import { useXacThucStore } from '../kho-trang-thai/useXacThucStore';
import { toast } from '../kho-trang-thai/useThongBaoStore';
import { thietBiService, type DeviceInfo } from '../dich-vu/thiet-bi/thiet-bi.service';
import { desktopLogger } from '../dich-vu/logger/desktop-logger';

export const TrangCaiDat: React.FC = () => {
  const { theme, setTheme } = useGiaoDienStore();
  const {
    thuMucPortable,
    datLaiMacDinh,
    chonThuMucQuaDialog,
    trinhTerminal,
    setTrinhTerminal,
    thuMucLamViecTerminal,
    datLaiMacDinhTerminal,
    chonThuMucTerminalQuaDialog,
  } = useCaiDatStore();
  const { maThietBi } = useXacThucStore();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isWtAvailable, setIsWtAvailable] = useState<boolean>(true);
  const [logFilePath, setLogFilePath] = useState<string>('');

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
          toast.success(`Đã dọn dẹp ${formatBytes(freed)} tệp cài đặt tạm thời.`);
        } else {
          toast.info('Thư mục tải về đã sạch sẽ, không có tệp thừa cần dọn.');
        }
      } catch (err) {
        console.error('Lỗi khi dọn dẹp downloads:', err);
      } finally {
        setIsCleaning(false);
      }
    } else {
      setDownloadSize(0);
      toast.success('Đã dọn dẹp bộ nhớ tạm thành công.');
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
    thietBiService.getDeviceInfo().then((info) => {
      setDeviceInfo(info);
    });
    fetchDownloadSize();

    const isTauri =
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => {
          invoke<boolean>('kiem_tra_windows_terminal_kha_dung')
            .then((res) => setIsWtAvailable(Boolean(res)))
            .catch(() => setIsWtAvailable(false));
        })
        .catch(() => setIsWtAvailable(false));
    }

    desktopLogger.layDuongDanLog().then((path) => {
      // Chỉ hiện thư mục chứa nhật ký (khớp với nút "Mở thư mục"), bỏ tên tệp ở cuối
      setLogFilePath(path.replace(/[\\/][^\\/]+$/, ''));
    });
  }, []);

  const handleOpenLogDirectory = async () => {
    try {
      await desktopLogger.moThuMucLog();
      toast.success('Đã mở thư mục chứa nhật ký hoạt động.');
    } catch (err) {
      toast.error('Không thể mở thư mục nhật ký: ' + err);
    }
  };

  const handleCopyLogPath = async () => {
    if (!logFilePath) return;
    try {
      await navigator.clipboard.writeText(logFilePath);
      toast.success('Đã sao chép đường dẫn thư mục nhật ký vào bộ nhớ tạm.');
    } catch {
      toast.info(`Đường dẫn nhật ký: ${logFilePath}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full select-none">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted" />
          <span>Cài Đặt Ứng Dụng</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Chọn giao diện, thư mục lưu và xem thông tin máy của bạn.
        </p>
      </div>

      {/* Cấu hình Giao diện / Theme */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <h3 className="text-sm font-semibold font-display text-primary">Giao diện</h3>
        <p className="text-xs text-secondary">Chọn giao diện tối hoặc sáng cho dễ nhìn.</p>

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
              <div className="text-xs font-semibold text-primary">Giao diện tối</div>
              <div className="text-[11px] text-muted">Nền tối, dịu mắt</div>
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
            <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] border border-border flex items-center justify-center text-slate-800">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs font-semibold text-primary">Giao diện sáng</div>
              <div className="text-[11px] text-muted">Nền sáng ấm, đỡ chói mắt</div>
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

      {/* Cấu hình Trình Dòng Lệnh & Terminal CLI (P3B-18 & D-27) */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-forge" />
            <span>Trình dòng lệnh (Terminal cho ứng dụng CLI)</span>
          </h3>
          <p className="text-xs text-secondary mt-1">
            Lựa chọn ứng dụng Terminal và thư mục làm việc mặc định khi nhấn "Mở Terminal" tại trang
            chi tiết ứng dụng.
          </p>
        </div>

        {/* 3 Tùy chọn Terminal */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setTrinhTerminal('windows-terminal')}
            className={`p-3.5 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
              trinhTerminal === 'windows-terminal'
                ? 'bg-surface-elevated border-accent-forge ring-1 ring-accent-forge'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-primary">
                  <Terminal className="w-4 h-4 text-accent-forge" />
                </div>
                <span className="text-xs font-semibold text-primary">Windows Terminal</span>
              </div>
              {trinhTerminal === 'windows-terminal' && (
                <Check className="w-4 h-4 text-accent-forge" />
              )}
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Mở <code>wt.exe</code> đa nhiệm hiện đại (khuyên dùng cho Windows 10/11).
              {!isWtAvailable && (
                <span className="text-amber-400 block mt-1 font-mono text-[10px]">
                  (Chưa phát hiện wt.exe - sẽ tự fallback sang PowerShell)
                </span>
              )}
            </p>
          </div>

          <div
            onClick={() => setTrinhTerminal('powershell')}
            className={`p-3.5 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
              trinhTerminal === 'powershell'
                ? 'bg-surface-elevated border-accent-forge ring-1 ring-accent-forge'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-sky-400 font-mono text-xs font-bold">
                  PS
                </div>
                <span className="text-xs font-semibold text-primary">PowerShell</span>
              </div>
              {trinhTerminal === 'powershell' && <Check className="w-4 h-4 text-accent-forge" />}
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Mở cửa sổ <code>powershell.exe</code> độc lập chuẩn mực hệ thống.
            </p>
          </div>

          <div
            onClick={() => setTrinhTerminal('cmd')}
            className={`p-3.5 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
              trinhTerminal === 'cmd'
                ? 'bg-surface-elevated border-accent-forge ring-1 ring-accent-forge'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-amber-400 font-mono text-xs font-bold">
                  C:&gt;
                </div>
                <span className="text-xs font-semibold text-primary">Command Prompt</span>
              </div>
              {trinhTerminal === 'cmd' && <Check className="w-4 h-4 text-accent-forge" />}
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Mở cửa sổ <code>cmd.exe</code> cổ điển nhẹ nhàng và tương thích cao.
            </p>
          </div>
        </div>

        {/* Thư mục làm việc của Terminal */}
        <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono text-muted uppercase">
              Thư mục làm việc mặc định:
            </span>
            <div
              className="font-mono text-xs text-primary font-medium truncate mt-0.5"
              title={thuMucLamViecTerminal || '%USERPROFILE% (Thư mục người dùng cá nhân)'}
            >
              {thuMucLamViecTerminal || '%USERPROFILE% (Thư mục người dùng cá nhân)'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => chonThuMucTerminalQuaDialog()}
              className="btn-tactile px-3 py-1.5 rounded-lg bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Chọn thư mục...</span>
            </button>
            {thuMucLamViecTerminal && (
              <button
                onClick={() => datLaiMacDinhTerminal()}
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

      {/* Nhật ký hoạt động hệ thống (P3B-19 & D-27) */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-forge" />
              <span>Nhật ký hoạt động</span>
            </h3>
            <p className="text-xs text-secondary mt-1">
              Ghi lại việc tải về, kiểm tra tệp, cài đặt, gỡ ứng dụng và lỗi kết nối để dễ tìm
              nguyên nhân khi có sự cố. Thông tin đăng nhập và dữ liệu nhạy cảm được tự động che đi.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono text-muted uppercase">Thư mục nhật ký:</span>
            <div
              className="font-mono text-xs text-primary font-medium truncate mt-0.5 select-all"
              title={logFilePath}
            >
              {logFilePath || '%LOCALAPPDATA%\\forgestore-desktop\\logs'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLogPath}
              className="btn-tactile px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-xs font-semibold text-secondary hover:text-primary flex items-center gap-1.5 shadow-sm transition-all"
              title="Sao chép đường dẫn thư mục nhật ký"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép đường dẫn</span>
            </button>
            <button
              onClick={handleOpenLogDirectory}
              className="btn-tactile px-3 py-1.5 rounded-lg bg-accent-forge/10 hover:bg-accent-forge/20 border border-accent-forge/30 text-accent-forge text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Mở thư mục nhật ký</span>
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
            <span className="font-mono text-primary font-medium">Windows 64-bit</span>
          </div>
          <div className="flex justify-between py-1.5 text-secondary">
            <span>Mã định danh máy:</span>
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
