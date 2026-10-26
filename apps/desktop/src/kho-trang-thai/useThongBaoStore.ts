import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
}

export const useThongBaoStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => {
      // Dọn dẹp timer cho các toast bị đẩy ra ngoài bởi slice(-2)
      if (state.toasts.length >= 3) {
        const evicted = state.toasts.slice(0, state.toasts.length - 2);
        evicted.forEach((t) => clearToastTimer(t.id));
      }

      return {
        // Giới hạn tối đa 3 toasts cùng lúc để tránh che khuất màn hình
        toasts: [...state.toasts.slice(-2), { id, type, message }],
      };
    });

    const timer = setTimeout(() => {
      clearToastTimer(id);
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3500);

    toastTimers.set(id, timer);
  },
  removeToast: (id) => {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

/**
 * Tiện ích gửi thông báo nhanh (Toast) thay thế cho window.alert
 */
export const toast = {
  success: (message: string) => useThongBaoStore.getState().addToast('success', message),
  error: (message: string) => useThongBaoStore.getState().addToast('error', message),
  info: (message: string) => useThongBaoStore.getState().addToast('info', message),
};
