import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Sparkles, LogIn, Compass, RefreshCw, AlertCircle } from 'lucide-react';
import { AppCard, AppCardData } from '../thanh-phan/dung-chung/TheUngDung';
import { useNavStore } from '../kho-trang-thai/useDieuHuongStore';
import { useAuthStore } from '../kho-trang-thai/useXacThucStore';
import { favoritesService } from '../dich-vu/yeu-thich/yeu-thich.service';
import { storeService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import type { UngDungTomTatDto } from '@forgestore/types';

export const FavoritesPage: React.FC = () => {
  const { navigateTo, setAuthModalOpen } = useNavStore();
  const { isAuthenticated } = useAuthStore();

  // Nạp danh sách ứng dụng yêu thích từ API backend (P3-12.1)
  const {
    data: favoritesResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['user-favorites', isAuthenticated],
    queryFn: () => favoritesService.layDanhSachYeuThich(1, 50),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // L-11: 5 phút cache, mở lại kho yêu thích hiển thị ngay lập tức không chờ server
  });

  const rawApps = favoritesResponse?.duLieu || [];
  const displayApps: AppCardData[] = rawApps.map((dto: UngDungTomTatDto) =>
    storeService.mapDtoToAppCard(dto),
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full select-none">
      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <span>Kho Yêu Thích Đồng Bộ Đám Mây</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Ứng dụng bạn đã lưu trữ sẽ tự động đồng bộ xuyên suốt sang ForgeStore Mobile (Module 4)
          </p>
        </div>

        {isAuthenticated && (
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-tactile h-8 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
            title="Làm mới danh sách yêu thích"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        )}
      </div>

      {/* Banner thông báo khi người dùng chưa đăng nhập */}
      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-surface-elevated/80 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-forge/10 border border-accent-forge/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent-forge" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-primary font-display">
                Đăng nhập để đồng bộ kho yêu thích
              </h3>
              <p className="text-[11px] text-secondary mt-0.5">
                Lưu ứng dụng yêu thích an toàn trên tài khoản đám mây và mở ngay trên máy tính hoặc
                điện thoại.
              </p>
            </div>
          </div>

          <button
            onClick={() => setAuthModalOpen(true)}
            className="btn-tactile px-4 py-2 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-2 shrink-0 shadow-sm focus-visible:ring-2 focus-visible:ring-accent-forge outline-none cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng Nhập Ngay</span>
          </button>
        </div>
      )}

      {/* Trạng thái tải: Skeleton Shimmer (CLS = 0) */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="tactile-card p-4 rounded-xl flex flex-col justify-between h-[210px] skeleton-shimmer"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-surface-elevated/70" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-28 rounded bg-surface-elevated/70" />
                  <div className="h-3 w-40 rounded bg-surface-elevated/50" />
                </div>
              </div>
              <div className="h-8 w-full rounded bg-surface-elevated/40 mt-3" />
              <div className="h-7 w-full rounded bg-surface-elevated/50 mt-3" />
            </div>
          ))}
        </div>
      )}

      {/* Trạng thái lỗi mạng */}
      {isError && (
        <div className="p-8 rounded-2xl bg-surface border border-rose-500/30 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <h3 className="text-sm font-bold text-primary">Không thể tải kho yêu thích</h3>
          <p className="text-xs text-muted max-w-md">
            Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra lại đường truyền mạng.
          </p>
          <button
            onClick={() => refetch()}
            className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Danh sách ứng dụng yêu thích */}
      {!isLoading && !isError && displayApps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayApps.map((app, idx) => (
            <AppCard key={app.id} app={app} staggerIndex={idx} />
          ))}
        </div>
      )}

      {/* Trạng thái rỗng (Empty State) */}
      {!isLoading && !isError && displayApps.length === 0 && (
        <div className="p-12 rounded-2xl bg-surface border border-border/60 flex flex-col items-center justify-center text-center gap-3 my-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
            <Heart className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold font-display text-primary">
            Chưa có ứng dụng nào trong kho yêu thích
          </h3>
          <p className="text-xs text-secondary max-w-md leading-relaxed">
            Nhấp vào biểu tượng trái tim ở trang chi tiết của bất kỳ phần mềm nào để lưu lại và truy
            cập nhanh tại đây.
          </p>
          <button
            onClick={() => navigateTo('explore')}
            className="btn-tactile mt-2 px-4 py-2.5 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
          >
            <Compass className="w-4 h-4" />
            <span>Khám Phá Kho Ứng Dụng Ngay</span>
          </button>
        </div>
      )}
    </div>
  );
};
