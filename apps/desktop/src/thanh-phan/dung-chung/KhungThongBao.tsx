import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useThongBaoStore, ToastType } from '../../kho-trang-thai/useThongBaoStore';

export const KhungThongBao: React.FC = () => {
  const { toasts, removeToast } = useThongBaoStore();

  if (toasts.length === 0) return null;

  const renderIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-600 dark:text-accent-ai shrink-0 mt-0.5" />;
    }
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-[380px] select-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-surface-elevated/95 border border-border shadow-[0_12px_32px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl animate-fade-in"
        >
          {renderIcon(t.type)}
          <p className="text-xs text-primary leading-relaxed font-medium flex-1 whitespace-pre-line">
            {t.message}
          </p>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="w-5 h-5 rounded flex items-center justify-center text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
