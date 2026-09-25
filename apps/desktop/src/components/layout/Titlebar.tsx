import React, { useState, useEffect } from 'react';
import { Search, Minus, Square, X, Sun, Moon, Sparkles } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useNavStore } from '../../stores/useNavStore';

export const Titlebar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { setSearchModalOpen } = useNavStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // Xử lý điều khiển cửa sổ Tauri an toàn (kể cả khi chạy trên trình duyệt dev)
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

  // Lắng nghe phím tắt Ctrl+K để mở modal tìm kiếm
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
      className="h-14 min-h-[56px] w-full bg-surface border-b border-border flex items-center justify-between px-3 select-none z-50 transition-colors duration-200"
    >
      {/* Vùng bên trái: Logo & Tên ứng dụng */}
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-forge to-accent-forge-hover flex items-center justify-center shadow-md shadow-orange-950/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-sm tracking-wide text-primary flex items-center gap-1.5">
            ForgeStore
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated text-accent-ai font-mono font-medium">
              v0.1.0
            </span>
          </span>
        </div>
      </div>

      {/* Vùng ở giữa: Ô tìm kiếm nhanh Ctrl+K */}
      <div data-tauri-drag-region className="flex-1 max-w-md mx-4">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="w-full h-8 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border hover:border-border-focus flex items-center justify-between text-secondary hover:text-primary transition-all duration-150 text-xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted group-hover:text-accent-ai transition-colors" />
            <span className="truncate">Tìm kiếm ứng dụng, ý định AI hoặc dán repo...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-canvas border border-border rounded text-muted group-hover:text-primary">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Vùng bên phải: Nút theme, đăng nhập & 3 nút điều khiển cửa sổ frameless */}
      <div className="flex items-center gap-1">
        {/* Nút bật tắt theme */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang Trắng ngà sữa' : 'Chuyển sang Dark than chì'}
          className="w-8 h-8 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Nút Đăng nhập GitHub */}
        <button
          onClick={() => alert('Đăng nhập GitHub qua Deep Link sẽ được hoàn thiện ở P3-04')}
          className="h-7 px-2.5 ml-1 mr-2 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Đăng nhập
        </button>

        {/* Cụm 3 nút cửa sổ Custom Titlebar Frameless */}
        <div className="flex items-center -mr-1">
          <button
            onClick={handleMinimize}
            title="Thu nhỏ"
            className="w-10 h-10 flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Thu lại' : 'Phóng to'}
            className="w-10 h-10 flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            title="Đóng ứng dụng"
            className="w-10 h-10 flex items-center justify-center text-secondary hover:text-white hover:bg-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
