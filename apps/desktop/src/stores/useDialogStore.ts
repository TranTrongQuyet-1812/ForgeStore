import { create } from 'zustand';

export type DialogVariant = 'danger' | 'warning' | 'primary';
export type DialogIcon = 'logout' | 'trash' | 'alert' | 'info';

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  icon?: DialogIcon;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface DialogState {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  open: (options: ConfirmDialogOptions) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  isOpen: false,
  options: null,
  open: (options) => set({ isOpen: true, options }),
  close: () => set({ isOpen: false, options: null }),
}));

let activeDialogResolver: ((value: boolean) => void) | null = null;

/**
 * Hàm tiện ích mở hộp thoại xác nhận trả về Promise<boolean>.
 * Thay thế drop-in cho `window.confirm(...)` dạng `if (await confirmDialog(...))`.
 * Tự động giải phóng (resolve false) cho dialog cũ nếu có dialog mới mở đè lên (chống dangling promise).
 */
export function confirmDialog(
  options: Omit<ConfirmDialogOptions, 'onConfirm' | 'onCancel'>,
): Promise<boolean> {
  // Giải phóng an toàn dialog trước đó nếu chưa giải quyết xong
  if (activeDialogResolver) {
    activeDialogResolver(false);
    activeDialogResolver = null;
  }

  return new Promise<boolean>((resolve) => {
    activeDialogResolver = resolve;

    useDialogStore.getState().open({
      ...options,
      onConfirm: () => {
        useDialogStore.getState().close();
        if (activeDialogResolver === resolve) {
          activeDialogResolver = null;
        }
        resolve(true);
      },
      onCancel: () => {
        useDialogStore.getState().close();
        if (activeDialogResolver === resolve) {
          activeDialogResolver = null;
        }
        resolve(false);
      },
    });
  });
}
