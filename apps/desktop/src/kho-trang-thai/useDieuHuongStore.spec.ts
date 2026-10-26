import { describe, it, expect, beforeEach } from 'vitest';
import { useDieuHuongStore } from './useDieuHuongStore';

describe('useDieuHuongStore & HopThoaiXacThuc state (P3B-15-PREMIUM-UI)', () => {
  beforeEach(() => {
    useDieuHuongStore.setState({
      currentTab: 'explore',
      selectedAppId: null,
      selectedCategory: null,
      searchQuery: '',
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
});
