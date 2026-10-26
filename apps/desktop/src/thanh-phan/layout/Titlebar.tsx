import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { useThemeStore } from '../../kho-trang-thai/useThemeStore';
import { useNavStore } from '../../kho-trang-thai/useNavStore';
import { useAuthStore } from '../../kho-trang-thai/useAuthStore';
import { confirmDialog } from '../../kho-trang-thai/useDialogStore';
import { authService } from '../../dich-vu/auth/auth-service';
import { isTauri } from '../../dich-vu/auth/token-storage';

const TAB_CONFIGS: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  explore: { label: 'Khám phá Store', icon: Compass },
  detail: { label: 'Chi tiết ứng dụng', icon: Sparkles },
  library: { label: 'Thư viện máy', icon: Library },
  favorites: { label: 'Kho yêu thích', icon: Heart },
  categories: { label: 'Danh mục', icon: LayoutGrid },
  settings: { label: 'Cài đặt', icon: Settings },
};

export const Titlebar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { currentTab, setSearchModalOpen, setAuthModalOpen, navigateTo } = useNavStore();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Đóng user profile menu khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

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
          title={
            theme === 'dark' ? 'Chuyển sang Trắng ngà sữa (Light)' : 'Chuyển sang Dark than chì'
          }
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {isAuthenticated && user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-border-focus text-xs shadow-xs select-none cursor-pointer transition-all"
              title={
                user.tenHienThi
                  ? `${user.tenHienThi} (@${user.tenDangNhap})`
                  : `@${user.tenDangNhap}`
              }
            >
              {user.duongDanAvatar && !avatarError ? (
                <img
                  src={user.duongDanAvatar}
                  alt={user.tenDangNhap}
                  onError={() => setAvatarError(true)}
                  className="w-5 h-5 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-muted">
                  <UserIcon className="w-3 h-3" />
                </div>
              )}
              <span className="font-medium text-primary max-w-[120px] truncate text-xs">
                {user.tenHienThi || user.tenDangNhap}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-muted transition-transform duration-200 ${
                  isUserMenuOpen ? 'rotate-180 text-primary' : ''
                }`}
              />
            </button>

            {/* User Profile Dropdown Menu (Raycast / Linear / macOS Account Menu) */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-elevated border border-border shadow-[0_16px_40px_rgba(0,0,0,0.35)] z-50 animate-fade-in select-none overflow-hidden backdrop-blur-xl">
                {/* 1. Header Profile Info */}
                <div className="px-3.5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    {user.duongDanAvatar && !avatarError ? (
                      <img
                        src={user.duongDanAvatar}
                        alt={user.tenDangNhap}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-border shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-muted shrink-0 shadow-xs">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-primary truncate leading-tight tracking-tight">
                        {user.tenHienThi || user.tenDangNhap}
                      </h4>
                      <p
                        className="text-[11px] text-muted truncate mt-0.5 font-normal"
                        title={user.thuDienTu || `@${user.tenDangNhap}`}
                      >
                        {user.thuDienTu || `@${user.tenDangNhap}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Quick Navigation Shortcuts */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigateTo('favorites');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-surface-hover text-secondary hover:text-primary transition-colors cursor-pointer group text-xs font-medium"
                  >
                    <Heart className="w-3.5 h-3.5 text-muted group-hover:text-rose-500 transition-colors shrink-0" />
                    <span className="flex-1">Kho yêu thích của tôi</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigateTo('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-surface-hover text-secondary hover:text-primary transition-colors cursor-pointer group text-xs font-medium"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted group-hover:text-accent-forge transition-colors shrink-0" />
                    <span className="flex-1">Cài đặt & Giao diện</span>
                  </button>
                </div>

                {/* 3. Action Logout */}
                <div className="p-1.5 pt-0 border-t border-border/60">
                  <button
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      const confirmed = await confirmDialog({
                        title: 'Đăng xuất khỏi ForgeStore',
                        description:
                          'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không? Các ứng dụng yêu thích vẫn được lưu an toàn trên đám mây.',
                        confirmLabel: 'Đăng xuất',
                        cancelLabel: 'Hủy',
                        variant: 'danger',
                        icon: 'logout',
                      });
                      if (confirmed) {
                        authService.logout();
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg text-left hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer text-xs font-medium group"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500/80 group-hover:text-rose-500 transition-colors shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            disabled={isLoading}
            className="h-8 px-3 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-border-focus text-xs text-primary font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 active:scale-[0.98]"
          >
            <UserIcon className="w-3.5 h-3.5 text-muted" />
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
