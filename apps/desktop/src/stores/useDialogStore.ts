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

/**
 * Hàm tiện ích mở hộp thoại xác nhận trả về Promise<boolean>.
 * Thay thế drop-in cho `window.confirm(...)` dạng `if (await confirmDialog(...))`.
 */
export function confirmDialog(
  options: Omit<ConfirmDialogOptions, 'onConfirm' | 'onCancel'>,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useDialogStore.getState().open({
      ...options,
      onConfirm: () => {
        useDialogStore.getState().close();
        resolve(true);
      },
      onCancel: () => {
        useDialogStore.getState().close();
        resolve(false);
      },
    });
  });
}
