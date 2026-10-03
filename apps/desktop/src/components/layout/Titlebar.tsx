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
import { useThemeStore } from '../../stores/useThemeStore';
import { useNavStore } from '../../stores/useNavStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/auth/auth-service';
import { isTauri } from '../../services/auth/token-storage';

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
  const { currentTab, setSearchModalOpen } = useNavStore();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  // Đóng auth menu khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (authMenuRef.current && !authMenuRef.current.contains(e.target as Node)) {
        setIsAuthMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAuthMenuOpen(false);
      }
    };

    if (isAuthMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthMenuOpen]);

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
          <div className="relative" ref={authMenuRef}>
            <button
              onClick={() => setIsAuthMenuOpen((prev) => !prev)}
              disabled={isLoading}
              className="h-8 px-3 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
              <span>{isLoading ? 'Đang kết nối...' : 'Đăng nhập'}</span>
              <ChevronDown
                className={`w-3 h-3 text-muted transition-transform duration-200 ${
                  isAuthMenuOpen ? 'rotate-180 text-primary' : ''
                }`}
              />
            </button>

            {isAuthMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 p-1.5 rounded-2xl bg-surface-elevated border border-border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-2 border-b border-border/50 mb-1">
                  <p className="text-xs font-semibold text-primary">Đăng nhập vào ForgeStore</p>
                  <p className="text-[11px] text-muted leading-tight mt-0.5">
                    Đồng bộ yêu thích & lịch sử cài đặt đám mây
                  </p>
                </div>

                <div className="space-y-1">
                  {/* GitHub OAuth Button */}
                  <button
                    onClick={() => {
                      setIsAuthMenuOpen(false);
                      authService.loginWithGithub();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-primary group-hover:text-accent-forge shrink-0 shadow-2xs">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">Tiếp tục với GitHub</p>
                      <p className="text-[10px] text-muted truncate">
                        Dành cho cộng đồng lập trình viên
                      </p>
                    </div>
                  </button>

                  {/* Google OAuth Button */}
                  <button
                    onClick={() => {
                      setIsAuthMenuOpen(false);
                      authService.loginWithGoogle();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 shadow-2xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27a7.18 7.18 0 010-4.54V6.58H1.25a11.97 11.97 0 000 10.84l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">Tiếp tục với Google</p>
                      <p className="text-[10px] text-muted truncate">
                        Dành cho người dùng phổ thông
                      </p>
                    </div>
                  </button>
                </div>

                <div className="mt-1 pt-1.5 px-2 border-t border-border/40 text-[10px] text-muted/80 flex items-center justify-between">
                  <span>Không cần mật khẩu</span>
                  <span className="font-mono">PKCE S256</span>
                </div>
              </div>
            )}
          </div>
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
