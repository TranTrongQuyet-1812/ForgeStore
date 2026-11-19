import { create } from 'zustand';

export type NavTab =
  'explore' | 'categories' | 'library' | 'favorites' | 'settings' | 'detail' | 'search';

interface NavState {
  currentTab: NavTab;
  selectedAppId: string | null;
  selectedCategory: string | null;
  searchQuery: string;
  // Lưu số trang kết quả trong store vì BoCucUngDung unmount trang khi mở chi tiết app.
  trangTimKiem: number;
  // Nhớ nguồn mở trang chi tiết để nút quay lại trả về trang kết quả khi đi từ 'search'.
  tabTruocChiTiet: NavTab | null;
  isSearchModalOpen: boolean;
  isAuthModalOpen: boolean;
  navigateTo: (tab: NavTab, appId?: string) => void;
  openAppDetail: (appId: string) => void;
  moTrangTimKiem: (tuKhoa: string) => void;
  setTrangTimKiem: (trang: number) => void;
  quayLaiTuChiTiet: () => void;
  openCategory: (category: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchModalOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
}

export const useDieuHuongStore = create<NavState>((set) => ({
  currentTab: 'explore',
  selectedAppId: null,
  selectedCategory: null,
  searchQuery: '',
  trangTimKiem: 1,
  tabTruocChiTiet: null,
  isSearchModalOpen: false,
  isAuthModalOpen: false,
  navigateTo: (tab, appId) =>
    set({ currentTab: tab, selectedAppId: appId ?? null, tabTruocChiTiet: null }),
  openAppDetail: (appId) =>
    set((state) => ({
      tabTruocChiTiet: state.currentTab === 'detail' ? state.tabTruocChiTiet : state.currentTab,
      currentTab: 'detail',
      selectedAppId: appId,
    })),
  moTrangTimKiem: (tuKhoa) =>
    set({
      currentTab: 'search',
      searchQuery: tuKhoa.trim(),
      trangTimKiem: 1,
      selectedAppId: null,
      tabTruocChiTiet: null,
    }),
  setTrangTimKiem: (trang) => set({ trangTimKiem: Math.max(1, Math.floor(trang)) }),
  quayLaiTuChiTiet: () =>
    set((state) => ({
      currentTab: state.tabTruocChiTiet === 'search' ? 'search' : 'explore',
      selectedAppId: null,
      tabTruocChiTiet: null,
    })),
  openCategory: (category) =>
    set({ currentTab: 'explore', selectedCategory: category, tabTruocChiTiet: null }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery, trangTimKiem: 1 }),
  setSearchModalOpen: (isSearchModalOpen) => set({ isSearchModalOpen }),
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
}));
