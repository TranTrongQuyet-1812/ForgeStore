import { describe, it, expect, beforeEach } from 'vitest';
import { useUpdaterStore } from '../../stores/useUpdaterStore';

describe('useUpdaterStore - Bỏ qua phiên bản (P3B-17.2)', () => {
  beforeEach(() => {
    useUpdaterStore.setState({
      soLuongBanCapNhat: 2,
      danhSachCapNhat: [
        {
          maUngDung: 'app-1',
          phienBanHienTai: '1.0.0',
          phienBanMoiNhat: '1.1.0',
          coBanCapNhat: true,
        },
        {
          maUngDung: 'app-2',
          phienBanHienTai: '2.0.0',
          phienBanMoiNhat: '2.1.0',
          coBanCapNhat: true,
        },
      ],
      danhSachBoQuaVersion: {},
    });
  });

  it('bỏ qua phiên bản chỉ định, tự giảm số lượng bản cập nhật', () => {
    const store = useUpdaterStore.getState();
    store.boQuaPhienBan('app-1', '1.1.0');

    const state = useUpdaterStore.getState();
    expect(state.danhSachBoQuaVersion['app-1']).toBe('1.1.0');
    expect(state.soLuongBanCapNhat).toBe(1);
    expect(state.danhSachCapNhat.some((u) => u.maUngDung === 'app-1')).toBe(false);
  });

  it('kiemTraDaBoQua trả về true nếu phiên bản trùng với bản bỏ qua', () => {
    const store = useUpdaterStore.getState();
    store.boQuaPhienBan('app-1', '1.1.0');

    expect(useUpdaterStore.getState().kiemTraDaBoQua('app-1', '1.1.0')).toBe(true);
    expect(useUpdaterStore.getState().kiemTraDaBoQua('app-1', '1.0.5')).toBe(false);
  });

  it('tự hết tác dụng khi có bản mới hơn bản đã bỏ qua (P3B-17.2)', () => {
    const store = useUpdaterStore.getState();
    store.boQuaPhienBan('app-1', '1.1.0');

    // Phiên bản mới hơn 1.2.0 xuất hiện
    const daBoQua = useUpdaterStore.getState().kiemTraDaBoQua('app-1', '1.2.0');
    expect(daBoQua).toBe(false);
    // Danh sách bỏ qua tự động xóa bản cũ
    expect(useUpdaterStore.getState().danhSachBoQuaVersion['app-1']).toBeUndefined();
  });
});
