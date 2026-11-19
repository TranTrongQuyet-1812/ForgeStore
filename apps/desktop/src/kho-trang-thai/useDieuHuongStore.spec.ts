import { describe, it, expect, beforeEach } from 'vitest';
import { useDieuHuongStore } from './useDieuHuongStore';

describe('useDieuHuongStore & HopThoaiXacThuc state (P3B-15-PREMIUM-UI)', () => {
  beforeEach(() => {
    useDieuHuongStore.setState({
      currentTab: 'explore',
      selectedAppId: null,
      selectedCategory: null,
      searchQuery: '',
      trangTimKiem: 1,
      tabTruocChiTiet: null,
      isSearchModalOpen: false,
      isAuthModalOpen: false,
    });
  });

  it('khởi tạo mặc định với isAuthModalOpen = false', () => {
    const state = useDieuHuongStore.getState();
    expect(state.isAuthModalOpen).toBe(false);
    expect(state.currentTab).toBe('explore');
  });

  it('setAuthModalOpen(true) mở modal xác thực trung tâm và setAuthModalOpen(false) đóng lại', () => {
    useDieuHuongStore.getState().setAuthModalOpen(true);
    expect(useDieuHuongStore.getState().isAuthModalOpen).toBe(true);

    useDieuHuongStore.getState().setAuthModalOpen(false);
    expect(useDieuHuongStore.getState().isAuthModalOpen).toBe(false);
  });

  it('điều hướng tab và cập nhật state chính xác', () => {
    useDieuHuongStore.getState().navigateTo('favorites');
    expect(useDieuHuongStore.getState().currentTab).toBe('favorites');

    useDieuHuongStore.getState().openAppDetail('app-test-123');
    expect(useDieuHuongStore.getState().currentTab).toBe('detail');
    expect(useDieuHuongStore.getState().selectedAppId).toBe('app-test-123');

    useDieuHuongStore.getState().openCategory('developer-tools');
    expect(useDieuHuongStore.getState().currentTab).toBe('explore');
    expect(useDieuHuongStore.getState().selectedCategory).toBe('developer-tools');
  });

  it('moTrangTimKiem đặt đúng tab, từ khóa và đưa về trang 1 (P3B-41)', () => {
    useDieuHuongStore.getState().setTrangTimKiem(4);
    useDieuHuongStore.getState().moTrangTimKiem('  ghi chú markdown  ');

    const state = useDieuHuongStore.getState();
    expect(state.currentTab).toBe('search');
    expect(state.searchQuery).toBe('ghi chú markdown');
    expect(state.trangTimKiem).toBe(1);
    expect(state.selectedAppId).toBeNull();
  });

  it('quayLaiTuChiTiet chỉ quay về search khi mở chi tiết từ search, giữ nguyên từ khóa và trang (P3B-41)', () => {
    useDieuHuongStore.getState().moTrangTimKiem('terminal');
    useDieuHuongStore.getState().setTrangTimKiem(3);

    useDieuHuongStore.getState().openAppDetail('app-1');
    expect(useDieuHuongStore.getState().tabTruocChiTiet).toBe('search');

    // Mở tiếp app khác khi vẫn đang ở detail thì vẫn giữ nguồn ban đầu là 'search'
    useDieuHuongStore.getState().openAppDetail('app-2');
    expect(useDieuHuongStore.getState().tabTruocChiTiet).toBe('search');

    useDieuHuongStore.getState().quayLaiTuChiTiet();
    const state = useDieuHuongStore.getState();
    expect(state.currentTab).toBe('search');
    expect(state.searchQuery).toBe('terminal');
    expect(state.trangTimKiem).toBe(3);
    expect(state.tabTruocChiTiet).toBeNull();
  });

  it('quayLaiTuChiTiet về explore khi mở chi tiết từ explore, library hoặc favorites (P3B-41)', () => {
    for (const nguon of ['explore', 'library', 'favorites'] as const) {
      useDieuHuongStore.getState().navigateTo(nguon);
      useDieuHuongStore.getState().openAppDetail('app-xyz');
      useDieuHuongStore.getState().quayLaiTuChiTiet();

      expect(useDieuHuongStore.getState().currentTab).toBe('explore');
      expect(useDieuHuongStore.getState().tabTruocChiTiet).toBeNull();
    }
  });
});
