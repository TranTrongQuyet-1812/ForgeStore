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
} from 'lucide-react';
import { useNavStore } from '../../stores/useNavStore';
import { storeService } from '../../services/store/store-service';
import type { TimKiemResponseDto, InspectRepoResponseDto } from '@forgestore/types';

export const SearchModal: React.FC = () => {
  const { isSearchModalOpen, setSearchModalOpen, openAppDetail } = useNavStore();

  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<TimKiemResponseDto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Trạng thái kiểm định Paste & Play
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectSuccess, setInspectSuccess] = useState<InspectRepoResponseDto | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tự động focus vào input khi mở modal và reset trạng thái khi đóng (EC-06: Dọn timer 800ms)
  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
      setQuery('');
      setSearchResult(null);
      setSelectedIndex(-1);
      setIsInspecting(false);
      setInspectError(null);
      setInspectSuccess(null);
    }
  }, [isSearchModalOpen]);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // Nhận diện đường dẫn GitHub Repo cho tính năng Paste & Play (EC-05: Hỗ trợ cả full URL và định dạng rút gọn owner/repo)
  const trimmedQuery = query.trim();
  const isGithubFullUrl = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(trimmedQuery);
  const isGithubShortRepo = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmedQuery);
  const isGithubUrl = isGithubFullUrl || isGithubShortRepo;

  // Debounce 300ms gọi API tìm kiếm (P3-07.1)
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

    const timer = setTimeout(async () => {
      try {
        const res = await storeService.timKiem(trimmed, 'WINDOWS');
        setSearchResult(res);
        setSelectedIndex(res.duLieu && res.duLieu.length > 0 ? 0 : -1);
      } catch (err) {
        console.error('Lỗi tìm kiếm:', err);
        setSearchResult(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Xử lý nạp và kiểm định repo Paste & Play (P3-07.2)
  const handleInspectRepo = async (rawUrl: string) => {
    if (!rawUrl || isInspecting) return;
    const urlToInspect = rawUrl.startsWith('http') ? rawUrl : `https://github.com/${rawUrl}`;
    setIsInspecting(true);
    setInspectError(null);
    setInspectSuccess(null);

    try {
      const res = await storeService.kiemDinhRepo(urlToInspect);
      if (res.trangThai === 'THANH_CONG' && res.ungDung) {
        setInspectSuccess(res);
        // Tự động chuyển trang sau 800ms (EC-06: Quản lý timer chống rò rỉ)
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
        }
        autoCloseTimerRef.current = setTimeout(() => {
          openAppDetail(res.ungDung!.tenRepoDayDu || res.ungDung!.maUngDung);
          setSearchModalOpen(false);
        }, 800);
      } else {
        // Thông báo lỗi dễ hiểu theo TrangThaiNapRepo
        let errorMsg = 'Không thể nạp ứng dụng từ liên kết này.';
        if (res.trangThai === 'LINK_KHONG_HOP_LE') {
          errorMsg = 'Liên kết GitHub không hợp lệ hoặc kho lưu trữ không công khai.';
        } else if (res.trangThai === 'KHONG_CO_RELEASE') {
          errorMsg = 'Kho lưu trữ này chưa có bất kỳ bản phát hành (Release) nào trên GitHub.';
        } else if (res.trangThai === 'KHONG_CO_FILE_CAI_DAT') {
          errorMsg =
            'Không tìm thấy tệp cài đặt tương thích Windows (.exe, .msi, .zip) trong bản phát hành mới nhất.';
        }
        setInspectError(res.thongBao || errorMsg);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối khi thẩm định repository.';
      setInspectError(message);
    } finally {
      setIsInspecting(false);
    }
  };

  // Điều khiển bàn phím (P3-07.3: Mũi tên lên/xuống, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchModalOpen(false);
      return;
    }

    const items = searchResult?.duLieu || [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
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
          openAppDetail(searchResult.duongDanUrl.repo);
          setSearchModalOpen(false);
        } else {
          handleInspectRepo(query.trim());
        }
      } else if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
        const selectedApp = items[selectedIndex];
        if (selectedApp.chuaThamDinh || searchResult?.nguonKetQua === 'GITHUB') {
          handleInspectRepo(selectedApp.duongDanGithub || selectedApp.tenRepoDayDu);
        } else {
          openAppDetail(selectedApp.tenRepoDayDu || selectedApp.maUngDung);
          setSearchModalOpen(false);
        }
      }
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);

  // FE-V3-02: Focus Trap tuần hoàn tiêu điểm bàn phím (Tab / Shift+Tab) bên trong Modal theo WCAG 2.1
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchModalOpen(false);
      return;
    }

    if (e.key === 'Tab') {
      if (!modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (
          document.activeElement === first ||
          !modalRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  if (!isSearchModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs select-none animate-fade-in"
      onClick={() => setSearchModalOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm ứng dụng"
        onKeyDown={handleModalKeyDown}
        className="tactile-card w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Thanh nhập tìm kiếm (Ctrl+K) */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface-elevated/40">
          <Search className="w-5 h-5 text-accent-ai shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Tìm kiếm theo tên app, ý định AI hoặc dán link GitHub"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm theo tên app, ý định AI tiếng Việt hoặc dán link GitHub..."
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-accent-forge animate-spin shrink-0" />}
          {query && !isSearching && (
            <button
              onClick={() => setQuery('')}
              className="btn-tactile text-muted hover:text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-surface-elevated border border-border rounded text-muted">
            ESC
          </kbd>
        </div>

        {/* 2. Nội dung kết quả tìm kiếm / chế độ Paste & Play */}
        <div className="p-4 max-h-[420px] overflow-y-auto flex flex-col gap-2">
          {/* Nhánh 1: Phát hiện link GitHub hoặc loaiTruyVan === 'URL' (P3-07.2 Paste & Play) */}
          {isGithubUrl || searchResult?.loaiTruyVan === 'URL' ? (
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-accent-forge font-semibold text-xs">
                  <Github className="w-4 h-4" />
                  <span>PHÁT HIỆN LIÊN KẾT GITHUB (PASTE & PLAY)</span>
                </div>
                {searchResult?.duongDanUrl?.daCoTrongStore && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                    ĐÃ CÓ TRONG STORE
                  </span>
                )}
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                {searchResult?.duongDanUrl?.daCoTrongStore
                  ? 'Ứng dụng này đã được thẩm định an toàn và đồng bộ đầy đủ tệp cài đặt trong kho ForgeStore.'
                  : 'Hệ thống sẽ kết nối GitHub API, tự động trích xuất bản phát hành mới nhất, thẩm định SHA-256 và tóm tắt AI tiếng Việt.'}
              </p>

              {/* Thông báo lỗi khi thẩm định thất bại */}
              {inspectError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inspectError}</span>
                </div>
              )}

              {/* Thông báo thành công */}
              {inspectSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {inspectSuccess.chiCoHuongDanCli ? (
                      <>
                        Repository phân phối qua hướng dẫn dòng lệnh (CLI). Đang mở trang chi tiết
                        của <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                      </>
                    ) : (
                      <>
                        Thẩm định hoàn tất! Đang chuyển sang trang cài đặt của{' '}
                        <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Nút hành động */}
              {searchResult?.duongDanUrl?.daCoTrongStore ? (
                <button
                  onClick={() => {
                    openAppDetail(searchResult.duongDanUrl!.repo);
                    setSearchModalOpen(false);
                  }}
                  className="btn-tactile w-full py-2.5 px-4 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-950/30"
                >
                  <span>Mở Trang Cài Đặt Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleInspectRepo(query.trim())}
                  disabled={isInspecting || !!inspectSuccess}
                  className="btn-tactile w-full py-2.5 px-4 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-950/30 disabled:opacity-70 disabled:cursor-wait"
                >
                  {isInspecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang thẩm định repo và tệp cài đặt...</span>
                    </>
                  ) : (
                    <>
                      <span>Thẩm Định & Nạp Cài Đặt Ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : query.trim().length >= 2 ? (
            /* Nhánh 2: Kết quả tìm kiếm theo tên hoặc ý định AI (P3-07.1) */
            <div className="flex flex-col gap-2">
              {/* Huy hiệu thông báo loại truy vấn */}
              {searchResult?.loaiTruyVan === 'Y_DINH' && (
                <div className="p-2.5 rounded-xl bg-accent-ai/10 border border-accent-ai/20 flex items-center justify-between text-xs text-accent-ai">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      {searchResult.truyVanDich
                        ? `Tìm theo ý định ngữ nghĩa AI: "${searchResult.truyVanDich}"`
                        : 'Tìm kiếm thông minh kết hợp Dual-AI & pgvector'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted">gemini-3.1-flash-lite</span>
                </div>
              )}

              {/* Banner trạng thái thẩm định khi kích hoạt từ danh sách */}
              {(isInspecting || inspectError || inspectSuccess) && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex flex-col gap-2">
                  {inspectError && (
                    <div className="text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{inspectError}</span>
                    </div>
                  )}
                  {inspectSuccess && (
                    <div className="text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {inspectSuccess.chiCoHuongDanCli ? (
                          <>
                            Repository phân phối qua hướng dẫn CLI. Đang mở trang chi tiết của{' '}
                            <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                          </>
                        ) : (
                          <>
                            Thẩm định hoàn tất! Đang mở trang chi tiết của{' '}
                            <strong>{inspectSuccess.ungDung?.tenKhoChua}</strong>...
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {isInspecting && (
                    <div className="text-accent-forge text-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Đang kết nối GitHub và thẩm định gói cài đặt...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Danh sách ứng dụng tìm thấy */}
              {searchResult?.duLieu && searchResult.duLieu.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {searchResult.duLieu.map((app, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isFromGithub = Boolean(
                      app.chuaThamDinh || searchResult?.nguonKetQua === 'GITHUB',
                    );

                    return (
                      <div
                        key={app.maUngDung}
                        onClick={() => {
                          if (isFromGithub) {
                            handleInspectRepo(
                              app.duongDanGithub || `https://github.com/${app.tenRepoDayDu}`,
                            );
                          } else {
                            openAppDetail(app.tenRepoDayDu || app.maUngDung);
                            setSearchModalOpen(false);
                          }
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`btn-tactile p-3 rounded-xl flex items-center justify-between cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-surface-elevated border-accent-forge/40 shadow-xs'
                            : 'bg-surface-elevated/40 border-border/40 hover:border-border hover:bg-surface-elevated/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 overflow-hidden">
                            {app.duongDanIcon ? (
                              <img
                                src={app.duongDanIcon}
                                alt={app.tenKhoChua}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-primary font-bold text-sm font-display">
                                {app.tenKhoChua.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 truncate">
                              <h4 className="text-xs font-bold text-primary font-display truncate">
                                {app.tenKhoChua}
                              </h4>
                              {isFromGithub ? (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                                  Từ GitHub
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
                                  ? 'Mã nguồn mở GitHub • Nhấn để thẩm định và nạp vào Store'
                                  : `${app.danhMucChinh} • Cập nhật ${app.phienBanMoiNhat || 'mới'}`)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3 font-mono text-xs">
                          <span className="text-amber-400 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {app.soSaoGithub >= 1000
                              ? `${(app.soSaoGithub / 1000).toFixed(1)}k`
                              : app.soSaoGithub}
                          </span>
                          {app.diemUyTin !== undefined && app.diemUyTin !== null && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                app.diemUyTin >= 80
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : app.diemUyTin >= 60
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {app.diemUyTin}/100
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-muted" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !isSearching ? (
                /* Không tìm thấy kết quả */
                <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-muted">
                  <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-muted">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-secondary">
                    Không tìm thấy ứng dụng nào khớp với "<strong>{query}</strong>".
                  </p>
                  <p className="text-[11px] text-muted max-w-sm">
                    Ông có thể dán trực tiếp đường dẫn GitHub repo để hệ thống thẩm định và nạp cài
                    đặt ngay!
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            /* Trạng thái rỗng: Hướng dẫn tìm kiếm */
            <div className="py-8 flex flex-col items-center justify-center text-center gap-3 text-muted">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-accent-forge">
                <Search className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <p className="text-xs font-medium text-primary">
                  Tìm kiếm thông minh hoặc Nạp ứng dụng trực tiếp
                </p>
                <p className="text-[11px] text-secondary leading-relaxed">
                  Gõ <strong>tên ứng dụng</strong> (vd: <em>RustDesk</em>), mô tả ý định bằng{' '}
                  <strong>tiếng Việt</strong> (vd: <em>"quay màn hình nhẹ"</em>) hoặc{' '}
                  <strong>dán liên kết GitHub</strong> (Paste & Play).
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted mt-1">
                <span>Dùng</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border">
                  ↓
                </kbd>
                <span>để chọn</span>
                <span>•</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border">
                  ENTER
                </kbd>
                <span>để mở</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
