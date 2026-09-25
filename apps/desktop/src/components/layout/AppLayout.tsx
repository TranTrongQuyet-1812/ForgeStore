import React from 'react';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { useNavStore } from '../../stores/useNavStore';
import { ExplorePage } from '../../pages/ExplorePage';
import { DetailPage } from '../../pages/DetailPage';
import { LibraryPage } from '../../pages/LibraryPage';
import { FavoritesPage } from '../../pages/FavoritesPage';
import { CategoriesPage } from '../../pages/CategoriesPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { SearchModal } from '../search/SearchModal';

export const AppLayout: React.FC = () => {
  const { currentTab } = useNavStore();

  const renderContent = () => {
    switch (currentTab) {
      case 'explore':
        return <ExplorePage />;
      case 'detail':
        return <DetailPage />;
      case 'library':
        return <LibraryPage />;
      case 'favorites':
        return <FavoritesPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <ExplorePage />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-canvas text-primary font-body">
      {/* 1. Thanh tiêu đề Custom Titlebar Frameless (64px / 56px) */}
      <Titlebar />

      {/* 2. Phần thân 2 cột (Sidebar 240px cố định + Vùng nội dung chính co giãn) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        {/* Vùng cuộn nội dung chính */}
        <main className="flex-1 h-full overflow-y-auto bg-canvas transition-colors duration-200">
          {renderContent()}
        </main>
      </div>

      {/* 3. Modal tìm kiếm nhanh Ctrl+K (Toàn cục) */}
      <SearchModal />
    </div>
  );
};
