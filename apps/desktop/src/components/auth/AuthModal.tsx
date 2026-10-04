import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
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
        className="w-full max-w-[360px] sm:max-w-[380px] rounded-2xl bg-surface-elevated border border-border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.5)] p-6 sm:p-7 relative overflow-hidden"
      >
        {/* Nút đóng góc phải */}
        <button
          onClick={() => {
            setAuthModalOpen(false);
            setLoadingProvider(null);
          }}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Mark Tối Giản */}
        <div className="w-10 h-10 rounded-xl bg-surface border border-border shadow-xs flex items-center justify-center mx-auto mb-3.5 text-accent-forge">
          <svg
            className="w-5 h-5"
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
        </div>

        {/* Tiêu đề & Phụ đề súc tích */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-primary font-display tracking-tight">
            Đăng nhập vào ForgeStore
          </h2>
          <p className="text-xs text-muted mt-1 leading-normal">
            Đồng bộ kho ứng dụng và thiết bị của bạn
          </p>
        </div>

        {/* 2 Nút Đăng nhập Chuẩn Raycast / Linear */}
        <div className="space-y-2.5">
          {/* Nút Google */}
          <button
            onClick={handleLoginGoogle}
            disabled={loadingProvider !== null}
            className="w-full h-10.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-border hover:border-border-focus flex items-center justify-center gap-2.5 text-xs font-semibold text-primary transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
          >
            {loadingProvider === 'google' ? (
              <Loader2 className="w-4 h-4 text-accent-forge animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>Tiếp tục với Google</span>
          </button>

          {/* Nút GitHub */}
          <button
            onClick={handleLoginGithub}
            disabled={loadingProvider !== null}
            className="w-full h-10.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-border hover:border-border-focus flex items-center justify-center gap-2.5 text-xs font-semibold text-primary transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
          >
            {loadingProvider === 'github' ? (
              <Loader2 className="w-4 h-4 text-accent-forge animate-spin" />
            ) : (
              <svg className="w-4 h-4 fill-current text-primary shrink-0" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            <span>Tiếp tục với GitHub</span>
          </button>
        </div>

        {/* Footer bảo mật kín đáo, không khoe code */}
        <div className="mt-6 pt-4 border-t border-border/40 text-center flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>Xác thực an toàn qua trình duyệt hệ thống</span>
        </div>
      </div>
    </div>
  );
};
