import React, { useState, useEffect } from 'react';
import {
  Search,
  Minus,
  Square,
  X,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Compass,
  Sparkles,
  Library,
  Heart,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useNavStore } from '../../stores/useNavStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/auth/auth-service';
import { isTauri } from '../../services/auth/token-storage';

const TAB_CONFIGS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  explore: { label: 'Khám phá Store', icon: Compass },
  detail: { label: 'Chi tiết ứng dụng', icon: Sparkles },
  library: { label: 'Thư viện máy', icon: Library },
  favorites: { label: 'Kho yêu thích', icon: Heart },
  categories: { label: 'Danh mục', icon: LayoutGrid },
  settings: { label: 'Cài đặt', icon: Settings },
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
      className="h-16 min-h-[64px] w-full bg-surface border-b border-border flex items-center justify-between px-5 select-none z-40 transition-colors duration-200 shadow-xs shrink-0 cursor-default"
    >
      {/* Vùng bên trái: Breadcrumbs trang hiện tại */}
      {(() => {
        const config = TAB_CONFIGS[currentTab] || TAB_CONFIGS.explore;
        const Icon = config.icon;
        return (
          <div data-tauri-drag-region className="flex items-center gap-2.5 text-xs">
            <div className="w-7 h-7 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-accent-forge shrink-0 shadow-2xs">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-primary font-bold font-display text-sm tracking-tight">
              {config.label}
            </span>
            {!isTauri() && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 font-mono text-[10px] font-semibold tracking-wide">
                Web Preview
              </span>
            )}
          </div>
        );
      })()}

      {/* Vùng ở giữa: Command Palette Search Bar (Raycast / Linear style) */}
      <div data-tauri-drag-region className="flex-1 max-w-xl mx-6">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="w-full h-9 px-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-border-focus flex items-center justify-between text-secondary hover:text-primary transition-all duration-150 text-xs group shadow-inner"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Search className="w-3.5 h-3.5 text-muted group-hover:text-accent-forge transition-colors shrink-0" />
            <span className="truncate">Tìm theo tên app, ý định AI hoặc dán link repo...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-canvas border border-border rounded-md text-muted group-hover:text-primary shadow-xs shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Vùng bên phải: Nút theme, đăng nhập & 3 nút điều khiển frameless */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang Trắng ngà sữa (Light)' : 'Chuyển sang Dark than chì'}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-elevated border border-border text-xs shadow-xs">
              {user.duongDanAvatar ? (
                <img
                  src={user.duongDanAvatar}
                  alt={user.tenDangNhap}
                  className="w-4 h-4 rounded-full object-cover border border-border"
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
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-rose-500 hover:bg-surface-hover transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => authService.loginWithGithub()}
            disabled={isLoading}
            className="h-8 px-3 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
            <span>{isLoading ? 'Đang kết nối...' : 'Đăng nhập'}</span>
          </button>
        )}

        {/* 3 nút Windows Controls */}
        <div className="flex items-center ml-1 border-l border-border pl-2">
          <button
            onClick={handleMinimize}
            title="Thu nhỏ"
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors rounded-lg"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Thu lại' : 'Phóng to'}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors rounded-lg"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            title="Đóng ứng dụng"
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-white hover:bg-red-600 transition-colors rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
