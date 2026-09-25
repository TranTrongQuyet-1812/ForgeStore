import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  Heart,
  Download,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Github,
  FileArchive,
  CheckCircle2,
  Radio,
  Shield,
  Zap,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { TrustPill } from '../components/common/TrustPill';
import { useNavStore } from '../stores/useNavStore';
import { useInstallStore } from '../stores/useInstallStore';
import { storeService } from '../services/store/store-service';

export const DetailPage: React.FC = () => {
  const { selectedAppId, navigateTo } = useNavStore();
  const appId = selectedAppId || 'rustdesk/rustdesk';

  // Quản lý polling AI
  const [pollStartTime] = useState<number>(() => Date.now());

  // Trạng thái giao diện
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('EXE');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);

  // Động cơ cài đặt Native Tauri & Quản lý tiến trình (P3-08..P3-11)
  const { caiDatMap, batDauCaiDat, huyCaiDat, moApp } = useInstallStore();

  // TanStack Query nạp dữ liệu sống từ Backend
  const {
    data: appDetail,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['app-detail', appId],
    queryFn: () => storeService.layChiTietApp(appId),
    staleTime: 3 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      // P3-06.2: Nếu chưa có phân tích AI hoặc đang phân tích, polling lại mỗi 2.5s (dừng sau 30s)
      if (!data?.phanTichAi) {
        if (Date.now() - pollStartTime < 30000) {
          return 2500;
        }
      }
      return false;
    },
  });

  // Đồng bộ trạng thái yêu thích từ backend
  useEffect(() => {
    if (appDetail?.laYeuThich !== undefined) {
      setIsFavorited(appDetail.laYeuThich);
    }
  }, [appDetail?.laYeuThich]);

  // Format kích thước tệp
  const formatBytes = (bytes?: number | string): string => {
    if (!bytes) return 'N/A';
    const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(num) || num <= 0) return 'N/A';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format số sao
  const formatStars = (stars?: number): string => {
    if (!stars) return '0';
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  // Sao chép mã băm SHA-256 kèm hiệu ứng Checkmark Pop
  const handleCopySha = (sha?: string | null, fileId?: string) => {
    if (!sha) return;
    navigator.clipboard.writeText(sha);
    setCopiedSha(fileId || sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  // Phân tích các tệp cài đặt của bản phát hành mới nhất
  const latestRelease = appDetail?.banPhatHanhMoiNhat || appDetail?.danhSachBanPhatHanh?.[0];
  const allAssets = latestRelease?.danhSachTepCaiDat || [];

  // Lọc tệp cài đặt phù hợp với Windows
  const windowsAssets = allAssets.filter((f) => {
    const ext = f.tenTep.toLowerCase();
    return ext.endsWith('.exe') || ext.endsWith('.msi') || ext.endsWith('.zip');
  });
  const displayAssets = windowsAssets.length > 0 ? windowsAssets : allAssets;

  // Danh sách các định dạng tệp thực tế có sẵn
  const availableFormats = Array.from(
    new Set(displayAssets.map((a) => a.dinhDangTep?.toString() || 'EXE')),
  );

  // Tự động chọn format mặc định nếu format hiện tại không tồn tại
  useEffect(() => {
    if (availableFormats.length > 0 && !availableFormats.includes(selectedFormat)) {
      setSelectedFormat(availableFormats[0]);
    }
  }, [availableFormats, selectedFormat]);

  const selectedAsset =
    displayAssets.find((a) => a.dinhDangTep?.toString() === selectedFormat) || displayAssets[0];

  // Trạng thái cài đặt thực tế từ useInstallStore (P3-08..P3-11)
  const appKey = appDetail?.maUngDung || appId;
  const installInfo = caiDatMap[appKey];
  const currentStatus = installInfo?.trangThai || 'CHUA_CAI';

  // Xử lý nút cài đặt
  const handleInstallClick = () => {
    if (currentStatus === 'DA_CAI_DAT') {
      if (installInfo?.duongDanThucThi) {
        moApp(appKey);
      }
      return;
    }
    if (
      currentStatus === 'DANG_TAI' ||
      currentStatus === 'XAC_MINH' ||
      currentStatus === 'DANG_CAI_DAT'
    ) {
      return;
    }

    if (!selectedAsset) {
      alert('Không tìm thấy tệp cài đặt phù hợp.');
      return;
    }

    batDauCaiDat({
      maUngDung: appKey,
      tenApp: appDetail?.tenKhoChua || 'App',
      url: selectedAsset.duongDanTaiVe,
      tenTep: selectedAsset.tenTep,
      loaiTep: selectedAsset.dinhDangTep?.toString() || selectedFormat,
      sha256DuKien: selectedAsset.maBamSha256 || undefined,
      phienBan: latestRelease?.tenPhienBan,
      maTep: selectedAsset.maTep,
    });
  };

  // Bóc tách 3 tính năng từ tomTatTinhNangVi
  const featureList = (appDetail?.phanTichAi?.tomTatTinhNangVi || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*0-9.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);

  const featureIcons = [
    <Shield key="f1" className="w-4 h-4 text-cyan-400" />,
    <Zap key="f2" className="w-4 h-4 text-orange-400" />,
    <Radio key="f3" className="w-4 h-4 text-emerald-400" />,
  ];

  // Điểm an toàn & xếp hạng
  const trustScore = appDetail?.phanTichAi?.diemUyTin ?? appDetail?.diemUyTin ?? 100;
  const riskItems = appDetail?.phanTichAi?.yeuToRuiRo || [];

  // Xếp loại màu sắc trust score
  const getScoreTheme = (score: number) => {
    if (score >= 80)
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        bar: 'bg-emerald-500',
        label: 'AN TOÀN CAO',
      };
    if (score >= 60)
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        bar: 'bg-amber-500',
        label: 'CẦN LƯU Ý',
      };
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      bar: 'bg-rose-500',
      label: 'CẢNH BÁO',
    };
  };

  const scoreTheme = getScoreTheme(trustScore);

  // 1. TRẠNG THÁI LOADING: Skeleton Shimmer (CLS = 0)
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-4 rounded skeleton-shimmer" />
          <div className="w-3 h-4 rounded skeleton-shimmer" />
          <div className="w-24 h-4 rounded skeleton-shimmer" />
          <div className="w-3 h-4 rounded skeleton-shimmer" />
          <div className="w-32 h-4 rounded skeleton-shimmer" />
        </div>

        {/* Pro Split-View Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="tactile-card p-6 rounded-2xl flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="flex-1 flex flex-col gap-3">
                <div className="w-48 h-7 rounded skeleton-shimmer" />
                <div className="w-64 h-4 rounded skeleton-shimmer" />
                <div className="w-full h-12 rounded skeleton-shimmer mt-1" />
              </div>
            </div>
            <div className="tactile-card p-6 rounded-2xl h-48 skeleton-shimmer" />
            <div className="tactile-card p-6 rounded-2xl h-64 skeleton-shimmer" />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="tactile-card p-6 rounded-2xl h-64 skeleton-shimmer" />
            <div className="tactile-card p-6 rounded-2xl h-48 skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  // 2. TRẠNG THÁI LỖI (Error State)
  if (isError || !appDetail) {
    return (
      <div className="flex flex-col items-center justify-center p-12 max-w-xl mx-auto min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold font-display text-primary">
          Không thể tải thông tin ứng dụng
        </h2>
        <p className="text-xs text-muted max-w-md">
          Có thể máy chủ đang khởi động hoặc repository "{appId}" chưa được đồng bộ vào kho dữ liệu.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => navigateTo('explore')}
            className="btn-tactile px-4 py-2 rounded-xl bg-surface-elevated text-secondary hover:text-primary text-xs font-semibold border border-border"
          >
            Quay lại Khám phá
          </button>
          <button
            onClick={() => refetch()}
            className="btn-tactile px-4 py-2 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none">
      {/* 1. Breadcrumb & Nút quay lại (P3-06.1) */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <button
          onClick={() => navigateTo('explore')}
          className="btn-tactile flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Khám phá</span>
        </button>
        <span>/</span>
        <span>{appDetail.danhMucChinh || 'Tiện ích'}</span>
        <span>/</span>
        <span className="text-primary font-medium">{appDetail.tenKhoChua}</span>
      </div>

      {/* 2. PRO SPLIT-VIEW DASHBOARD (Cột chính 68% + Cột hành động 32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* === CỘT CHÍNH (68% - 8 CỘT TRÊN LG) === */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Header Thông Tin Ứng Dụng (P3-06.1) */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-5">
            {/* App Icon hoặc Gradient Chữ Cái */}
            <div className="w-20 h-20 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-xl shadow-black/20">
              {appDetail.duongDanIcon ? (
                <img
                  src={appDetail.duongDanIcon}
                  alt={appDetail.tenKhoChua}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-bold text-3xl font-display text-white shadow-xl shadow-orange-950/40">
                  {appDetail.tenKhoChua.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display text-primary">
                  {appDetail.tenKhoChua}
                </h1>
                {appDetail.daXacMinh && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    Verified FOSS
                  </span>
                )}
                {appDetail.duocNoiBat && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-medium border border-amber-500/30 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    Forge Đề Xuất
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted font-mono flex-wrap">
                <span>{appDetail.tenRepoDayDu}</span>
                <span>•</span>
                <span className="text-amber-400 flex items-center gap-0.5 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {formatStars(appDetail.soSaoGithub)} sao
                </span>
                <span>•</span>
                <span>{appDetail.loaiGiayPhep || 'Giấy phép FOSS'}</span>
                {appDetail.ngonNguChinh && (
                  <>
                    <span>•</span>
                    <span className="text-primary">{appDetail.ngonNguChinh}</span>
                  </>
                )}
              </div>

              <p className="text-xs text-secondary mt-3 leading-relaxed">
                {appDetail.moTaGocTiengAnh ||
                  'Ứng dụng mã nguồn mở minh bạch, được đồng bộ và kiểm định bảo mật trực tiếp từ GitHub.'}
              </p>
            </div>
          </div>

          {/* Khối AI: Gemini Executive Summary (P3-06.2) */}
          <div className="tactile-card p-6 rounded-2xl border-l-4 border-l-accent-ai flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent-ai text-xs font-bold font-display uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>BỘ NÃO AI • TÓM TẮT ĐIỀU HÀNH (GEMINI FLASH)</span>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {appDetail.phanTichAi?.moHinhTomTat || 'gemini-3.1-flash-lite'}
              </span>
            </div>

            {/* Slogan AI tiếng Việt hoặc skeleton đang chờ */}
            {appDetail.phanTichAi?.khauHieuTiengViet ? (
              <blockquote className="text-base font-semibold text-primary italic pl-3 border-l-2 border-accent-ai/40">
                "{appDetail.phanTichAi.khauHieuTiengViet}"
              </blockquote>
            ) : (
              <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50 flex items-center gap-3 animate-pulse">
                <Sparkles className="w-5 h-5 text-accent-ai animate-spin" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-primary">
                    Đang yêu cầu Dual-AI (Gemini Flash & Jev Noul) thẩm định ứng dụng...
                  </span>
                  <span className="text-[11px] text-muted font-mono">
                    Hệ thống đang tự động phân tích mã nguồn và giấy phép (tự động cập nhật).
                  </span>
                </div>
              </div>
            )}

            {/* 3 Thẻ tính năng cốt lõi có icon chuyên biệt (P3-06.2) */}
            {featureList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                {featureList.map((feature, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60 flex flex-col gap-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-border/40">
                      {featureIcons[idx] || <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <h4 className="text-xs font-bold text-primary font-display">
                      Tính Năng #{idx + 1}
                    </h4>
                    <p className="text-[11px] text-secondary leading-relaxed">{feature}</p>
                  </div>
                ))}
              </div>
            ) : (
              appDetail.phanTichAi?.tomTatTinhNangVi && (
                <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                  {appDetail.phanTichAi.tomTatTinhNangVi}
                </p>
              )
            )}
          </div>

          {/* Bảng Các Tệp Cài Đặt & Checksum SHA-256 (P3-06.4) */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold font-display text-primary flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-accent-forge" />
                  <span>
                    BẢN PHÁT HÀNH {latestRelease?.tenPhienBan || 'MỚI NHẤT'}
                    {latestRelease?.laBanThuNghiem && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 ml-2">
                        Pre-release
                      </span>
                    )}
                  </span>
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5">
                  Phát hành:{' '}
                  {latestRelease?.ngayPhatHanh
                    ? new Date(latestRelease.ngayPhatHanh).toLocaleDateString('vi-VN')
                    : 'Gần đây'}{' '}
                  • {displayAssets.length} tệp cài đặt khả dụng
                </p>
              </div>

              {appDetail.duongDanGithub && (
                <a
                  href={`${appDetail.duongDanGithub}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-tactile text-xs font-mono text-accent-ai hover:underline flex items-center gap-1"
                >
                  <span>GitHub Releases</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Danh sách tệp cài đặt */}
            <div className="flex flex-col gap-2.5">
              {displayAssets.length > 0 ? (
                displayAssets.map((asset) => {
                  const isCopied = copiedSha === asset.maTep || copiedSha === asset.maBamSha256;
                  const isSelected = selectedAsset?.maTep === asset.maTep;

                  return (
                    <div
                      key={asset.maTep}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-surface-elevated/80 border-accent-forge/40 shadow-sm'
                          : 'bg-surface-elevated/40 border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-primary truncate">
                          <span className="truncate">{asset.tenTep}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded bg-accent-forge/15 text-accent-forge text-[10px] shrink-0">
                              ĐANG CHỌN
                            </span>
                          )}
                        </div>

                        {/* Checksum SHA-256 kèm nút 1-Click Copy Pop (P3-06.4) */}
                        <div className="flex items-center gap-2 text-[11px] text-muted font-mono truncate">
                          <span>
                            SHA-256:{' '}
                            {asset.maBamSha256
                              ? `${asset.maBamSha256.substring(0, 14)}...${asset.maBamSha256.substring(asset.maBamSha256.length - 8)}`
                              : 'Chưa có mã băm'}
                          </span>
                          {asset.maBamSha256 && (
                            <button
                              onClick={() => handleCopySha(asset.maBamSha256, asset.maTep)}
                              title="Sao chép toàn bộ mã băm SHA-256"
                              className="text-accent-ai hover:text-primary flex items-center gap-1 btn-tactile"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span
                                className={`text-[10px] transition-colors ${
                                  isCopied ? 'text-emerald-400 font-semibold' : ''
                                }`}
                              >
                                {isCopied ? 'Đã chép SHA-256' : 'Chép mã'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-secondary">
                          {formatBytes(asset.dungLuongBytes)}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-semibold uppercase">
                          {asset.kienTrucChip || 'x64'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-surface-elevated/30 border border-border/40 text-center text-xs text-muted">
                  Không tìm thấy tệp cài đặt đính kèm cho bản phát hành này.
                </div>
              )}
            </div>
          </div>

          {/* Lịch Sử Các Bản Phát Hành (P3-06.4) */}
          {appDetail.danhSachBanPhatHanh && appDetail.danhSachBanPhatHanh.length > 1 && (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-sm font-bold font-display text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted" />
                  <span>LỊCH SỬ PHIÊN BẢN ({appDetail.danhSachBanPhatHanh.length})</span>
                </h3>
                <button
                  onClick={() => setShowAllVersions(!showAllVersions)}
                  className="btn-tactile text-xs font-mono text-muted hover:text-primary flex items-center gap-1"
                >
                  <span>{showAllVersions ? 'Thu gọn' : 'Xem tất cả'}</span>
                  {showAllVersions ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {(showAllVersions
                  ? appDetail.danhSachBanPhatHanh
                  : appDetail.danhSachBanPhatHanh.slice(0, 3)
                ).map((release) => (
                  <div
                    key={release.maPhatHanh}
                    className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border/40 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {release.tenPhienBan}
                      </span>
                      <span className="text-[11px] font-mono text-muted">
                        {new Date(release.ngayPhatHanh).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    {release.tomTatNangCapVi ? (
                      <p className="text-[11px] text-secondary leading-relaxed">
                        {release.tomTatNangCapVi}
                      </p>
                    ) : (
                      release.tieuDePhatHanh && (
                        <p className="text-[11px] text-muted leading-relaxed">
                          {release.tieuDePhatHanh}
                        </p>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* === CỘT PHỤ (32% - 4 CỘT TRÊN LG, STICKY SIDEBAR) === */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-4">
          {/* Card Hành Động Cài Đặt Nổi Bật (P3-06.1) */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-5 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted uppercase">Tùy chọn tải về</span>
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className={`btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                  isFavorited
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    : 'bg-surface-elevated border-border text-muted hover:text-primary'
                }`}
                title={isFavorited ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500' : ''}`} />
              </button>
            </div>

            {/* Bộ chọn định dạng tệp có sẵn */}
            {availableFormats.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-elevated border border-border text-xs font-mono font-medium">
                {availableFormats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`btn-tactile py-1.5 rounded-lg uppercase transition-all ${
                      selectedFormat === fmt
                        ? 'bg-accent-forge text-white shadow-sm font-bold'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    .{fmt.toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Nút Cài Đặt Đa Trạng Thái (P3-11) */}
            <button
              onClick={handleInstallClick}
              disabled={currentStatus === 'XAC_MINH' || currentStatus === 'DANG_CAI_DAT'}
              className={`btn-tactile relative overflow-hidden w-full h-12 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-150 ${
                currentStatus === 'DA_CAI_DAT'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/30'
                  : currentStatus === 'XAC_MINH'
                    ? 'bg-amber-600 text-white cursor-wait'
                    : currentStatus === 'DANG_CAI_DAT'
                      ? 'bg-blue-600 text-white cursor-wait'
                      : currentStatus === 'DANG_TAI'
                        ? 'bg-surface-elevated text-primary border border-accent-forge/50 cursor-default px-3'
                        : currentStatus === 'LOI'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                          : 'bg-accent-forge hover:bg-accent-forge-hover text-white shadow-orange-950/40'
              }`}
            >
              {currentStatus === 'DANG_TAI' && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-accent-forge/25 transition-all duration-150"
                  style={{ width: `${installInfo?.phanTram ?? 0}%` }}
                />
              )}

              <div className="relative z-10 w-full flex items-center justify-center gap-2 font-mono">
                {currentStatus === 'DANG_TAI' ? (
                  <>
                    <Download className="w-4 h-4 animate-bounce text-accent-forge shrink-0" />
                    <span className="font-tnum">Đang tải {installInfo?.phanTram ?? 0}%</span>
                    {(installInfo?.tocDoBps ?? 0) > 0 && (
                      <span className="text-[11px] text-muted font-tnum hidden sm:inline">
                        ({formatBytes(installInfo?.tocDoBps)}/s)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        huyCaiDat(appKey);
                      }}
                      className="btn-tactile ml-auto px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-1 border border-rose-500/30"
                      title="Hủy tải tệp"
                    >
                      <X className="w-3 h-3" />
                      <span>Huỷ</span>
                    </button>
                  </>
                ) : currentStatus === 'XAC_MINH' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 animate-pulse text-amber-200" />
                    <span>Xác minh SHA-256...</span>
                  </>
                ) : currentStatus === 'DANG_CAI_DAT' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                    <span>Đang cài đặt...</span>
                  </>
                ) : currentStatus === 'DA_CAI_DAT' ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{installInfo?.duongDanThucThi ? 'Mở Ứng Dụng' : 'Đã Cài Đặt'}</span>
                  </>
                ) : currentStatus === 'LOI' ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Lỗi – Thử Lại</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Cài Đặt 1-Click ({formatBytes(selectedAsset?.dungLuongBytes)})</span>
                  </>
                )}
              </div>
            </button>

            {/* Chú thích cho app cài qua EXE/MSI đã xong */}
            {currentStatus === 'DA_CAI_DAT' && !installInfo?.duongDanThucThi && (
              <p className="text-[11px] text-muted text-center leading-normal">
                Ứng dụng đã cài đặt vào hệ thống. Bạn có thể mở từ Start Menu hoặc Desktop.
              </p>
            )}

            {/* Thông báo lỗi nếu xảy ra (P3-09.2) */}
            {currentStatus === 'LOI' && installInfo?.thongDiepLoi && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 break-words">{installInfo.thongDiepLoi}</div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đã kiểm định mã độc & tính toàn vẹn SHA-256</span>
            </div>
          </div>

          {/* Jev AI Trust Score Gauge & Thẩm Định Chi Tiết (P3-06.3) */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-display text-primary uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>CHỈ SỐ BẢO VỆ JEV AI</span>
              </span>
              <TrustPill score={trustScore} size="sm" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold font-mono font-tnum ${scoreTheme.text}`}>
                {trustScore}
              </span>
              <span className="text-sm font-mono text-muted">/ 100</span>
              <span
                className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreTheme.text} ${scoreTheme.bg} ${scoreTheme.border}`}
              >
                {scoreTheme.label}
              </span>
            </div>

            {/* Thanh Progress Gauge Trực Quan */}
            <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreTheme.bar}`}
                style={{ width: `${Math.min(100, Math.max(5, trustScore))}%` }}
              />
            </div>

            {/* Điểm nổi bật & Yếu tố rủi ro */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/40 text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Kho chứa có hơn {appDetail.soLuotFork || 10} lượt forks minh bạch</span>
              </div>
              <div className="flex items-center gap-2 text-secondary">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Bản phát hành cập nhật liên tục từ GitHub</span>
              </div>

              {riskItems.length > 0 ? (
                riskItems.slice(0, 2).map((risk, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-muted">
                    <span className="text-[11px] font-mono text-amber-400 shrink-0">
                      -{risk.diemTru}đ
                    </span>
                    <span className="truncate">{risk.moTa}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>Không phát hiện yếu tố rủi ro bất thường.</span>
                </div>
              )}

              {/* Nút mở Popover/Modal Chi Tiết (P3-06.3) */}
              <button
                onClick={() => setIsSafetyModalOpen(true)}
                className="btn-tactile text-accent-ai hover:underline text-left text-xs font-semibold mt-1 flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Xem chi tiết thẩm định rủi ro ({riskItems.length} mục)</span>
              </button>
            </div>
          </div>

          {/* Thẻ Thông Tin Kho Lưu Trữ GitHub */}
          <div className="tactile-card p-5 rounded-2xl flex flex-col gap-3 text-xs">
            <h4 className="font-bold font-display text-primary flex items-center gap-2">
              <Github className="w-4 h-4" />
              <span>DỮ LIỆU KHO CHỨA GITHUB</span>
            </h4>
            <div className="flex flex-col gap-2 font-mono text-[11px] text-secondary">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Ngôn ngữ chính:</span>
                <span className="text-primary font-bold">
                  {appDetail.ngonNguChinh || 'Đa ngôn ngữ'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Forks:</span>
                <span className="text-primary">{formatStars(appDetail.soLuotFork)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Bản phát hành:</span>
                <span className="text-primary">
                  {appDetail.danhSachBanPhatHanh?.length || 1} releases
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Đồng bộ lần cuối:</span>
                <span className="text-emerald-400">
                  {new Date(appDetail.dongBoLanCuoi).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODAL/POPOVER CHI TIẾT THẨM ĐỊNH RỦI RO JEV AI (P3-06.3) */}
      {isSafetyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="tactile-card w-full max-w-lg p-6 rounded-2xl border border-border shadow-2xl flex flex-col gap-5 bg-surface max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold font-display text-primary">
                  BẢNG KÊ KHAI AN TOÀN & RỦI RO JEV AI
                </h3>
              </div>
              <button
                onClick={() => setIsSafetyModalOpen(false)}
                className="btn-tactile w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60">
              <div>
                <span className="text-xs text-muted font-mono">Điểm tín nhiệm bảo mật</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-2xl font-bold font-mono ${scoreTheme.text}`}>
                    {trustScore} / 100
                  </span>
                  <span className="text-xs font-semibold text-secondary">({scoreTheme.label})</span>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-muted">
                <div>Thẩm định: Jev Noul AI</div>
                <div className="text-primary font-semibold">
                  {appDetail.phanTichAi?.trangThaiThamDinhJev || 'DA_THAM_DINH'}
                </div>
              </div>
            </div>

            {/* Danh sách yếu tố rủi ro */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-primary uppercase font-mono">
                Yếu tố xem xét & điểm trừ ({riskItems.length})
              </h4>
              {riskItems.length > 0 ? (
                riskItems.map((risk, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-elevated/40 border border-border/50 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>{risk.ma}</span>
                      </span>
                      <span className="font-mono text-amber-400 font-bold">-{risk.diemTru}đ</span>
                    </div>
                    <p className="text-secondary text-[11px] leading-relaxed mt-0.5">{risk.moTa}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted mt-1">
                      <span>Nguồn: {risk.nguon}</span>
                      {risk.xacSuat !== undefined && (
                        <span>Xác suất Noul: {(risk.xacSuat * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
                  Tuyệt vời! Ứng dụng này không có bất kỳ yếu tố rủi ro nào bị phát hiện.
                </div>
              )}
            </div>

            {/* Quyền hạn đã thẩm định (nếu có) */}
            {appDetail.phanTichAi?.quyenHanDaKiemTra &&
              appDetail.phanTichAi.quyenHanDaKiemTra.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                  <h4 className="text-xs font-bold text-primary uppercase font-mono">
                    Quyền hạn hệ thống đã kiểm tra ({appDetail.phanTichAi.quyenHanDaKiemTra.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {appDetail.phanTichAi.quyenHanDaKiemTra.map((perm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-surface-elevated text-[11px] font-mono text-muted border border-border"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <button
              onClick={() => setIsSafetyModalOpen(false)}
              className="btn-tactile w-full h-10 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border mt-2"
            >
              Đóng bảng kê khai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
