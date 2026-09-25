import React from 'react';
import { Heart } from 'lucide-react';
import { AppCard } from '../components/common/AppCard';

export const FavoritesPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full select-none">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          <span>Kho Yêu Thích Đồng Bộ Đám Mây</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Các ứng dụng bạn đã lưu trữ sẽ tự động đồng bộ sang ứng dụng ForgeStore Mobile (Module 4)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AppCard
          app={{
            id: 'obsidian',
            tenApp: 'Obsidian',
            tacGia: 'obsidianmd',
            moTaNgan:
              'Ứng dụng ghi chú kiến thức cá nhân dạng mạng lưới (Second Brain), hỗ trợ Markdown và bảo mật offline.',
            soSaoGithub: 112000,
            phienBanMoiNhat: '1.5.8',
            diemUyTin: 98,
            danhMucChinh: 'Văn phòng',
          }}
        />
        <AppCard
          app={{
            id: 'newpipe',
            tenApp: 'NewPipe',
            tacGia: 'TeamNewPipe',
            moTaNgan:
              'Trình phát đa phương tiện tự do nhẹ nhàng, tôn trọng quyền riêng tư và không quảng cáo.',
            soSaoGithub: 32500,
            phienBanMoiNhat: '0.27.0',
            diemUyTin: 92,
            danhMucChinh: 'Đa phương tiện',
          }}
        />
      </div>
    </div>
  );
};
