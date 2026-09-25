import React from 'react';
import { Settings, Sun, Moon, Laptop } from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

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

      {/* Thông tin phần cứng & Định danh máy */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
        <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
          <Laptop className="w-4 h-4 text-accent-forge" />
          <span>Thông tin thiết bị</span>
        </h3>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-border/50 text-secondary">
            <span>Tên thiết bị:</span>
            <span className="font-mono text-primary font-medium">PC-DESKTOP-1812</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50 text-secondary">
            <span>Nền tảng hệ điều hành:</span>
            <span className="font-mono text-primary font-medium">Windows 11 x64</span>
          </div>
          <div className="flex justify-between py-1.5 text-secondary">
            <span>Machine GUID (Băm SHA-256 bảo mật):</span>
            <span className="font-mono text-muted text-[11px]">8f3b...c912</span>
          </div>
        </div>
      </div>
    </div>
  );
};
