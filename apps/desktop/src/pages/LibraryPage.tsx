import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Library,
  RefreshCw,
  Play,
  Trash2,
  Download,
  Search,
  Laptop,
  Compass,
  FolderOpen,
  Check,
  Copy,
  Terminal,
  AlertTriangle,
  Shield,
  Loader2,
  BellOff,
} from 'lucide-react';
import { useNavStore } from '../stores/useNavStore';
import { useInstallStore } from '../stores/useInstallStore';
import { useUpdaterStore } from '../stores/useUpdaterStore';
import { useAuthStore } from '../stores/useAuthStore';
import { libraryService } from '../services/library/library-service';
import { deviceService, DeviceInfo } from '../services/device/device-service';
import { installService } from '../services/install/install-service';
import type { ThongTinUngDungRegistry } from '../services/install/install-types';
import { authService } from '../services/auth/auth-service';
import { confirmDialog } from '../stores/useDialogStore';
import { toast } from '../stores/useToastStore';

export const LibraryPage: React.FC = () => {
  const { navigateTo, openAppDetail } = useNavStore();
  const { caiDatMap, goCaiDatLocal } = useInstallStore();
  const {
    soLuongBanCapNhat,
    danhSachCapNhat,
    dangKiemTra,
    kiemTraCapNhat,
    boQuaPhienBan,
    kiemTraDaBoQua,
  } = useUpdaterStore();
  const { user, isAuthenticated, maThietBi } = useAuthStore();
  const queryClient = useQueryClient();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [registryMap, setRegistryMap] = useState<Record<string, ThongTinUngDungRegistry | null>>(
    {},
  );
  const [isCheckingRegistry, setIsCheckingRegistry] = useState(false);
  const [isUninstallingId, setIsUninstallingId] = useState<string | null>(null);
  const [isConfirmingCliId, setIsConfirmingCliId] = useState<string | null>(null);
  const [cliUninstallModalApp, setCliUninstallModalApp] = useState<{
    maUngDung: string;
    tenApp: string;
    trinhQuanLyGoi?: string | null;
    tenGoiCli?: string | null;
    lenhGo: string;
  } | null>(null);
  const [cliUpdateModalApp, setCliUpdateModalApp] = useState<{
    maUngDung: string;
    tenApp: string;
    phienBanMoi?: string;
    lenhCapNhatCli: string;
  } | null>(null);
  const [copiedCliId, setCopiedCliId] = useState<string | null>(null);
  const [isUninstallingCli, setIsUninstallingCli] = useState(false);
  const syncedRegistryKeysRef = useRef<Set<string>>(new Set());

  // 1. Lấy thông tin thiết bị máy trạm
  useEffect(() => {
    deviceService.getDeviceInfo().then((dev) => {
      setDeviceInfo(dev);
    });
  }, []);

  // 2. Nạp danh sách ứng dụng đã cài đặt từ Backend theo máy hiện tại (P3-12.2 & A3)
  const {
    data: backendInstalledApps = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
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

  // 4. Đối chiếu ứng dụng đã cài đặt với Windows Registry (A4)
  useEffect(() => {
    if (backendInstalledApps.length === 0) {
      setRegistryMap({});
      return;
    }

    let isMounted = true;
    setIsCheckingRegistry(true);

    Promise.all(
      backendInstalledApps.map(async (app) => {
        // P3B-16.6: Không quét registry đối với ứng dụng cài qua dòng lệnh CLI
        if (app.trinhQuanLyGoi) {
          return { maUngDung: app.maUngDung, regInfo: null };
        }

        const ten = app.ungDung?.tenKhoChua || app.ungDung?.tenRepoDayDu || app.maUngDung;
        const currentCaiDatMap = useInstallStore.getState().caiDatMap;
        const localApp = currentCaiDatMap[app.maUngDung];
        const regKey = app.khoaRegistry || localApp?.registryKey;
        const regDisp = app.tenHienThiRegistry || localApp?.registryDisplayName;
        const regInfo = await installService.kiemTraAppRegistry(ten, regKey, regDisp);

        // DELIV-40.2 & FE-R7-03: Tự động lưu ngược khóa Registry cho app cũ bằng endpoint riêng
        // Dùng syncedRegistryKeysRef để tránh spam PUT request khi chuyển tab
        if (
          maThietBi &&
          !app.khoaRegistry &&
          regInfo?.registry_key &&
          !syncedRegistryKeysRef.current.has(app.maUngDung)
        ) {
          syncedRegistryKeysRef.current.add(app.maUngDung);
          libraryService
            .capNhatKhoaRegistry(maThietBi, app.maUngDung, {
              khoaRegistry: regInfo.registry_key,
              tenHienThiRegistry: regInfo.display_name || undefined,
            })
            .catch((err) => {
              syncedRegistryKeysRef.current.delete(app.maUngDung);
              console.warn('[LibraryPage] Không thể tự động lưu khóa registry lên backend:', err);
            });
        }

        return { maUngDung: app.maUngDung, regInfo };
      }),
    ).then((results) => {
      if (!isMounted) return;
      const newMap: Record<string, ThongTinUngDungRegistry | null> = {};
      for (const r of results) {
        newMap[r.maUngDung] = r.regInfo;
      }
      setRegistryMap(newMap);
      setIsCheckingRegistry(false);
    });

    return () => {
      isMounted = false;
    };
  }, [backendInstalledApps, maThietBi]);

  // 5. Danh sách ứng dụng đã cài đặt trên máy trạm hiện tại (Nguyên tắc 1, A3 & A4)
  const updatesMap = new Map(danhSachCapNhat.map((u) => [u.maUngDung, u]));

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
      daBoQuaPhienBan?: boolean;
      khoaRegistry?: string | null;
      tenHienThiRegistry?: string | null;
      regInfo?: ThongTinUngDungRegistry | null;
      daBiGoBenNgoai: boolean;
      trinhQuanLyGoi?: string | null;
      tenGoiCli?: string | null;
      lenhGoCli?: string | null;
      lenhCapNhatCli?: string | null;
      trangThaiXacNhan?: string | null;
      thoiGianHetHan?: string | null;
      laAppCli: boolean;
    }
  >();

  // Đưa app từ backend vào map và đối chiếu với registry
  for (const bApp of backendInstalledApps) {
    const updateItem = updatesMap.get(bApp.maUngDung);
    const localApp = caiDatMap[bApp.maUngDung];
    const regInfo = registryMap[bApp.maUngDung];
    const laAppCli = Boolean(bApp.trinhQuanLyGoi);

    // Phát hiện app đã bị gỡ ngoài Windows:
    // P3B-16.6: Không áp dụng cho app CLI vì app CLI không ghi vào Windows Registry Uninstaller
    const daBiGoBenNgoai =
      !laAppCli &&
      !isCheckingRegistry &&
      Object.keys(registryMap).length > 0 &&
      registryMap[bApp.maUngDung] === null &&
      !localApp;

    const targetNewVersion = updateItem?.phienBanMoiNhat || bApp.phienBanMoiNhat || undefined;
    const daBoQua = kiemTraDaBoQua(bApp.maUngDung, targetNewVersion);
    const coBanMoiRaw =
      bApp.phienBanHienTai !== 'latest' && Boolean(updateItem?.coBanCapNhat || bApp.coBanMoi);
    const coBanMoi = coBanMoiRaw && !daBoQua;

    mergedAppsMap.set(bApp.maUngDung, {
      maUngDung: bApp.maUngDung,
      tenApp: bApp.ungDung?.tenKhoChua || bApp.ungDung?.tenRepoDayDu || bApp.maUngDung,
      phienBanHienTai: bApp.phienBanHienTai,
      duongDanThuMuc: bApp.duongDanThuMuc ?? undefined,
      duongDanThucThi: localApp?.duongDanThucThi ?? undefined,
      iconUrl: bApp.ungDung?.duongDanIcon ?? undefined,
      // P3B-16 & P3B-17: Ẩn thông báo nếu bản này đã được người dùng chọn bỏ qua
      coBanMoi,
      phienBanMoi: targetNewVersion,
      daBoQuaPhienBan: daBoQua,
      khoaRegistry: bApp.khoaRegistry ?? localApp?.registryKey,
      tenHienThiRegistry: bApp.tenHienThiRegistry ?? localApp?.registryDisplayName,
      regInfo,
      daBiGoBenNgoai,
      trinhQuanLyGoi: bApp.trinhQuanLyGoi ?? null,
      tenGoiCli: bApp.tenGoiCli ?? null,
      lenhGoCli: bApp.lenhGoCli ?? null,
      lenhCapNhatCli: bApp.lenhCapNhatCli ?? null,
      trangThaiXacNhan: bApp.trangThaiXacNhan ?? null,
      thoiGianHetHan: bApp.thoiGianHetHan ?? null,
      laAppCli,
    });
  }

  const allInstalledApps = Array.from(mergedAppsMap.values());

  // Lọc theo ô tìm kiếm
  const filteredApps = allInstalledApps.filter((app) =>
    app.tenApp.toLowerCase().includes(searchFilter.trim().toLowerCase()),
  );

  // R-06, SEC-R9-02, SEC-R9-03: Kiểm tra thư mục cài đặt có an toàn và hợp lệ hay không
  // - Chặn đường dẫn mạng UNC (\\ hoặc //) chống rò rỉ NTLM
  // - Chặn mọi thư mục nằm dưới Windows (kể cả ổ đĩa khác C:\)
  // - Chặn ProgramData\Package Cache (kể cả 8.3 short name packag~1)
  // - Chặn temp, tmp, system32, syswow64 theo từng segment (không chặn nhầm Tempest, xử lý trailing dot)
  // - Chặn ổ đĩa gốc C:\ hoặc C:
  const laThuMucCaiDatHopLe = (dir?: string | null): boolean => {
    if (!dir || !dir.trim()) return false;
    let s = dir.trim();

    // SEC-R9-03: Chặn đường dẫn mạng UNC và NT Device Path chống rò rỉ NTLM hash
    if (
      s.startsWith('\\\\') ||
      s.startsWith('//') ||
      s.startsWith('\\??\\') ||
      s.startsWith('\\\\?\\')
    ) {
      return false;
    }

    s = s
      .replace(/^\\\\\?\\/, '')
      .replace(/^\\\?\?\\/, '')
      .trim()
      .replace(/^"/, '')
      .replace(/"$/, '')
      .trim();
    if (!s) return false;

    const normalized = s.replace(/\//g, '\\');
    const lower = normalized.toLowerCase();

    // 1. Chặn thư mục nằm dưới Windows (kể cả trên ổ đĩa khác C)
    if (
      lower.startsWith('c:\\windows\\') ||
      lower === 'c:\\windows' ||
      lower.includes(':\\windows\\')
    ) {
      return false;
    }

    // 2. Chặn Package Cache (kể cả 8.3 SFN packag~1)
    if (
      lower.includes('programdata\\package cache') ||
      lower.includes('package cache') ||
      lower.includes('packag~1')
    ) {
      return false;
    }

    // 3. Chặn Temp, System32, SysWOW64 theo đúng phân đoạn (không chặn nhầm Tempest, loại bỏ trailing dot)
    const segments = lower.split('\\');
    for (const seg of segments) {
      const cleanSeg = seg.trim().replace(/\.+$/, '');
      if (
        cleanSeg === 'temp' ||
        cleanSeg === 'tmp' ||
        cleanSeg === 'system32' ||
        cleanSeg === 'syswow64'
      ) {
        return false;
      }
    }

    // 4. Chặn ổ đĩa gốc
    if ((lower.length <= 3 && lower.includes(':')) || lower === '\\') {
      return false;
    }

    return true;
  };

  // L-01, R-06: Bóc tách thư mục cha từ UninstallString
  const trichXuatThuMucCaiDatTuUninstallString = (
    uninstallString?: string | null,
  ): string | null => {
    if (!uninstallString || !uninstallString.trim()) return null;
    const trimmed = uninstallString.trim();

    let exePath = '';
    if (trimmed.startsWith('"')) {
      const closeQuoteIdx = trimmed.indexOf('"', 1);
      if (closeQuoteIdx !== -1) {
        exePath = trimmed.slice(1, closeQuoteIdx);
      }
    } else {
      const exeIdx = trimmed.toLowerCase().lastIndexOf('.exe');
      if (exeIdx !== -1) {
        exePath = trimmed.slice(0, exeIdx + 4).trim();
      } else {
        const parts = trimmed.split(' ');
        exePath = parts[0] || '';
      }
    }

    if (exePath.toLowerCase().endsWith('.exe')) {
      const lastSlash = Math.max(exePath.lastIndexOf('\\'), exePath.lastIndexOf('/'));
      if (lastSlash > 0) {
        const parentDir = exePath.slice(0, lastSlash);
        if (laThuMucCaiDatHopLe(parentDir)) {
          return parentDir;
        }
      }
    }
    return null;
  };

  // L-01, R-06: Bóc tách thư mục cha từ DisplayIcon (bỏ chỉ số icon ,0 hoặc ,1)
  const trichXuatThuMucTuDisplayIcon = (displayIcon?: string | null): string | null => {
    if (!displayIcon || !displayIcon.trim()) return null;
    let s = displayIcon.trim();
    s = s.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '');
    const commaIdx = s.lastIndexOf(',');
    if (commaIdx !== -1) {
      const after = s
        .slice(commaIdx + 1)
        .trim()
        .replace(/"/g, '');
      if (!isNaN(Number(after))) {
        s = s.slice(0, commaIdx);
      }
    }
    const clean = s.trim().replace(/^"/, '').replace(/"$/, '').trim();
    const lastSlash = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'));
    if (lastSlash > 0) {
      const parentDir = clean.slice(0, lastSlash);
      if (laThuMucCaiDatHopLe(parentDir)) {
        return parentDir;
      }
    }
    return null;
  };

  // R-01, R-06: Kiểm tra DisplayIcon có phải là ứng dụng hợp lệ hay không (loại bỏ uninstaller/setup/msiexec/Windows/Package Cache)
  const laDisplayIconHopLe = (displayIcon?: string | null): boolean => {
    if (!displayIcon || !displayIcon.trim()) return false;
    let s = displayIcon.trim();
    s = s.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '');
    const commaIdx = s.lastIndexOf(',');
    if (commaIdx !== -1) {
      const after = s
        .slice(commaIdx + 1)
        .trim()
        .replace(/"/g, '');
      if (!isNaN(Number(after))) {
        s = s.slice(0, commaIdx);
      }
    }
    const clean = s.trim().replace(/^"/, '').replace(/"$/, '').trim();
    const lower = clean.toLowerCase();
    if (!lower.endsWith('.exe')) return false;
    if (
      lower.startsWith('c:\\windows\\') ||
      lower.startsWith('c:/windows/') ||
      lower.includes('package cache')
    )
      return false;

    const lastSlash = Math.max(lower.lastIndexOf('\\'), lower.lastIndexOf('/'));
    const fileName = lastSlash >= 0 ? lower.slice(lastSlash + 1) : lower;
    const tuKhoaCam = ['unins', 'uninst', 'uninstall', 'setup', 'install', 'update', 'msiexec'];
    if (tuKhoaCam.some((kw) => fileName.includes(kw))) {
      return false;
    }
    return true;
  };

  // L-01, R-06: Lấy thư mục cài đặt thực tế để mở hoặc hiển thị (thẩm định nghiêm ngặt qua laThuMucCaiDatHopLe)
  const layThuMucCaiDatThucTe = (app: {
    duongDanThuMuc?: string | null;
    regInfo?: ThongTinUngDungRegistry | null;
  }): string | null => {
    // 1. InstallLocation từ Registry
    if (app.regInfo?.install_location && app.regInfo.install_location.trim()) {
      const cleaned = app.regInfo.install_location
        .trim()
        .replace(/^\\\\\?\\/, '')
        .replace(/^\\\?\?\\/, '');
      if (laThuMucCaiDatHopLe(cleaned)) {
        return cleaned;
      }
    }
    // 2. Thư mục cha từ UninstallString
    const dirFromUninstall = trichXuatThuMucCaiDatTuUninstallString(app.regInfo?.uninstall_string);
    if (dirFromUninstall && laThuMucCaiDatHopLe(dirFromUninstall)) {
      return dirFromUninstall.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '');
    }
    // 3. Thư mục cha từ DisplayIcon
    const dirFromIcon = trichXuatThuMucTuDisplayIcon(app.regInfo?.display_icon);
    if (dirFromIcon && laThuMucCaiDatHopLe(dirFromIcon)) {
      return dirFromIcon.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '');
    }
    // 4. Nếu là Portable ZIP (có duongDanThuMuc và không phải file download .exe/.msi)
    if (
      app.duongDanThuMuc &&
      app.duongDanThuMuc.trim() &&
      !/\.(exe|msi)$/i.test(app.duongDanThuMuc.trim())
    ) {
      const cleaned = app.duongDanThuMuc
        .trim()
        .replace(/^\\\\\?\\/, '')
        .replace(/^\\\?\?\\/, '');
      if (laThuMucCaiDatHopLe(cleaned)) {
        return cleaned;
      }
    }
    return null;
  };

  // Xử lý mở ứng dụng (L-01: Mở ứng dụng từ DisplayIcon qua Registry hoặc đường dẫn thực thi)
  const handleOpenApp = async (app: {
    maUngDung: string;
    duongDanThucThi?: string;
    tenApp: string;
    khoaRegistry?: string | null;
    regInfo?: ThongTinUngDungRegistry | null;
  }) => {
    if (app.duongDanThucThi) {
      await installService.moUngDung(app.duongDanThucThi);
      return;
    }

    // Khởi chạy native thông qua DisplayIcon từ khóa Registry đã xác minh
    const regKey = app.regInfo?.registry_key || app.khoaRegistry;
    if (regKey) {
      try {
        const ok = await installService.moUngDungTuRegistry(regKey, app.tenApp);
        if (ok) return;
      } catch (err) {
        console.warn(`[LibraryPage] Không thể mở app từ Registry [${regKey}]:`, err);
      }
    }

    // Nếu là app giả lập trong RAM thì thử moApp
    const localApp = caiDatMap[app.maUngDung];
    if (localApp?.duongDanThucThi) {
      await installService.moUngDung(localApp.duongDanThucThi);
      return;
    }

    // Nếu hoàn toàn không thể định vị file/folder thực thi: Thông báo rõ ràng cho người dùng
    toast.info(
      `Ứng dụng "${app.tenApp}" đã được cài đặt vào hệ thống Windows. Bạn có thể khởi chạy trực tiếp từ Start Menu hoặc Desktop!`,
    );
  };

  // Xử lý mở thư mục cài đặt thực tế (L-01)
  const handleOpenFolder = (app: {
    tenApp: string;
    duongDanThuMuc?: string | null;
    regInfo?: ThongTinUngDungRegistry | null;
  }) => {
    const dir = layThuMucCaiDatThucTe(app);
    if (dir) {
      installService.moThuMuc(dir);
    } else {
      toast.error(`Không thể xác định thư mục cài đặt của "${app.tenApp}".`);
    }
  };

  // Xử lý xác nhận lại ứng dụng CLI ("Xác nhận đã cài" - P3B-16.5)
  const handleConfirmCli = async (app: { maUngDung: string; tenApp: string }) => {
    if (!maThietBi) return;
    try {
      setIsConfirmingCliId(app.maUngDung);
      const res = await libraryService.xacNhanCaiDatCli(maThietBi, app.maUngDung);
      if (res?.thanhCong) {
        toast.success(`Đã xác nhận cài đặt "${app.tenApp}". Bản ghi sẽ không bị hết hạn.`);
        queryClient.invalidateQueries({
          queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
        });
      } else {
        toast.error('Không thể xác nhận cài đặt ứng dụng.');
      }
    } catch (err) {
      toast.error(`Lỗi xác nhận: ${(err as Error).message}`);
    } finally {
      setIsConfirmingCliId(null);
    }
  };

  // Sao chép lệnh CLI trong modal (Chống Pastejacking)
  const handleCopyCliCommand = (cmd: string, id: string) => {
    if (!cmd) return;
    const sanitizedCmd = cmd.trim().replace(/[\r\n]+/g, ' ');
    navigator.clipboard
      .writeText(sanitizedCmd)
      .then(() => {
        setCopiedCliId(id);
        toast.success('Đã sao chép câu lệnh vào Clipboard!');
        setTimeout(() => setCopiedCliId(null), 2500);
      })
      .catch(() => {
        toast.error('Không thể sao chép vào Clipboard.');
      });
  };

  // Xác nhận đã gỡ ứng dụng CLI khỏi máy tính (P3B-16.6)
  const handleConfirmCliUninstalled = async () => {
    if (!cliUninstallModalApp || !maThietBi) return;
    try {
      setIsUninstallingCli(true);
      await libraryService.goCaiDat(maThietBi, cliUninstallModalApp.maUngDung);
      goCaiDatLocal(cliUninstallModalApp.maUngDung);
      queryClient.invalidateQueries({
        queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
      });
      toast.success(`Đã xóa "${cliUninstallModalApp.tenApp}" khỏi Thư viện máy.`);
      setCliUninstallModalApp(null);
    } catch (err) {
      toast.error(`Lỗi khi xóa khỏi Thư viện: ${(err as Error).message}`);
    } finally {
      setIsUninstallingCli(false);
    }
  };

  // Xử lý gỡ cài đặt thật và đồng bộ danh sách (A4 & P3B-16.6)
  const handleUninstallApp = async (app: {
    maUngDung: string;
    tenApp: string;
    phienBanHienTai: string;
    khoaRegistry?: string | null;
    regInfo?: ThongTinUngDungRegistry | null;
    daBiGoBenNgoai: boolean;
    laAppCli?: boolean;
    trinhQuanLyGoi?: string | null;
    tenGoiCli?: string | null;
    lenhGoCli?: string | null;
  }) => {
    // Trường hợp 0: Phần mềm cài bằng dòng lệnh CLI (P3B-16.6)
    if (app.laAppCli) {
      const lenhGo = app.lenhGoCli || `${app.trinhQuanLyGoi} uninstall ${app.tenGoiCli}`;

      setCliUninstallModalApp({
        maUngDung: app.maUngDung,
        tenApp: app.tenApp,
        trinhQuanLyGoi: app.trinhQuanLyGoi,
        tenGoiCli: app.tenGoiCli,
        lenhGo,
      });
      return;
    }

    // Trường hợp 1: Phần mềm đã bị người dùng gỡ bên ngoài Windows (A4)
    if (app.daBiGoBenNgoai) {
      const xacNhanDon = await confirmDialog({
        title: 'Dọn dẹp Thư viện máy',
        description: `Phần mềm "${app.tenApp}" đã được gỡ cài đặt bên ngoài Windows.\n\nBạn có muốn dọn bản ghi này khỏi Thư viện của máy?`,
        confirmLabel: 'Dọn dẹp',
        cancelLabel: 'Hủy',
        variant: 'warning',
        icon: 'trash',
      });
      if (xacNhanDon) {
        try {
          setIsUninstallingId(app.maUngDung);
          goCaiDatLocal(app.maUngDung);
          if (maThietBi) {
            await libraryService.goCaiDat(maThietBi, app.maUngDung);
            queryClient.invalidateQueries({
              queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
            });
          }
        } finally {
          setIsUninstallingId(null);
        }
      }
      return;
    }

    // Trường hợp 2: Gỡ cài đặt native qua UninstallString từ Registry Windows (A4, Vấn đề 1)
    const displayName = app.regInfo?.display_name || app.tenApp;
    const displayVersion = app.regInfo?.display_version || app.phienBanHienTai;
    const publisher = app.regInfo?.publisher ? ` (Nhà phát triển: ${app.regInfo.publisher})` : '';

    const xacNhan = await confirmDialog({
      title: 'Gỡ cài đặt phần mềm',
      description: `Bạn có chắc chắn muốn gỡ cài đặt phần mềm "${displayName}"${publisher} - Phiên bản ${displayVersion} khỏi máy tính này không?\n\nThao tác này sẽ khởi chạy trình gỡ cài đặt chính chủ của phần mềm.`,
      confirmLabel: 'Gỡ cài đặt',
      cancelLabel: 'Hủy',
      variant: 'danger',
      icon: 'trash',
    });

    if (!xacNhan) return;

    if (app.regInfo?.uninstall_string) {
      try {
        setIsUninstallingId(app.maUngDung);
        const keyToUse = app.regInfo.registry_key || app.khoaRegistry || undefined;
        await installService.goCaiDatQuaRegistry(
          app.tenApp,
          app.regInfo.uninstall_string,
          keyToUse,
        );

        // Sau khi bộ gỡ chính chủ chạy xong thành công: Xóa bản ghi trên Backend
        if (maThietBi) {
          await libraryService.goCaiDat(maThietBi, app.maUngDung);
        }
        goCaiDatLocal(app.maUngDung);
        queryClient.invalidateQueries({
          queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('NGUOI_DUNG_HUY')) {
          // Người dùng chủ động bấm Cancel ở hộp UAC hoặc uninstaller: không làm gì
        } else {
          toast.error(`Không thể hoàn tất gỡ cài đặt: ${errorMsg}`);
        }
      } finally {
        setIsUninstallingId(null);
      }
    } else {
      // Nếu không tìm thấy UninstallString trong registry: hỏi dọn bản ghi
      const xacNhanXoa = await confirmDialog({
        title: 'Xóa khỏi danh sách quản lý',
        description: `Không tìm thấy lệnh gỡ cài đặt trong Registry Windows cho "${app.tenApp}".\n\nBạn có muốn xóa phần mềm này khỏi danh sách quản lý?`,
        confirmLabel: 'Xóa bỏ',
        cancelLabel: 'Hủy',
        variant: 'warning',
        icon: 'trash',
      });
      if (xacNhanXoa) {
        try {
          setIsUninstallingId(app.maUngDung);
          goCaiDatLocal(app.maUngDung);
          if (maThietBi) {
            await libraryService.goCaiDat(maThietBi, app.maUngDung);
            queryClient.invalidateQueries({
              queryKey: ['device-installed-apps', user?.maNguoiDung, maThietBi],
            });
          }
        } finally {
          setIsUninstallingId(null);
        }
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold font-display text-primary truncate group-hover:text-accent-forge transition-colors">
                      {app.tenApp}
                    </h3>
                    {app.laAppCli && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-accent-forge font-mono text-[10px] font-bold shrink-0">
                        CLI: {app.trinhQuanLyGoi}
                      </span>
                    )}
                    {app.laAppCli && app.trangThaiXacNhan === 'CHO_XAC_NHAN' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Chờ xác nhận (24h)
                      </span>
                    ) : app.daBiGoBenNgoai ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-bold shrink-0">
                        Đã bị gỡ bên ngoài Windows
                      </span>
                    ) : app.coBanMoi ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold shrink-0">
                        Bản mới: {app.phienBanMoi || 'Mới'}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted font-mono truncate">
                    <span>Phiên bản: {app.phienBanHienTai}</span>
                    {app.laAppCli ? (
                      <>
                        <span>•</span>
                        <span
                          className="text-accent-ai font-medium truncate max-w-[280px]"
                          title={app.tenGoiCli || ''}
                        >
                          Gói: {app.tenGoiCli}
                        </span>
                      </>
                    ) : (
                      (() => {
                        const thuMuc = layThuMucCaiDatThucTe(app);
                        if (thuMuc) {
                          return (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[280px]" title={thuMuc}>
                                {thuMuc}
                              </span>
                            </>
                          );
                        }
                        return (
                          <>
                            <span>•</span>
                            <span className="text-muted/80">Đã cài trên Windows</span>
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Cụm nút hành động (A4, L-01, P3B-16) */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {app.daBiGoBenNgoai ? (
                  /* App đã bị gỡ ngoài Windows: Nút dọn khỏi thư viện (EC-07) */
                  <button
                    onClick={() => handleUninstallApp(app)}
                    disabled={isUninstallingId !== null}
                    className="btn-tactile h-8 px-3.5 rounded-lg bg-surface-elevated hover:bg-rose-500/15 border border-rose-500/30 text-rose-400 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-rose-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Dọn bản ghi này khỏi danh sách quản lý máy này"
                  >
                    {isUninstallingId === app.maUngDung ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-forge" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Dọn Khỏi Thư Viện</span>
                  </button>
                ) : app.laAppCli ? (
                  /* App cài bằng dòng lệnh CLI: Xác nhận đã cài, Cập nhật qua lệnh, Lệnh gỡ (P3B-16) */
                  <>
                    {app.trangThaiXacNhan === 'CHO_XAC_NHAN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmCli(app);
                        }}
                        disabled={isConfirmingCliId === app.maUngDung}
                        className="btn-tactile h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all outline-none"
                        title="Xác nhận bạn đã cài phần mềm này và hủy tự động hết hạn 24h"
                      >
                        {isConfirmingCliId === app.maUngDung ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Xác nhận đã cài</span>
                      </button>
                    )}

                    {app.coBanMoi && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (app.lenhCapNhatCli) {
                              setCliUpdateModalApp({
                                maUngDung: app.maUngDung,
                                tenApp: app.tenApp,
                                phienBanMoi: app.phienBanMoi,
                                lenhCapNhatCli: app.lenhCapNhatCli,
                              });
                            } else {
                              openAppDetail(app.maUngDung);
                            }
                          }}
                          className="btn-tactile h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all outline-none"
                          title="Xem lệnh cập nhật phiên bản mới"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Cập Nhật</span>
                        </button>
                        {app.phienBanMoi && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              boQuaPhienBan(app.maUngDung, app.phienBanMoi!);
                              toast.info(`Đã bỏ qua thông báo cập nhật bản ${app.phienBanMoi}`);
                            }}
                            className="btn-tactile h-8 px-2.5 rounded-lg border border-border hover:bg-surface-elevated text-secondary hover:text-primary font-medium text-xs flex items-center gap-1 shadow-xs transition-all outline-none"
                            title="Bỏ qua phiên bản này (tự hiện lại khi có bản mới hơn)"
                          >
                            <BellOff className="w-3.5 h-3.5 text-secondary" />
                            <span className="hidden sm:inline">Bỏ qua</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUninstallApp(app);
                      }}
                      className="btn-tactile h-8 px-2.5 rounded-lg border border-border hover:bg-rose-500/10 hover:border-rose-500/30 text-muted hover:text-rose-400 font-medium text-xs flex items-center gap-1.5 transition-colors"
                      title="Xem lệnh gỡ cài đặt CLI"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Lệnh Gỡ</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Nút cập nhật nếu có bản mới (P3B-17.2) */}
                    {app.coBanMoi && (
                      <>
                        <button
                          onClick={() => openAppDetail(app.maUngDung)}
                          disabled={isUninstallingId !== null}
                          className="btn-tactile h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-amber-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật lên phiên bản mới"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Cập Nhật</span>
                        </button>
                        {app.phienBanMoi && (
                          <button
                            onClick={() => {
                              boQuaPhienBan(app.maUngDung, app.phienBanMoi!);
                              toast.info(`Đã bỏ qua thông báo cập nhật bản ${app.phienBanMoi}`);
                            }}
                            disabled={isUninstallingId !== null}
                            className="btn-tactile h-8 px-2.5 rounded-lg border border-border hover:bg-surface-elevated text-secondary hover:text-primary font-medium text-xs flex items-center gap-1 shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-accent-forge outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Bỏ qua phiên bản này (tự hiện lại khi có bản mới hơn)"
                          >
                            <BellOff className="w-3.5 h-3.5 text-secondary" />
                            <span className="hidden sm:inline">Bỏ qua</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Nút Mở Ứng Dụng (L-01, R-01, R-08: Hiện khi có file thực thi, DisplayIcon hợp lệ hoặc InstallLocation khả dụng) */}
                    {(app.duongDanThucThi ||
                      laDisplayIconHopLe(app.regInfo?.display_icon) ||
                      (app.regInfo?.install_location &&
                        laThuMucCaiDatHopLe(app.regInfo?.install_location))) && (
                      <button
                        onClick={() => handleOpenApp(app)}
                        disabled={isUninstallingId !== null}
                        className="btn-tactile h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Khởi chạy ứng dụng"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Mở Ứng Dụng</span>
                      </button>
                    )}

                    {/* Nút Mở Thư Mục Cài Đặt (L-01, R-06: Chỉ hiện khi có thư mục cài đặt hợp lệ, không mở vào Windows) */}
                    {layThuMucCaiDatThucTe(app) && (
                      <button
                        onClick={() => handleOpenFolder(app)}
                        disabled={isUninstallingId !== null}
                        className="btn-tactile h-8 px-3 rounded-lg border border-border hover:bg-surface-elevated text-secondary hover:text-primary font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-accent-forge outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mở thư mục cài đặt trong File Explorer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Thư Mục</span>
                      </button>
                    )}

                    {/* Nút Gỡ cài đặt native (A4, FE-03) */}
                    <button
                      onClick={() => handleUninstallApp(app)}
                      disabled={isUninstallingId !== null}
                      className="btn-tactile h-8 w-8 rounded-lg border border-border hover:bg-rose-500/10 hover:border-rose-500/30 text-muted hover:text-rose-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 outline-none disabled:opacity-50"
                      title="Gỡ cài đặt phần mềm này khỏi máy"
                    >
                      {isUninstallingId === app.maUngDung ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-forge" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </>
                )}
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
            Duyệt kho ForgeStore và chỉ với 1-Click Cài Đặt, phần mềm sẽ tự động tải, cài đặt an
            toàn và xuất hiện tại thư viện này.
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

      {/* Modal Lệnh Gỡ Cài Đặt CLI (P3B-16.6) */}
      {cliUninstallModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="tactile-card w-full max-w-lg p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-primary">
                    Lệnh Gỡ Cài Đặt Phần Mềm
                  </h3>
                  <span className="text-[11px] font-mono text-muted">
                    {cliUninstallModalApp.tenApp} ({cliUninstallModalApp.trinhQuanLyGoi})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCliUninstallModalApp(null)}
                className="btn-tactile w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              ForgeStore <strong className="text-primary">tuyệt đối không tự chạy lệnh</strong> trên
              máy tính của bạn. Hãy mở Terminal / PowerShell cá nhân, sao chép và thực thi câu lệnh
              dưới đây để gỡ phần mềm:
            </p>

            {/* Khung lệnh gỡ */}
            <div className="relative group rounded-xl bg-slate-950/90 border border-border overflow-hidden shadow-inner">
              <pre className="p-3.5 pr-28 text-xs font-mono text-rose-400 overflow-x-auto leading-relaxed select-text font-medium">
                <code>{cliUninstallModalApp.lenhGo}</code>
              </pre>
              <button
                type="button"
                onClick={() => handleCopyCliCommand(cliUninstallModalApp.lenhGo, 'cli-uninstall')}
                className="btn-tactile absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/[0.08] text-[11px] font-mono flex items-center gap-1.5 shadow-sm"
              >
                {copiedCliId === 'cli-uninstall' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop" />
                    <span className="text-emerald-400 font-semibold">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Chép lệnh</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border text-[11px] text-muted flex items-start gap-2 leading-relaxed">
              <Shield className="w-4 h-4 text-accent-forge shrink-0 mt-0.5" />
              <span>
                Sau khi bạn đã hoàn tất gỡ cài đặt trong Terminal, hãy bấm nút{' '}
                <strong>"Xác nhận đã gỡ"</strong> bên dưới để xóa bản ghi khỏi Thư viện máy này.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCliUninstallModalApp(null)}
                className="btn-tactile h-9 px-4 rounded-xl border border-border hover:bg-surface text-secondary hover:text-primary text-xs font-medium"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmCliUninstalled}
                disabled={isUninstallingCli}
                className="btn-tactile h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                {isUninstallingCli ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận đã gỡ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lệnh Cập Nhật CLI (P3B-16.7) */}
      {cliUpdateModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="tactile-card w-full max-w-lg p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-primary">
                    Lệnh Cập Nhật Phần Mềm
                  </h3>
                  <span className="text-[11px] font-mono text-muted">
                    {cliUpdateModalApp.tenApp} • Lên bản{' '}
                    {cliUpdateModalApp.phienBanMoi || 'mới nhất'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCliUpdateModalApp(null)}
                className="btn-tactile w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Mở Terminal / PowerShell cá nhân và chạy câu lệnh cập nhật an toàn dưới đây:
            </p>

            {/* Khung lệnh cập nhật */}
            <div className="relative group rounded-xl bg-slate-950/90 border border-border overflow-hidden shadow-inner">
              <pre className="p-3.5 pr-28 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed select-text font-medium">
                <code>{cliUpdateModalApp.lenhCapNhatCli}</code>
              </pre>
              <button
                type="button"
                onClick={() => handleCopyCliCommand(cliUpdateModalApp.lenhCapNhatCli, 'cli-update')}
                className="btn-tactile absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/[0.08] text-[11px] font-mono flex items-center gap-1.5 shadow-sm"
              >
                {copiedCliId === 'cli-update' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop" />
                    <span className="text-emerald-400 font-semibold">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Chép lệnh</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCliUpdateModalApp(null)}
                className="btn-tactile h-9 px-4 rounded-xl border border-border hover:bg-surface text-secondary hover:text-primary text-xs font-medium"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setCliUpdateModalApp(null);
                  if (maThietBi) kiemTraCapNhat(maThietBi);
                  refetch();
                }}
                className="btn-tactile h-9 px-4 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Đã cập nhật xong</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
