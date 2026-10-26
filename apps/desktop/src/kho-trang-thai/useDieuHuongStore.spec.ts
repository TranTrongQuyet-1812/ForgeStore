import { describe, it, expect, beforeEach } from 'vitest';
import { useNavStore } from './useDieuHuongStore';

describe('useNavStore & AuthModal state (P3B-15-PREMIUM-UI)', () => {
  beforeEach(() => {
    useNavStore.setState({
      currentTab: 'explore',
      selectedAppId: null,
      selectedCategory: null,
      searchQuery: '',
      isSearchModalOpen: false,
      isAuthModalOpen: false,
    });
  });

  it('khởi tạo mặc định với isAuthModalOpen = false', () => {
    const state = useNavStore.getState();
    expect(state.isAuthModalOpen).toBe(false);
    expect(state.currentTab).toBe('explore');
  });

  it('setAuthModalOpen(true) mở modal xác thực trung tâm và setAuthModalOpen(false) đóng lại', () => {
    useNavStore.getState().setAuthModalOpen(true);
    expect(useNavStore.getState().isAuthModalOpen).toBe(true);

    useNavStore.getState().setAuthModalOpen(false);
    expect(useNavStore.getState().isAuthModalOpen).toBe(false);
  });

  it('điều hướng tab và cập nhật state chính xác', () => {
    useNavStore.getState().navigateTo('favorites');
    expect(useNavStore.getState().currentTab).toBe('favorites');

    useNavStore.getState().openAppDetail('app-test-123');
    expect(useNavStore.getState().currentTab).toBe('detail');
    expect(useNavStore.getState().selectedAppId).toBe('app-test-123');

    useNavStore.getState().openCategory('developer-tools');
    expect(useNavStore.getState().currentTab).toBe('explore');
    expect(useNavStore.getState().selectedCategory).toBe('developer-tools');
  });
});
