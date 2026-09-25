import React, { useState, useMemo } from 'react';
import { Star, Clock, Download, Check, Flame, ArrowUpRight, Shield } from 'lucide-react';
import { AppCard, AppCardData } from '../components/common/AppCard';
import { TrustPill } from '../components/common/TrustPill';
import { useNavStore } from '../stores/useNavStore';

type SpotlightMode = 'trending' | 'curated' | 'security';
type TimeWindow = 'today' | 'week' | 'month';
type SortTab = 'trending' | 'stars' | 'recent';

const SAMPLE_APPS: AppCardData[] = [
  {
    id: 'obsidian',
    tenApp: 'Obsidian',
    repoHandle: 'obsidianmd/obsidian-releases',
    tacGia: 'Dynalist Inc.',
    moTaNgan:
      'Ứng dụng ghi chú kiến thức cá nhân dạng mạng lưới (Second Brain), hỗ trợ Markdown và bảo mật dữ liệu offline.',
    soSaoGithub: 112000,
    starDelta: '+2.1k tuần này',
    phienBanMoiNhat: 'v1.5.8',
    kichThuocFile: '74.5 MB',
    dinhDangFile: ['EXE'],
    kienTruc: ['x64', 'ARM64'],
    diemUyTin: 98,
    danhMucChinh: 'Văn phòng',
    giayPhep: 'Freeware',
    isVerifiedFoss: true,
  },
  {
    id: 'rustdesk',
    tenApp: 'RustDesk',
    repoHandle: 'rustdesk/rustdesk',
    tacGia: 'RustDesk Team',
    moTaNgan:
      'Phần mềm điều khiển máy tính từ xa mã nguồn mở an toàn, thay thế hoàn hảo cho TeamViewer và AnyDesk.',
    soSaoGithub: 78400,
    starDelta: '+1.4k tuần này',
    phienBanMoiNhat: 'v1.3.8',
    kichThuocFile: '18.2 MB',
    dinhDangFile: ['EXE', 'MSI'],
    kienTruc: ['x64', 'ARM64'],
    diemUyTin: 95,
    danhMucChinh: 'Tiện ích hệ thống',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
  {
    id: 'bitwarden',
    tenApp: 'Bitwarden Client',
    repoHandle: 'bitwarden/clients',
    tacGia: 'Bitwarden Inc.',
    moTaNgan:
      'Trình quản lý mật khẩu mã hóa đầu cuối an toàn, minh bạch mã nguồn, tự động điền form và đồng bộ đa nền tảng.',
    soSaoGithub: 36100,
    starDelta: '+920 tuần này',
    phienBanMoiNhat: 'v2024.9.0',
    kichThuocFile: '88.1 MB',
    dinhDangFile: ['EXE'],
    kienTruc: ['x64', 'ARM64'],
    diemUyTin: 97,
    danhMucChinh: 'Bảo mật',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
  {
    id: 'newpipe',
    tenApp: 'NewPipe',
    repoHandle: 'TeamNewPipe/NewPipe',
    tacGia: 'TeamNewPipe',
    moTaNgan:
      'Trình phát đa phương tiện tự do nhẹ nhàng, tôn trọng quyền riêng tư, hỗ trợ phát popup và tải video không quảng cáo.',
    soSaoGithub: 32500,
    starDelta: '+850 tuần này',
    phienBanMoiNhat: 'v0.27.0',
    kichThuocFile: '12.4 MB',
    dinhDangFile: ['APK'],
    kienTruc: ['ARM64', 'x86'],
    diemUyTin: 92,
    danhMucChinh: 'Đa phương tiện',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
  {
    id: 'sharex',
    tenApp: 'ShareX',
    repoHandle: 'ShareX/ShareX',
    tacGia: 'Jaex',
    moTaNgan:
      'Công cụ chụp ảnh màn hình, quay video, trích xuất OCR văn bản và chia sẻ tệp mã nguồn mở hàng đầu trên Windows.',
    soSaoGithub: 28900,
    starDelta: '+450 tuần này',
    phienBanMoiNhat: 'v16.1.0',
    kichThuocFile: '34.8 MB',
    dinhDangFile: ['EXE', 'ZIP'],
    kienTruc: ['x64'],
    diemUyTin: 96,
    danhMucChinh: 'Tiện ích hệ thống',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
  {
    id: 'notepad-plus-plus',
    tenApp: 'Notepad++',
    repoHandle: 'notepad-plus-plus/notepad-plus-plus',
    tacGia: 'Don Ho',
    moTaNgan:
      'Trình soạn thảo mã nguồn và văn bản siêu nhẹ, tốc độ cao được hàng triệu lập trình viên toàn cầu tin dùng.',
    soSaoGithub: 24200,
    starDelta: '+310 tuần này',
    phienBanMoiNhat: 'v8.6.9',
    kichThuocFile: '4.8 MB',
    dinhDangFile: ['EXE', 'MSI', 'ZIP'],
    kienTruc: ['x64', 'x86', 'ARM64'],
    diemUyTin: 94,
    danhMucChinh: 'Lập trình',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
];

const CATEGORIES = [
  { name: 'Tất cả', count: 22 },
  { name: 'Tiện ích hệ thống', count: 6 },
  { name: 'Đa phương tiện', count: 5 },
  { name: 'Lập trình', count: 4 },
  { name: 'Bảo mật', count: 3 },
  { name: 'Văn phòng', count: 4 },
];

interface SpotlightConfig {
  app: AppCardData;
  badge: string;
  badgeIcon: React.ReactNode;
  subtitle: string;
  quote: string;
  gradient: string;
}

const SPOTLIGHT_CONFIGS: Record<SpotlightMode, SpotlightConfig> = {
  trending: {
    app: SAMPLE_APPS[0], // Obsidian
    badge: 'QUÁN QUÂN XU HƯỚNG GIT',
    badgeIcon: <Flame className="w-3.5 h-3.5 fill-accent-forge text-accent-forge" />,
    subtitle: 'Tăng trưởng sao nhanh nhất tuần (+2.1k sao)',
    quote:
      '"Ứng dụng ghi chú kiến thức cá nhân dạng mạng lưới (Second Brain), hỗ trợ Markdown và bảo mật dữ liệu offline hàng đầu."',
    gradient: 'from-purple-500 to-indigo-600',
  },
  curated: {
    app: SAMPLE_APPS[1], // RustDesk
    badge: 'FORGE ĐỀ XUẤT • TIÊU ĐIỂM FOSS',
    badgeIcon: <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />,
    subtitle: 'Giải pháp điều khiển máy tính từ xa thay thế TeamViewer',
    quote:
      '"Giải pháp truy cập và điều khiển máy tính từ xa tự lưu trữ (self-hosted), bảo mật mã hóa đầu cuối NaCl và không phụ thuộc hạ tầng bên thứ ba."',
    gradient: 'from-orange-500 to-amber-600',
  },
  security: {
    app: SAMPLE_APPS[2], // Bitwarden
    badge: 'AN TOÀN TUYỆT ĐỐI • JEV AI 97/100',
    badgeIcon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
    subtitle: 'Mã hóa đầu cuối Zero-Knowledge, bảo vệ danh tính số',
    quote:
      '"Trình quản lý mật khẩu mã hóa đầu cuối an toàn, minh bạch mã nguồn, tự động điền form và bảo vệ thông tin đăng nhập đa nền tảng tuyệt đối."',
    gradient: 'from-blue-600 to-cyan-600',
  },
};

export const ExplorePage: React.FC = () => {
  const { openAppDetail } = useNavStore();
  const [spotlightMode, setSpotlightMode] = useState<SpotlightMode>('trending');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeSort, setActiveSort] = useState<SortTab>('trending');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');

  const currentSpotlight = SPOTLIGHT_CONFIGS[spotlightMode];
  const spotlightApp = currentSpotlight.app;

  const parseDelta = (delta?: string): number => {
    if (!delta) return 0;
    const matchK = delta.match(/([0-9.]+)\s*k/i);
    if (matchK) return Math.round(parseFloat(matchK[1]) * 1000);
    const matchNum = delta.match(/([0-9]+)/);
    return matchNum ? parseInt(matchNum[1], 10) : 0;
  };

  // Lọc theo danh mục và sắp xếp theo tab / khung thời gian
  const processedApps = useMemo(() => {
    let result = [...SAMPLE_APPS];

    if (activeCategory !== 'Tất cả') {
      result = result.filter((a) => a.danhMucChinh === activeCategory);
    }

    if (activeSort === 'stars') {
      result.sort((a, b) => b.soSaoGithub - a.soSaoGithub);
    } else if (activeSort === 'trending') {
      // Khi chọn Trending: sắp xếp theo delta sao chính xác (hỗ trợ hậu tố k)
      result.sort((a, b) => {
        const deltaA = parseDelta(a.starDelta);
        const deltaB = parseDelta(b.starDelta);
        return deltaB - deltaA;
      });
    }

    return result;
  }, [activeCategory, activeSort]);

  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full select-none">
      {/* 1. DUAL-LENS INTERACTIVE SPOTLIGHT STAGE (Phục vụ cả Dev lẫn Người dùng phổ thông) */}
      <section className="tactile-card relative overflow-hidden rounded-2xl p-6 md:p-8 border border-border/80">
        <div className="relative z-10 flex flex-col gap-5">
          {/* Hàng trên: Bộ chọn 3 chế độ Spotlight */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border">
              <button
                onClick={() => setSpotlightMode('trending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  spotlightMode === 'trending'
                    ? 'bg-accent-forge text-white shadow-sm font-semibold'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>🔥 Xu Hướng Git (#1)</span>
              </button>

              <button
                onClick={() => setSpotlightMode('curated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  spotlightMode === 'curated'
                    ? 'bg-accent-forge text-white shadow-sm font-semibold'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>⭐ Forge Đề Xuất</span>
              </button>

              <button
                onClick={() => setSpotlightMode('security')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  spotlightMode === 'security'
                    ? 'bg-accent-forge text-white shadow-sm font-semibold'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>🛡️ An Toàn Tuyệt Đối</span>
              </button>
            </div>

            <span className="text-xs font-mono text-muted">
              {spotlightMode === 'trending' && 'Dữ liệu đo lường tốc độ tăng sao Git 7 ngày qua'}
              {spotlightMode === 'curated' && 'Tuyển chọn biên tập: FOSS chất lượng cao, dễ dùng'}
              {spotlightMode === 'security' && 'Thẩm định bảo mật tự động bởi Jev AI'}
            </span>
          </div>

          {/* Khung nội dung chính của Spotlight */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pt-1">
            {/* Cột trái: Thông tin ứng dụng theo chế độ đang chọn */}
            <div className="flex-1 max-w-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-forge/20 text-accent-forge border border-accent-forge/40 flex items-center gap-1">
                  {currentSpotlight.badgeIcon}
                  <span>{currentSpotlight.badge}</span>
                </span>
                <span className="text-xs font-mono text-muted">{currentSpotlight.subtitle}</span>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentSpotlight.gradient} flex items-center justify-center font-bold text-2xl font-display text-white shadow-lg`}
                >
                  {spotlightApp.tenApp.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold font-display text-primary tracking-tight">
                      {spotlightApp.tenApp}
                    </h2>
                    {spotlightApp.isVerifiedFoss && (
                      <span className="text-emerald-400" title="Mã nguồn mở đã xác minh minh bạch">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted">
                    {spotlightApp.repoHandle} • ⭐ {formatStars(spotlightApp.soSaoGithub)} sao
                    GitHub
                    {spotlightApp.starDelta && (
                      <span className="text-emerald-400 font-semibold ml-1.5">
                        ({spotlightApp.starDelta})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <p className="text-sm text-secondary leading-relaxed mt-1">
                {currentSpotlight.quote}
              </p>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-xs font-mono text-primary border border-border">
                  {spotlightApp.phienBanMoiNhat} (Mới nhất)
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated/70 text-xs font-mono text-secondary border border-border/60">
                  {spotlightApp.kienTruc?.join(' & ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated/70 text-xs font-mono text-secondary border border-border/60">
                  {spotlightApp.kichThuocFile}
                </span>
                <TrustPill score={spotlightApp.diemUyTin} size="sm" showLabel />
              </div>
            </div>

            {/* Cột phải: CTA Cài đặt 1-Click & Phân tích AI */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={() => openAppDetail(spotlightApp.id)}
                className="h-11 px-6 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Cài Đặt 1-Click ({spotlightApp.kichThuocFile})</span>
              </button>

              <button
                onClick={() => openAppDetail(spotlightApp.id)}
                className="h-10 px-5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary font-medium text-xs flex items-center justify-center gap-1.5 border border-border transition-colors"
              >
                <span>Xem phân tích Dual-AI</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THANH CÔNG CỤ LỌC & SẮP XẾP HỢP NHẤT (Triệt tiêu khối lặp lại gây rối UX) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border pb-3">
          {/* Cụm tab sắp xếp + Toggle khung thời gian GitHub */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-medium">
              <button
                onClick={() => setActiveSort('trending')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'trending'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-accent-forge" />
                <span>Thịnh Hành</span>
              </button>

              <button
                onClick={() => setActiveSort('stars')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'stars'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Nhiều Sao Nhất</span>
              </button>

              <button
                onClick={() => setActiveSort('recent')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'recent'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-accent-ai" />
                <span>Mới Cập Nhật</span>
              </button>
            </div>

            {/* Toggle khung thời gian (Hôm nay / Tuần này / Tháng này) khi đang ở tab Thịnh Hành */}
            {activeSort === 'trending' && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-mono">
                <button
                  onClick={() => setTimeWindow('today')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'today'
                      ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => setTimeWindow('week')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'week'
                      ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Tuần này
                </button>
                <button
                  onClick={() => setTimeWindow('month')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'month'
                      ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Tháng này
                </button>
              </div>
            )}
          </div>

          {/* Dải chip lọc danh mục với số lượng */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === cat.name
                    ? 'bg-accent-forge text-white shadow-sm'
                    : 'bg-surface hover:bg-surface-elevated text-secondary hover:text-primary border border-border'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] font-mono ${activeCategory === cat.name ? 'text-white/80' : 'text-muted'}`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. LƯỚI THẺ ỨNG DỤNG 3 CỘT RỘNG RÃI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {processedApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      </section>
    </div>
  );
};
