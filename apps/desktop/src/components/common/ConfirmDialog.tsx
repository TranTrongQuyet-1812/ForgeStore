import React, { useEffect, useRef } from 'react';
import { LogOut, Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { useDialogStore } from '../../stores/useDialogStore';

export const ConfirmDialog: React.FC = () => {
  const { isOpen, options, close } = useDialogStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus nút Hủy để tránh người dùng nhấn Enter nhầm
  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  // Phím tắt bàn phím: Escape để Hủy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !options) return;
      if (e.key === 'Escape') {
        options.onCancel?.();
        close();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options, close]);

  if (!isOpen || !options) return null;

  const {
    title,
    description,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy',
    variant = 'danger',
    icon = 'alert',
    onConfirm,
    onCancel,
  } = options;

  const handleCancel = () => {
    onCancel?.();
    close();
  };

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    close();
  };

  const renderIcon = () => {
    const iconClass = 'w-5 h-5 shrink-0';
    switch (icon) {
      case 'logout':
        return <LogOut className={iconClass} />;
      case 'trash':
        return <Trash2 className={iconClass} />;
      case 'info':
        return <Info className={iconClass} />;
      case 'alert':
      default:
        return <AlertTriangle className={iconClass} />;
    }
  };

  const getIconWrapperClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'primary':
      default:
        return 'bg-forge-500/10 text-forge-500 border-forge-500/20';
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20';
      case 'primary':
      default:
        return 'bg-forge-500 hover:bg-forge-600 text-white shadow-forge-900/20';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          handleCancel();
        }
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div
        ref={cardRef}
        className="w-full max-w-[380px] rounded-2xl bg-surface-elevated border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 relative overflow-hidden"
      >
        {/* Nút đóng góc phải */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Biểu tượng Squircle theo theme */}
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4.5 ${getIconWrapperClass()}`}
        >
          {renderIcon()}
        </div>

        {/* Tiêu đề & Mô tả */}
        <div>
          <h3
            id="confirm-dialog-title"
            className="text-base font-bold font-display text-primary tracking-tight leading-snug"
          >
            {title}
          </h3>
          <p
            id="confirm-dialog-description"
            className="text-xs text-secondary mt-2 leading-relaxed whitespace-pre-line"
          >
            {description}
          </p>
        </div>

        {/* Cụm 2 nút hành động căn phải */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={handleCancel}
            className="h-9 px-4 rounded-xl bg-surface hover:bg-surface-hover text-secondary hover:text-primary border border-border text-xs font-semibold transition-colors cursor-pointer active:scale-[0.99]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`h-9 px-4 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-[0.99] ${getConfirmButtonClass()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
