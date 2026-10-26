import React from 'react';
import { ThanhTieuDe } from './ThanhTieuDe';
import { ThanhBen } from './ThanhBen';
import { useDieuHuongStore } from '../../kho-trang-thai/useDieuHuongStore';
import { TrangKhamPha } from '../../trang/TrangKhamPha';
import { TrangChiTiet } from '../../trang/TrangChiTiet';
import { TrangThuVien } from '../../trang/TrangThuVien';
import { TrangYeuThich } from '../../trang/TrangYeuThich';
import { TrangDanhMuc } from '../../trang/TrangDanhMuc';
import { TrangCaiDat } from '../../trang/TrangCaiDat';
import { HopThoaiTimKiem } from '../tim-kiem/HopThoaiTimKiem';
import { HopThoaiXacThuc } from '../xac-thuc/HopThoaiXacThuc';
import { HopThoaiXacNhan } from '../dung-chung/HopThoaiXacNhan';
import { KhungThongBao } from '../dung-chung/KhungThongBao';

export const BoCucUngDung: React.FC = () => {
  const { currentTab } = useDieuHuongStore();

  const renderContent = () => {
    switch (currentTab) {
      case 'explore':
        return <TrangKhamPha />;
      case 'detail':
        return <TrangChiTiet />;
      case 'library':
        return <TrangThuVien />;
      case 'favorites':
        return <TrangYeuThich />;
      case 'categories':
        return <TrangDanhMuc />;
      case 'settings':
        return <TrangCaiDat />;
      default:
        return <TrangKhamPha />;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-canvas text-primary font-body select-none">
      {/* 1. Thanh điều hướng dọc Full-Height ThanhBen (260px) */}
      <ThanhBen />

      {/* 2. Cột nội dung bên phải: Header (ThanhTieuDe) + Vùng cuộn chính */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Thanh tiêu đề Custom ThanhTieuDe Frameless */}
        <ThanhTieuDe />

        {/* Vùng cuộn nội dung chính với Zero-Latency Crossfade & Micro-Elevation */}
        <main
          key={currentTab}
          className="flex-1 h-full overflow-y-auto ambient-canvas transition-colors duration-200 animate-fade-in"
        >
          {renderContent()}
        </main>
      </div>

      {/* 3. Modal tìm kiếm nhanh Ctrl+K (Toàn cục) */}
      <HopThoaiTimKiem />

      {/* 4. Hộp thoại xác thực tài khoản trung tâm (Toàn cục) */}
      <HopThoaiXacThuc />

      {/* 5. Hộp thoại xác nhận hành động toàn cục (Thay thế triệt để window.confirm) */}
      <HopThoaiXacNhan />

      {/* 6. Hệ thống thông báo nhanh toàn cục (Thay thế triệt để window.alert) */}
      <KhungThongBao />
    </div>
  );
};
