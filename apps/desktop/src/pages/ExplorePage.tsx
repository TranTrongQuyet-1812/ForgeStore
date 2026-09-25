import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  Clock,
  Download,
  Check,
  Flame,
  ArrowUpRight,
  Shield,
  RefreshCw,
  AlertCircle,
  PackageOpen,
} from 'lucide-react';
import { AppCard, AppCardData } from '../components/common/AppCard';
import { TrustPill } from '../components/common/TrustPill';
import { useNavStore } from '../stores/useNavStore';
import { storeService } from '../services/store/store-service';
import type { UngDungTomTatDto } from '@forgestore/types';

type SpotlightMode = 'trending' | 'curated' | 'security';
type TimeWindow = 'today' | 'week' | 'month';
type SortTab = 'trending' | 'stars' | 'recent';

// Dữ liệu mẫu dự phòng khi server backend chưa phản hồi hoặc offline
const FALLBACK_APPS: AppCardData[] = [
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
    soSaoGithub: 124400,
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
    id: 'powertoys',
    tenApp: 'PowerToys',
    repoHandle: 'microsoft/PowerToys',
    tacGia: 'microsoft',
    moTaNgan:
      'Bộ công cụ tinh chỉnh và gia tăng năng suất tối thượng cho người dùng nâng cao trên Windows 11.',
    soSaoGithub: 139000,
    starDelta: '+1.8k tuần này',
    phienBanMoiNhat: 'v0.84.0',
    kichThuocFile: '68.4 MB',
    dinhDangFile: ['EXE', 'MSI'],
    kienTruc: ['x64', 'ARM64'],
    diemUyTin: 100,
    danhMucChinh: 'Tiện ích hệ thống',
    giayPhep: 'MIT',
    isVerifiedFoss: true,
  },
  {
    id: 'localsend',
    tenApp: 'LocalSend',
    repoHandle: 'localsend/localsend',
    tacGia: 'localsend',
    moTaNgan:
      'Chia sẻ tệp tin và tin nhắn an toàn, tức thì qua mạng Wi-Fi nội bộ mà không cần Internet.',
    soSaoGithub: 92600,
    starDelta: '+1.1k tuần này',
    phienBanMoiNhat: 'v1.14.0',
    kichThuocFile: '24.1 MB',
    dinhDangFile: ['EXE'],
    kienTruc: ['x64', 'ARM64'],
    diemUyTin: 95,
    danhMucChinh: 'Mạng & Giao tiếp',
    giayPhep: 'MIT',
    isVerifiedFoss: true,
  },
  {
    id: 'vlc',
    tenApp: 'VLC Media Player',
    repoHandle: 'videolan/vlc',
    tacGia: 'VideoLAN',
    moTaNgan:
      'Trình phát đa phương tiện mã nguồn mở tự do, hỗ trợ phát mọi định dạng audio/video không cần codec phụ.',
    soSaoGithub: 19800,
    starDelta: '+290 tuần này',
    phienBanMoiNhat: 'v3.0.21',
    kichThuocFile: '42.0 MB',
    dinhDangFile: ['EXE', 'MSI'],
    kienTruc: ['x64'],
    diemUyTin: 100,
    danhMucChinh: 'Đa phương tiện',
    giayPhep: 'GPL-2.0',
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
    danhMucChinh: 'Bảo mật & Quyền riêng tư',
    giayPhep: 'GPL-3.0',
    isVerifiedFoss: true,
  },
];

const CATEGORIES = [
  'Tất cả',
  'Tiện ích hệ thống',
  'Lập trình & Phát triển',
  'Đa phương tiện',
  'Mạng & Giao tiếp',
  'Bảo mật & Quyền riêng tư',
  'Học tập & Giáo dục',
  'Năng suất & Văn phòng',
];

interface SpotlightConfig {
  app: AppCardData;
  badge: string;
  badgeIcon: React.ReactNode;
  subtitle: string;
  quote: string;
  gradient: string;
}

export const ExplorePage: React.FC = () => {
  const { openAppDetail } = useNavStore();
  const [spotlightMode, setSpotlightMode] = useState<SpotlightMode>('trending');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeSort, setActiveSort] = useState<SortTab>('trending');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');

  // Đấu nối TanStack Query: Nạp danh sách ứng dụng sống từ Supabase Backend (P3-05.1)
  const {
    data: appsResponse,
    isLoading: isAppsLoading,
    isError: isAppsError,
    refetch: refetchApps,
  } = useQuery({
    queryKey: ['store-apps', activeCategory, activeSort],
    queryFn: () =>
      storeService.layDanhSachApps({
        platform: 'windows',
        category: activeCategory !== 'Tất cả' ? activeCategory : undefined,
        sort: activeSort,
        page: 1,
        limit: 30,
      }),
    staleTime: 1000 * 60 * 3, // 3 phút cache
  });

  // Đấu nối TanStack Query: Nạp các ứng dụng nổi bật (Featured Apps)
  const { data: featuredAppsData } = useQuery({
    queryKey: ['featured-apps'],
    queryFn: () => storeService.layAppsNoiBat(),
    staleTime: 1000 * 60 * 10,
  });

  // Chuyển đổi dữ liệu backend DTO sang AppCardData, ưu tiên dữ liệu sống
  const liveApps = useMemo(() => {
    if (appsResponse?.duLieu && appsResponse.duLieu.length > 0) {
      return appsResponse.duLieu.map((dto: UngDungTomTatDto) => storeService.mapDtoToAppCard(dto));
    }
    return FALLBACK_APPS;
  }, [appsResponse]);

  const featuredAppsList = useMemo(() => {
    if (featuredAppsData && featuredAppsData.length > 0) {
      return featuredAppsData.map((dto: UngDungTomTatDto) => storeService.mapDtoToAppCard(dto));
    }
    return FALLBACK_APPS;
  }, [featuredAppsData]);

  // Cấu hình Spotlight tương ứng với 3 chế độ
  const spotlightConfigs: Record<SpotlightMode, SpotlightConfig> = useMemo(() => {
    // Top app nhiều sao nhất làm quán quân Trending
    const topStarApp =
      [...featuredAppsList].sort((a, b) => b.soSaoGithub - a.soSaoGithub)[0] || FALLBACK_APPS[2];

    // App đề xuất (RustDesk hoặc LocalSend)
    const curatedApp =
      featuredAppsList.find((a) => a.repoHandle?.includes('rustdesk')) ||
      featuredAppsList[1] ||
      FALLBACK_APPS[1];

    // App an toàn cao nhất (Jev AI 97-100)
    const securityApp =
      featuredAppsList.find((a) => a.diemUyTin >= 97) || featuredAppsList[0] || FALLBACK_APPS[5];

    return {
      trending: {
        app: topStarApp,
        badge: 'QUÁN QUÂN XU HƯỚNG GIT',
        badgeIcon: <Flame className="w-3.5 h-3.5 fill-accent-forge text-accent-forge" />,
        subtitle: `Dẫn đầu cộng đồng FOSS (${((topStarApp.soSaoGithub || 0) / 1000).toFixed(0)}k sao)`,
        quote: `"${topStarApp.moTaNgan}"`,
        gradient: 'from-orange-500 to-amber-600',
      },
      curated: {
        app: curatedApp,
        badge: 'FORGE ĐỀ XUẤT • TIÊU ĐIỂM FOSS',
        badgeIcon: <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />,
        subtitle: 'Tuyển chọn chất lượng: mã nguồn minh bạch, hiệu năng cao',
        quote: `"${curatedApp.moTaNgan}"`,
        gradient: 'from-purple-500 to-indigo-600',
      },
      security: {
        app: securityApp,
        badge: `AN TOÀN TUYỆT ĐỐI • JEV AI ${securityApp.diemUyTin}/100`,
        badgeIcon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
        subtitle: 'Thẩm định an toàn tự động bởi Dual-AI & Jev Protocol',
        quote: `"${securityApp.moTaNgan}"`,
        gradient: 'from-blue-600 to-cyan-600',
      },
    };
  }, [featuredAppsList]);

  const currentSpotlight = spotlightConfigs[spotlightMode];
  const spotlightApp = currentSpotlight.app;

  // Xử lý lọc danh mục và sắp xếp cục bộ nếu đang dùng fallback
  const processedApps = useMemo(() => {
    let result = [...liveApps];

    if (activeCategory !== 'Tất cả') {
      result = result.filter((a) => a.danhMucChinh === activeCategory);
    }

    if (activeSort === 'stars') {
      result.sort((a, b) => b.soSaoGithub - a.soSaoGithub);
    }

    return result;
  }, [liveApps, activeCategory, activeSort]);

  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full select-none animate-fade-in">
      {/* 1. DUAL-LENS INTERACTIVE SPOTLIGHT STAGE (Trụ cột 4: Morphing Breathe Transition) */}
      <section className="tactile-card relative overflow-hidden rounded-2xl p-6 md:p-8 border border-border/80">
        <div className="relative z-10 flex flex-col gap-5">
          {/* Hàng trên: Bộ chọn 3 chế độ Spotlight */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border">
              <button
                onClick={() => setSpotlightMode('trending')}
                className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
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
                className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
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
                className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
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
              {spotlightMode === 'trending' &&
                'Dữ liệu đo lường tốc độ tăng sao Git trực tiếp từ GitHub'}
              {spotlightMode === 'curated' &&
                'Tuyển chọn biên tập: FOSS chất lượng cao, chuẩn Windows'}
              {spotlightMode === 'security' && 'Thẩm định bảo mật tự động bởi Jev AI Protocol'}
            </span>
          </div>

          {/* Khung nội dung chính của Spotlight với Morphing Fade Animation */}
          <div
            key={spotlightMode}
            className="animate-fade-in flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pt-1"
          >
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
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentSpotlight.gradient} flex items-center justify-center font-bold text-2xl font-display text-white shadow-lg shrink-0 overflow-hidden`}
                >
                  {spotlightApp.iconUrl ? (
                    <img
                      src={spotlightApp.iconUrl}
                      alt={spotlightApp.tenApp}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    spotlightApp.tenApp.charAt(0)
                  )}
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
                  {spotlightApp.kienTruc?.join(' & ') || 'x64'}
                </span>
                {spotlightApp.kichThuocFile && (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated/70 text-xs font-mono text-secondary border border-border/60">
                    {spotlightApp.kichThuocFile}
                  </span>
                )}
                <TrustPill score={spotlightApp.diemUyTin} size="sm" showLabel />
              </div>
            </div>

            {/* Cột phải: CTA Cài đặt 1-Click & Phân tích AI */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={() => openAppDetail(spotlightApp.id)}
                className="btn-tactile h-11 px-6 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/30"
              >
                <Download className="w-4 h-4" />
                <span>Cài Đặt 1-Click</span>
              </button>

              <button
                onClick={() => openAppDetail(spotlightApp.id)}
                className="btn-tactile h-10 px-5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary font-medium text-xs flex items-center justify-center gap-1.5 border border-border transition-colors"
              >
                <span>Xem phân tích Dual-AI</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THANH CÔNG CỤ LỌC & SẮP XẾP HỢP NHẤT (P3-05.2 & P3-05.3) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border pb-3">
          {/* Cụm tab sắp xếp + Toggle khung thời gian GitHub */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-medium">
              <button
                onClick={() => setActiveSort('trending')}
                className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
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
                className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
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
                className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'recent'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-accent-ai" />
                <span>Mới Cập Nhật</span>
              </button>
            </div>

            {/* Toggle khung thời gian (Hôm nay / Tuần này / Tháng này) khi ở tab Thịnh Hành */}
            {activeSort === 'trending' && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-mono">
                <button
                  onClick={() => setTimeWindow('today')}
                  className={`btn-tactile px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'today'
                      ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => setTimeWindow('week')}
                  className={`btn-tactile px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'week'
                      ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Tuần này
                </button>
                <button
                  onClick={() => setTimeWindow('month')}
                  className={`btn-tactile px-2.5 py-1 rounded-lg transition-colors ${
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

          {/* Dải chip lọc danh mục chuẩn CSDL */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === category
                    ? 'bg-accent-forge text-white shadow-sm font-semibold'
                    : 'bg-surface hover:bg-surface-elevated text-secondary hover:text-primary border border-border'
                }`}
              >
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. LƯỚI THẺ ỨNG DỤNG 3 CỘT RỘNG RÃI (Trụ cột 2: Sibling Stagger Wave < 120ms) */}
        {isAppsLoading ? (
          /* Trạng thái Skeleton Shimmer chống giật layout (CLS = 0) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="tactile-card flex flex-col justify-between p-4 rounded-xl min-h-[170px] select-none"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl skeleton-shimmer shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="w-32 h-4 rounded skeleton-shimmer" />
                    <div className="w-48 h-3 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="w-full h-8 mt-4 rounded skeleton-shimmer" />
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                  <div className="w-16 h-5 rounded-full skeleton-shimmer" />
                  <div className="w-20 h-7 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : isAppsError ? (
          /* Trạng thái Lỗi kết nối kèm nút Thử lại */
          <div className="p-8 rounded-2xl bg-surface border border-red-500/20 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-primary">Không thể kết nối máy chủ Store</h3>
            <p className="text-xs text-muted max-w-md">
              Đang hiển thị dữ liệu lưu tạm. Vui lòng kiểm tra lại dịch vụ Backend hoặc bấm thử lại.
            </p>
            <button
              onClick={() => refetchApps()}
              className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold flex items-center gap-2 border border-border"
            >
              <RefreshCw className="w-3.5 h-3.5 text-accent-forge" />
              <span>Thử lại ngay</span>
            </button>
          </div>
        ) : processedApps.length === 0 ? (
          /* Trạng thái Không có ứng dụng phù hợp bộ lọc */
          <div className="p-12 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-muted">
              <PackageOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-primary">Chưa có ứng dụng trong danh mục này</h3>
            <p className="text-xs text-muted max-w-sm">
              Không tìm thấy ứng dụng nào thuộc danh mục "{activeCategory}". Ông hãy thử chọn danh
              mục khác nhé!
            </p>
            <button
              onClick={() => setActiveCategory('Tất cả')}
              className="btn-tactile mt-2 px-4 py-1.5 rounded-lg bg-accent-forge text-white text-xs font-semibold"
            >
              Xem tất cả ứng dụng
            </button>
          </div>
        ) : (
          /* Lưới ứng dụng thật với hiệu ứng Sibling Stagger Wave */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedApps.map((app, index) => (
              <AppCard key={app.id} app={app} staggerIndex={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
