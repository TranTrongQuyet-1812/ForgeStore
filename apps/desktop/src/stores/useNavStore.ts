import { create } from 'zustand';

export type NavTab =
  'explore' | 'categories' | 'library' | 'favorites' | 'settings' | 'detail' | 'search';

interface NavState {
  currentTab: NavTab;
  selectedAppId: string | null;
  searchQuery: string;
  isSearchModalOpen: boolean;
  navigateTo: (tab: NavTab, appId?: string) => void;
  openAppDetail: (appId: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchModalOpen: (open: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentTab: 'explore',
  selectedAppId: null,
  searchQuery: '',
  isSearchModalOpen: false,
  navigateTo: (tab, appId) => set({ currentTab: tab, selectedAppId: appId ?? null }),
  openAppDetail: (appId) => set({ currentTab: 'detail', selectedAppId: appId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchModalOpen: (isSearchModalOpen) => set({ isSearchModalOpen }),
}));
