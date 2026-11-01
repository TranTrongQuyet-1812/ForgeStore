import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Trash2, AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { useHopThoaiStore } from '../../kho-trang-thai/useHopThoaiStore';

export const HopThoaiXacNhan: React.FC = () => {
  const { isOpen, options, close } = useHopThoaiStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-focus nút Hủy để tránh người dùng nhấn Enter nhầm
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      // Timeout ngắn đảm bảo DOM đã render hoàn chỉnh
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Phím tắt bàn phím: Escape để Hủy và Focus Trap (Tab navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !options) return;

      if (e.key === 'Escape') {
        if (!isSubmitting) {
          options.onCancel?.();
          close();
        }
        return;
      }

      // Focus Trap giữa [Nút Đóng (X) <-> Nút Hủy <-> Nút Xác Nhận]
      if (e.key === 'Tab') {
        const focusableElements = [
          closeBtnRef.current,
          cancelBtnRef.current,
          confirmBtnRef.current,
        ].filter(Boolean) as HTMLButtonElement[];

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options, close, isSubmitting]);

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
    if (isSubmitting) return;
    onCancel?.();
    close();
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
      close();
    } catch (err) {
      console.error('[HopThoaiXacNhan] Lỗi khi thực thi xác nhận:', err);
    } finally {
      setIsSubmitting(false);
    }
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
        return 'bg-danger/10 text-danger border-danger/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'primary':
      default:
        return 'bg-accent-forge/10 text-accent-forge-text border-accent-forge/20';
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-danger-solid hover:bg-danger-solid/90 text-white shadow-black/20';
      case 'warning':
        // Chuẩn hóa tương phản 10.5:1 (WCAG AAA)
        return 'bg-warning-solid hover:bg-warning-solid/90 text-slate-950 font-bold shadow-black/10';
      case 'primary':
      default:
        return 'bg-accent-forge hover:bg-accent-forge-hover text-on-accent shadow-black/20';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
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
          ref={closeBtnRef}
          type="button"
          disabled={isSubmitting}
          onClick={handleCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Biểu tượng Squircle theo theme */}
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${getIconWrapperClass()}`}
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
          <div className="max-h-[60vh] overflow-y-auto pr-1 mt-2">
            <p
              id="confirm-dialog-description"
              className="text-xs text-secondary leading-relaxed whitespace-pre-line"
            >
              {description}
            </p>
          </div>
        </div>

        {/* Cụm 2 nút hành động căn phải */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
            className="h-9 px-4 rounded-xl bg-surface hover:bg-surface-hover text-secondary hover:text-primary border border-border text-xs font-semibold transition-colors cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className={`h-9 px-4 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait flex items-center gap-1.5 ${getConfirmButtonClass()}`}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
