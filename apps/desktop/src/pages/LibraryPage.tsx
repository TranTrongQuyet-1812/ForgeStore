import React from 'react';
import { Library, RefreshCw, Play, Trash2 } from 'lucide-react';

export const LibraryPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full select-none">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
            <Library className="w-5 h-5 text-accent-forge" />
            <span>Thư Viện Của Máy Này</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Quản lý các phần mềm đã tải và cài đặt cục bộ trên máy tính (Thiết bị: PC-DESKTOP-1812)
          </p>
        </div>

        <button
          onClick={() => alert('Quét cập nhật sẽ được hoàn thiện ở P3-12')}
          className="h-8 px-3.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-accent-ai" />
          <span>Kiểm Tra Cập Nhật</span>
        </button>
      </div>

      {/* Danh sách các ứng dụng đã cài đặt */}
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-lg font-display text-primary">
              R
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-primary">RustDesk</h3>
              <p className="text-xs text-muted font-mono">
                Phiên bản đang cài: v1.3.8 • Đã băm SHA256 an toàn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Gỡ cài đặt sẽ được hoàn thiện ở P3-12')}
              className="h-8 px-3 rounded-lg border border-border hover:bg-surface-elevated text-xs text-muted hover:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Gỡ bỏ</span>
            </button>
            <button
              onClick={() => alert('Khởi chạy ứng dụng qua Rust Core')}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Mở Ứng Dụng</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-lg font-display text-primary">
              N
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-primary">Notepad++</h3>
              <p className="text-xs text-muted font-mono">
                Phiên bản đang cài: v8.6.9 • Đường dẫn: C:\Program Files\Notepad++
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Gỡ cài đặt sẽ được hoàn thiện ở P3-12')}
              className="h-8 px-3 rounded-lg border border-border hover:bg-surface-elevated text-xs text-muted hover:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Gỡ bỏ</span>
            </button>
            <button
              onClick={() => alert('Khởi chạy ứng dụng qua Rust Core')}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Mở Ứng Dụng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
