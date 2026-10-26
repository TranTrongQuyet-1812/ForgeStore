import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useHopThoaiStore, confirmDialog } from './useHopThoaiStore';

describe('useHopThoaiStore & confirmDialog (Mục 69 - In-App Confirmation System)', () => {
  beforeEach(() => {
    useHopThoaiStore.getState().close();
  });

  it('khởi tạo với trạng thái đóng', () => {
    const state = useHopThoaiStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.options).toBeNull();
  });

  it('open cập nhật trạng thái mở và tùy chọn dialog', () => {
    const onConfirmMock = vi.fn();
    useHopThoaiStore.getState().open({
      title: 'Đăng xuất',
      description: 'Bạn có chắc chắn?',
      variant: 'danger',
      icon: 'logout',
      onConfirm: onConfirmMock,
    });

    const state = useHopThoaiStore.getState();
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
    expect(useHopThoaiStore.getState().isOpen).toBe(true);

    // Giả lập người dùng bấm Xác nhận
    useHopThoaiStore.getState().options?.onConfirm?.();

    const result = await promise;
    expect(result).toBe(true);
    expect(useHopThoaiStore.getState().isOpen).toBe(false);
  });

  it('confirmDialog resolve false khi bấm Hủy', async () => {
    const promise = confirmDialog({
      title: 'Xác nhận xóa',
      description: 'Hành động không thể hoàn tác',
    });

    expect(useHopThoaiStore.getState().isOpen).toBe(true);

    // Giả lập người dùng bấm Hủy
    useHopThoaiStore.getState().options?.onCancel?.();

    const result = await promise;
    expect(result).toBe(false);
    expect(useHopThoaiStore.getState().isOpen).toBe(false);
  });

  it('xử lý concurrent invocations: dialog mới giải phóng dialog cũ an toàn (không dangling promise)', async () => {
    const promise1 = confirmDialog({
      title: 'Dialog 1',
      description: 'Hành động 1',
    });
    expect(useHopThoaiStore.getState().isOpen).toBe(true);
    expect(useHopThoaiStore.getState().options?.title).toBe('Dialog 1');

    // Dialog 2 kích hoạt khi Dialog 1 chưa được tương tác
    const promise2 = confirmDialog({
      title: 'Dialog 2',
      description: 'Hành động 2',
    });

    // Dialog 1 phải được tự động resolve false ngay lập tức
    const result1 = await promise1;
    expect(result1).toBe(false);

    // Dialog 2 đang mở và hoạt động bình thường
    expect(useHopThoaiStore.getState().isOpen).toBe(true);
    expect(useHopThoaiStore.getState().options?.title).toBe('Dialog 2');

    // Xác nhận Dialog 2
    useHopThoaiStore.getState().options?.onConfirm?.();
    const result2 = await promise2;
    expect(result2).toBe(true);
    expect(useHopThoaiStore.getState().isOpen).toBe(false);
  });
});
