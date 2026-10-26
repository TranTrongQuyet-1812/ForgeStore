import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useGiaoDienStore = create<ThemeState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(nextTheme);
      return { theme: nextTheme };
    });
  },
}));
