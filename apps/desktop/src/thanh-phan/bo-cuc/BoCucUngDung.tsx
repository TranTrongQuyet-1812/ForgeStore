import React from 'react';
import { Titlebar } from './ThanhTieuDe';
import { Sidebar } from './ThanhBen';
import { useNavStore } from '../../kho-trang-thai/useDieuHuongStore';
import { ExplorePage } from '../../trang/TrangKhamPha';
import { DetailPage } from '../../trang/TrangChiTiet';
import { LibraryPage } from '../../trang/TrangThuVien';
import { FavoritesPage } from '../../trang/TrangYeuThich';
import { CategoriesPage } from '../../trang/TrangDanhMuc';
import { SettingsPage } from '../../trang/TrangCaiDat';
import { SearchModal } from '../tim-kiem/HopThoaiTimKiem';
import { AuthModal } from '../xac-thuc/HopThoaiXacThuc';
import { ConfirmDialog } from '../dung-chung/HopThoaiXacNhan';
import { ToastContainer } from '../dung-chung/KhungThongBao';

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
    <div className="h-screen w-screen flex overflow-hidden bg-canvas text-primary font-body select-none">
      {/* 1. Thanh điều hướng dọc Full-Height Sidebar (260px) */}
      <Sidebar />

      {/* 2. Cột nội dung bên phải: Header (Titlebar) + Vùng cuộn chính */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Thanh tiêu đề Custom Titlebar Frameless */}
        <Titlebar />

        {/* Vùng cuộn nội dung chính với Zero-Latency Crossfade & Micro-Elevation */}
        <main
          key={currentTab}
          className="flex-1 h-full overflow-y-auto ambient-canvas transition-colors duration-200 animate-fade-in"
        >
          {renderContent()}
        </main>
      </div>

      {/* 3. Modal tìm kiếm nhanh Ctrl+K (Toàn cục) */}
      <SearchModal />

      {/* 4. Hộp thoại xác thực tài khoản trung tâm (Toàn cục) */}
      <AuthModal />

      {/* 5. Hộp thoại xác nhận hành động toàn cục (Thay thế triệt để window.confirm) */}
      <ConfirmDialog />

      {/* 6. Hệ thống thông báo nhanh toàn cục (Thay thế triệt để window.alert) */}
      <ToastContainer />
    </div>
  );
};
