import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
import { useNavStore } from '../../kho-trang-thai/useDieuHuongStore';
import { useAuthStore } from '../../kho-trang-thai/useXacThucStore';
import { authService } from '../../dich-vu/xac-thuc/xac-thuc.service';

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

  // Lắng nghe sự kiện lỗi xác thực hoặc người dùng hủy từ deep link
  useEffect(() => {
    const unsubscribe = authService.onAuthError(() => {
      setLoadingProvider(null);
    });
    return unsubscribe;
  }, []);

  // Tự động giải phóng trạng thái chờ sau 60 giây (1 phút) nếu người dùng tắt tab hoặc không có phản hồi
  useEffect(() => {
    if (!loadingProvider) return;
    const timer = setTimeout(() => {
      setLoadingProvider(null);
    }, 60000);
    return () => clearTimeout(timer);
  }, [loadingProvider]);

  // Lắng nghe phím Escape để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setAuthModalOpen(false);
        setLoadingProvider(null);
        authService.cancelCurrentLogin();
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
          authService.cancelCurrentLogin();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[380px] rounded-2xl bg-surface-elevated border border-border shadow-2xl p-7 relative overflow-hidden"
      >
        {/* Nút đóng góc phải */}
        <button
          onClick={() => {
            setAuthModalOpen(false);
            setLoadingProvider(null);
            authService.cancelCurrentLogin();
          }}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo chính thức của ForgeStore (đồng bộ với Sidebar) */}
        <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center p-2 mx-auto mb-4 shrink-0 shadow-md shadow-black/10 dark:shadow-black/40">
          <img
            src="/logo.png"
            alt="ForgeStore Logo"
            className="w-full h-full object-contain drop-shadow pointer-events-none"
          />
        </div>

        {/* Tiêu đề & Phụ đề */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black font-display text-primary tracking-tight">
            Đăng nhập vào ForgeStore
          </h2>
          <p className="text-xs text-secondary mt-1.5 max-w-[280px] mx-auto leading-relaxed">
            Lưu ứng dụng yêu thích theo tài khoản của bạn
          </p>
        </div>

        {/* 2 Nút Đăng nhập Chuẩn SSO cao cấp */}
        <div className="space-y-3">
          {/* Nút Google - Nền trắng chữ đen chuẩn Google Identity Brand */}
          <button
            onClick={handleLoginGoogle}
            disabled={loadingProvider !== null}
            className="w-full h-11 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 flex items-center justify-center gap-3 text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {loadingProvider === 'google' ? (
              <Loader2 className="w-4 h-4 text-slate-700 animate-spin" />
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

          {/* Nút GitHub - Chuẩn Dark Slate GitHub #24292F */}
          <button
            onClick={handleLoginGithub}
            disabled={loadingProvider !== null}
            className="w-full h-11 px-4 rounded-xl bg-[#24292F] hover:bg-[#1C2128] text-white border border-white/10 flex items-center justify-center gap-3 text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {loadingProvider === 'github' ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <svg className="w-4 h-4 fill-current text-white shrink-0" viewBox="0 0 24 24">
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

        {/* Nút hủy thủ công giải phóng spinner ngay lập tức nếu người dùng đóng tab trình duyệt */}
        {loadingProvider !== null && (
          <div className="mt-3.5 text-center animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setLoadingProvider(null);
                authService.cancelCurrentLogin();
              }}
              className="text-[11px] text-muted hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer inline-flex items-center gap-1 font-medium underline underline-offset-4"
            >
              Hủy kết nối và thử lại
            </button>
          </div>
        )}

        {/* Footer bảo mật kín đáo, không có đường kẻ thô cắt ngang */}
        <div className="mt-6 text-center text-[11px] text-muted flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>Xác thực an toàn qua trình duyệt hệ thống</span>
        </div>
      </div>
    </div>
  );
};
