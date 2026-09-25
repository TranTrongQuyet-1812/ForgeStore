import React, { useState } from 'react';
import { Sparkles, TrendingUp, Star, Clock } from 'lucide-react';
import { AppCard, AppCardData } from '../components/common/AppCard';

// Dữ liệu mẫu khởi đầu chuẩn xác từ 22 apps thực tế đã seed trên Supabase
const SAMPLE_APPS: AppCardData[] = [
  {
    id: 'rustdesk',
    tenApp: 'RustDesk',
    tacGia: 'rustdesk',
    moTaNgan: 'Phần mềm điều khiển máy tính từ xa mã nguồn mở, thay thế hoàn hảo cho TeamViewer.',
    soSaoGithub: 78400,
    phienBanMoiNhat: '1.3.8',
    diemUyTin: 95,
    danhMucChinh: 'Tiện ích hệ thống',
  },
  {
    id: 'obsidian',
    tenApp: 'Obsidian',
    tacGia: 'obsidianmd',
    moTaNgan:
      'Ứng dụng ghi chú kiến thức cá nhân dạng mạng lưới (Second Brain), hỗ trợ Markdown và bảo mật offline.',
    soSaoGithub: 112000,
    phienBanMoiNhat: '1.5.8',
    diemUyTin: 98,
    danhMucChinh: 'Văn phòng',
  },
  {
    id: 'newpipe',
    tenApp: 'NewPipe',
    tacGia: 'TeamNewPipe',
    moTaNgan:
      'Trình phát đa phương tiện tự do nhẹ nhàng, tôn trọng quyền riêng tư và không quảng cáo.',
    soSaoGithub: 32500,
    phienBanMoiNhat: '0.27.0',
    diemUyTin: 92,
    danhMucChinh: 'Đa phương tiện',
  },
  {
    id: 'sharex',
    tenApp: 'ShareX',
    tacGia: 'ShareX',
    moTaNgan:
      'Công cụ chụp ảnh màn hình, quay video và chia sẻ tệp mã nguồn mở miễn phí hàng đầu trên Windows.',
    soSaoGithub: 28900,
    phienBanMoiNhat: '16.1.0',
    diemUyTin: 96,
    danhMucChinh: 'Tiện ích hệ thống',
  },
  {
    id: 'notepad-plus-plus',
    tenApp: 'Notepad++',
    tacGia: 'notepad-plus-plus',
    moTaNgan:
      'Trình soạn thảo mã nguồn và văn bản gọn nhẹ, tốc độ cao được hàng triệu lập trình viên tin dùng.',
    soSaoGithub: 24200,
    phienBanMoiNhat: '8.6.9',
    diemUyTin: 94,
    danhMucChinh: 'Lập trình',
  },
  {
    id: 'bitwarden',
    tenApp: 'Bitwarden Client',
    tacGia: 'bitwarden',
    moTaNgan:
      'Trình quản lý mật khẩu mã hóa đầu cuối an toàn, đồng bộ đa nền tảng và minh bạch mã nguồn.',
    soSaoGithub: 36100,
    phienBanMoiNhat: '2024.9.0',
    diemUyTin: 97,
    danhMucChinh: 'Bảo mật',
  },
];

const CATEGORIES = [
  'Tất cả',
  'Lập trình',
  'Đa phương tiện',
  'Bảo mật',
  'Tiện ích hệ thống',
  'Văn phòng',
];

export const ExplorePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeTab, setActiveTab] = useState<'stars' | 'trending' | 'recent'>('stars');

  const filteredApps =
    activeCategory === 'Tất cả'
      ? SAMPLE_APPS
      : SAMPLE_APPS.filter((a) => a.danhMucChinh === activeCategory);

  return (
    <div className="flex flex-col gap-6 p-6 pb-12 select-none">
      {/* 1. Hero Showcase Carousel Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-950/40 via-surface-elevated to-surface border border-border p-6 md:p-8 flex flex-col justify-between min-h-[180px] shadow-lg">
        <div className="max-w-xl z-10 flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-forge/15 border border-accent-forge/30 text-accent-forge text-xs font-semibold w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tiêu biểu trong tuần</span>
          </div>
          <h2 className="text-2xl font-bold font-display text-primary">
            Khám Phá Phần Mềm Mã Nguồn Mở Tự Do
          </h2>
          <p className="text-xs text-secondary leading-relaxed">
            Hàng nghìn ứng dụng đỉnh cao trên GitHub được tuyển chọn, tóm tắt tính năng bằng Gemini
            và thẩm định quyền hạn an toàn với Jev AI.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-accent-forge/10 to-transparent pointer-events-none"></div>
      </div>

      {/* 2. Dải Chip Lọc Danh Mục & Tab Sắp Xếp */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        {/* Tab sắp xếp: Top Sao, Thịnh Hành, Mới Cập Nhật */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs">
          <button
            onClick={() => setActiveTab('stars')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'stars'
                ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                : 'text-muted hover:text-secondary'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Top Sao</span>
          </button>

          <button
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'trending'
                ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                : 'text-muted hover:text-secondary'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-accent-forge" />
            <span>Thịnh Hành</span>
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'recent'
                ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                : 'text-muted hover:text-secondary'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-accent-ai" />
            <span>Mới Cập Nhật</span>
          </button>
        </div>

        {/* Dải chip lọc danh mục */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-accent-forge text-white shadow-sm'
                  : 'bg-surface hover:bg-surface-elevated text-secondary hover:text-primary border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Lưới Thẻ App Chuẩn 3 Cột Rộng Rãi Thoáng Đãng (per Web Dev specs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredApps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
};
