import React, { useState, useEffect } from 'react';
import { Search, Minus, Square, X, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useNavStore } from '../../stores/useNavStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/auth/auth-service';
import { isTauri } from '../../services/auth/token-storage';

const TAB_TITLES: Record<string, string> = {
  explore: 'Khám phá',
  detail: 'Chi tiết ứng dụng',
  library: 'Thư viện máy',
  favorites: 'Kho yêu thích',
  categories: 'Danh mục',
  settings: 'Cài đặt',
};

export const Titlebar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { currentTab, setSearchModalOpen } = useNavStore();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // Xử lý điều khiển cửa sổ Tauri an toàn
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {
      console.info('Minimize window (browser preview mode)');
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch {
      setIsMaximized(!isMaximized);
      console.info('Toggle maximize window (browser preview mode)');
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {
      console.info('Close window (browser preview mode)');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchModalOpen]);

  return (
    <header
      data-tauri-drag-region
      className="h-14 min-h-[56px] w-full bg-surface border-b border-border/80 flex items-center justify-between px-3 select-none z-50 transition-colors duration-200 shadow-sm"
    >
      {/* Vùng bên trái: Logo & Breadcrumbs thanh lịch */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-surface-elevated/80 border border-border/80 flex items-center justify-center shadow-xs overflow-hidden p-1">
          <img src="/logo.png" alt="ForgeStore Logo" className="w-full h-full object-contain" />
        </div>
        <div data-tauri-drag-region className="flex items-center gap-1.5 text-xs">
          <span className="font-display font-bold text-primary tracking-wide">ForgeStore</span>
          <span className="text-muted">/</span>
          <span className="text-secondary font-medium">{TAB_TITLES[currentTab] || 'Khám phá'}</span>
          {!isTauri() && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold tracking-wide">
              Chế độ giả lập Web
            </span>
          )}
        </div>
      </div>

      {/* Vùng ở giữa: Command Palette Search Bar (Raycast / Linear style) */}
      <div data-tauri-drag-region className="flex-1 max-w-md mx-4">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="w-full h-8 px-3 rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated border border-border hover:border-border-focus flex items-center justify-between text-secondary hover:text-primary transition-all duration-150 text-xs group shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted group-hover:text-accent-forge transition-colors" />
            <span className="truncate">Tìm theo tên app, ý định AI hoặc dán link repo...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-canvas border border-border rounded text-muted group-hover:text-primary shadow-xs">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Vùng bên phải: Nút theme, đăng nhập & 3 nút điều khiển frameless */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang Trắng ngà sữa' : 'Chuyển sang Dark than chì'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-elevated transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-elevated border border-border text-xs shadow-xs">
              {user.duongDanAvatar ? (
                <img
                  src={user.duongDanAvatar}
                  alt={user.tenDangNhap}
                  className="w-4 h-4 rounded-full object-cover border border-border/50"
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-muted" />
              )}
              <span className="font-medium text-primary max-w-[110px] truncate text-[11px]">
                {user.tenHienThi || user.tenDangNhap}
              </span>
            </div>
            <button
              onClick={() => authService.logout()}
              title="Đăng xuất khỏi tài khoản"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-rose-400 hover:bg-surface-elevated transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => authService.loginWithGithub()}
            disabled={isLoading}
            className="h-7 px-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {isLoading ? 'Đang kết nối...' : 'Đăng nhập'}
          </button>
        )}

        {/* 3 nút Windows Controls */}
        <div className="flex items-center ml-1">
          <button
            onClick={handleMinimize}
            title="Thu nhỏ"
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-primary hover:bg-surface-elevated transition-colors rounded-md"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Thu lại' : 'Phóng to'}
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-primary hover:bg-surface-elevated transition-colors rounded-md"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            title="Đóng ứng dụng"
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-white hover:bg-red-600 transition-colors rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
