import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
} from 'lucide-react';
import { TheUngDung, AppCardData } from '../thanh-phan/dung-chung/TheUngDung';
import { NhanTinCay } from '../thanh-phan/dung-chung/NhanTinCay';
import {
  KhungXuongCard,
  KhungXuongSpotlight,
  AsciiReveal,
} from '../thanh-phan/dung-chung/KhungXuongAscii';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { useDeviceInstalledApps } from '../hooks/useDeviceInstalledApps';
import type { InfiniteData } from '@tanstack/react-query';
import type { TrangKetQua, UngDungTomTatDto } from '@forgestore/types';
import { gopTrangUngDung, rutVeTrangDau } from './kham-pha.core';

type SpotlightMode = 'trending' | 'curated' | 'security';
type TimeWindow = 'today' | 'week' | 'month';
type SortTab = 'trending' | 'stars' | 'recent';

interface SpotlightConfig {
  app: AppCardData;
  badge: string;
  badgeIcon: React.ReactNode;
  subtitle: string;
  quote: string;
  gradient: string;
}

export const TrangKhamPha: React.FC = () => {
  const queryClient = useQueryClient();
  const { openAppDetail, selectedCategory, setSelectedCategory } = useDieuHuongStore();
  const { layTrangThaiCaiDat } = useDeviceInstalledApps();
  const [spotlightMode, setSpotlightMode] = useState<SpotlightMode>('trending');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeSort, setActiveSort] = useState<SortTab>('trending');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const diemCuoiDanhSachRef = useRef<HTMLDivElement>(null);
  const dangTaiTrangKeRef = useRef(false);

  const doiBoLoc = useCallback(
    (capNhat: () => void) => {
      // Thu gọn cache không hoạt động để khi quay lại bộ lọc cũ danh sách luôn bắt đầu từ trang đầu.
      queryClient.setQueriesData<InfiniteData<TrangKetQua<UngDungTomTatDto>, number>>(
        { queryKey: ['store-apps'], type: 'inactive' },
        (data) => rutVeTrangDau(data),
      );
      capNhat();
    },
    [queryClient],
  );

  // Cho phép dùng con lăn chuột (mouse wheel) cuộn ngang dải danh mục mượt mà
  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;

      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 2) return;

      const isAtStart = el.scrollLeft <= 1 && e.deltaY < 0;
      const isAtEnd = el.scrollLeft >= maxScroll - 2 && e.deltaY > 0;

      // Khi còn có thể cuộn ngang thì chặn cuộn dọc trang và cuộn ngang dải chip
      if (!isAtStart && !isAtEnd) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Đồng bộ danh mục khi được chọn từ TrangDanhMuc
  useEffect(() => {
    if (selectedCategory) {
      doiBoLoc(() => setActiveCategory(selectedCategory));
      setSelectedCategory(null);
    }
  }, [selectedCategory, setSelectedCategory, doiBoLoc]);

  // Đấu nối TanStack Query: Nạp danh sách ứng dụng sống từ Supabase Backend (P3-05.1 & B2)
  const {
    data: appsResponse,
    isLoading: isAppsLoading,
    isError: isAppsError,
    refetch: refetchApps,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: [
      'store-apps',
      activeCategory,
      activeSort,
      activeSort === 'trending' ? timeWindow : undefined,
    ],
    queryFn: ({ pageParam }) =>
      khoUngDungService.layDanhSachUngDung({
        platform: 'windows',
        category: activeCategory !== 'Tất cả' ? activeCategory : undefined,
        sort: activeSort,
        window: activeSort === 'trending' ? timeWindow : undefined,
        page: pageParam,
        limit: 30,
      }),
    initialPageParam: 1,
    getNextPageParam: (trangCuoi) =>
      trangCuoi.trangHienTai < trangCuoi.tongSoTrang ? trangCuoi.trangHienTai + 1 : undefined,
    staleTime: 1000 * 60 * 3, // 3 phút cache
    placeholderData: (previousData) => previousData, // FE-V3-06: Giữ dữ liệu cũ mượt mà khi đổi category/sort, chống nhấp nháy skeleton
  });

  const taiTrangKe = useCallback(() => {
    if (dangTaiTrangKeRef.current) return;
    dangTaiTrangKeRef.current = true;
    void fetchNextPage().finally(() => {
      dangTaiTrangKeRef.current = false;
    });
  }, [fetchNextPage]);

  useEffect(() => {
    const diemCuoi = diemCuoiDanhSachRef.current;
    if (
      !diemCuoi ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      isPlaceholderData
    )
      return;

    // Dừng tự tải khi lỗi để không lặp request liên tục; nút thử lại cho người dùng chủ động tiếp tục.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) taiTrangKe();
      },
      { rootMargin: '320px' },
    );
    observer.observe(diemCuoi);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, taiTrangKe]);

  // Đấu nối TanStack Query: Nạp các ứng dụng nổi bật (Featured Apps)
  const { data: featuredAppsData, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ['featured-apps'],
    queryFn: () => khoUngDungService.layUngDungNoiBat(),
    staleTime: 1000 * 60 * 10,
  });

  // Đấu nối TanStack Query: Nạp danh mục ứng dụng động có app khả dụng trên Windows (K3)
  const { data: serverCategories = [] } = useQuery({
    queryKey: ['store-categories', 'windows'],
    queryFn: () => khoUngDungService.layDanhSachDanhMuc('windows'),
    staleTime: 1000 * 60 * 5, // 5 phút cache
  });

  // Dựng danh sách chips động từ API (K3), luôn có 'Tất cả' ở đầu
  const displayCategories = useMemo(() => {
    const tongTatCa = serverCategories.reduce((sum, c) => sum + c.soLuong, 0);
    return [{ ten: 'Tất cả', soLuong: tongTatCa }, ...serverCategories];
  }, [serverCategories]);

  // Tự động fallback về 'Tất cả' nếu category đang chọn không có app trên Windows
  useEffect(() => {
    if (
      serverCategories.length > 0 &&
      activeCategory !== 'Tất cả' &&
      !serverCategories.some((c) => c.ten === activeCategory)
    ) {
      doiBoLoc(() => setActiveCategory('Tất cả'));
    }
  }, [serverCategories, activeCategory, doiBoLoc]);

  // Chuyển đổi dữ liệu backend DTO sang AppCardData, hoàn toàn từ dữ liệu sống (B3)
  const liveAppPages = useMemo(() => {
    const trangDaGop = gopTrangUngDung(appsResponse?.pages ?? []);
    return trangDaGop.map((trang) =>
      trang.map((dto: UngDungTomTatDto) => khoUngDungService.anhXaDtoSangTheUngDung(dto)),
    );
  }, [appsResponse]);

  const featuredAppsList = useMemo(() => {
    if (featuredAppsData && featuredAppsData.length > 0) {
      return featuredAppsData.map((dto: UngDungTomTatDto) =>
        khoUngDungService.anhXaDtoSangTheUngDung(dto),
      );
    }
    return [];
  }, [featuredAppsData]);

  // Cấu hình Spotlight tương ứng với 3 chế độ (chỉ khi có featuredAppsList)
  const spotlightConfigs: Record<SpotlightMode, SpotlightConfig> | null = useMemo(() => {
    if (featuredAppsList.length === 0) return null;

    // Top app nhiều sao nhất làm quán quân Trending
    const topStarApp =
      [...featuredAppsList].sort((a, b) => b.soSaoGithub - a.soSaoGithub)[0] || featuredAppsList[0];

    // App đề xuất (RustDesk hoặc app thứ 2)
    const curatedApp =
      featuredAppsList.find((a) => a.repoHandle?.includes('rustdesk')) ||
      featuredAppsList[1] ||
      featuredAppsList[0];

    // App uy tín cao nhất (Điểm uy tín >= 97)
    const securityApp =
      featuredAppsList.find((a) => (a.diemUyTin ?? 0) >= 97) || featuredAppsList[0];

    return {
      trending: {
        app: topStarApp,
        badge: 'ĐANG ĐƯỢC QUAN TÂM',
        badgeIcon: <Flame className="w-3.5 h-3.5 fill-accent-forge text-accent-forge-text" />,
        subtitle: `Dẫn đầu cộng đồng FOSS (${((topStarApp.soSaoGithub || 0) / 1000).toFixed(0)}k sao)`,
        quote: `"${topStarApp.moTaNgan}"`,
        gradient: 'from-accent-forge to-warning',
      },
      curated: {
        app: curatedApp,
        badge: 'FORGE ĐỀ XUẤT • TIÊU ĐIỂM FOSS',
        badgeIcon: <Star className="w-3.5 h-3.5 fill-warning text-warning" />,
        subtitle: 'Tuyển chọn chất lượng: mã nguồn minh bạch, hiệu năng cao',
        quote: `"${curatedApp.moTaNgan}"`,
        gradient: 'from-accent-ai to-accent-ai',
      },
      security: {
        app: securityApp,
        badge: `ĐIỂM UY TÍN CAO • ${securityApp.diemUyTin || 100}/100`,
        badgeIcon: <Shield className="w-3.5 h-3.5 text-success" />,
        subtitle: 'Đánh giá dựa trên lịch sử kho mã và tính minh bạch',
        quote: `"${securityApp.moTaNgan}"`,
        gradient: 'from-accent-ai to-accent-ai',
      },
    };
  }, [featuredAppsList]);

  const currentSpotlight = spotlightConfigs ? spotlightConfigs[spotlightMode] : null;
  const spotlightApp = currentSpotlight?.app;

  // Sử dụng dữ liệu ứng dụng sống từ API Backend
  const processedApps = liveAppPages.flat();

  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full select-none animate-fade-in">
      {/* 1. DUAL-LENS INTERACTIVE SPOTLIGHT STAGE (Chỉ hiển thị khi có dữ liệu thật từ Backend) */}
      {isFeaturedLoading ? (
        <KhungXuongSpotlight variant="dither" />
      ) : currentSpotlight && spotlightApp ? (
        <AsciiReveal key={spotlightMode} preset="dither" duration="fast" origin="center">
          <section
            data-ascii="surface"
            className="surface-card relative overflow-hidden rounded-2xl p-6 md:p-8 border border-border"
          >
            <div className="relative z-10 flex flex-col gap-5">
              {/* Hàng trên: Bộ chọn 3 chế độ Spotlight */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border">
                  <button
                    onClick={() => setSpotlightMode('trending')}
                    className={`btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all outline-none ${
                      spotlightMode === 'trending'
                        ? 'bg-surface-elevated text-primary font-semibold shadow-xs border border-border-focus'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    {spotlightMode === 'trending' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0" />
                    )}
                    <span>Đang được quan tâm</span>
                  </button>

                  <button
                    onClick={() => setSpotlightMode('curated')}
                    className={`btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all outline-none ${
                      spotlightMode === 'curated'
                        ? 'bg-surface-elevated text-primary font-semibold shadow-xs border border-border-focus'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    {spotlightMode === 'curated' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0" />
                    )}
                    <span>Forge Đề Xuất</span>
                  </button>

                  <button
                    onClick={() => setSpotlightMode('security')}
                    className={`btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all outline-none ${
                      spotlightMode === 'security'
                        ? 'bg-surface-elevated text-primary font-semibold shadow-xs border border-border-focus'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    {spotlightMode === 'security' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0" />
                    )}
                    <span>Điểm uy tín cao</span>
                  </button>
                </div>

                <span className="text-xs font-mono text-muted">
                  {spotlightMode === 'trending' && 'Ứng dụng được cộng đồng quan tâm nhiều nhất'}
                  {spotlightMode === 'curated' &&
                    'Tuyển chọn chất lượng: mã nguồn mở, hoạt động ổn định'}
                  {spotlightMode === 'security' && 'Ứng dụng đạt điểm uy tín cao nhất từ kho mã'}
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
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-forge/20 text-accent-forge-text border border-accent-forge/40 flex items-center gap-1">
                      {currentSpotlight.badgeIcon}
                      <span>{currentSpotlight.badge}</span>
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {currentSpotlight.subtitle}
                    </span>
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
                          <span className="text-success" title="Mã nguồn mở đã xác minh minh bạch">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted">
                        {spotlightApp.repoHandle} • ⭐ {formatStars(spotlightApp.soSaoGithub)} sao
                        GitHub
                        {spotlightApp.starDelta && (
                          <span className="text-success font-semibold ml-1.5">
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
                    <NhanTinCay score={spotlightApp.diemUyTin} size="sm" showLabel />
                  </div>
                </div>

                {/* Cột phải: CTA Cài đặt 1-Click / Đã cài & Phân tích (L-02) */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
                  {(() => {
                    const spotlightTrangThai = layTrangThaiCaiDat(
                      spotlightApp.id,
                      spotlightApp.repoHandle,
                    );
                    const isInstalled = spotlightTrangThai.trangThai === 'DA_CAI_DAT';
                    const isProcessing =
                      spotlightTrangThai.trangThai === 'DANG_TAI' ||
                      spotlightTrangThai.trangThai === 'XAC_MINH' ||
                      spotlightTrangThai.trangThai === 'DANG_CAI_DAT';

                    return (
                      <button
                        onClick={() => openAppDetail(spotlightApp.id)}
                        className={`btn-tactile h-11 px-6 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                          isInstalled
                            ? 'bg-success-solid hover:bg-success-solid/90 text-white shadow-black/30'
                            : isProcessing
                              ? 'bg-accent-forge/80 text-on-accent shadow-black/30'
                              : 'bg-accent-forge hover:bg-accent-forge-hover text-on-accent shadow-black/30'
                        }`}
                      >
                        {isInstalled ? (
                          <>
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>{spotlightTrangThai.label}</span>
                          </>
                        ) : isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{spotlightTrangThai.label}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Cài Đặt 1-Click</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => openAppDetail(spotlightApp.id)}
                    className="btn-tactile h-10 px-5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary font-medium text-xs flex items-center justify-center gap-1.5 border border-border transition-colors"
                  >
                    <span>Xem chi tiết ứng dụng</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </AsciiReveal>
      ) : null}

      {/* 2. THANH CÔNG CỤ LỌC & SẮP XẾP HỢP NHẤT (P3-05.2 & P3-05.3) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border pb-3">
          {/* Cụm tab sắp xếp + Toggle khung thời gian GitHub */}
          <div className="shrink-0 flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar">
            <div className="shrink-0 flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-medium">
              <button
                onClick={() => doiBoLoc(() => setActiveSort('trending'))}
                className={`btn-tactile shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'trending'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Flame
                  className={`w-3.5 h-3.5 shrink-0 ${activeSort === 'trending' ? 'text-accent-forge-text' : 'text-muted'}`}
                />
                <span className="whitespace-nowrap">Thịnh Hành</span>
              </button>

              <button
                onClick={() => doiBoLoc(() => setActiveSort('stars'))}
                className={`btn-tactile shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'stars'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 shrink-0 ${activeSort === 'stars' ? 'text-accent-forge-text' : 'text-muted'}`}
                />
                <span className="whitespace-nowrap">Nhiều Sao Nhất</span>
              </button>

              <button
                onClick={() => doiBoLoc(() => setActiveSort('recent'))}
                className={`btn-tactile shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSort === 'recent'
                    ? 'bg-surface-elevated text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${activeSort === 'recent' ? 'text-accent-forge-text' : 'text-muted'}`}
                />
                <span className="whitespace-nowrap">Mới Cập Nhật</span>
              </button>
            </div>

            {/* Toggle khung thời gian (Hôm nay / Tuần này / Tháng này) khi ở tab Thịnh Hành */}
            {activeSort === 'trending' && (
              <div className="shrink-0 flex items-center gap-1 p-1 rounded-xl bg-surface border border-border text-xs font-mono animate-fade-in">
                <button
                  onClick={() => doiBoLoc(() => setTimeWindow('today'))}
                  className={`btn-tactile shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'today'
                      ? 'bg-surface-elevated text-accent-forge-text font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => doiBoLoc(() => setTimeWindow('week'))}
                  className={`btn-tactile shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'week'
                      ? 'bg-surface-elevated text-accent-forge-text font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Tuần này
                </button>
                <button
                  onClick={() => doiBoLoc(() => setTimeWindow('month'))}
                  className={`btn-tactile shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg transition-colors ${
                    timeWindow === 'month'
                      ? 'bg-surface-elevated text-accent-forge-text font-semibold shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  Tháng này
                </button>
              </div>
            )}
          </div>

          {/* Dải chip lọc danh mục chuẩn CSDL động (K3) - Hỗ trợ cuộn ngang bằng con lăn chuột */}
          <div
            ref={categoryScrollRef}
            className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
          >
            {displayCategories.map((category) => {
              const isActive = activeCategory === category.ten;
              return (
                <button
                  key={category.ten}
                  onClick={() => doiBoLoc(() => setActiveCategory(category.ten))}
                  className={`btn-tactile px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all flex items-center gap-2 outline-none ${
                    isActive
                      ? 'bg-surface-elevated text-primary font-bold shadow-xs border border-border-focus'
                      : 'bg-surface hover:bg-surface-hover text-secondary hover:text-primary border border-border'
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0 shadow-[0_0_6px_rgba(255,158,32,0.6)]" />
                  )}
                  <span className="whitespace-nowrap">{category.ten}</span>
                  {category.soLuong > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none shrink-0 ${
                        isActive
                          ? 'bg-accent-forge/15 text-accent-forge-text border border-accent-forge/25 font-bold'
                          : 'bg-surface-hover text-muted border border-border'
                      }`}
                    >
                      {category.soLuong}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. LƯỚI THẺ ỨNG DỤNG 3 CỘT RỘNG RÃI (Trụ cột 2: Sibling Stagger Wave < 120ms) */}
        {isAppsLoading ? (
          /* Trạng thái Skeleton ASCII giải mã độc đáo (ascii-reveal) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <KhungXuongCard key={i} index={i} variant="dither" />
            ))}
          </div>
        ) : isAppsError && !appsResponse?.pages.length ? (
          /* Trạng thái Lỗi kết nối kèm nút Thử lại (B3) */
          <div className="p-8 rounded-2xl bg-surface border border-danger/20 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-primary">Không thể kết nối máy chủ Store</h3>
            <p className="text-xs text-muted max-w-md">
              Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
            </p>
            <button
              onClick={() => refetchApps()}
              className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold flex items-center gap-2 border border-border"
            >
              <RefreshCw className="w-3.5 h-3.5 text-accent-forge-text" />
              <span>Thử lại ngay</span>
            </button>
          </div>
        ) : processedApps.length === 0 ? (
          /* Trạng thái Không có ứng dụng phù hợp bộ lọc (B3 & Vấn đề nhỏ 1) */
          <div className="p-12 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-muted">
              <PackageOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-primary">
              {activeSort === 'trending'
                ? timeWindow === 'today'
                  ? 'Không có bản phát hành mới trong hôm nay'
                  : timeWindow === 'week'
                    ? 'Không có bản phát hành mới trong tuần này'
                    : 'Không có bản phát hành mới trong tháng này'
                : 'Chưa có ứng dụng Windows trong danh mục này'}
            </h3>
            <p className="text-xs text-muted max-w-sm">
              {activeSort === 'trending'
                ? `Không tìm thấy ứng dụng nào có bản phát hành mới ${
                    timeWindow === 'today'
                      ? 'trong hôm nay'
                      : timeWindow === 'week'
                        ? 'trong 7 ngày qua'
                        : 'trong 30 ngày qua'
                  }${activeCategory !== 'Tất cả' ? ` thuộc danh mục "${activeCategory}"` : ''}. Bạn hãy thử chọn khung thời gian hoặc danh mục khác nhé!`
                : `Không tìm thấy ứng dụng Windows nào thuộc danh mục "${activeCategory}". Bạn hãy thử chọn danh mục khác nhé!`}
            </p>
            {activeSort === 'trending' ? (
              <div className="flex items-center gap-2 mt-2">
                {timeWindow !== 'month' && (
                  <button
                    onClick={() => doiBoLoc(() => setTimeWindow('month'))}
                    className="btn-tactile px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border"
                  >
                    Xem trong tháng này
                  </button>
                )}
                {activeCategory !== 'Tất cả' && (
                  <button
                    onClick={() => doiBoLoc(() => setActiveCategory('Tất cả'))}
                    className="btn-tactile px-3 py-1.5 rounded-lg bg-accent-forge text-on-accent text-xs font-semibold"
                  >
                    Xem tất cả danh mục
                  </button>
                )}
              </div>
            ) : activeCategory !== 'Tất cả' ? (
              <button
                onClick={() => doiBoLoc(() => setActiveCategory('Tất cả'))}
                className="btn-tactile mt-2 px-4 py-1.5 rounded-lg bg-accent-forge text-on-accent text-xs font-semibold"
              >
                Xem tất cả ứng dụng
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5">
              {liveAppPages.map((trang, indexTrang) => {
                const luoi = (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {trang.map((app, index) => (
                      <TheUngDung key={app.id} app={app} staggerIndex={index} />
                    ))}
                  </div>
                );

                return indexTrang === 0 ? (
                  <AsciiReveal preset="dither" duration="fast" origin="top-left" key="trang-dau">
                    {luoi}
                  </AsciiReveal>
                ) : (
                  <React.Fragment key={`trang-${indexTrang}`}>{luoi}</React.Fragment>
                );
              })}
            </div>

            {hasNextPage ? (
              <div ref={diemCuoiDanhSachRef} className="flex flex-col items-center gap-2 py-3">
                {isFetchingNextPage && (
                  <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải thêm ứng dụng...
                  </p>
                )}
                {isFetchNextPageError ? (
                  <button
                    type="button"
                    onClick={taiTrangKe}
                    disabled={isFetchingNextPage}
                    className="btn-tactile px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border disabled:opacity-60"
                  >
                    Thử lại
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={taiTrangKe}
                    disabled={isFetchingNextPage || isPlaceholderData}
                    className="btn-tactile px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border disabled:opacity-60"
                  >
                    Xem thêm
                  </button>
                )}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-muted" aria-live="polite">
                Đã xem hết {appsResponse?.pages[0]?.tongSo ?? processedApps.length} ứng dụng
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};
