import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Sparkles, Cloud, Star, ArrowRight, Loader2 } from 'lucide-react';
import { useNavStore } from '../../stores/useNavStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/auth/auth-service';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen } = useNavStore();
  const { isAuthenticated } = useAuthStore();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Tự động đóng modal khi đăng nhập thành công
  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen) {
      setAuthModalOpen(false);
      setLoadingProvider(null);
    }
  }, [isAuthenticated, isAuthModalOpen, setAuthModalOpen]);

  // Lắng nghe phím Escape để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setAuthModalOpen(false);
        setLoadingProvider(null);
      }
    };

    if (isAuthModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthModalOpen, setAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleLoginGoogle = async () => {
    setLoadingProvider('google');
    try {
      await authService.loginWithGoogle();
    } catch {
      setLoadingProvider(null);
    }
  };

  const handleLoginGithub = async () => {
    setLoadingProvider('github');
    try {
      await authService.loginWithGithub();
    } catch {
      setLoadingProvider(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        // Đóng khi click vào vùng backdrop bên ngoài
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          setAuthModalOpen(false);
          setLoadingProvider(null);
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[440px] rounded-3xl bg-surface-elevated border border-border shadow-2xl overflow-hidden relative"
      >
        {/* Nút đóng góc phải */}
        <button
          onClick={() => {
            setAuthModalOpen(false);
            setLoadingProvider(null);
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-primary hover:bg-surface transition-colors cursor-pointer z-10"
          title="Đóng hộp thoại (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Khối Header Brand & Logo */}
        <div className="pt-8 pb-6 px-8 text-center border-b border-border/40 relative overflow-hidden">
          {/* Hào quang nền mờ trang nhã */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-accent-forge/10 blur-2xl rounded-full pointer-events-none" />

          {/* Logo ForgeStore Squircle */}
          <div className="w-14 h-14 rounded-2xl bg-surface border border-accent-forge/30 flex items-center justify-center shadow-[0_0_25px_rgba(249,115,22,0.18)] mx-auto mb-4 relative group">
            <svg
              className="w-7 h-7 text-accent-forge"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-surface-elevated" />
          </div>

          <h2 className="text-xl font-bold text-primary tracking-tight mb-1.5">
            Chào mừng đến với ForgeStore
          </h2>
          <p className="text-xs text-muted max-w-[320px] mx-auto leading-relaxed">
            Kho ứng dụng mã nguồn mở minh bạch, kiểm duyệt an ninh tự động bằng Trí tuệ Nhân tạo.
          </p>
        </div>

        {/* Khối Thao tác Đăng nhập (2 nút to bản tactile) */}
        <div className="p-8 space-y-3">
          {/* Nút 1: Google */}
          <button
            onClick={handleLoginGoogle}
            disabled={loadingProvider !== null}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface hover:bg-surface-hover border border-border hover:border-border-focus transition-all group cursor-pointer shadow-xs disabled:opacity-60 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center shrink-0">
                {loadingProvider === 'google' ? (
                  <Loader2 className="w-5 h-5 text-accent-forge animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-primary group-hover:text-accent-forge transition-colors">
                  Tiếp tục với Google
                </div>
                <div className="text-[11px] text-muted">
                  Gmail & Google Workspace (Trường học / Công ty)
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Nút 2: GitHub */}
          <button
            onClick={handleLoginGithub}
            disabled={loadingProvider !== null}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface hover:bg-surface-hover border border-border hover:border-border-focus transition-all group cursor-pointer shadow-xs disabled:opacity-60 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center shrink-0">
                {loadingProvider === 'github' ? (
                  <Loader2 className="w-5 h-5 text-accent-forge animate-spin" />
                ) : (
                  <svg className="w-5 h-5 fill-current text-primary" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-primary group-hover:text-accent-forge transition-colors">
                  Tiếp tục với GitHub
                </div>
                <div className="text-[11px] text-muted">
                  Tài khoản GitHub lập trình viên & kho mã nguồn
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* Khối Quyền lợi Tài khoản (Value Bullets) */}
        <div className="px-8 pb-6">
          <div className="p-4 rounded-2xl bg-surface/50 border border-border/50 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
              Quyền lợi khi đăng nhập
            </div>

            <div className="flex items-start gap-2.5 text-xs text-secondary">
              <Cloud className="w-4 h-4 text-accent-forge shrink-0 mt-0.5" />
              <span>
                <strong>Đồng bộ thiết bị:</strong> Tự động lưu trữ danh sách cài đặt và kho yêu
                thích trên cloud.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-secondary">
              <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Cộng đồng & Đánh giá:</strong> Viết phản hồi chất lượng và bình chọn phiên
                bản tốt nhất.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-secondary">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Bảo mật AI cá nhân hóa:</strong> Nhận cảnh báo tức thời khi repo phần mềm có
                hành vi bất thường.
              </span>
            </div>
          </div>
        </div>

        {/* Khối Footer Bảo Mật Chuẩn PKCE */}
        <div className="py-3 px-8 bg-surface border-t border-border/40 text-center flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px] text-muted font-mono">
            Bảo mật PKCE RFC 7636 • Không lưu mật khẩu
          </span>
        </div>
      </div>
    </div>
  );
};
