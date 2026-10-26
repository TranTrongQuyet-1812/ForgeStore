import { create } from 'zustand';

export type NavTab =
  'explore' | 'categories' | 'library' | 'favorites' | 'settings' | 'detail' | 'search';

interface NavState {
  currentTab: NavTab;
  selectedAppId: string | null;
  selectedCategory: string | null;
  searchQuery: string;
  isSearchModalOpen: boolean;
  isAuthModalOpen: boolean;
  navigateTo: (tab: NavTab, appId?: string) => void;
  openAppDetail: (appId: string) => void;
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
  isSearchModalOpen: false,
  isAuthModalOpen: false,
  navigateTo: (tab, appId) => set({ currentTab: tab, selectedAppId: appId ?? null }),
  openAppDetail: (appId) => set({ currentTab: 'detail', selectedAppId: appId }),
  openCategory: (category) => set({ currentTab: 'explore', selectedCategory: category }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchModalOpen: (isSearchModalOpen) => set({ isSearchModalOpen }),
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
}));
