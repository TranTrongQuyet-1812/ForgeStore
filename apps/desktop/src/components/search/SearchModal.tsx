import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Github, ArrowRight, Sparkles } from 'lucide-react';
import { useNavStore } from '../../stores/useNavStore';

export const SearchModal: React.FC = () => {
  const { isSearchModalOpen, setSearchModalOpen, openAppDetail } = useNavStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Tự động focus vào input khi mở modal
  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  // Nhận diện đường dẫn GitHub Repo cho tính năng Paste & Play
  const isGithubUrl = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(query.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh nhập tìm kiếm */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-5 h-5 text-accent-ai shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchModalOpen(false);
            }}
            placeholder="Tìm theo tên app, mô tả ý định tiếng Việt hoặc dán link GitHub..."
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted hover:text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-surface-elevated border border-border rounded text-muted">
            ESC
          </kbd>
        </div>

        {/* Nội dung kết quả tìm kiếm / chế độ Paste & Play */}
        <div className="p-4 max-h-[380px] overflow-y-auto flex flex-col gap-2">
          {/* Nhánh 1: Phát hiện link GitHub (Paste & Play) */}
          {isGithubUrl ? (
            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-accent-forge font-semibold text-xs">
                <Github className="w-4 h-4" />
                <span>PHÁT HIỆN LIÊN KẾT GITHUB (PASTE & PLAY)</span>
              </div>
              <p className="text-xs text-secondary">
                Hệ thống sẽ thẩm định repo, trích xuất tệp cài đặt Windows tương thích và tóm tắt AI
                tiếng Việt tự động.
              </p>
              <button
                onClick={() => {
                  alert(`Đang thẩm định repo: ${query}. Tính năng sẽ liên kết API ở P3-07!`);
                  setSearchModalOpen(false);
                }}
                className="mt-1 w-full py-2 px-3 rounded-lg bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span>Thẩm Định & Nạp Cài Đặt Ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : query.length > 0 ? (
            /* Nhánh 2: Kết quả tìm kiếm theo tên hoặc ý định AI */
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent-ai px-1 py-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tìm kiếm theo ý định tự nhiên với Gemini Flash...</span>
              </div>
              <div
                onClick={() => {
                  openAppDetail('newpipe-id');
                  setSearchModalOpen(false);
                }}
                className="p-3 rounded-xl hover:bg-surface-elevated flex items-center justify-between cursor-pointer border border-transparent hover:border-border transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center text-primary font-bold">
                    N
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-primary">NewPipe</h4>
                    <p className="text-[11px] text-muted">Trình xem video nhẹ không quảng cáo</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">92/100</span>
              </div>
            </div>
          ) : (
            /* Trạng thái rỗng: Hướng dẫn tìm kiếm */
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2 text-muted">
              <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-accent-forge">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs max-w-sm text-secondary">
                Gõ <strong className="text-primary">tên ứng dụng</strong>, mô tả nhu cầu bằng{' '}
                <strong className="text-primary">tiếng Việt</strong> (VD: <em>"app ghi chú nhẹ"</em>
                ) hoặc <strong className="text-primary">dán trực tiếp link GitHub</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
