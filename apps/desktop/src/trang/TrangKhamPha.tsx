import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Check,
  RefreshCw,
  AlertCircle,
  PackageOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { TheUngDung, AppCardData } from '../thanh-phan/dung-chung/TheUngDung';
import { ThanhPhanTrang } from '../thanh-phan/dung-chung/ThanhPhanTrang';
import { NhanTinCay } from '../thanh-phan/dung-chung/NhanTinCay';
import {
  KhungXuongCard,
  KhungXuongSpotlight,
  AsciiReveal,
} from '../thanh-phan/dung-chung/KhungXuongAscii';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { useDeviceInstalledApps } from '../hooks/useDeviceInstalledApps';
import type { UngDungTomTatDto } from '@forgestore/types';

// Số ứng dụng mỗi trang: đủ để duyệt nhanh nhưng chỉ có chừng này thẻ trên màn hình
const SO_UNG_DUNG_MOI_TRANG = 30;
// Số lượng Repo nhiều sao nhất hiển thị trên băng trượt Hero
const SO_LUONG_HERO_TOP_SAO = 5;

type TimeWindow = 'today' | 'week' | 'month';
type SortTab = 'trending' | 'stars' | 'recent';

export const TrangKhamPha: React.FC = () => {
  const queryClient = useQueryClient();
  const { openAppDetail, selectedCategory, setSelectedCategory } = useDieuHuongStore();
  const { layTrangThaiCaiDat } = useDeviceInstalledApps();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeSort, setActiveSort] = useState<SortTab>('trending');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [trang, setTrang] = useState(1);
  const dauDanhSachRef = useRef<HTMLDivElement>(null);

  // Đổi danh mục, sắp xếp hoặc khung thời gian thì quay về trang 1 của bộ lọc mới
  const doiBoLoc = useCallback((capNhat: () => void) => {
    capNhat();
    setTrang(1);
  }, []);

  const chuyenTrang = useCallback((trangMoi: number) => {
    setTrang(trangMoi);
    // Về đầu danh sách ngay để người dùng thấy ứng dụng đầu trang mới, không cuộn mượt cho đỡ giật
    dauDanhSachRef.current?.scrollIntoView({ block: 'start' });
  }, []);

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
  const truyVanTrang = useCallback(
    (trangSo: number) => ({
      queryKey: [
        'store-apps',
        activeCategory,
        activeSort,
        activeSort === 'trending' ? timeWindow : undefined,
        trangSo,
      ],
      queryFn: () =>
        khoUngDungService.layDanhSachUngDung({
          platform: 'windows',
          category: activeCategory !== 'Tất cả' ? activeCategory : undefined,
          sort: activeSort,
          window: activeSort === 'trending' ? timeWindow : undefined,
          page: trangSo,
          limit: SO_UNG_DUNG_MOI_TRANG,
        }),
      staleTime: 1000 * 60 * 3, // 3 phút cache
    }),
    [activeCategory, activeSort, timeWindow],
  );

  const {
    data: appsResponse,
    isLoading: isAppsLoading,
    isError: isAppsError,
    refetch: refetchApps,
    isPlaceholderData,
  } = useQuery({
    ...truyVanTrang(trang),
    placeholderData: (previousData) => previousData, // FE-V3-06: Giữ dữ liệu cũ mượt mà khi đổi trang/bộ lọc, chống nhấp nháy skeleton
  });

  // Tải sẵn trang kế để bấm "Sau" là có ngay
  const tongSoTrang = appsResponse?.tongSoTrang ?? 0;
  useEffect(() => {
    if (isPlaceholderData || trang >= tongSoTrang) return;
    void queryClient.prefetchQuery(truyVanTrang(trang + 1));
  }, [isPlaceholderData, trang, tongSoTrang, queryClient, truyVanTrang]);

  // Đấu nối TanStack Query: Nạp Top 5 Repo nhiều sao nhất thực tế từ hệ thống cho băng trượt Hero
  const { data: topStarResponse, isLoading: isHeroLoading } = useQuery({
    queryKey: ['hero-top-stars-apps', 'windows', SO_LUONG_HERO_TOP_SAO],
    queryFn: () =>
      khoUngDungService.layDanhSachUngDung({
        platform: 'windows',
        sort: 'stars',
        page: 1,
        limit: SO_LUONG_HERO_TOP_SAO,
      }),
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
  const processedApps = useMemo(
    () =>
      (appsResponse?.duLieu ?? []).map((dto: UngDungTomTatDto) =>
        khoUngDungService.anhXaDtoSangTheUngDung(dto),
      ),
    [appsResponse],
  );

  const heroTopApps: AppCardData[] = useMemo(() => {
    const list = topStarResponse?.duLieu ?? [];
    return list
      .slice(0, SO_LUONG_HERO_TOP_SAO)
      .map((dto: UngDungTomTatDto) => khoUngDungService.anhXaDtoSangTheUngDung(dto));
  }, [topStarResponse]);

  // Tự động trượt ngang qua 5 Repo mỗi 5 giây (tạm dừng khi người dùng rê chuột vào xem)
  useEffect(() => {
    if (isHeroPaused || heroTopApps.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroTopApps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHeroPaused, heroTopApps.length]);

  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full select-none animate-fade-in">
      {/* 1. HERO CAROUSEL: BĂNG TRƯỢT NGANG TOP 5 REPO NHIỀU SAO NHẤT TRÊN GITHUB */}
      {isHeroLoading ? (
        <KhungXuongSpotlight variant="dither" />
      ) : heroTopApps.length > 0 ? (
        <section
          data-ascii="surface"
          onMouseEnter={() => setIsHeroPaused(true)}
          onMouseLeave={() => setIsHeroPaused(false)}
          className="surface-card group relative overflow-hidden rounded-2xl border border-border"
        >
          {/* Ánh sáng nền nhẹ tạo chiều sâu cho sân khấu Hero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent-forge/10 blur-3xl"
          />

          {/* Băng trượt ngang 5 Repo */}
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {heroTopApps.map((slideApp) => {
              const slideTrangThai = layTrangThaiCaiDat(slideApp.id, slideApp.repoHandle);
              const isInstalled = slideTrangThai.trangThai === 'DA_CAI_DAT';
              const isProcessing =
                slideTrangThai.trangThai === 'DANG_TAI' ||
                slideTrangThai.trangThai === 'XAC_MINH' ||
                slideTrangThai.trangThai === 'DANG_CAI_DAT';

              return (
                <div
                  key={slideApp.id}
                  className="w-full shrink-0 p-6 md:p-8 pb-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
                >
                  {/* Cột trái: Thông tin ứng dụng tiêu điểm */}
                  <div className="flex-1 max-w-2xl flex flex-col gap-3 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {slideApp.danhMucChinh && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-accent-forge/15 text-accent-forge-text border border-accent-forge/30">
                          {slideApp.danhMucChinh}
                        </span>
                      )}
                      <span className="text-xs font-mono text-muted">
                        {formatStars(slideApp.soSaoGithub)} sao trên GitHub
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5 mt-1">
                      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center font-bold text-2xl font-display text-primary shadow-md shrink-0 overflow-hidden">
                        {slideApp.iconUrl ? (
                          <img
                            src={slideApp.iconUrl}
                            alt={slideApp.tenApp}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          slideApp.tenApp.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-2xl md:text-3xl font-bold font-display text-primary tracking-tight truncate">
                          {slideApp.tenApp}
                        </h2>
                        <p className="text-xs font-mono text-muted truncate mt-0.5">
                          {slideApp.repoHandle}
                          {slideApp.giayPhep ? ` • ${slideApp.giayPhep}` : ''}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-secondary leading-relaxed mt-1 line-clamp-2">
                      {slideApp.moTaNgan}
                    </p>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {slideApp.phienBanMoiNhat && (
                        <span className="px-2.5 py-0.5 rounded-md bg-surface text-xs font-mono text-primary border border-border">
                          {slideApp.phienBanMoiNhat}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-md bg-surface text-xs font-mono text-secondary border border-border">
                        {slideApp.kienTruc?.join(' & ') || 'x64'}
                      </span>
                      {slideApp.kichThuocFile && (
                        <span className="px-2.5 py-0.5 rounded-md bg-surface text-xs font-mono text-secondary border border-border">
                          {slideApp.kichThuocFile}
                        </span>
                      )}
                      <NhanTinCay score={slideApp.diemUyTin} size="sm" showLabel />
                    </div>
                  </div>

                  {/* Cột phải: Nút hành động */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
                    <button
                      onClick={() => openAppDetail(slideApp.id)}
                      className={`btn-tactile h-11 px-6 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                        isInstalled
                          ? 'bg-success-solid hover:bg-success-solid/90 text-white'
                          : isProcessing
                            ? 'bg-accent-forge/80 text-on-accent'
                            : 'bg-accent-forge hover:bg-accent-forge-hover text-on-accent'
                      }`}
                    >
                      {isInstalled ? (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>{slideTrangThai.label}</span>
                        </>
                      ) : isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{slideTrangThai.label}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Cài Đặt 1-Click</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => openAppDetail(slideApp.id)}
                      className="btn-tactile h-10 px-5 rounded-xl bg-surface hover:bg-surface-hover text-primary font-medium text-xs flex items-center justify-center border border-border transition-colors"
                    >
                      <span>Xem chi tiết ứng dụng</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cụm 5 chấm chỉ báo (Pagination Dots) + nút tiến/lùi ở đáy Hero */}
          {heroTopApps.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-20">
              <button
                type="button"
                aria-label="Ứng dụng trước"
                onClick={() =>
                  setActiveSlide((prev) => (prev - 1 + heroTopApps.length) % heroTopApps.length)
                }
                className="w-6 h-6 rounded-full bg-surface/80 hover:bg-surface-hover border border-border flex items-center justify-center text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/80 backdrop-blur-xs border border-border/80">
                {heroTopApps.map((item, idx) => {
                  const isCurrent = activeSlide === idx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Chuyển tới ${item.tenApp}`}
                      title={`${item.tenApp} (${formatStars(item.soSaoGithub)} sao)`}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        isCurrent
                          ? 'w-6 bg-accent-forge shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                          : 'w-2 bg-border-focus hover:bg-muted'
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                aria-label="Ứng dụng tiếp theo"
                onClick={() => setActiveSlide((prev) => (prev + 1) % heroTopApps.length)}
                className="w-6 h-6 rounded-full bg-surface/80 hover:bg-surface-hover border border-border flex items-center justify-center text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>
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
        ) : isAppsError && !appsResponse ? (
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
            {/* scroll-mt: chừa chút khoảng trống phía trên khi nhảy về đầu danh sách */}
            <div
              ref={dauDanhSachRef}
              className={`scroll-mt-4 transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60' : ''}`}
            >
              {/* key theo bộ lọc và trang đã về để hiệu ứng giải mã phát lại cho dữ liệu mới */}
              <AsciiReveal
                preset="dither"
                duration="fast"
                origin="top-left"
                key={`${activeSort}-${activeCategory}-${timeWindow}-${appsResponse?.trangHienTai ?? 1}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {processedApps.map((app, index) => (
                    <TheUngDung key={app.id} app={app} staggerIndex={index} />
                  ))}
                </div>
              </AsciiReveal>
            </div>

            <ThanhPhanTrang
              trangHienTai={appsResponse?.trangHienTai ?? trang}
              tongSoTrang={tongSoTrang}
              tongSo={appsResponse?.tongSo ?? processedApps.length}
              kichThuocTrang={appsResponse?.kichThuocTrang ?? SO_UNG_DUNG_MOI_TRANG}
              dangTai={isPlaceholderData}
              onChuyenTrang={chuyenTrang}
            />
            {isAppsError && (
              <p className="text-center text-xs text-danger">
                Không tải được trang này.{' '}
                <button type="button" onClick={() => refetchApps()} className="underline">
                  Thử lại
                </button>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};
