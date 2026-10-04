import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDialogStore, confirmDialog } from './useDialogStore';

describe('useDialogStore & confirmDialog (Mục 69 - In-App Confirmation System)', () => {
  beforeEach(() => {
    useDialogStore.getState().close();
  });

  it('khởi tạo với trạng thái đóng', () => {
    const state = useDialogStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.options).toBeNull();
  });

  it('open cập nhật trạng thái mở và tùy chọn dialog', () => {
    const onConfirmMock = vi.fn();
    useDialogStore.getState().open({
      title: 'Đăng xuất',
      description: 'Bạn có chắc chắn?',
      variant: 'danger',
      icon: 'logout',
      onConfirm: onConfirmMock,
    });

    const state = useDialogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.options?.title).toBe('Đăng xuất');
    expect(state.options?.variant).toBe('danger');
    expect(state.options?.icon).toBe('logout');
  });

  it('confirmDialog resolve true khi bấm Xác nhận', async () => {
    const promise = confirmDialog({
      title: 'Xác nhận xóa',
      description: 'Hành động không thể hoàn tác',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
    });

    // Trạng thái modal đã mở
    expect(useDialogStore.getState().isOpen).toBe(true);

    // Giả lập người dùng bấm Xác nhận
    useDialogStore.getState().options?.onConfirm?.();

    const result = await promise;
    expect(result).toBe(true);
    expect(useDialogStore.getState().isOpen).toBe(false);
  });

  it('confirmDialog resolve false khi bấm Hủy', async () => {
    const promise = confirmDialog({
      title: 'Xác nhận xóa',
      description: 'Hành động không thể hoàn tác',
    });

    expect(useDialogStore.getState().isOpen).toBe(true);

    // Giả lập người dùng bấm Hủy
    useDialogStore.getState().options?.onCancel?.();

    const result = await promise;
    expect(result).toBe(false);
    expect(useDialogStore.getState().isOpen).toBe(false);
  });
});
