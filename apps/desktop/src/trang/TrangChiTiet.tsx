import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  Heart,
  Download,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Github,
  FileArchive,
  CheckCircle2,
  Shield,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
  X,
  Loader2,
  FolderOpen,
  Terminal,
  BookOpen,
  Languages,
  Library,
  Smartphone,
} from 'lucide-react';
import { NhanTinCay } from '../thanh-phan/dung-chung/NhanTinCay';
import { NhanLuuTru } from '../thanh-phan/dung-chung/NhanLuuTru';
import { NhanDaCaiTrenMay } from '../thanh-phan/dung-chung/NhanDaCaiTrenMay';
import { XemMarkdown } from '../thanh-phan/dung-chung/XemMarkdown';
import { AsciiSkeleton } from '../thanh-phan/dung-chung/KhungXuongAscii';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { useXacThucStore } from '../kho-trang-thai/useXacThucStore';
import { useCaiDatUngDungStore } from '../kho-trang-thai/useCaiDatUngDungStore';
import { useCaiDatStore } from '../kho-trang-thai/useCaiDatStore';
import { toast } from '../kho-trang-thai/useThongBaoStore';
import { caiDatUngDungService } from '../dich-vu/cai-dat-ung-dung/cai-dat-ung-dung.service';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { yeuThichService } from '../dich-vu/yeu-thich/yeu-thich.service';
import { thuVienService } from '../dich-vu/thu-vien/thu-vien.service';
import { ApiError } from '../dich-vu/api/api-client';
import { useDongBoUngDungCli } from '../hooks/useDongBoUngDungCli';
import { TIEU_DE_HUONG_DAN_DONG_LENH } from './tieu-de-huong-dan.core';
import { layNhanHeDieuHanh, layNhanNhomCachCai, layTenCachCai } from './hien-thi-cach-cai.core';
import {
  CachCaiDto,
  MaTrinhQuanLyGoi,
  trichTenGoiTuLenhTho,
  laLenhNpmCucBo,
  timTepTheoMauWildcard,
  kiemTraGoiThuocRepo,
  type TrangKetQua,
  type UngDungTomTatDto,
} from '@forgestore/types';

/**
 * Thuật toán chọn tệp cài đặt tối ưu cho máy tính Windows (P3-FIX)
 * Ưu tiên:
 * 1. Bản x64 / x86_64 rõ ràng (tên tệp hoặc kienTrucChip === 'X86_64').
 * 2. Bản trung tính / Universal ('DUNG_CHUNG', hoặc không ghi kiến trúc, không chứa 'arm').
 * 3. Bản 32-bit x86 (tương thích qua WoW64 trên Windows x64).
 * 4. Bản ARM64 (ưu tiên thấp nhất khi chạy trên máy x64).
 */
export function timTepCaiDatToiUu<
  T extends { tenTep: string; dinhDangTep?: string | null; kienTrucChip?: string | null },
>(assets: T[], format: string, kienTrucUuTien: 'x64' | 'arm64' = 'x64'): T | undefined {
  if (!assets || assets.length === 0) return undefined;

  const fmtUpper = format.toUpperCase();
  const filtered = assets.filter((a) => {
    const assetFmt = (a.dinhDangTep || '').toString().toUpperCase();
    if (assetFmt === fmtUpper) return true;
    if (fmtUpper === 'EXE' && a.tenTep.toLowerCase().endsWith('.exe')) return true;
    if (fmtUpper === 'MSI' && a.tenTep.toLowerCase().endsWith('.msi')) return true;
    if (
      (fmtUpper === 'ZIP' || fmtUpper === 'ZIP_PORTABLE') &&
      (a.tenTep.toLowerCase().endsWith('.zip') || a.tenTep.toLowerCase().endsWith('.7z'))
    )
      return true;
    return false;
  });

  const candidates = filtered.length > 0 ? filtered : assets;

  const scoreAsset = (asset: T): number => {
    const ten = asset.tenTep.toLowerCase();
    const chip = (asset.kienTrucChip || '').toString().toUpperCase();

    const isArm = ten.includes('arm64') || ten.includes('aarch64') || chip.includes('ARM64');
    const isExplicitX64 =
      ten.includes('x64') ||
      ten.includes('x86_64') ||
      ten.includes('amd64') ||
      ten.includes('win64') ||
      chip === 'X86_64';
    const isExplicitX86 =
      ten.includes('x86') || ten.includes('win32') || ten.includes('ia32') || chip === 'X86';

    // FE-V3-04: Trừ điểm nặng đối với các tệp dành riêng cho Linux, macOS, Android
    // hoặc tệp mã nguồn đính kèm (source code zip), tránh chọn nhầm tệp Linux/macOS zip cho máy Windows
    const isNonWindows =
      ten.includes('linux') ||
      ten.includes('darwin') ||
      ten.includes('macos') ||
      ten.includes('osx') ||
      ten.includes('ubuntu') ||
      ten.includes('debian') ||
      ten.includes('android');

    const isSourceCode =
      ten.includes('source') ||
      ten.startsWith('src-') ||
      ten.endsWith('-src.zip') ||
      ten === 'source.zip';

    if (isNonWindows || isSourceCode) {
      return 0; // Đưa về 0 điểm tuyệt đối
    }

    if (kienTrucUuTien === 'x64') {
      if (isExplicitX64 && !isArm) {
        // Tên chứa rõ ràng x64/amd64 được ưu tiên hàng đầu
        return ten.includes('x64') || ten.includes('amd64') ? 110 : 100;
      }
      if (!isArm && !isExplicitX86) {
        // Bản trung tính / Universal / không ghi kiến trúc
        return 70;
      }
      if (isExplicitX86 && !isArm) {
        // Bản 32-bit (chạy qua WoW64)
        return 40;
      }
      // Bản ARM trên máy x64
      return 10;
    } else {
      // Máy ARM
      if (isArm) return 110;
      if (!isExplicitX64 && !isExplicitX86) return 70;
      return 30;
    }
  };

  const sorted = [...candidates].sort((a, b) => scoreAsset(b) - scoreAsset(a));
  return sorted[0];
}

/**
 * P3B-17.1: Biến thể đã nhớ chỉ được áp dụng khi cùng loại tệp với tab đang mở.
 * Nếu không, tab hiện EXE nhưng tệp được chọn lại là .7z đã nhớ từ lần trước và
 * bấm sang tab khác cũng không đổi được tệp đang chọn.
 */
export function bienTheKhopTab<T extends { dinhDangTep?: unknown }>(
  bienTheDaNho: T | null | undefined,
  selectedFormat: string,
): T | null {
  if (!bienTheDaNho) return null;
  const dinhDang = (bienTheDaNho.dinhDangTep?.toString() || 'EXE').toUpperCase();
  return dinhDang === selectedFormat.toUpperCase() ? bienTheDaNho : null;
}

/**
 * Tính trạng thái hiệu lực của nút Cài đặt theo định dạng (A2, A3, FE-01, FE-V3-03)
 * - Tab ZIP: Luôn tải độc lập, không bị khóa bởi bản EXE/MSI đã cài trên máy.
 * - Tab EXE/MSI: Nguồn chân lý từ server theo thiết bị (isInstalledOnDevice) hoặc vừa cài xong.
 * - FE-V3-03: Phân lập Task Slot: Tab ZIP và Tab EXE chỉ nhận tiến trình tải/xác minh/cài đặt
 *   nếu loại tệp đang xử lý trùng khớp với Tab định dạng đang xem.
 */
export function tinhTrangThaiHieuLuc(params: {
  selectedFormat: string;
  isInstalledOnDevice: boolean;
  localStatus: string;
  installedFileType?: string;
  hasExtractedDir?: boolean;
}): string {
  const isZipTab =
    params.selectedFormat.toUpperCase() === 'ZIP' ||
    params.selectedFormat.toUpperCase() === 'ZIP_PORTABLE';

  const isZipFile = params.installedFileType?.toUpperCase().includes('ZIP');
  const isProgress =
    params.localStatus === 'DANG_TAI' ||
    params.localStatus === 'XAC_MINH' ||
    params.localStatus === 'DANG_CAI_DAT';

  if (isZipTab) {
    // FE-V3-03: Tab ZIP chỉ hiển thị tiến trình nếu tệp đang tải/cài là ZIP
    if (isProgress) {
      if (params.installedFileType === undefined || isZipFile) {
        return params.localStatus;
      }
      // Tiến trình thuộc về bản EXE/MSI, Tab ZIP giữ trạng thái sẵn sàng
      return 'CHUA_CAI';
    }
    // L-08: Tab ZIP luôn là nút "Tải về & giải nén", không giữ trạng thái DA_CAI_DAT
    if (params.localStatus === 'LOI' && isZipFile) {
      return 'LOI';
    }
    if (params.localStatus === 'DA_HUY' && isZipFile) {
      return 'DA_HUY';
    }
    return 'CHUA_CAI';
  } else {
    // Thẻ phân loại EXE / MSI:
    // FE-V3-03 & FE-EC-02: Tab EXE chỉ hiển thị tiến trình nếu tệp đang tải/cài KHÔNG phải là ZIP
    if (isProgress) {
      if (params.installedFileType === undefined || !isZipFile) {
        return params.localStatus;
      }
      // Tiến trình thuộc về bản ZIP, Tab EXE hiển thị theo trạng thái đã cài hoặc sẵn sàng
      return params.isInstalledOnDevice ? 'DA_CAI_DAT' : 'CHUA_CAI';
    }
    if (params.localStatus === 'DA_HUY' && !isZipFile) {
      return 'DA_HUY';
    }
    if (params.localStatus === 'LOI' && !isZipFile) {
      return 'LOI';
    }
    if (params.isInstalledOnDevice) {
      return 'DA_CAI_DAT';
    }
    // FIX EC-01: Chỉ nhận DA_CAI_DAT từ localStatus nếu phiên cài vừa rồi KHÔNG phải là ZIP Portable
    if (params.localStatus === 'DA_CAI_DAT') {
      if (!isZipFile) {
        return 'DA_CAI_DAT';
      }
      return 'CHUA_CAI';
    }
    return !isZipFile ? params.localStatus : 'CHUA_CAI';
  }
}

/**
 * Kiểm tra xem URL tải tệp có an toàn và thuộc nguồn phát hành tin cậy (GitHub) hay không (SEC-02).
 * Chặn đứng các scheme độc hại (javascript:, file:, data:, http:) và open redirect / credential injection.
 */
export function laUrlTaiVeAnToan(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    // Chặn credential nhúng trong URL: https://user:pass@evil.com/
    if (parsed.username || parsed.password) return false;

    const hostname = parsed.hostname.toLowerCase();
    // Danh sách miền GitHub tin cậy để tải bản phát hành
    return (
      hostname === 'github.com' ||
      hostname.endsWith('.github.com') ||
      hostname === 'githubusercontent.com' ||
      hostname.endsWith('.githubusercontent.com')
    );
  } catch {
    return false;
  }
}

/** Là tệp cài chạy được trên Windows (.exe, .msi, .zip, .7z). */
export function laTepCaiWindows(tenTep: string): boolean {
  const ext = tenTep.toLowerCase();
  return (
    ext.endsWith('.exe') || ext.endsWith('.msi') || ext.endsWith('.zip') || ext.endsWith('.7z')
  );
}

/**
 * Phân tích tệp của bản phát hành (P3B-19.3 / 19.6): app chỉ có APK khi không có tệp Windows.
 * Nếu bản Windows trả 0 tệp thì lấy danh sách từ bản Android (tepAndroid).
 */
export function phanTichTepAndroidApk<T extends { tenTep: string }>(
  tepWindows: T[],
  tepAndroid: T[] = [],
) {
  const windowsAssets = tepWindows.filter((f) => laTepCaiWindows(f.tenTep));
  const coFileCaiDat = windowsAssets.length > 0;
  const ungVien = tepWindows.length > 0 ? tepWindows : tepAndroid;
  const apkAssets = ungVien.filter((f) => f.tenTep.toLowerCase().endsWith('.apk'));
  return {
    windowsAssets,
    coFileCaiDat,
    apkAssets,
    chiCoFileApkAndroid: !coFileCaiDat && apkAssets.length > 0,
  };
}

export const TrangChiTiet: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedAppId, navigateTo, setAuthModalOpen } = useDieuHuongStore();
  const { isAuthenticated, user, maThietBi } = useXacThucStore();
  const appId = selectedAppId || 'rustdesk/rustdesk';
  // Cờ `laYeuThich` trong chi tiết app phụ thuộc người đang đăng nhập, nên khóa cache phải gắn với
  // người dùng. Nếu không, bản tải lúc chưa có token (laYeuThich rỗng) bị giữ lại sau khi đăng nhập.
  const appDetailKey = ['app-detail', appId, user?.maNguoiDung ?? 'khach'] as const;

  // Quản lý polling AI
  const [pollStartTime] = useState<number>(() => Date.now());

  // Trạng thái giao diện
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<boolean>(false);
  const [loiYeuThich, setLoiYeuThich] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('EXE');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);
  const [zipExtractToast, setZipExtractToast] = useState<{ duongDan: string } | null>(null);
  const [moThuMucLoi, setMoThuMucLoi] = useState<string | null>(null);
  const [activeCliMethodIndex, setActiveCliMethodIndex] = useState<number>(0);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const [isRecordingCli, setIsRecordingCli] = useState<boolean>(false);
  const [isConfirmingCli, setIsConfirmingCli] = useState<boolean>(false);
  const [terminalWarningModal, setTerminalWarningModal] = useState<{
    lenh: string;
    canhBao?: string;
  } | null>(null);

  // Reset trạng thái cục bộ khi chuyển sang xem ứng dụng khác
  useEffect(() => {
    setSelectedAssetId(null);
    setIsSafetyModalOpen(false);
    setShowAllVersions(false);
    setActiveCliMethodIndex(0);
    setLoiYeuThich(null);
    setZipExtractToast(null);
    setMoThuMucLoi(null);
    setIsRecordingCli(false);
    setIsConfirmingCli(false);
    setTerminalWarningModal(null);
  }, [appId]);

  // Cấu hình thư mục lưu bản portable từ trang Cài đặt (L-08: Chỗ duy nhất chọn thư mục portable)
  const { thuMucPortable } = useCaiDatStore();
  const targetPortableDir = thuMucPortable || undefined;

  // Động cơ cài đặt Native Tauri & Quản lý tiến trình (P3-08..P3-11)
  const { caiDatMap, batDauCaiDat, huyCaiDat, moApp } = useCaiDatUngDungStore();

  // TanStack Query nạp dữ liệu sống từ Backend
  const {
    data: appDetail,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: appDetailKey,
    queryFn: () => khoUngDungService.layChiTietApp(appId),
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

  // Nạp danh sách yêu thích người dùng để đồng bộ hai chiều chính xác 100%
  const { data: userFavoritesData } = useQuery({
    queryKey: ['user-favorites'],
    // Backend giới hạn limit tối đa 50 (QueryFavoritesDto); gửi 100 sẽ bị trả 400.
    queryFn: () => yeuThichService.layDanhSachYeuThich(1, 50),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  // Nạp danh sách ứng dụng đã cài đặt trên thiết bị hiện tại từ server (A3)
  const { data: installedAppsOnDevice = [] } = useQuery({
    queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
    queryFn: () =>
      maThietBi ? thuVienService.layDanhSachAppDaCai(maThietBi) : Promise.resolve([]),
    enabled: Boolean(isAuthenticated && maThietBi),
    staleTime: 1000 * 60 * 2,
  });

  // P3B-19.6: Khi không có tệp cài Windows và không có CLI, nạp thêm chi tiết nền tảng Android để lấy tệp APK
  const coFileWindowsBanDau = Boolean(
    (
      appDetail?.banPhatHanhMoiNhat?.danhSachTepCaiDat ||
      appDetail?.danhSachBanPhatHanh?.[0]?.danhSachTepCaiDat ||
      []
    ).some((f) => laTepCaiWindows(f.tenTep)),
  );
  const huongDanCliBanDau =
    appDetail?.huongDanCaiDat || appDetail?.phanTichAi?.huongDanCaiDat || null;
  const coCliBanDau = Boolean(
    huongDanCliBanDau && huongDanCliBanDau.cachCai && huongDanCliBanDau.cachCai.length > 0,
  );
  const canFetchAndroidApk = Boolean(appDetail && !coFileWindowsBanDau && !coCliBanDau);

  const { data: androidDetail } = useQuery({
    queryKey: ['app-detail-android', appId],
    queryFn: () => khoUngDungService.layChiTietApp(appId, 'android'),
    enabled: canFetchAndroidApk,
    staleTime: 3 * 60 * 1000,
  });

  // P3B-05.7 / P3B-05.9 / Lỗi 4: Nạp tài liệu README song ngữ từ backend kèm timeout polling 2 phút (40 lần)
  const [readmeLang, setReadmeLang] = useState<'vi' | 'en'>('vi');
  const pollCountRef = useRef(0);
  const [isPollTimedOut, setIsPollTimedOut] = useState(false);
  const [isRetryingReadme, setIsRetryingReadme] = useState(false);

  // Reset bộ đếm polling khi chuyển app
  useEffect(() => {
    pollCountRef.current = 0;
    setIsPollTimedOut(false);
  }, [appId]);

  const {
    data: readmeData,
    isLoading: isReadmeLoading,
    refetch: refetchReadme,
  } = useQuery({
    queryKey: ['app-readme', appId],
    queryFn: () => khoUngDungService.layReadmeApp(appId),
    enabled: Boolean(appId),
    staleTime: 2 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      // README đang xếp sang ngày mai thì không có gì để chờ, khỏi hỏi lại mỗi 3 giây.
      if (data?.choNgayMai) return false;
      if (
        data &&
        (data.trangThai === 'DANG_DICH' ||
          data.trangThai === 'CHUA_DICH' ||
          data.trangThai === 'DA_CU')
      ) {
        pollCountRef.current += 1;
        if (pollCountRef.current > 40) {
          setIsPollTimedOut(true);
          return false; // Dừng polling sau 2 phút (40 x 3s)
        }
        return 3000;
      }
      return false;
    },
  });

  // Đồng bộ trạng thái yêu thích từ backend hoặc danh sách user-favorites
  useEffect(() => {
    if (appDetail?.laYeuThich !== undefined) {
      setIsFavorited(appDetail.laYeuThich);
    } else if (userFavoritesData?.duLieu) {
      const match = userFavoritesData.duLieu.some(
        (fav) =>
          fav.maUngDung === appDetail?.maUngDung ||
          // Chỉ so mã app hoặc tên đầy đủ owner/repo: chỉ tên repo thì hai repo trùng tên khác chủ sẽ bị nhầm
          fav.tenRepoDayDu === appId,
      );
      setIsFavorited(match);
    }
  }, [appDetail?.laYeuThich, appDetail?.maUngDung, appId, userFavoritesData]);

  // Đổi trạng thái yêu thích kết nối API Backend Supabase
  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      toast.info('Vui lòng đăng nhập để lưu ứng dụng vào Kho yêu thích');
      return;
    }

    const targetId = appDetail?.maUngDung || appId;
    if (!targetId) return;

    setIsTogglingFavorite(true);
    setLoiYeuThich(null);
    const prevState = isFavorited;
    const nextState = !prevState;
    setIsFavorited(nextState);

    try {
      const res = await yeuThichService.chuyenDoiYeuThich(targetId);
      setIsFavorited(res.daYeuThich);
      // Cập nhật ngay trong cache của app-detail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(appDetailKey, (old: any) => {
        if (!old) return old;
        return { ...old, laYeuThich: res.daYeuThich };
      });
      // L-11: Cập nhật thẳng cache ['user-favorites'] thay vì invalidateQueries
      queryClient.setQueriesData<TrangKetQua<UngDungTomTatDto>>(
        { queryKey: ['user-favorites'] },
        (old) => {
          if (!old || !old.duLieu) return old;
          if (res.daYeuThich) {
            const alreadyExists = old.duLieu.some(
              (item) => item.maUngDung === targetId || item.tenRepoDayDu === targetId,
            );
            if (alreadyExists) return old;

            const banMoiNhat = appDetail?.danhSachBanPhatHanh?.[0];
            const newFav: UngDungTomTatDto = {
              maUngDung: appDetail?.maUngDung || targetId,
              chuSoHuu: appDetail?.chuSoHuu || '',
              tenKhoChua: appDetail?.tenKhoChua || '',
              tenRepoDayDu: appDetail?.tenRepoDayDu || '',
              duongDanGithub: appDetail?.duongDanGithub || '',
              duongDanIcon: appDetail?.duongDanIcon ?? null,
              soSaoGithub: appDetail?.soSaoGithub || 0,
              danhMucChinh: appDetail?.danhMucChinh || 'Tiện ích hệ thống',
              nenTangHoTro: appDetail?.nenTangHoTro || 'DA_NEN_TANG',
              khauHieuTiengViet:
                appDetail?.phanTichAi?.khauHieuTiengViet || appDetail?.moTaGocTiengAnh || '',
              phienBanMoiNhat: banMoiNhat?.tenPhienBan ?? null,
              ngayCapNhat: banMoiNhat?.ngayPhatHanh
                ? new Date(banMoiNhat.ngayPhatHanh).toISOString()
                : new Date().toISOString(),
              diemUyTin: appDetail?.phanTichAi?.diemUyTin ?? null,
              mucDoAnToan: appDetail?.phanTichAi?.mucDoAnToan ?? null,
              daXacMinh: appDetail?.daXacMinh ?? false,
              duocNoiBat: appDetail?.duocNoiBat ?? false,
              daLuuTru: appDetail?.daLuuTru ?? false,
              tenGoiAndroid: appDetail?.tenGoiAndroid ?? null,
              dinhDangCoSan: appDetail?.dinhDangCoSan,
              kienTrucCoSan: appDetail?.kienTrucCoSan,
              loaiGiayPhep: appDetail?.loaiGiayPhep || null,
            };

            return {
              ...old,
              duLieu: [newFav, ...old.duLieu],
              tongSo: old.tongSo + 1,
            };
          } else {
            return {
              ...old,
              duLieu: old.duLieu.filter(
                (item) => item.maUngDung !== targetId && item.tenRepoDayDu !== targetId,
              ),
              tongSo: Math.max(0, old.tongSo - 1),
            };
          }
        },
      );
    } catch (err) {
      console.warn('[TrangChiTiet] Lỗi khi chuyển đổi yêu thích:', err);
      setIsFavorited(prevState);
      // Báo lỗi ra giao diện thay vì âm thầm quay về trạng thái cũ
      setLoiYeuThich(
        err instanceof ApiError
          ? `Không lưu được yêu thích (mã ${err.status}). Vui lòng thử lại.`
          : 'Không kết nối được máy chủ để lưu yêu thích. Vui lòng thử lại.',
      );
    } finally {
      setIsTogglingFavorite(false);
    }
  };

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

  // FE-V3-05: Quản lý timer trạng thái "Đã chép" bằng useRef chống race condition và memory leak
  const copyCommandTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyCommandTimerRef.current) clearTimeout(copyCommandTimerRef.current);
    };
  }, []);

  // Sao chép câu lệnh CLI kèm hiệu ứng Checkmark Pop (DELIV-33.3, FE-V3-05 & EC-04)
  const handleCopyCommand = (lenh: string, id: string) => {
    if (!lenh) return;
    // Khử khuẩn ký tự xuống dòng chống Pastejacking nguy hiểm
    const sanitizedLenh = lenh.trim().replace(/[\r\n]+/g, ' ');
    navigator.clipboard
      .writeText(sanitizedLenh)
      .then(() => {
        setCopiedCommandId(id);
        if (copyCommandTimerRef.current) clearTimeout(copyCommandTimerRef.current);
        copyCommandTimerRef.current = setTimeout(() => setCopiedCommandId(null), 2000);
      })
      .catch((err) => console.warn('[TrangChiTiet] Không thể sao chép lệnh:', err));
  };

  // Mở Terminal an toàn theo Quyết định D-27 (P3B-18)
  const thucHienMoTerminal = async (lenh: string) => {
    if (!lenh) return;
    const sanitizedLenh = lenh.trim().replace(/[\r\n]+/g, ' ');

    // 1. Sao chép câu lệnh vào Clipboard
    let daChepClipboard = false;
    try {
      await navigator.clipboard.writeText(sanitizedLenh);
      daChepClipboard = true;
    } catch (clipErr) {
      console.warn(
        '[TrangChiTiet] Không thể sao chép vào clipboard trước khi mở terminal:',
        clipErr,
      );
      daChepClipboard = false;
    }

    // 2. Lấy cấu hình terminal từ useCaiDatStore
    const { trinhTerminal, thuMucLamViecTerminal } = useCaiDatStore.getState();

    const isTauri =
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mo_terminal_chay_lenh', {
          lenh: sanitizedLenh,
          trinhTerminal: trinhTerminal || undefined,
          thuMucLamViec: thuMucLamViecTerminal || undefined,
        });
        if (daChepClipboard) {
          toast.success(
            'Đã mở Terminal! Lệnh đã nằm trong Clipboard, nhấn Ctrl+V rồi Enter để chạy.',
          );
        } else {
          toast.info(
            'Đã mở Terminal nhưng không thể tự động sao chép vào Clipboard. Vui lòng sao chép lệnh thủ công!',
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Không thể mở Terminal tự động: ${errMsg}`);
        if (daChepClipboard) {
          toast.info(
            'Lệnh đã nằm trong Clipboard. Vui lòng mở Terminal thủ công rồi nhấn Ctrl+V rồi Enter để chạy.',
          );
        } else {
          toast.info('Vui lòng sao chép lệnh và mở Terminal thủ công để chạy.');
        }
      }
    } else {
      // Giả lập trên Web dev
      if (daChepClipboard) {
        toast.info(
          `[Web Dev] Lệnh đã nằm trong Clipboard. Mở Terminal rồi nhấn Ctrl+V rồi Enter để chạy: ${sanitizedLenh}`,
        );
      } else {
        toast.info(
          `[Web Dev] Không thể sao chép lệnh vào Clipboard. Mở Terminal và gõ: ${sanitizedLenh}`,
        );
      }
    }
  };

  const handleOpenTerminal = (lenh: string, ruiRoCao?: boolean, canhBaoRuiRo?: string) => {
    if (!lenh) return;
    const sanitizedLenh = lenh.trim().replace(/[\r\n]+/g, ' ');

    // Kiểm tra rủi ro cao: loại bỏ regex tham lam để triệt tiêu hoàn toàn ReDoS O(N^2), bổ sung cả cradle ngoặc đơn iex (...)
    const hasPipe = /\|\s*(?:sudo\s+)?(?:bash|sh|zsh|pwsh|iex|Invoke-Expression)\b/i.test(
      sanitizedLenh,
    );
    const hasDownloadTool = /\b(?:curl|wget|irm|iwr|Invoke-RestMethod|Invoke-WebRequest)\b/i.test(
      sanitizedLenh,
    );
    const hasParenthesisCradle =
      /\b(?:iex|Invoke-Expression)\s*\(\s*(?:irm|iwr|Invoke-RestMethod|Invoke-WebRequest|New-Object)\b/i.test(
        sanitizedLenh,
      );
    const hasPrivilegeEscalation = /\b(?:sudo|runas|gsudo)\b/i.test(sanitizedLenh);

    if (
      ruiRoCao ||
      (hasPipe && hasDownloadTool) ||
      hasParenthesisCradle ||
      hasPrivilegeEscalation
    ) {
      setTerminalWarningModal({
        lenh: sanitizedLenh,
        canhBao:
          canhBaoRuiRo ||
          'Lệnh này thực thi trực tiếp script tải từ internet hoặc yêu cầu quyền hạn quản trị. Hãy kiểm tra kỹ nội dung lệnh trước khi mở.',
      });
      return;
    }

    thucHienMoTerminal(sanitizedLenh);
  };

  // Phân tích các tệp cài đặt của bản phát hành mới nhất (ưu tiên Windows, fallback Android khi cần)
  const latestRelease =
    appDetail?.banPhatHanhMoiNhat ||
    appDetail?.danhSachBanPhatHanh?.[0] ||
    androidDetail?.banPhatHanhMoiNhat ||
    androidDetail?.danhSachBanPhatHanh?.[0];
  const allAssets = latestRelease?.danhSachTepCaiDat || [];

  // Lọc tệp cài Windows và APK Android (FE-EC-01, P3B-17.6, P3B-19.3, P3B-19.6)
  const { windowsAssets, coFileCaiDat, apkAssets, chiCoFileApkAndroid } = phanTichTepAndroidApk(
    allAssets,
    androidDetail?.banPhatHanhMoiNhat?.danhSachTepCaiDat ||
      androidDetail?.danhSachBanPhatHanh?.[0]?.danhSachTepCaiDat ||
      [],
  );
  const displayAssets = windowsAssets;

  const handleDownloadApk = async (apkAsset: (typeof allAssets)[0]) => {
    if (!apkAsset.duongDanTaiVe) return;

    if (!laUrlTaiVeAnToan(apkAsset.duongDanTaiVe)) {
      toast.error('Đường dẫn tải tệp APK không an toàn hoặc không thuộc nguồn GitHub tin cậy!');
      return;
    }

    try {
      toast.info(`Bắt đầu tải tệp ${apkAsset.tenTep}...`);
      const isTauri =
        typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      if (isTauri) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(apkAsset.duongDanTaiVe);
      } else {
        window.open(apkAsset.duongDanTaiVe, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(apkAsset.duongDanTaiVe, '_blank', 'noopener,noreferrer');
    }
  };

  // Hướng dẫn cài đặt qua dòng lệnh CLI (DELIV-33.3)
  const huongDanCli = appDetail?.huongDanCaiDat || appDetail?.phanTichAi?.huongDanCaiDat || null;
  // Khẩu hiệu riêng: bỏ qua nếu trùng nguyên văn với dòng mô tả đang hiển thị dưới tên app
  const moTaDangHienThi = (appDetail?.moTaVi || appDetail?.moTaGocTiengAnh || '').trim();
  const khauHieuUngVien = (
    appDetail?.phanTichAi?.khauHieuTiengViet ||
    appDetail?.khauHieuTiengViet ||
    ''
  ).trim();
  const khauHieuRieng =
    khauHieuUngVien && khauHieuUngVien !== moTaDangHienThi ? khauHieuUngVien : null;

  const coHuongDanCli = Boolean(
    huongDanCli && huongDanCli.cachCai && huongDanCli.cachCai.length > 0,
  );

  // Danh sách các định dạng tệp thực tế có sẵn
  const availableFormats = Array.from(
    new Set(displayAssets.map((a) => a.dinhDangTep?.toString() || 'EXE')),
  );

  // Tự động chọn format mặc định nếu format hiện tại không tồn tại
  useEffect(() => {
    if (availableFormats.length > 0 && !availableFormats.includes(selectedFormat)) {
      setSelectedFormat(availableFormats[0]);
      setSelectedAssetId(null);
    }
  }, [availableFormats, selectedFormat]);

  // Thuật toán chọn tệp tối ưu cho Windows x64 (P3-FIX)
  const optimalAsset = useMemo(
    () => timTepCaiDatToiUu(displayAssets, selectedFormat, 'x64'),
    [displayAssets, selectedFormat],
  );

  // Trạng thái cài đặt thực tế từ useCaiDatUngDungStore (P3-08..P3-11 & P3B-17)
  const appKey = appDetail?.maUngDung || appId;
  const installInfo = caiDatMap[appKey];

  // P3B-17.1: Tự động nhận diện biến thể đã cài đặt lần trước qua mẫu wildcard pattern
  const mauBienTheDaLuu =
    useCaiDatUngDungStore((s) => s.layBienThe(appKey)) || installInfo?.mauBienThe;
  const assetBienTheCu = useMemo(() => {
    if (!mauBienTheDaLuu || displayAssets.length === 0) return null;
    return timTepTheoMauWildcard(displayAssets, mauBienTheDaLuu);
  }, [displayAssets, mauBienTheDaLuu]);

  // Lựa chọn hiện tại: ưu tiên tệp người dùng click chọn thủ công, tiếp đến là biến thể đã cài lần trước, nếu không thì lấy tệp tối ưu
  const selectedAsset = useMemo(() => {
    if (selectedAssetId) {
      const found = displayAssets.find((a) => a.maTep === selectedAssetId);
      if (found) return found;
    }
    const bienTheTrongTab = bienTheKhopTab(assetBienTheCu, selectedFormat);
    if (bienTheTrongTab) {
      return bienTheTrongTab;
    }
    return optimalAsset || displayAssets[0];
  }, [selectedAssetId, displayAssets, assetBienTheCu, optimalAsset, selectedFormat]);

  // Mở trang lần đầu: đưa tab về đúng loại tệp của biến thể đã nhớ (chỉ một lần cho mỗi app)
  const daDongBoTabTheoBienThe = useRef<string | null>(null);
  useEffect(() => {
    if (!assetBienTheCu || daDongBoTabTheoBienThe.current === appKey) return;
    daDongBoTabTheoBienThe.current = appKey;
    setSelectedFormat(assetBienTheCu.dinhDangTep?.toString() || 'EXE');
  }, [assetBienTheCu, appKey]);

  // Cảnh báo nếu tệp đang chọn không tương thích với máy x64
  const isChipIncompatible = useMemo(() => {
    if (!selectedAsset) return false;
    const chip = (selectedAsset.kienTrucChip || '').toString().toUpperCase();
    const ten = selectedAsset.tenTep.toLowerCase();
    return ten.includes('arm64') || ten.includes('aarch64') || chip.includes('ARM64');
  }, [selectedAsset]);

  // Kiểm tra xem ứng dụng này đã được cài trên chính máy trạm hiện tại hay chưa (Nguyên tắc 1 & A3)
  const isInstalledOnDevice = useMemo(() => {
    if (!isAuthenticated || !maThietBi) return false;
    return installedAppsOnDevice.some(
      (item) => item.maUngDung === appDetail?.maUngDung || item.ungDung?.tenRepoDayDu === appId,
    );
  }, [installedAppsOnDevice, isAuthenticated, maThietBi, appDetail?.maUngDung, appId]);

  // Kiểm tra riêng bản ghi cài đặt qua dòng lệnh CLI trên thiết bị (P3B-16)
  const installedCliRecord = useMemo(() => {
    if (!isAuthenticated || !maThietBi) return null;
    return (
      installedAppsOnDevice.find(
        (item) =>
          (item.maUngDung === appDetail?.maUngDung || item.ungDung?.tenRepoDayDu === appId) &&
          Boolean(item.trinhQuanLyGoi),
      ) || null
    );
  }, [installedAppsOnDevice, isAuthenticated, maThietBi, appDetail?.maUngDung, appId]);

  // P3B-30: đối chiếu bản ghi cài bằng dòng lệnh của ứng dụng này với máy (tự xác nhận, đọc phiên bản thật)
  const banGhiCliDeDongBo = useMemo(
    () => (installedCliRecord ? [installedCliRecord] : []),
    [installedCliRecord],
  );
  useDongBoUngDungCli(maThietBi, banGhiCliDeDongBo);

  // Ghi nhận "Tôi đã cài" qua dòng lệnh CLI (P3B-16.5)
  const handleRecordCliInstall = async (currentMethod?: CachCaiDto | null) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      toast.info('Vui lòng đăng nhập tài khoản để lưu ứng dụng vào Thư viện của máy.');
      return;
    }
    if (!maThietBi) {
      toast.info('Chưa xác định được mã thiết bị máy trạm. Vui lòng thử lại sau.');
      return;
    }
    if (!appDetail?.maUngDung) return;

    try {
      setIsRecordingCli(true);
      const nhomLow = ((currentMethod?.nhom || '') as string).toLowerCase();
      let trinhQuanLy: MaTrinhQuanLyGoi = MaTrinhQuanLyGoi.WINGET;
      if (nhomLow.includes('winget')) trinhQuanLy = MaTrinhQuanLyGoi.WINGET;
      else if (nhomLow.includes('scoop')) trinhQuanLy = MaTrinhQuanLyGoi.SCOOP;
      else if (nhomLow.includes('npm')) trinhQuanLy = MaTrinhQuanLyGoi.NPM;
      else if (nhomLow.includes('pip')) trinhQuanLy = MaTrinhQuanLyGoi.PIP;
      else if (nhomLow.includes('docker')) trinhQuanLy = MaTrinhQuanLyGoi.DOCKER;
      else if (currentMethod?.trinhQuanLy)
        trinhQuanLy = currentMethod.trinhQuanLy as MaTrinhQuanLyGoi;

      let tenGoi = currentMethod?.tenGoi;
      if (!tenGoi && currentMethod?.buoc?.[0]?.lenh) {
        const trich = trichTenGoiTuLenhTho(currentMethod.buoc[0].lenh);
        if (trich) {
          tenGoi = trich.tenGoi;
          trinhQuanLy = trich.trinhQuanLy;
        }
      }
      if (!tenGoi) {
        tenGoi = appDetail.tenKhoChua || appDetail.tenRepoDayDu.split('/')[1];
      }

      const phienBan =
        appDetail.banPhatHanhMoiNhat?.tenPhienBan ||
        appDetail.danhSachBanPhatHanh?.[0]?.tenPhienBan ||
        undefined;

      const res = await thuVienService.ghiNhanCaiDatCli(maThietBi, {
        maUngDung: appDetail.maUngDung,
        trinhQuanLy,
        tenGoi,
        phienBan,
        // Thư viện npm cài vào dự án (không -g): lệnh gỡ và cập nhật cũng phải cục bộ
        cucBo:
          trinhQuanLy === MaTrinhQuanLyGoi.NPM && laLenhNpmCucBo(currentMethod?.buoc?.[0]?.lenh),
      });

      if (res) {
        toast.success(
          `Đã ghi nhận "${appDetail.tenKhoChua}" vào Thư viện máy (Trạng thái: Chờ xác nhận trong 24h).`,
        );
        queryClient.invalidateQueries({
          queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
        });
      } else {
        toast.error('Không thể ghi nhận cài đặt: Tên gói không hợp lệ hoặc lỗi máy chủ.');
      }
    } catch (err) {
      toast.error(`Lỗi khi ghi nhận cài đặt: ${(err as Error).message}`);
    } finally {
      setIsRecordingCli(false);
    }
  };

  // Xác nhận lại ứng dụng CLI đã cài (P3B-16.5)
  const handleConfirmCliInstall = async () => {
    if (!maThietBi || !appDetail?.maUngDung) return;
    try {
      setIsConfirmingCli(true);
      const res = await thuVienService.xacNhanCaiDatCli(maThietBi, appDetail.maUngDung);
      if (res?.thanhCong) {
        toast.success('Đã xác nhận cài đặt thành công! Bản ghi sẽ không bị hết hạn.');
        queryClient.invalidateQueries({
          queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
        });
      } else {
        toast.error('Không thể xác nhận cài đặt.');
      }
    } catch (err) {
      toast.error(`Lỗi xác nhận: ${(err as Error).message}`);
    } finally {
      setIsConfirmingCli(false);
    }
  };

  // Xác định định dạng tệp đang chọn có phải bản nén Portable .zip không
  const isZipTab =
    selectedFormat.toUpperCase() === 'ZIP' || selectedFormat.toUpperCase() === 'ZIP_PORTABLE';

  // Trạng thái cài đặt thực tế từ useCaiDatUngDungStore (P3-08..P3-11)
  const localStatus = installInfo?.trangThai || 'CHUA_CAI';

  const effectiveStatus = useMemo(
    () =>
      tinhTrangThaiHieuLuc({
        selectedFormat,
        isInstalledOnDevice,
        localStatus,
        installedFileType: installInfo?.loaiTep,
        hasExtractedDir: Boolean(installInfo?.duongDanThuMuc),
      }),
    [selectedFormat, isInstalledOnDevice, localStatus, installInfo],
  );

  // Xử lý nút cài đặt / tải portable (L-08)
  const handleInstallClick = async () => {
    if (effectiveStatus === 'DA_CAI_DAT') {
      if (installInfo?.duongDanThucThi) {
        moApp(appKey);
      } else {
        // FE-R6-03: Nếu đã cài nhưng không có đường dẫn trong RAM, dẫn sang Thư viện để quản lý/mở
        navigateTo('library');
      }
      return;
    }
    if (
      effectiveStatus === 'DANG_TAI' ||
      effectiveStatus === 'XAC_MINH' ||
      effectiveStatus === 'DANG_CAI_DAT'
    ) {
      return;
    }

    if (!selectedAsset) {
      toast.error('Không tìm thấy tệp cài đặt phù hợp cho thiết bị.');
      return;
    }

    setZipExtractToast(null);
    setMoThuMucLoi(null);

    const ok = await batDauCaiDat({
      maUngDung: appKey,
      tenApp: appDetail?.tenKhoChua || 'App',
      url: selectedAsset.duongDanTaiVe,
      tenTep: selectedAsset.tenTep,
      loaiTep: selectedAsset.dinhDangTep?.toString() || selectedFormat,
      sha256DuKien: selectedAsset.maBamSha256 || undefined,
      phienBan: latestRelease?.tenPhienBan,
      maTep: selectedAsset.maTep,
      thuMucDich: isZipTab ? targetPortableDir : undefined,
    });

    if (ok && isZipTab) {
      const extractedPath =
        useCaiDatUngDungStore.getState().caiDatMap[appKey]?.duongDanThuMuc ||
        targetPortableDir ||
        'thư mục giải nén';
      setZipExtractToast({ duongDan: extractedPath });
    }
  };

  // Điểm an toàn & xếp hạng
  const diemUyTinGoc = appDetail?.phanTichAi?.diemUyTin ?? appDetail?.diemUyTin ?? null;
  const coDiemUyTin = typeof diemUyTinGoc === 'number';
  const trustScore = diemUyTinGoc ?? 0;
  const riskItems = appDetail?.phanTichAi?.yeuToRuiRo || [];

  // L-09 & L-10: Nhãn mức độ uy tín trung tính, chuẩn hóa ngôn ngữ đời thường
  const getScoreTheme = (score: number) => {
    if (score >= 80)
      return {
        text: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/20',
        bar: 'bg-success-solid',
        label: 'Uy tín cao',
      };
    if (score >= 60)
      return {
        text: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/20',
        bar: 'bg-warning-solid',
        label: 'Uy tín trung bình',
      };
    return {
      text: 'text-danger',
      bg: 'bg-danger/10',
      border: 'border-danger/20',
      bar: 'bg-danger-solid',
      label: 'Cần lưu ý',
    };
  };

  const scoreTheme = getScoreTheme(trustScore);

  // L-09, R-03: trạng thái kiểm tra quyền bằng ngôn ngữ đời thường (L-10); quyền chỉ có ở bản Android (P2-70).
  // App có bản Android mà danh sách quyền rỗng là chưa đọc được tệp APK, không được ghi là "bản Windows".
  const trangThaiKiemTraQuyen = appDetail?.phanTichAi?.quyenHanDaKiemTra?.length
    ? 'Đã kiểm tra quyền truy cập của ứng dụng'
    : appDetail?.nenTangHoTro === 'WINDOWS'
      ? 'Không cần kiểm tra quyền (bản Windows)'
      : 'Chưa đọc được quyền truy cập của bản Android';

  // L-10: Tên nhãn định dạng thân thiện đời thường
  const getFormatLabel = (fmt: string) => {
    const upper = fmt.toUpperCase();
    if (upper === 'EXE') return 'Bản cài đặt (.exe)';
    if (upper === 'MSI') return 'Bản cài đặt (.msi)';
    if (upper === 'ZIP' || upper === 'ZIP_PORTABLE') return 'Bản chạy ngay (.zip, .7z)';
    return `.${fmt.toLowerCase()}`;
  };

  // 1. TRẠNG THÁI LOADING: Skeleton ASCII (ascii-reveal)
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none text-muted font-mono">
        {/* Khung xương tải đường dẫn điều hướng (Breadcrumb Skeleton) */}
        <div className="flex items-center gap-2">
          <AsciiSkeleton lines={1} widths={['220px']} variant="dither" seed={201} />
        </div>

        {/* Khung xương tải giao diện chia đôi (Split-View Skeleton) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="tactile-card p-6 rounded-2xl flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl border border-border/50 bg-surface flex items-center justify-center overflow-hidden shrink-0">
                <AsciiSkeleton rows={5} width="100%" height="100%" variant="dither" seed={202} />
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <AsciiSkeleton lines={1} widths={['45%']} variant="dither" seed={203} />
                <AsciiSkeleton lines={1} widths={['65%']} variant="dither" seed={204} />
                <AsciiSkeleton lines={2} widths={['100%', '80%']} variant="dither" seed={205} />
              </div>
            </div>
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-3">
              <AsciiSkeleton lines={1} widths={['30%']} variant="dither" seed={206} />
              <AsciiSkeleton
                lines={6}
                widths={['100%', '95%', '90%', '85%', '92%', '70%']}
                variant="dither"
                seed={207}
              />
            </div>
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-3">
              <AsciiSkeleton lines={1} widths={['40%']} variant="dither" seed={208} />
              <AsciiSkeleton
                lines={8}
                widths={['100%', '98%', '95%', '90%', '94%', '88%', '75%', '50%']}
                variant="dither"
                seed={209}
              />
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-3">
              <AsciiSkeleton lines={1} widths={['50%']} variant="dither" seed={210} />
              <AsciiSkeleton
                lines={6}
                widths={['90%', '85%', '95%', '80%', '90%', '70%']}
                variant="dither"
                seed={211}
              />
            </div>
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-3">
              <AsciiSkeleton lines={1} widths={['40%']} variant="dither" seed={212} />
              <AsciiSkeleton
                lines={5}
                widths={['95%', '85%', '90%', '80%', '65%']}
                variant="dither"
                seed={213}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. TRẠNG THÁI LỖI (Error State)
  if (isError || !appDetail) {
    return (
      <div className="flex flex-col items-center justify-center p-12 max-w-xl mx-auto min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center">
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
            className="btn-tactile px-4 py-2 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent text-xs font-semibold flex items-center gap-2"
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
                <div className="w-full h-full bg-gradient-to-br from-accent-forge to-warning flex items-center justify-center font-bold text-3xl font-display text-white shadow-xl shadow-black/40">
                  {appDetail.tenKhoChua.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display text-primary">
                  {appDetail.tenKhoChua}
                </h1>
                <NhanLuuTru daLuuTru={appDetail.daLuuTru} />
                {appDetail.daXacMinh && (
                  <span className="px-2.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-mono font-medium border border-success/25 flex items-center gap-1.5">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    Mã nguồn mở · {appDetail.loaiGiayPhep || 'FOSS'}
                  </span>
                )}
                {appDetail.duocNoiBat && (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-elevated text-secondary text-xs font-mono font-medium border border-border flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-muted" />
                    Forge Đề Xuất
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted font-mono flex-wrap">
                <span>{appDetail.tenRepoDayDu}</span>
                <span>•</span>
                <span className="text-secondary flex items-center gap-1 font-medium">
                  <Star className="w-3.5 h-3.5 text-muted" />
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

              <p className="text-sm text-secondary mt-3 leading-relaxed">
                {appDetail.moTaVi ||
                  appDetail.moTaGocTiengAnh ||
                  'Ứng dụng mã nguồn mở minh bạch, được đồng bộ trực tiếp từ GitHub.'}
              </p>
            </div>
          </div>

          {/* Khẩu hiệu: chỉ hiện khi khác dòng mô tả ở trên (tránh lặp một câu hai lần, P3B-10) */}
          {khauHieuRieng && (
            <div className="surface-card px-5 py-3 rounded-xl bg-surface/50 border border-border">
              <blockquote className="text-sm font-medium text-secondary italic">
                "{khauHieuRieng}"
              </blockquote>
            </div>
          )}

          {/* Tài liệu & Giới thiệu chi tiết (README Song Ngữ - P3B-05.9) */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-primary font-display font-bold text-sm">
                <BookOpen className="w-4 h-4 text-accent-forge-text" />
                <span>Tài liệu & Hướng dẫn (README)</span>
              </div>

              {/* Nút chuyển đổi song ngữ hai chiều */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-elevated border border-border">
                <button
                  type="button"
                  onClick={() => setReadmeLang('vi')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    readmeLang === 'vi'
                      ? 'bg-accent-forge text-on-accent shadow-sm'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>Tiếng Việt</span>
                  {readmeData?.trangThai === 'HOAN_TAT' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-success-solid"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setReadmeLang('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    readmeLang === 'en'
                      ? 'bg-accent-forge text-on-accent shadow-sm'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  }`}
                >
                  <span>Bản gốc</span>
                </button>
              </div>
            </div>

            {/* Nội dung README theo ngôn ngữ (Lỗi 5 & Fix Lỗi 1) */}
            {isReadmeLoading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-accent-forge-text" />
                <span className="text-xs font-mono">Đang tải tài liệu README...</span>
              </div>
            ) : readmeLang === 'vi' ? (
              readmeData?.banDich ? (
                <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                  {(readmeData?.trangThai === 'DA_CU' ||
                    (readmeData?.trangThai === 'DANG_DICH' && Boolean(readmeData?.banDich))) && (
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-warning shrink-0" />
                      <span>
                        Tài liệu vừa cập nhật trên GitHub. Đang cập nhật bản dịch tiếng Việt mới
                        (tạm thời hiển thị bản dịch trước đó)...
                      </span>
                    </div>
                  )}
                  {readmeData?.trangThai === 'THAT_BAI' && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                        <span>
                          Tài liệu vừa cập nhật trên GitHub nhưng cập nhật bản dịch tiếng Việt mới
                          thất bại (tạm thời hiển thị bản dịch trước đó).
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isRetryingReadme}
                        onClick={async () => {
                          try {
                            setIsRetryingReadme(true);
                            pollCountRef.current = 0;
                            setIsPollTimedOut(false);
                            // Gọi endpoint POST retry chuyên biệt với rate-limit riêng (Fix Claude DELIV-77.7)
                            await khoUngDungService.dichLaiReadmeUngDung(appId);
                            refetchReadme();
                          } finally {
                            setIsRetryingReadme(false);
                          }
                        }}
                        className="text-xs font-semibold text-accent-forge-text hover:underline shrink-0 ml-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1"
                      >
                        {isRetryingReadme && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                        Dịch lại
                      </button>
                    </div>
                  )}
                  <XemMarkdown
                    content={readmeData.banDich}
                    owner={appDetail?.chuSoHuu}
                    repo={appDetail?.tenKhoChua}
                  />
                </div>
              ) : readmeData?.choNgayMai ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-secondary">
                    <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                    <span>
                      Bản dịch tiếng Việt sẽ có vào ngày mai. Hiện đang xem bản gốc tiếng Anh.
                    </span>
                  </div>
                  {readmeData.banGoc && (
                    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      <XemMarkdown
                        content={readmeData.banGoc}
                        owner={appDetail?.chuSoHuu}
                        repo={appDetail?.tenKhoChua}
                      />
                    </div>
                  )}
                </div>
              ) : readmeData?.trangThai === 'THAT_BAI' || isPollTimedOut ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs text-secondary">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                      <span>Chưa có bản dịch tiếng Việt, đang xem bản gốc tiếng Anh.</span>
                    </div>
                    <button
                      type="button"
                      disabled={isRetryingReadme}
                      onClick={async () => {
                        try {
                          setIsRetryingReadme(true);
                          pollCountRef.current = 0;
                          setIsPollTimedOut(false);
                          // Gọi endpoint POST retry chuyên biệt với rate-limit riêng (Fix Claude DELIV-77.7)
                          await khoUngDungService.dichLaiReadmeUngDung(appId);
                          refetchReadme();
                        } finally {
                          setIsRetryingReadme(false);
                        }
                      }}
                      className="text-xs font-semibold text-accent-forge-text hover:underline shrink-0 ml-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1"
                    >
                      {isRetryingReadme && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                      Dịch lại
                    </button>
                  </div>
                  {readmeData?.banGoc && (
                    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      <XemMarkdown
                        content={readmeData.banGoc}
                        owner={appDetail?.chuSoHuu}
                        repo={appDetail?.tenKhoChua}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-warning shrink-0" />
                      <span>
                        Đang dịch tài liệu sang tiếng Việt... Tạm thời hiển thị bản gốc bên dưới.
                      </span>
                    </div>
                  </div>
                  {readmeData?.banGoc && (
                    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      <XemMarkdown
                        content={readmeData.banGoc}
                        owner={appDetail?.chuSoHuu}
                        repo={appDetail?.tenKhoChua}
                      />
                    </div>
                  )}
                </div>
              )
            ) : readmeData?.banGoc ? (
              <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <XemMarkdown
                  content={readmeData.banGoc}
                  owner={appDetail?.chuSoHuu}
                  repo={appDetail?.tenKhoChua}
                />
              </div>
            ) : (
              <p className="text-xs text-muted italic">
                Không tìm thấy tài liệu README trong kho mã nguồn.
              </p>
            )}
          </div>

          {/* Bảng Các Tệp Cài Đặt & Checksum SHA-256 (P3-06.4) - Chỉ hiển thị khi có tệp cài đặt */}
          {coFileCaiDat && (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold font-display text-primary flex items-center gap-2">
                    <FileArchive className="w-4 h-4 text-accent-forge-text" />
                    <span>
                      BẢN PHÁT HÀNH {latestRelease?.tenPhienBan || 'MỚI NHẤT'}
                      {latestRelease?.laBanThuNghiem && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning ml-2">
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

                {(appDetail.duongDanGithub || androidDetail?.duongDanGithub) && (
                  <a
                    href={`${appDetail.duongDanGithub || androidDetail?.duongDanGithub}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tactile text-xs font-mono text-accent-ai hover:underline flex items-center gap-1"
                  >
                    <span>GitHub Releases</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Danh sách tệp cài đặt */}
              <div className="flex flex-col gap-2.5">
                {displayAssets.map((asset) => {
                  const isSelected = selectedAsset?.maTep === asset.maTep;

                  return (
                    <div
                      key={asset.maTep}
                      onClick={() => {
                        setSelectedAssetId(asset.maTep);
                        if (asset.dinhDangTep) {
                          setSelectedFormat(asset.dinhDangTep.toString());
                        }
                      }}
                      className={`relative overflow-hidden p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-surface-elevated border-border-focus shadow-sm'
                          : 'bg-surface/40 border-border hover:border-border-focus hover:bg-surface/70'
                      }`}
                    >
                      {/* Vạch chỉ thị màu cam mảnh 3px bo tròn mép trái khi được chọn (Linear/Raycast style) */}
                      {isSelected && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent-forge rounded-r" />
                      )}

                      <div className={`flex flex-col gap-1 min-w-0 ${isSelected ? 'pl-2' : ''}`}>
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-primary truncate">
                          <span className="truncate">{asset.tenTep}</span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-accent-forge/10 text-accent-forge-text text-[10px] shrink-0 font-semibold border border-accent-forge/20 tracking-wider">
                              ĐANG CHỌN
                            </span>
                          )}
                        </div>

                        {/* L-10: Thay chuỗi SHA-256 dài ngoằng bằng dòng xác minh file gốc */}
                        <div className="flex items-center gap-1.5 text-[11px] text-success font-mono">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Đã xác minh file gốc</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-secondary">
                          {formatBytes(asset.dungLuongBytes)}
                        </span>
                        <span
                          className={`text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded ${
                            (asset.kienTrucChip || '').toString().includes('ARM')
                              ? 'text-warning bg-warning/10 border border-warning/20'
                              : 'text-success bg-success/10 border border-success/20'
                          }`}
                        >
                          {asset.kienTrucChip || 'x64'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Khối Hướng Dẫn Cài Đặt Qua Dòng Lệnh CLI (DELIV-33.3) */}
          {coHuongDanCli && huongDanCli && (
            <div
              id="cli-guide-section"
              className="tactile-card p-6 rounded-2xl flex flex-col gap-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-accent-forge-text" />
                  <h3 className="text-sm font-bold font-display text-primary uppercase tracking-wider">
                    {TIEU_DE_HUONG_DAN_DONG_LENH}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    Trích xuất nguyên văn
                  </span>
                </div>
                {huongDanCli.coRuiRoCao && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Chứa lệnh rủi ro cao
                  </span>
                )}
              </div>

              {/* Tabs chọn phương thức cài đặt */}
              {huongDanCli.cachCai.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-surface/50 border border-border text-xs font-mono">
                  {huongDanCli.cachCai.map((cach, idx) => {
                    const isActive = activeCliMethodIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCliMethodIndex(idx)}
                        className={`btn-tactile px-3.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
                          isActive
                            ? 'bg-surface-elevated text-primary shadow-sm border border-border-focus font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                        }`}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0" />
                        )}
                        <span>
                          {layNhanNhomCachCai(cach.nhom)} • {layTenCachCai(cach.ten, cach.nhom)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Phương thức được chọn */}
              {(() => {
                const currentMethod =
                  huongDanCli.cachCai[activeCliMethodIndex] || huongDanCli.cachCai[0];
                if (!currentMethod) return null;

                const ownershipCheck =
                  currentMethod.tenGoi && currentMethod.trinhQuanLy
                    ? kiemTraGoiThuocRepo(
                        currentMethod.trinhQuanLy,
                        currentMethod.tenGoi,
                        appDetail?.duongDanGithub || appDetail?.tenRepoDayDu || appId,
                      )
                    : null;

                return (
                  <div className="flex flex-col gap-4">
                    {/* Thông tin phương thức & Yêu cầu tiên quyết */}
                    <div className="p-3.5 rounded-xl bg-surface/40 border border-border flex flex-col gap-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-display text-primary">
                            {layTenCachCai(currentMethod.ten, currentMethod.nhom)}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-accent-forge-text font-bold uppercase">
                            {layNhanNhomCachCai(currentMethod.nhom)}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted">
                            Hệ điều hành: {layNhanHeDieuHanh(currentMethod.heDieuHanh)}
                          </span>
                          <NhanDaCaiTrenMay
                            trinhQuanLy={currentMethod.trinhQuanLy}
                            tenGoi={currentMethod.tenGoi}
                          />
                        </div>
                      </div>

                      {/* Yêu cầu môi trường */}
                      {currentMethod.yeuCau && currentMethod.yeuCau.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-mono text-muted">
                          <span className="text-secondary font-medium">Yêu cầu môi trường:</span>
                          {currentMethod.yeuCau.map((yc, ycIdx) => (
                            <span
                              key={ycIdx}
                              className="px-2 py-0.5 rounded bg-surface border border-border text-primary text-[10px]"
                            >
                              {yc}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Cảnh báo nếu tên gói có thể không thuộc repository (P3B-18 & D-27: Heuristic Name Check) */}
                      {ownershipCheck && !ownershipCheck.khop && (
                        <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-[11px] font-mono flex items-start gap-2 leading-relaxed mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold">Lưu ý đối chiếu tên gói:</span>{' '}
                            {ownershipCheck.canhBao}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Danh sách các bước lệnh (loại bỏ viền lồng hộp, phân tách thoáng đãng) */}
                    <div className="flex flex-col gap-4">
                      {currentMethod.buoc.map((buoc, bIdx) => {
                        const stepId = `cli-${activeCliMethodIndex}-${bIdx}`;
                        const isCopied = copiedCommandId === stepId;

                        return (
                          <div key={bIdx} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-primary flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[10px] font-mono font-bold text-accent-forge-text shrink-0">
                                  {bIdx + 1}
                                </span>
                                <span>{buoc.moTa}</span>
                              </span>

                              {buoc.ruiRoCao && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-danger/20 text-danger font-bold border border-danger/30 flex items-center gap-1 shrink-0">
                                  <AlertTriangle className="w-3 h-3" />
                                  Lệnh rủi ro cao
                                </span>
                              )}
                            </div>

                            {/* Khối dòng lệnh nguyên văn (P3B-18 & D-27: Nút Mở Terminal cạnh Chép lệnh) */}
                            <div className="relative group rounded-xl bg-slate-950/90 border border-border overflow-hidden shadow-inner">
                              <pre className="p-3.5 pr-64 text-xs font-mono text-success overflow-x-auto leading-relaxed select-text font-medium">
                                <code>{buoc.lenh}</code>
                              </pre>
                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenTerminal(buoc.lenh, buoc.ruiRoCao, buoc.canhBaoRuiRo)
                                  }
                                  className="btn-tactile px-2.5 py-1 rounded-lg bg-accent-forge hover:bg-accent-forge-hover text-on-accent text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-xs transition-all shadow-sm font-semibold"
                                  title="Mở Terminal đã chuẩn bị sẵn câu lệnh trong biến môi trường và Clipboard (D-27)"
                                >
                                  <Terminal className="w-3 h-3" />
                                  <span>Mở Terminal</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCommand(buoc.lenh, stepId)}
                                  className="btn-tactile px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/[0.08] text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-xs transition-all shadow-sm"
                                  title="Sao chép câu lệnh này vào Clipboard"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-success animate-pop" />
                                      <span className="text-success font-semibold">Đã chép</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Chép lệnh</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Cảnh báo rủi ro cao */}
                            {buoc.ruiRoCao && (
                              <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-[11px] font-mono flex items-start gap-2 leading-relaxed">
                                <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <span className="font-bold">Lưu ý bảo mật:</span>{' '}
                                  {buoc.canhBaoRuiRo ||
                                    'Lệnh này thực thi trực tiếp script từ internet hoặc yêu cầu quyền hạn quản trị cao nhất. Hãy kiểm tra kỹ trước khi chạy.'}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Bar: "Tôi đã cài" hoặc Trạng thái đã ghi nhận trong Thư viện máy (P3B-16.5) */}
                    <div className="p-4 rounded-xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                      {installedCliRecord ? (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary">
                                Đã lưu trong Thư viện máy
                              </span>
                              {installedCliRecord.trangThaiXacNhan === 'CHO_XAC_NHAN' ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-bold">
                                  Chờ xác nhận (24h)
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold">
                                  Đã xác nhận
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-muted">
                              Trình quản lý: {installedCliRecord.trinhQuanLyGoi} • Gói:{' '}
                              {installedCliRecord.tenGoiCli}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-secondary">
                          <Terminal className="w-4 h-4 text-accent-forge-text shrink-0" />
                          <span>Bạn đã chạy xong câu lệnh trên trong Terminal cá nhân?</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        {installedCliRecord?.trangThaiXacNhan === 'CHO_XAC_NHAN' && (
                          <button
                            type="button"
                            onClick={handleConfirmCliInstall}
                            disabled={isConfirmingCli}
                            className="btn-tactile h-9 px-3.5 rounded-xl bg-success-solid hover:bg-success-solid/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                            title="Xác nhận bạn đã cài phần mềm này và hủy đếm ngược 24h"
                          >
                            {isConfirmingCli ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Xác nhận đã cài</span>
                          </button>
                        )}

                        {!installedCliRecord ? (
                          <button
                            type="button"
                            onClick={() => handleRecordCliInstall(currentMethod)}
                            disabled={isRecordingCli}
                            className="btn-tactile h-9 px-4 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent font-bold text-xs flex items-center gap-2 shadow-sm"
                            title="Ghi nhận ứng dụng vào Thư viện máy này (Chờ xác nhận sau 24h)"
                          >
                            {isRecordingCli ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>Tôi đã cài</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigateTo('library')}
                            className="btn-tactile h-9 px-3.5 rounded-xl border border-border hover:bg-surface-elevated text-secondary hover:text-primary text-xs font-medium flex items-center gap-1.5"
                          >
                            <Library className="w-3.5 h-3.5" />
                            <span>Mở Thư viện</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Banner an toàn hiển thị & README gốc */}
                    <div className="p-3.5 rounded-xl bg-surface/40 border border-border text-xs text-muted flex items-start sm:items-center justify-between gap-3 leading-relaxed flex-col sm:flex-row">
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-accent-forge-text shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-primary">An toàn hiển thị:</strong> ForgeStore chỉ
                          bóc tách câu lệnh nguyên văn từ README gốc của tác giả và không tự động
                          thực thi. Bạn hãy mở Terminal / PowerShell cá nhân để chạy các lệnh trên.
                        </span>
                      </div>
                      {huongDanCli.duongDanReadmeGoc && (
                        <a
                          href={huongDanCli.duongDanReadmeGoc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-tactile text-accent-ai hover:underline text-xs font-mono shrink-0 flex items-center gap-1 ml-auto"
                        >
                          <span>Xem README gốc</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Trường hợp ứng dụng chỉ có tệp APK Android (P3B-19.3) */}
          {chiCoFileApkAndroid && (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-5 border border-accent-ai/30 bg-accent-ai/5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-ai/20 border border-accent-ai/30 flex items-center justify-center text-accent-ai shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display text-primary flex items-center gap-2">
                      <span>ỨNG DỤNG DÀNH CHO ANDROID (.APK)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-ai/20 border border-accent-ai/30 text-accent-ai">
                        {apkAssets.length} tệp APK
                      </span>
                    </h3>
                    <p className="text-xs text-secondary mt-0.5 leading-relaxed">
                      Ứng dụng này hiện chỉ phát hành gói cài đặt cho Android (.apk). ForgeStore
                      Windows hiển thị thông tin và hỗ trợ tải về máy để bạn chuyển sang điện thoại
                      hoặc trình giả lập Android.
                    </p>
                  </div>
                </div>
                {(appDetail.duongDanGithub || androidDetail?.duongDanGithub) && (
                  <a
                    href={`${appDetail.duongDanGithub || androidDetail?.duongDanGithub}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tactile text-xs font-mono text-muted hover:text-primary flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub Releases</span>
                  </a>
                )}
              </div>

              {/* Danh sách tệp APK khả dụng */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-mono text-muted uppercase">
                  Danh sách tệp cài đặt APK:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {apkAssets.map((asset) => (
                    <div
                      key={asset.maTep}
                      className="p-3.5 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-3 hover:bg-surface/80 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Smartphone className="w-4 h-4 text-accent-ai shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold text-primary truncate">
                            {asset.tenTep}
                          </div>
                          <div className="text-[11px] font-mono text-muted flex items-center gap-2 mt-0.5">
                            <span>{formatBytes(asset.dungLuongBytes)}</span>
                            {asset.kienTrucChip && (
                              <>
                                <span>•</span>
                                <span>{asset.kienTrucChip}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownloadApk(asset)}
                        className="btn-tactile px-3.5 py-1.5 rounded-lg bg-accent-ai-solid hover:bg-accent-ai-solid/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải về</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trường hợp không có cả tệp cài đặt lẫn hướng dẫn CLI */}
          {!coFileCaiDat && !coHuongDanCli && !chiCoFileApkAndroid && (
            <div className="tactile-card p-6 rounded-2xl border border-border text-center text-xs text-muted">
              Ứng dụng này hiện chưa có tệp cài đặt phù hợp với Windows (.exe, .msi, .zip, .7z) và
              chưa có hướng dẫn cài đặt dòng lệnh.
            </div>
          )}

          {/* Lịch Sử Các Bản Phát Hành (P3-06.4) */}
          {appDetail.danhSachBanPhatHanh && appDetail.danhSachBanPhatHanh.length > 1 && (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
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

              <div className="flex flex-col gap-2.5">
                {(showAllVersions
                  ? appDetail.danhSachBanPhatHanh
                  : appDetail.danhSachBanPhatHanh.slice(0, 3)
                ).map((release) => (
                  <div
                    key={release.maPhatHanh}
                    className="p-3.5 rounded-xl bg-surface/30 hover:bg-surface/60 border border-border transition-all flex flex-col gap-1.5"
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
          {/* Card Hành Động Cài Đặt Nổi Bật (P3-06.1 & DELIV-33.3) */}
          {!coFileCaiDat && coHuongDanCli && huongDanCli ? (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-5 border border-accent-forge/30 bg-accent-forge/5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-accent-forge-text font-mono font-bold text-xs">
                  <Terminal className="w-4 h-4" />
                  <span>CÀI BẰNG DÒNG LỆNH</span>
                </div>
                <button
                  onClick={handleToggleFavorite}
                  disabled={isTogglingFavorite}
                  className={`btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                    isFavorited
                      ? 'bg-danger/10 border-danger/30 text-danger'
                      : 'bg-surface-elevated border-border text-muted hover:text-primary'
                  } ${isTogglingFavorite ? 'opacity-70 cursor-wait' : ''}`}
                  title={isFavorited ? 'Đã yêu thích (Bấm để bỏ thích)' : 'Thêm vào yêu thích'}
                >
                  {isTogglingFavorite ? (
                    <Loader2 className="w-4 h-4 animate-spin text-danger" />
                  ) : (
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-danger' : ''}`} />
                  )}
                </button>
              </div>
              {loiYeuThich && (
                <p role="alert" className="-mt-3 text-[11px] text-danger">
                  {loiYeuThich}
                </p>
              )}

              <p className="text-xs text-secondary leading-relaxed">
                Ứng dụng này không có bộ cài đồ họa (.exe, .msi) mà được triển khai qua các công cụ
                dòng lệnh (như pip, docker, npm, winget...).
              </p>

              <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border/80 flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex justify-between text-muted">
                  <span>Số cách cài khả dụng:</span>
                  <span className="text-primary font-bold">
                    {huongDanCli.cachCai.length} phương thức
                  </span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Cách cài ưu tiên:</span>
                  <span className="text-accent-forge-text font-bold">
                    {huongDanCli.cachCai[0]
                      ? layNhanNhomCachCai(huongDanCli.cachCai[0].nhom)
                      : 'Dòng lệnh'}
                  </span>
                </div>
              </div>

              {installedCliRecord ? (
                <div className="flex flex-col gap-2">
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2.5 text-xs text-success font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Đã lưu trong Thư viện máy ({installedCliRecord.trinhQuanLyGoi})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo('library')}
                    className="btn-tactile w-full h-11 rounded-xl bg-surface-elevated hover:bg-surface border border-border text-primary font-display font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Library className="w-4 h-4" />
                    <span>Xem Trong Thư Viện</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById('cli-guide-section')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="btn-tactile w-full h-12 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/40"
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Xem Hướng Dẫn Cài Bằng Dòng Lệnh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRecordCliInstall(
                        huongDanCli.cachCai[activeCliMethodIndex] || huongDanCli.cachCai[0],
                      )
                    }
                    disabled={isRecordingCli}
                    className="btn-tactile w-full h-9 rounded-xl border border-border hover:bg-surface-elevated text-secondary hover:text-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    {isRecordingCli ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Tôi đã cài bằng dòng lệnh</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted text-center leading-normal">
                <Shield className="w-3.5 h-3.5 text-accent-forge-text shrink-0" />
                <span>Lệnh nguyên văn từ README, không tự động chạy trên máy</span>
              </div>
            </div>
          ) : !coFileCaiDat && !coHuongDanCli ? (
            chiCoFileApkAndroid ? (
              /* Card Hành Động cho App Android APK (P3B-19.3) */
              <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4 border border-accent-ai/30 bg-accent-ai/5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-accent-ai font-mono font-bold text-xs">
                    <Smartphone className="w-4 h-4" />
                    <span>ỨNG DỤNG ANDROID (.APK)</span>
                  </div>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFavorite}
                    className={`btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                      isFavorited
                        ? 'bg-danger/10 border-danger/30 text-danger'
                        : 'bg-surface-elevated border-border text-muted hover:text-primary'
                    } ${isTogglingFavorite ? 'opacity-70 cursor-wait' : ''}`}
                    title={isFavorited ? 'Đã yêu thích (Bấm để bỏ thích)' : 'Thêm vào yêu thích'}
                  >
                    {isTogglingFavorite ? (
                      <Loader2 className="w-4 h-4 animate-spin text-danger" />
                    ) : (
                      <Heart className={`w-4 h-4 ${isFavorited ? 'fill-danger' : ''}`} />
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-surface/50 border border-border/50 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Smartphone className="w-4 h-4 text-accent-ai" />
                    <span>Chỉ phát hành cho Android</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Ứng dụng này không có bản chạy trực tiếp trên Windows. Bạn có thể tải file APK
                    về để cài đặt trên điện thoại hoặc trình giả lập Android.
                  </p>
                  {apkAssets[0] && (
                    <div className="text-[11px] font-mono text-secondary truncate mt-1 bg-surface-elevated/70 p-2.5 rounded-lg border border-border">
                      <span className="text-muted">Tệp chính: </span>
                      <span className="text-primary font-medium">{apkAssets[0].tenTep}</span>{' '}
                      <span className="text-muted">
                        ({formatBytes(apkAssets[0].dungLuongBytes)})
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => apkAssets[0] && handleDownloadApk(apkAssets[0])}
                  className="btn-tactile w-full h-12 rounded-xl bg-accent-ai-solid hover:bg-accent-ai-solid/90 text-white font-display font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File APK (Android)</span>
                </button>

                {(appDetail.duongDanGithub || androidDetail?.duongDanGithub) && (
                  <a
                    href={`${appDetail.duongDanGithub || androidDetail?.duongDanGithub}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tactile w-full h-9 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-secondary hover:text-primary font-mono text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Xem Bản Phát Hành Trên GitHub</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4 border border-border shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted uppercase">
                    Trạng thái phát hành
                  </span>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFavorite}
                    className={`btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                      isFavorited
                        ? 'bg-danger/10 border-danger/30 text-danger'
                        : 'bg-surface-elevated border-border text-muted hover:text-primary'
                    } ${isTogglingFavorite ? 'opacity-70 cursor-wait' : ''}`}
                    title={isFavorited ? 'Đã yêu thích (Bấm để bỏ thích)' : 'Thêm vào yêu thích'}
                  >
                    {isTogglingFavorite ? (
                      <Loader2 className="w-4 h-4 animate-spin text-danger" />
                    ) : (
                      <Heart className={`w-4 h-4 ${isFavorited ? 'fill-danger' : ''}`} />
                    )}
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50 text-center flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-muted" />
                  <span className="text-xs font-semibold text-primary">
                    Chưa có bản cài cho Windows
                  </span>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Repository này hiện chưa phát hành gói cài đặt (.exe, .msi, .zip, .7z) tương
                    thích với máy tính Windows.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full h-12 rounded-xl bg-surface-elevated border border-border text-muted font-display font-bold text-xs flex items-center justify-center cursor-not-allowed opacity-60"
                >
                  Chưa hỗ trợ cài đặt
                </button>
              </div>
            )
          ) : (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted uppercase">Tùy chọn tải về</span>
                <button
                  onClick={handleToggleFavorite}
                  disabled={isTogglingFavorite}
                  className={`btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                    isFavorited
                      ? 'bg-danger/10 border-danger/30 text-danger'
                      : 'bg-surface-elevated border-border hover:border-border-focus text-muted hover:text-primary'
                  } ${isTogglingFavorite ? 'opacity-70 cursor-wait' : ''}`}
                  title={isFavorited ? 'Đã yêu thích (Bấm để bỏ thích)' : 'Thêm vào yêu thích'}
                >
                  {isTogglingFavorite ? (
                    <Loader2 className="w-4 h-4 animate-spin text-danger" />
                  ) : (
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-danger' : ''}`} />
                  )}
                </button>
              </div>
              {loiYeuThich && (
                <p role="alert" className="-mt-3 text-[11px] text-danger">
                  {loiYeuThich}
                </p>
              )}

              {/* Bộ chọn định dạng tệp có sẵn (Segmented Control tinh tế) */}
              {availableFormats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface/50 border border-border text-xs font-mono font-medium">
                  {availableFormats.map((fmt) => {
                    const isFmtActive = selectedFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        onClick={() => {
                          setSelectedFormat(fmt);
                          setSelectedAssetId(null);
                        }}
                        className={`btn-tactile py-2 px-2.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                          isFmtActive
                            ? 'bg-surface-elevated text-primary shadow-sm border border-border-focus font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                        }`}
                      >
                        {isFmtActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0" />
                        )}
                        <span>{getFormatLabel(fmt)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cảnh báo không tương thích kiến trúc CPU (P3-FIX) */}
              {isChipIncompatible && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning font-mono flex items-start gap-2 animate-fade-in leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Lưu ý kiến trúc chip:</span> Tệp đang chọn (
                    {selectedAsset?.tenTep}) dành cho hệ máy ARM64. Máy tính Windows của bạn là
                    x64/AMD64, vui lòng cân nhắc chọn bản x64 để ứng dụng chạy ổn định.
                  </div>
                </div>
              )}

              {/* Nút Cài Đặt Đa Trạng Thái (P3-11 & A2 & A3) */}
              <button
                onClick={handleInstallClick}
                disabled={effectiveStatus === 'XAC_MINH' || effectiveStatus === 'DANG_CAI_DAT'}
                className={`btn-tactile relative overflow-hidden w-full h-12 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-150 ${
                  effectiveStatus === 'DA_CAI_DAT'
                    ? 'bg-success-solid hover:bg-success-solid/90 text-white shadow-black/30'
                    : effectiveStatus === 'XAC_MINH'
                      ? 'bg-warning-solid text-slate-950 cursor-wait'
                      : effectiveStatus === 'DANG_CAI_DAT'
                        ? 'bg-accent-ai-solid text-white cursor-wait'
                        : effectiveStatus === 'DANG_TAI'
                          ? 'bg-surface-elevated text-primary border border-accent-forge/50 cursor-default px-3'
                          : effectiveStatus === 'LOI'
                            ? 'bg-danger-solid hover:bg-danger-solid/90 text-white shadow-black/40'
                            : 'bg-accent-forge hover:bg-accent-forge-hover text-on-accent shadow-black/40'
                }`}
              >
                {effectiveStatus === 'DANG_TAI' && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-accent-forge/25 transition-all duration-150"
                    style={{ width: `${installInfo?.phanTram ?? 0}%` }}
                  />
                )}

                <div className="relative z-10 w-full flex items-center justify-center gap-2 font-mono">
                  {effectiveStatus === 'DANG_TAI' ? (
                    <>
                      <Download className="w-4 h-4 animate-bounce text-accent-forge-text shrink-0" />
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
                        className="btn-tactile ml-auto px-2 py-0.5 rounded bg-danger/20 hover:bg-danger/30 text-danger text-xs font-mono flex items-center gap-1 border border-danger/30"
                        title="Hủy tải tệp"
                      >
                        <X className="w-3 h-3" />
                        <span>Huỷ</span>
                      </button>
                    </>
                  ) : effectiveStatus === 'XAC_MINH' ? (
                    <>
                      <ShieldCheck className="w-4 h-4 animate-pulse text-warning" />
                      <span>Đang kiểm tra file...</span>
                    </>
                  ) : effectiveStatus === 'DANG_CAI_DAT' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-accent-ai" />
                      <span>{isZipTab ? 'Đang giải nén portable...' : 'Đang cài đặt...'}</span>
                    </>
                  ) : effectiveStatus === 'DA_CAI_DAT' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        {installInfo?.duongDanThucThi ? 'Mở Ứng Dụng' : 'Xem trong Thư Viện'}
                      </span>
                    </>
                  ) : effectiveStatus === 'LOI' ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Lỗi – Thử Lại</span>
                    </>
                  ) : isZipTab ? (
                    <>
                      <FileArchive className="w-4 h-4" />
                      <span>Tải Bản Portable ({formatBytes(selectedAsset?.dungLuongBytes)})</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Cài Đặt 1-Click ({formatBytes(selectedAsset?.dungLuongBytes)})</span>
                    </>
                  )}
                </div>
              </button>

              {/* Thông báo giải nén ZIP thành công tạm thời (L-08) */}
              {zipExtractToast && isZipTab && (
                <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-xs text-success font-mono flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <div className="break-all">
                        <span className="font-bold">Đã giải nén vào:</span>{' '}
                        {zipExtractToast.duongDan}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZipExtractToast(null)}
                      className="text-muted hover:text-primary shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setMoThuMucLoi(null);
                        await caiDatUngDungService.moThuMuc(zipExtractToast.duongDan);
                      } catch (err) {
                        const msg = (err as Error)?.message || 'Không thể mở thư mục';
                        setMoThuMucLoi(msg);
                      }
                    }}
                    className="btn-tactile h-8 px-3 rounded-lg bg-success-solid hover:bg-success-solid/90 text-white font-semibold flex items-center justify-center gap-1.5 self-start mt-1 text-xs"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Mở thư mục</span>
                  </button>
                  {moThuMucLoi && (
                    <div className="text-[11px] text-danger flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{moThuMucLoi}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Nút chạy lại bộ cài cho EXE/MSI (FE-R6-03) */}
              {!isZipTab && effectiveStatus === 'DA_CAI_DAT' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedAsset) return;
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
                  }}
                  className="btn-tactile text-[11px] font-mono text-muted hover:text-accent-forge-text flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Chạy lại bộ cài đặt (.exe/.msi)</span>
                </button>
              )}

              {/* Chú thích cho app cài qua EXE/MSI đã xong */}
              {!isZipTab && effectiveStatus === 'DA_CAI_DAT' && !installInfo?.duongDanThucThi && (
                <p className="text-[11px] text-muted text-center leading-normal">
                  Ứng dụng đã cài đặt vào hệ thống. Bạn có thể mở từ Thư viện, Start Menu hoặc
                  Desktop.
                </p>
              )}

              {/* Thông báo hủy tiến trình (P3-08.5 & P3-FIX) */}
              {effectiveStatus === 'DA_HUY' && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning font-mono flex items-start gap-2 animate-fade-in leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Đã hủy:</span>{' '}
                    {installInfo?.thongDiepLoi ||
                      'Tiến trình đã dừng lại hoặc bị từ chối cấp quyền. Tệp tạm đã được dọn sạch.'}
                  </div>
                </div>
              )}

              {/* Thông báo lỗi nếu xảy ra (P3-09.2) */}
              {effectiveStatus === 'LOI' && installInfo?.thongDiepLoi && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger font-mono flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <div className="flex-1 break-words">{installInfo.thongDiepLoi}</div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span>✓ Đã xác minh file gốc</span>
              </div>

              {/* EC-04: Gợi ý phương thức CLI khi app có cả bản nhị phân lẫn CLI */}
              {coHuongDanCli && huongDanCli && (
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById('cli-guide-section')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-tactile text-[11px] font-mono text-muted hover:text-accent-forge-text flex items-center justify-center gap-1.5 transition-colors pt-2 border-t border-border"
                  title="Cuộn tới phần hướng dẫn cài đặt qua dòng lệnh"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent-forge-text" />
                  <span>
                    Hoặc cài bằng dòng lệnh (
                    {huongDanCli.cachCai[0]
                      ? layNhanNhomCachCai(huongDanCli.cachCai[0].nhom)
                      : 'dòng lệnh'}
                    )
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Điểm Uy Tín Kho Mã & Thẩm Định Chi Tiết (L-09 / L-10) */}
          {/* Chưa có phân tích thì không hiện điểm, tránh hiện 100 điểm giả */}
          {coDiemUyTin && (
            <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold font-display text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-muted" />
                  <span>ĐIỂM UY TÍN KHO MÃ</span>
                </span>
                <NhanTinCay score={trustScore} size="sm" />
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
              <div className="w-full bg-surface-elevated/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreTheme.bar}`}
                  style={{ width: `${Math.min(100, Math.max(5, trustScore))}%` }}
                />
              </div>

              {/* Điểm nổi bật & Yếu tố rủi ro */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border text-xs">
                {appDetail.soLuotFork ? (
                  <div className="flex items-center gap-2 text-secondary">
                    <Check className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>Kho chứa có hơn {appDetail.soLuotFork} lượt forks</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-secondary">
                  <Check className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span>{trangThaiKiemTraQuyen}</span>
                </div>
                <div className="flex items-center gap-2 text-secondary">
                  <Check className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span>Bản phát hành cập nhật liên tục từ GitHub</span>
                </div>

                {riskItems.length > 0 ? (
                  riskItems.slice(0, 2).map((risk, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-muted">
                      <span className="text-[11px] font-mono text-warning shrink-0">
                        -{risk.diemTru}đ
                      </span>
                      <span className="truncate">{risk.moTa}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-success text-[11px]">
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
          )}

          {/* Thẻ Thông Tin Kho Lưu Trữ GitHub */}
          <div className="tactile-card p-5 rounded-2xl flex flex-col gap-3 text-xs">
            <h4 className="font-semibold font-display text-muted flex items-center gap-2 uppercase tracking-wider">
              <Github className="w-4 h-4 text-muted" />
              <span>DỮ LIỆU KHO CHỨA GITHUB</span>
            </h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-secondary">
              <div className="flex justify-between py-1 border-b border-border">
                <span>Ngôn ngữ chính:</span>
                <span className="text-primary font-bold">
                  {appDetail.ngonNguChinh || 'Đa ngôn ngữ'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>Forks:</span>
                <span className="text-primary">{formatStars(appDetail.soLuotFork)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>Bản phát hành:</span>
                <span className="text-primary">
                  {appDetail.danhSachBanPhatHanh?.length || 1} releases
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Đồng bộ lần cuối:</span>
                <span className="text-secondary font-medium">
                  {new Date(appDetail.dongBoLanCuoi).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODAL/POPOVER CHI TIẾT THẨM ĐỊNH RỦI RO (P3-06.3) */}
      {isSafetyModalOpen && coDiemUyTin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="tactile-card w-full max-w-lg p-6 rounded-2xl border border-border shadow-2xl flex flex-col gap-5 bg-surface max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" />
                <h3 className="text-sm font-bold font-display text-primary">
                  BẢNG ĐÁNH GIÁ ĐIỂM UY TÍN KHO MÃ
                </h3>
              </div>
              <button
                onClick={() => setIsSafetyModalOpen(false)}
                className="btn-tactile w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/70 border border-border">
              <div>
                <span className="text-xs text-muted font-mono">Điểm uy tín kho mã</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-2xl font-bold font-mono ${scoreTheme.text}`}>
                    {trustScore} / 100
                  </span>
                  <span className="text-xs font-semibold text-secondary">({scoreTheme.label})</span>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-muted">
                <div>Trạng thái thẩm định</div>
                <div className="text-primary font-semibold">{trangThaiKiemTraQuyen}</div>
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
                    className="p-3 rounded-xl bg-surface/40 border border-border flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        <span>{risk.ma}</span>
                      </span>
                      <span className="font-mono text-warning font-bold">-{risk.diemTru}đ</span>
                    </div>
                    <p className="text-secondary text-[11px] leading-relaxed mt-0.5">{risk.moTa}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success text-xs text-center">
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

      {/* Modal Cảnh báo bảo mật lệnh CLI rủi ro cao (P3B-18 & Quyết định D-27) */}
      {terminalWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md p-5 rounded-2xl bg-surface-elevated border border-border shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-danger">
              <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-display text-primary">
                  Cảnh Báo Lệnh Rủi Ro Cao
                </h3>
                <p className="text-[11px] text-muted">Quy chuẩn an toàn ForgeStore (D-27)</p>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed">{terminalWarningModal.canhBao}</p>

            <div className="p-3 rounded-xl bg-slate-950 border border-border overflow-hidden">
              <code className="text-xs font-mono text-success break-all select-text">
                {terminalWarningModal.lenh}
              </code>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTerminalWarningModal(null)}
                className="btn-tactile px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-secondary hover:text-primary text-xs font-medium border border-border"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const cmd = terminalWarningModal.lenh;
                  setTerminalWarningModal(null);
                  thucHienMoTerminal(cmd);
                }}
                className="btn-tactile px-4 py-1.5 rounded-lg bg-danger-solid hover:bg-danger-solid/90 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Vẫn mở Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
