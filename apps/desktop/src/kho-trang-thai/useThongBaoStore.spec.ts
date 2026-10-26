import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, toast } from './useThongBaoStore';

describe('useToastStore & toast utility (Mục 69 - In-App Toast System)', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('thêm toast thành công qua toast.success', () => {
    toast.success('Thao tác thành công');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Thao tác thành công');
  });

  it('thêm toast lỗi qua toast.error và toast thông tin qua toast.info', () => {
    toast.error('Có lỗi xảy ra');
    toast.info('Thông tin hệ thống');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0].type).toBe('error');
    expect(toasts[1].type).toBe('info');
  });

  it('tự động dọn dẹp toast sau 3.5 giây', () => {
    toast.success('Tin nhắn tạm thời');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    // Tua 3.5 giây (3500ms)
    vi.advanceTimersByTime(3500);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast xóa đúng toast theo id', () => {
    toast.success('Toast 1');
    toast.error('Toast 2');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);

    const idToDelete = toasts[0].id;
    useToastStore.getState().removeToast(idToDelete);

    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe('Toast 2');
  });

  it('giới hạn tối đa 3 toasts cùng lúc tránh che màn hình', () => {
    toast.info('1');
    toast.info('2');
    toast.info('3');
    toast.info('4');

    expect(useToastStore.getState().toasts).toHaveLength(3);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['2', '3', '4']);
  });

  it('stress test: nạp 20 toast dồn dập vẫn giữ vững tối đa 3 toast và dọn dẹp sạch sẽ', () => {
    for (let i = 1; i <= 20; i++) {
      toast.error(`Lỗi ${i}`);
    }

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts.map((t) => t.message)).toEqual(['Lỗi 18', 'Lỗi 19', 'Lỗi 20']);

    // Tua hết 3500ms
    vi.advanceTimersByTime(3500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('xóa sớm qua removeToast không gây lỗi khi timer 3.5s kết thúc', () => {
    toast.info('Toast tạm');
    const id = useToastStore.getState().toasts[0].id;

    // Xóa sớm tại 1000ms
    vi.advanceTimersByTime(1000);
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);

    // Tua nốt thời gian còn lại
    vi.advanceTimersByTime(2500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
