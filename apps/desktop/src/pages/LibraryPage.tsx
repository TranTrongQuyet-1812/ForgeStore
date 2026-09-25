import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Library, RefreshCw, Play, Trash2, Download, Search, Laptop, Compass } from 'lucide-react';
import { useNavStore } from '../stores/useNavStore';
import { useInstallStore } from '../stores/useInstallStore';
import { useUpdaterStore } from '../stores/useUpdaterStore';
import { useAuthStore } from '../stores/useAuthStore';
import { libraryService } from '../services/library/library-service';
import { deviceService, DeviceInfo } from '../services/device/device-service';
import { installService } from '../services/install/install-service';
import { authService } from '../services/auth/auth-service';

export const LibraryPage: React.FC = () => {
  const { navigateTo, openAppDetail } = useNavStore();
  const { caiDatMap, goCaiDatLocal, moApp } = useInstallStore();
  const { soLuongBanCapNhat, danhSachCapNhat, dangKiemTra, kiemTraCapNhat } = useUpdaterStore();
  const { isAuthenticated, maThietBi } = useAuthStore();
  const queryClient = useQueryClient();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Lấy thông tin thiết bị máy trạm
  useEffect(() => {
    deviceService.getDeviceInfo().then((dev) => {
      setDeviceInfo(dev);
    });
  }, []);

  // 2. Nạp danh sách ứng dụng đã cài đặt từ Backend (P3-12.2 & Điểm 1)
  const {
    data: backendInstalledApps = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['device-installed-apps', maThietBi],
    queryFn: () =>
      maThietBi ? libraryService.layDanhSachAppDaCai(maThietBi) : Promise.resolve([]),
    enabled: Boolean(isAuthenticated && maThietBi),
    staleTime: 1000 * 60 * 2,
  });

  // 3. Tự động kiểm tra cập nhật khi tải trang thư viện (P3-12.3 & Điểm 1)
  useEffect(() => {
    if (isAuthenticated && maThietBi) {
      kiemTraCapNhat(maThietBi);
    }
  }, [isAuthenticated, maThietBi, kiemTraCapNhat]);

  // 4. Hợp nhất danh sách ứng dụng đã cài đặt (Backend + Local Install Cache)
  const localAppsList = Object.values(caiDatMap).filter((app) => app.trangThai === 'DA_CAI_DAT');

  // Tạo map tra cứu bản cập nhật từ updater store
  const updatesMap = new Map(danhSachCapNhat.map((u) => [u.maUngDung, u]));

  // Gộp danh sách duy nhất theo maUngDung
  const mergedAppsMap = new Map<
    string,
    {
      maUngDung: string;
      tenApp: string;
      phienBanHienTai: string;
      duongDanThucThi?: string;
      duongDanThuMuc?: string;
      iconUrl?: string;
      coBanMoi: boolean;
      phienBanMoi?: string;
    }
  >();

  // Đưa app từ backend vào map
  for (const bApp of backendInstalledApps) {
    const updateItem = updatesMap.get(bApp.maUngDung);
    mergedAppsMap.set(bApp.maUngDung, {
      maUngDung: bApp.maUngDung,
      tenApp: bApp.ungDung?.tenKhoChua || bApp.ungDung?.tenRepoDayDu || bApp.maUngDung,
      phienBanHienTai: bApp.phienBanHienTai,
      duongDanThuMuc: bApp.duongDanThuMuc ?? undefined,
      iconUrl: bApp.ungDung?.duongDanIcon ?? undefined,
      coBanMoi: Boolean(updateItem?.coBanCapNhat),
      phienBanMoi: updateItem?.phienBanMoiNhat,
    });
  }

  // Đưa app từ local install store vào map (nếu chưa có hoặc bổ sung path)
  for (const lApp of localAppsList) {
    const existing = mergedAppsMap.get(lApp.maUngDung);
    const updateItem = updatesMap.get(lApp.maUngDung);
    if (existing) {
      existing.duongDanThucThi = lApp.duongDanThucThi || existing.duongDanThucThi;
    } else {
      mergedAppsMap.set(lApp.maUngDung, {
        maUngDung: lApp.maUngDung,
        tenApp: lApp.tenApp || lApp.maUngDung,
        phienBanHienTai: 'v1.0.0',
        duongDanThucThi: lApp.duongDanThucThi,
        coBanMoi: Boolean(updateItem?.coBanCapNhat),
        phienBanMoi: updateItem?.phienBanMoiNhat,
      });
    }
  }

  const allInstalledApps = Array.from(mergedAppsMap.values());

  // Lọc theo ô tìm kiếm
  const filteredApps = allInstalledApps.filter((app) =>
    app.tenApp.toLowerCase().includes(searchFilter.trim().toLowerCase()),
  );

  // Xử lý mở app
  const handleOpenApp = (app: { maUngDung: string; duongDanThucThi?: string; tenApp: string }) => {
    if (app.duongDanThucThi) {
      installService.moUngDung(app.duongDanThucThi);
    } else {
      moApp(app.maUngDung);
    }
  };

  // Xử lý gỡ khỏi danh sách
  const handleRemoveApp = async (maUngDung: string) => {
    if (confirm('Bạn có chắc muốn gỡ ứng dụng này khỏi danh sách quản lý trên máy?')) {
      goCaiDatLocal(maUngDung);
      if (maThietBi) {
        await libraryService.goCaiDat(maThietBi, maUngDung);
        queryClient.invalidateQueries({ queryKey: ['device-installed-apps', maThietBi] });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full select-none">
      {/* Phần đầu trang & Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
            <Library className="w-5 h-5 text-accent-forge" />
            <span>Thư Viện Của Máy Này</span>
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted mt-1 font-mono">
            <Laptop className="w-3.5 h-3.5 text-secondary" />
            <span>Thiết bị: {deviceInfo?.tenThietBi || 'Windows PC'}</span>
            <span>•</span>
            <span className="truncate max-w-[200px]" title={maThietBi || 'Lưu trữ cục bộ'}>
              {maThietBi ? `Mã thiết bị: ${maThietBi.substring(0, 8)}...` : 'Chế độ lưu cục bộ'}
            </span>
          </div>
        </div>

        {/* Cụm nút thao tác đầu trang */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (maThietBi) kiemTraCapNhat(maThietBi);
              refetch();
            }}
            disabled={dangKiemTra}
            className="btn-tactile h-9 px-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-primary font-medium flex items-center gap-2 transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-accent-forge ${dangKiemTra ? 'animate-spin' : ''}`}
            />
            <span>{dangKiemTra ? 'Đang quét...' : 'Kiểm Tra Cập Nhật'}</span>
            {soLuongBanCapNhat > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent-forge text-white font-mono text-[10px] font-bold">
                {soLuongBanCapNhat}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Banner khuyến khích đăng nhập nếu chưa có phiên */}
      {!isAuthenticated && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-elevated/80 border border-border/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-forge/10 flex items-center justify-center text-accent-forge shrink-0">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-primary">
                Đăng nhập tài khoản ForgeStore
              </div>
              <div className="text-[11px] text-muted">
                Đăng nhập để đồng bộ ứng dụng đã cài đặt và nhận cảnh báo cập nhật mới tự động từ
                máy chủ.
              </div>
            </div>
          </div>
          <button
            onClick={() => authService.loginWithGithub()}
            className="btn-tactile h-8 px-4 rounded-lg bg-accent-forge hover:bg-accent-forge/90 text-white text-xs font-medium transition-all shadow-xs shrink-0"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}

      {/* Thanh tìm kiếm nhanh trong thư viện */}
      {allInstalledApps.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc ứng dụng đã cài đặt trên máy này..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-border text-xs text-primary placeholder:text-muted focus:border-accent-forge focus:ring-1 focus:ring-accent-forge outline-none transition-all"
          />
        </div>
      )}

      {/* Skeleton Shimmer khi đang tải (CLS = 0) */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="tactile-card p-4 rounded-xl flex items-center justify-between gap-4 skeleton-shimmer h-[76px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-surface-elevated/70" />
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-32 rounded bg-surface-elevated/70" />
                  <div className="h-3 w-48 rounded bg-surface-elevated/50" />
                </div>
              </div>
              <div className="h-8 w-28 rounded bg-surface-elevated/60" />
            </div>
          ))}
        </div>
      )}

      {/* Danh sách ứng dụng đã cài đặt */}
      {!isLoading && filteredApps.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredApps.map((app) => (
            <div
              key={app.maUngDung}
              className="tactile-card p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150"
            >
              {/* Thông tin ứng dụng */}
              <div
                onClick={() => openAppDetail(app.maUngDung)}
                className="flex items-center gap-3.5 cursor-pointer group flex-1 min-w-0"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-lg font-display text-primary shrink-0 overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-150">
                  {app.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt={app.tenApp}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{app.tenApp.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-display text-primary truncate group-hover:text-accent-forge transition-colors">
                      {app.tenApp}
                    </h3>
                    {app.coBanMoi && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold shrink-0">
                        Bản mới: {app.phienBanMoi || 'Mới'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted font-mono truncate">
                    <span>Phiên bản: {app.phienBanHienTai}</span>
                    {app.duongDanThuMuc && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[280px]" title={app.duongDanThuMuc}>
                          {app.duongDanThuMuc}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Cụm nút hành động */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {/* Nút cập nhật nếu có bản mới */}
                {app.coBanMoi && (
                  <button
                    onClick={() => openAppDetail(app.maUngDung)}
                    className="btn-tactile h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-amber-400 outline-none"
                    title="Cập nhật lên phiên bản mới"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Cập Nhật</span>
                  </button>
                )}

                {/* Nút Mở Ứng Dụng */}
                <button
                  onClick={() => handleOpenApp(app)}
                  className="btn-tactile h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none"
                  title="Khởi chạy ứng dụng native"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Mở Ứng Dụng</span>
                </button>

                {/* Nút Gỡ bỏ khỏi danh sách */}
                <button
                  onClick={() => handleRemoveApp(app.maUngDung)}
                  className="btn-tactile h-8 w-8 rounded-lg border border-border hover:bg-rose-500/10 hover:border-rose-500/30 text-muted hover:text-rose-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
                  title="Gỡ khỏi danh sách quản lý máy này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trạng thái rỗng (Empty State) khi chưa cài app nào */}
      {!isLoading && allInstalledApps.length === 0 && (
        <div className="p-12 rounded-2xl bg-surface border border-border/60 flex flex-col items-center justify-center text-center gap-3 my-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-forge/10 border border-accent-forge/20 flex items-center justify-center text-accent-forge mb-2">
            <Library className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold font-display text-primary">
            Chưa có ứng dụng nào được cài đặt trên máy này
          </h3>
          <p className="text-xs text-secondary max-w-md leading-relaxed">
            Duyệt kho ForgeStore và chỉ với 1-Click Cài Đặt, phần mềm sẽ tự động tải, xác thực
            SHA-256 nguyên tử và xuất hiện tại thư viện này.
          </p>
          <button
            onClick={() => navigateTo('explore')}
            className="btn-tactile mt-2 px-4 py-2.5 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
          >
            <Compass className="w-4 h-4" />
            <span>Khám Phá Ứng Dụng Ngay</span>
          </button>
        </div>
      )}

      {/* Trạng thái không tìm thấy kết quả khi lọc */}
      {!isLoading && allInstalledApps.length > 0 && filteredApps.length === 0 && (
        <div className="p-8 rounded-2xl bg-surface border border-border/60 text-center text-xs text-muted">
          Không tìm thấy ứng dụng nào khớp với từ khóa "{searchFilter}".
        </div>
      )}
    </div>
  );
};
