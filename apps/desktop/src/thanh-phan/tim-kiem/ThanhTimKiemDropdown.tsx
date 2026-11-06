import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Github,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Star,
  CornerDownLeft,
} from 'lucide-react';
import { useDieuHuongStore } from '../../kho-trang-thai/useDieuHuongStore';
import { useXacThucStore } from '../../kho-trang-thai/useXacThucStore';
import { khoUngDungService } from '../../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { layThongBaoLoi } from '../../dich-vu/api/thong-bao-loi';
import { layMaMoTrangTuLink } from './tien-ich-tim-kiem';
import { useDeviceInstalledApps } from '../../hooks/useDeviceInstalledApps';
import type { TimKiemResponseDto, InspectRepoResponseDto } from '@forgestore/types';

// Danh sách gợi ý tìm kiếm nhanh khi ô nhập đang trống
const GOI_Y_TIM_KIEM = [
  'PowerToys',
  'RustDesk',
  'Obsidian',
  'Quay màn hình',
  'Gõ tiếng Việt',
  'Lập trình',
];

export const ThanhTimKiemDropdown: React.FC = () => {
  const { openAppDetail, isSearchModalOpen, setSearchModalOpen } = useDieuHuongStore();
  const { kiemTraAppDaCai } = useDeviceInstalledApps();
  const isAuthenticated = useXacThucStore((s) => s.isAuthenticated);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<TimKiemResponseDto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Trạng thái kiểm định Paste & Play
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectSuccess, setInspectSuccess] = useState<InspectRepoResponseDto | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Chọn xong một kết quả thì đóng khung và xóa chữ đã gõ, để ô tìm kiếm sạch khi sang trang khác.
  const dongVaXoaTimKiem = () => {
    setIsOpen(false);
    setSearchModalOpen(false);
    setQuery('');
    setSearchResult(null);
    setSelectedIndex(-1);
    setInspectError(null);
    setInspectSuccess(null);
  };

  // Đồng bộ trạng thái mở nếu có nơi khác kích hoạt setSearchModalOpen
  useEffect(() => {
    if (isSearchModalOpen && !isOpen) {
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isSearchModalOpen, isOpen]);

  // Lắng nghe phím tắt toàn cục Ctrl + K / Cmd + K để focus ngay vào thanh tìm kiếm
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setSearchModalOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSearchModalOpen]);

  // Tự động đóng dropdown khi click ra ngoài thanh tìm kiếm
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchModalOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setSearchModalOpen]);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // Nhận diện đường dẫn GitHub Repo cho tính năng Paste & Play (EC-05 & FE-R7-05)
  const trimmedQuery = query.trim();
  const isGithubFullUrl = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(trimmedQuery);
  const EXCLUDED_TECH_TERMS = ['c/c++', 'tcp/ip', 'i/o', 'ci/cd', '24/7', 'p2p'];
  const isGithubShortRepo =
    /^[a-zA-Z0-9_.-]{2,}\/[a-zA-Z0-9_.-]{2,}$/.test(trimmedQuery) &&
    !EXCLUDED_TECH_TERMS.includes(trimmedQuery.toLowerCase());
  const isGithubUrl = isGithubFullUrl || isGithubShortRepo;

  // Debounce 300ms gọi API tìm kiếm
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResult(null);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setInspectError(null);

    // Gõ tiếp khi yêu cầu cũ chưa về thì bỏ kết quả cũ, tránh ghi đè kết quả của từ khóa mới.
    let daHuy = false;
    const timer = setTimeout(async () => {
      try {
        const res = await khoUngDungService.timKiem(trimmed, 'WINDOWS');
        if (daHuy) return;
        setSearchResult(res);
        setSelectedIndex(res.duLieu && res.duLieu.length > 0 ? 0 : -1);
      } catch (err) {
        if (daHuy) return;
        console.error('Lỗi tìm kiếm:', err);
        setSearchResult(null);
      } finally {
        if (!daHuy) setIsSearching(false);
      }
    }, 300);

    return () => {
      daHuy = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Xử lý nạp và kiểm định repo Paste & Play
  const handleInspectRepo = async (rawUrl: string) => {
    if (!rawUrl || isInspecting) return;
    // Thêm app mới vào kho cần đăng nhập (máy chủ từ chối khách), báo trước thay vì để lộ lỗi kỹ thuật
    if (!isAuthenticated) {
      setInspectSuccess(null);
      setInspectError('Hãy đăng nhập để thêm ứng dụng mới từ GitHub vào ForgeStore.');
      return;
    }
    const urlToInspect = rawUrl.startsWith('http') ? rawUrl : `https://github.com/${rawUrl}`;
    setIsInspecting(true);
    setInspectError(null);
    setInspectSuccess(null);

    try {
      const res = await khoUngDungService.kiemDinhRepo(urlToInspect);
      if (res.trangThai === 'THANH_CONG' && res.ungDung) {
        setInspectSuccess(res);
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
        }
        autoCloseTimerRef.current = setTimeout(() => {
          openAppDetail(res.ungDung!.tenRepoDayDu || res.ungDung!.maUngDung);
          dongVaXoaTimKiem();
        }, 800);
      } else {
        const errorMsg =
          res.trangThai === 'LINK_KHONG_HOP_LE'
            ? 'Liên kết GitHub không hợp lệ hoặc kho lưu trữ không công khai.'
            : 'Không thể nạp ứng dụng từ liên kết này.';
        setInspectError(res.thongBao || errorMsg);
      }
    } catch (err: unknown) {
      setInspectError(layThongBaoLoi(err, 'Lỗi kết nối khi kiểm tra repository.'));
    } finally {
      setIsInspecting(false);
    }
  };

  // Điều khiển bàn phím (Mũi tên lên/xuống, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchModalOpen(false);
      inputRef.current?.blur();
      return;
    }

    const items = searchResult?.duLieu || [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (items.length > 0) {
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isGithubUrl || searchResult?.loaiTruyVan === 'URL') {
        if (searchResult?.duongDanUrl?.daCoTrongStore) {
          openAppDetail(layMaMoTrangTuLink(searchResult.duongDanUrl));
          dongVaXoaTimKiem();
        } else {
          handleInspectRepo(query.trim());
        }
      } else if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
        const selectedApp = items[selectedIndex];
        if (selectedApp.chuaThamDinh || searchResult?.nguonKetQua === 'GITHUB') {
          handleInspectRepo(selectedApp.duongDanGithub || selectedApp.tenRepoDayDu);
        } else {
          openAppDetail(selectedApp.tenRepoDayDu || selectedApp.maUngDung);
          dongVaXoaTimKiem();
        }
      }
    }
  };

  const handleSelectApp = (app: {
    maUngDung: string;
    tenRepoDayDu: string;
    duongDanGithub?: string | null;
    chuaThamDinh?: boolean;
  }) => {
    const isFromGithub = Boolean(app.chuaThamDinh || searchResult?.nguonKetQua === 'GITHUB');
    if (isFromGithub) {
      handleInspectRepo(app.duongDanGithub || `https://github.com/${app.tenRepoDayDu}`);
    } else {
      openAppDetail(app.tenRepoDayDu || app.maUngDung);
      dongVaXoaTimKiem();
    }
  };

  return (
    <div ref={containerRef} data-no-drag className="relative w-full">
      {/* 1. Ô tìm kiếm thật trực tiếp trên Header */}
      <div
        className={`w-full h-9.5 px-3.5 rounded-xl flex items-center justify-between transition-all text-xs group shadow-xs ${
          isOpen
            ? 'bg-surface-elevated border border-accent-forge/50 ring-2 ring-accent-forge/15 shadow-sm'
            : 'bg-surface-elevated/70 hover:bg-surface-elevated border border-border hover:border-border-focus'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
          <Search
            className={`w-4 h-4 transition-colors shrink-0 ${
              isOpen ? 'text-accent-forge-text' : 'text-muted group-hover:text-primary'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Tìm kiếm ứng dụng hoặc dán liên kết GitHub"
            aria-expanded={isOpen}
            value={query}
            onFocus={() => {
              setIsOpen(true);
              setSearchModalOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm app, ý định AI hoặc dán link repo..."
            className="flex-1 bg-transparent text-xs text-primary placeholder:text-muted outline-none min-w-0 font-body"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSearching && (
            <Loader2 className="w-3.5 h-3.5 text-accent-forge-text animate-spin shrink-0" />
          )}

          {query && !isSearching && (
            <button
              onClick={() => {
                setQuery('');
                setSearchResult(null);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              title="Xóa nội dung"
              className="btn-tactile text-muted hover:text-primary transition-colors p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <kbd
            onClick={() => {
              inputRef.current?.focus();
              setIsOpen(true);
            }}
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-canvas border border-border rounded-md text-muted group-hover:text-primary shadow-xs shrink-0 cursor-pointer"
          >
            {isOpen ? 'ESC' : 'Ctrl K'}
          </kbd>
        </div>
      </div>

      {/* 2. Khung Dropdown kết quả thả ngay bên dưới thanh tìm kiếm */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Kết quả tìm kiếm"
          className="absolute -left-[80px] -right-[80px] top-full mt-2 z-50 rounded-2xl bg-surface/98 backdrop-blur-md border border-border shadow-2xl overflow-hidden flex flex-col animate-fade-in text-xs tactile-card"
        >
          <div className="p-3 max-h-[440px] overflow-y-auto no-scrollbar flex flex-col gap-2">
            {/* Nhánh A: Phát hiện đường dẫn GitHub (Paste & Play) */}
            {isGithubUrl || searchResult?.loaiTruyVan === 'URL' ? (
              <div className="p-3.5 rounded-xl bg-accent-forge/10 border border-accent-forge/30 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-accent-forge-text font-semibold text-xs">
                    <Github className="w-4 h-4" />
                    <span>DÁN ĐƯỜNG DẪN GITHUB ĐỂ CÀI</span>
                  </div>
                  {searchResult?.duongDanUrl?.daCoTrongStore && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/20 text-success font-semibold border border-success/30">
                      ĐÃ CÓ TRONG STORE
                    </span>
                  )}
                </div>

                <p className="text-xs text-secondary leading-relaxed">
                  {searchResult?.duongDanUrl?.daCoTrongStore
                    ? 'Ứng dụng này đã có sẵn và đồng bộ đầy đủ tệp cài đặt trong kho ForgeStore.'
                    : 'Hệ thống sẽ kết nối GitHub, tự động lấy phiên bản mới nhất và kiểm tra tệp cài đặt.'}
                </p>

                {inspectError && (
                  <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                )}

                {inspectSuccess && (
                  <div className="p-2.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {inspectSuccess.chiCoHuongDanCli ? (
                        <>
                          Ứng dụng này cài bằng dòng lệnh, trang chi tiết sẽ hướng dẫn từng bước.
                          Đang mở trang của <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                        </>
                      ) : (
                        <>
                          Kiểm tra hoàn tất! Đang chuyển sang trang cài đặt của{' '}
                          <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                        </>
                      )}
                    </span>
                  </div>
                )}

                {searchResult?.duongDanUrl?.daCoTrongStore ? (
                  <button
                    onClick={() => {
                      openAppDetail(layMaMoTrangTuLink(searchResult.duongDanUrl!));
                      dongVaXoaTimKiem();
                    }}
                    className="btn-tactile w-full py-2 px-3.5 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-black/20"
                  >
                    <span>
                      {kiemTraAppDaCai(undefined, searchResult.duongDanUrl!.repo)
                        ? 'Mở Trang Ứng Dụng (✓ Đã cài)'
                        : 'Mở Trang Cài Đặt Ngay'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleInspectRepo(query.trim())}
                    disabled={isInspecting || !!inspectSuccess}
                    className="btn-tactile w-full py-2 px-3.5 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-black/20 disabled:opacity-70 disabled:cursor-wait"
                  >
                    {isInspecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang kiểm tra ứng dụng và tệp cài đặt...</span>
                      </>
                    ) : (
                      <>
                        <span>Kiểm Tra & Xem Cài Đặt</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : query.trim().length >= 2 ? (
              /* Nhánh B: Kết quả tìm kiếm theo tên hoặc ý định */
              <div className="flex flex-col gap-1.5">
                {searchResult?.loaiTruyVan === 'Y_DINH' && (
                  <div className="p-2 rounded-xl bg-accent-ai/10 border border-accent-ai/20 flex items-center justify-between text-xs text-accent-ai mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Gợi ý thông minh theo nhu cầu bạn mô tả</span>
                    </div>
                  </div>
                )}

                {(isInspecting || inspectError || inspectSuccess) && (
                  <div className="p-2.5 rounded-xl bg-accent-forge/10 border border-accent-forge/30 flex flex-col gap-1.5 mb-1">
                    {inspectError && (
                      <div className="text-danger text-xs flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{inspectError}</span>
                      </div>
                    )}
                    {inspectSuccess && (
                      <div className="text-success text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Đang mở trang chi tiết...</span>
                      </div>
                    )}
                    {isInspecting && (
                      <div className="text-accent-forge-text text-xs flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Đang kết nối GitHub và kiểm tra gói cài đặt...</span>
                      </div>
                    )}
                  </div>
                )}

                {searchResult?.duLieu && searchResult.duLieu.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {searchResult.duLieu.map((app, idx) => {
                      const isSelected = selectedIndex === idx;
                      const isFromGithub = Boolean(
                        app.chuaThamDinh || searchResult?.nguonKetQua === 'GITHUB',
                      );

                      return (
                        <div
                          key={app.maUngDung}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectApp(app)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`btn-tactile p-2.5 rounded-xl flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected
                              ? 'bg-surface-elevated border-accent-forge/40 shadow-xs'
                              : 'bg-surface-elevated/40 border-border/40 hover:border-border hover:bg-surface-elevated/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 overflow-hidden">
                              {app.duongDanIcon ? (
                                <img
                                  src={app.duongDanIcon}
                                  alt={app.tenKhoChua}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-surface-hover flex items-center justify-center text-primary font-bold text-xs font-display">
                                  {app.tenKhoChua.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-semibold text-primary font-display truncate text-xs">
                                  {app.tenKhoChua}
                                </span>
                                {kiemTraAppDaCai(app.maUngDung, app.tenRepoDayDu) && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-success/20 text-success font-semibold border border-success/30 shrink-0">
                                    ✓ Đã cài
                                  </span>
                                )}
                                {isFromGithub ? (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent-ai/20 text-accent-ai font-semibold border border-accent-ai/30 shrink-0">
                                    GitHub
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-muted truncate">
                                    {app.tenRepoDayDu}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-secondary truncate">
                                {app.khauHieuTiengViet ||
                                  (isFromGithub
                                    ? 'Mã nguồn mở GitHub • Nhấn để xem cài đặt'
                                    : `${app.danhMucChinh} • Cập nhật ${app.phienBanMoiNhat || 'mới'}`)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 ml-2 font-mono text-[11px]">
                            <span className="text-secondary flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-muted" />
                              {app.soSaoGithub >= 1000
                                ? `${(app.soSaoGithub / 1000).toFixed(1)}k`
                                : app.soSaoGithub}
                            </span>
                            {app.diemUyTin !== undefined && app.diemUyTin !== null && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  app.diemUyTin >= 80
                                    ? 'bg-success/10 text-success'
                                    : app.diemUyTin >= 60
                                      ? 'bg-warning/10 text-warning'
                                      : 'bg-danger/10 text-danger'
                                }`}
                              >
                                {app.diemUyTin}/100
                              </span>
                            )}
                            <CornerDownLeft
                              className={`w-3 h-3 ${isSelected ? 'text-accent-forge-text' : 'text-muted'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !isSearching ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center gap-1.5 text-muted">
                    <p className="text-xs text-secondary">
                      Không tìm thấy ứng dụng nào khớp với &quot;<strong>{query}</strong>&quot;.
                    </p>
                    <p className="text-[11px] text-muted">
                      Bạn có thể dán đường dẫn GitHub (vd: <code>user/repo</code>) để cài đặt ngay.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Nhánh C: Trạng thái rỗng khi mới bấm vào ô tìm kiếm */
              <div className="py-3 px-1 flex flex-col gap-3">
                <div className="flex items-center justify-between text-muted text-[11px]">
                  <span className="font-medium text-secondary">Gợi ý tìm kiếm phổ biến:</span>
                  <span className="text-[10px] font-mono">Nhấn để tìm</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GOI_Y_TIM_KIEM.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setQuery(tag);
                        inputRef.current?.focus();
                      }}
                      className="btn-tactile px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover text-secondary hover:text-primary border border-border text-[11px] transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted">
                  <span>Dán link GitHub để cài đặt nhanh</span>
                  <div className="flex items-center gap-1.5">
                    <span>Dùng</span>
                    <kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border text-primary font-semibold">
                      ↑
                    </kbd>
                    <kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border text-primary font-semibold">
                      ↓
                    </kbd>
                    <span>chọn</span>
                    <span>•</span>
                    <kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border text-primary font-semibold">
                      ↵
                    </kbd>
                    <span>mở</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
