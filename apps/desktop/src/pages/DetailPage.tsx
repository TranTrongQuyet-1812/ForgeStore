import React, { useState } from 'react';
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
} from 'lucide-react';
import { TrustPill } from '../components/common/TrustPill';
import { useNavStore } from '../stores/useNavStore';

export const DetailPage: React.FC = () => {
  const { navigateTo } = useNavStore();
  const [isFavorited, setIsFavorited] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'exe' | 'msi' | 'zip'>('exe');
  const [installStatus, setInstallStatus] = useState<
    'idle' | 'downloading' | 'verifying' | 'installed'
  >('idle');
  const [progress, setProgress] = useState(0);
  const [copiedSha, setCopiedSha] = useState(false);

  const sha256Hash = 'a4b8c912e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b';

  const handleCopySha = () => {
    navigator.clipboard.writeText(sha256Hash);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleInstallClick = () => {
    if (installStatus === 'installed') {
      alert('Đang khởi chạy RustDesk trên Windows!');
      return;
    }
    if (installStatus !== 'idle') return;

    setInstallStatus('downloading');
    let p = 0;
    const timer = setInterval(() => {
      p += 12;
      if (p >= 100) {
        clearInterval(timer);
        setProgress(100);
        setInstallStatus('verifying');
        setTimeout(() => {
          setInstallStatus('installed');
        }, 1200);
      } else {
        setProgress(p);
      }
    }, 200);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none">
      {/* 1. Breadcrumb & Nút quay lại */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <button
          onClick={() => navigateTo('explore')}
          className="flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Khám phá</span>
        </button>
        <span>/</span>
        <span>Tiện ích hệ thống</span>
        <span>/</span>
        <span className="text-primary font-medium">RustDesk</span>
      </div>

      {/* 2. PRO SPLIT-VIEW DASHBOARD (Cột chính 68% + Cột hành động 32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* === CỘT CHÍNH (68% - 8 CỘT TRÊN LG) === */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Header Thông Tin Ứng Dụng */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-bold text-3xl font-display text-white shadow-xl shadow-orange-950/40 shrink-0">
              R
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display text-primary">RustDesk</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" />
                  Verified FOSS
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted font-mono">
                <span>rustdesk/rustdesk</span>
                <span>•</span>
                <span className="text-amber-400 flex items-center gap-0.5 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  78.4k sao
                </span>
                <span>•</span>
                <span>GPL-3.0</span>
              </div>

              <p className="text-xs text-secondary mt-3 leading-relaxed">
                Phần mềm điều khiển máy tính từ xa mã nguồn mở an toàn hàng đầu thế giới, giải pháp
                thay thế hoàn hảo cho TeamViewer và AnyDesk.
              </p>
            </div>
          </div>

          {/* Khối AI 1: Gemini Executive Summary (Bản Địa Hóa Tiếng Việt) */}
          <div className="tactile-card p-6 rounded-2xl border-l-4 border-l-accent-ai flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent-ai text-xs font-bold font-display uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>BỘ NÃO AI • TÓM TẮT ĐIỀU HÀNH (GEMINI FLASH)</span>
              </div>
              <span className="text-[11px] font-mono text-muted">
                Bản quyền phân tích ForgeStore AI
              </span>
            </div>

            <blockquote className="text-base font-semibold text-primary italic pl-3 border-l-2 border-accent-ai/40">
              "Giải pháp truy cập từ xa mã hóa đầu cuối NaCl, cho phép tự dựng server riêng để kiểm
              soát 100% dữ liệu."
            </blockquote>

            {/* 3 Thẻ tính năng cốt lõi có icon chuyên biệt */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-primary font-display">Tự Dựng Server</h4>
                <p className="text-[11px] text-secondary leading-relaxed">
                  Thiết lập máy chủ Relay riêng biệt hoàn toàn mà không phải gửi dữ liệu qua cloud
                  trung gian.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-primary font-display">Hiệu Suất Rust</h4>
                <p className="text-[11px] text-secondary leading-relaxed">
                  Xây dựng 100% trên nền tảng Rust, độ trễ sub-30ms, tiêu thụ cực ít tài nguyên CPU
                  và RAM.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-primary font-display">Mã Hóa NaCl</h4>
                <p className="text-[11px] text-secondary leading-relaxed">
                  Giao tiếp P2P trực tiếp giữa hai máy tính được mã hóa bảo mật chuẩn mật mã học cao
                  cấp.
                </p>
              </div>
            </div>
          </div>

          {/* Bảng Các Tệp Cài Đặt & Checksum SHA-256 */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold font-display text-primary flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-accent-forge" />
                  <span>BẢN PHÁT HÀNH v1.3.8 (MỚI NHẤT)</span>
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5">
                  Phát hành: 18/09/2026 • 3 tệp cài đặt Windows
                </p>
              </div>
              <a
                href="https://github.com/rustdesk/rustdesk/releases"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-accent-ai hover:underline flex items-center gap-1"
              >
                <span>GitHub Releases</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-primary">
                    <span>rustdesk-1.3.8-x86_64.exe</span>
                    <span className="px-1.5 py-0.2 rounded bg-accent-forge/15 text-accent-forge text-[10px]">
                      KHUYÊN DÙNG
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted font-mono truncate">
                    <span>
                      SHA-256: {sha256Hash.substring(0, 16)}...
                      {sha256Hash.substring(sha256Hash.length - 8)}
                    </span>
                    <button
                      onClick={handleCopySha}
                      title="Sao chép toàn bộ mã băm SHA-256"
                      className="text-accent-ai hover:text-primary flex items-center gap-1 btn-tactile"
                    >
                      {copiedSha ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span
                        className={`text-[10px] transition-colors ${copiedSha ? 'text-emerald-400 font-semibold' : ''}`}
                      >
                        {copiedSha ? 'Đã chép SHA-256' : 'Chép mã'}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-secondary">18.2 MB</span>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">x86_64</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-primary">
                    <span>rustdesk-1.3.8-x86_64.msi</span>
                  </div>
                  <span className="text-[11px] text-muted font-mono truncate">
                    Bộ cài đặt MSI cho quản trị viên hệ thống
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-secondary">19.5 MB</span>
                  <span className="text-xs font-mono text-muted">MSI</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === CỘT PHỤ (32% - 4 CỘT TRÊN LG, STICKY SIDEBAR) === */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-4">
          {/* Card Hành Động Cài Đặt Nổi Bật */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-5 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted uppercase">Tùy chọn tải về</span>
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                  isFavorited
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    : 'bg-surface-elevated border-border text-muted hover:text-primary'
                }`}
                title={isFavorited ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500' : ''}`} />
              </button>
            </div>

            {/* Bộ chọn định dạng tệp */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-elevated border border-border text-xs font-mono font-medium">
              {(['exe', 'msi', 'zip'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`py-1.5 rounded-lg uppercase transition-all ${
                    selectedFormat === fmt
                      ? 'bg-accent-forge text-white shadow-sm font-bold'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>

            {/* Nút Cài Đặt Đa Trạng Thái */}
            <button
              onClick={handleInstallClick}
              disabled={installStatus === 'downloading' || installStatus === 'verifying'}
              className={`relative overflow-hidden w-full h-12 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 active:scale-98 ${
                installStatus === 'installed'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/30'
                  : installStatus === 'verifying'
                    ? 'bg-amber-600 text-white cursor-wait'
                    : installStatus === 'downloading'
                      ? 'bg-surface-elevated text-primary border border-accent-forge/50 cursor-wait'
                      : 'bg-accent-forge hover:bg-accent-forge-hover text-white shadow-orange-950/40'
              }`}
            >
              {installStatus === 'downloading' && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-accent-forge/30 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              )}

              <div className="relative z-10 flex items-center gap-2 font-mono">
                {installStatus === 'downloading' ? (
                  <>
                    <Download className="w-4 h-4 animate-bounce text-accent-forge" />
                    <span className="font-tnum">Đang tải {progress}%</span>
                  </>
                ) : installStatus === 'verifying' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 animate-pulse text-amber-300" />
                    <span>Xác minh SHA-256...</span>
                  </>
                ) : installStatus === 'installed' ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Mở Ứng Dụng</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      Cài Đặt 1-Click (
                      {selectedFormat === 'exe'
                        ? '18.2 MB'
                        : selectedFormat === 'msi'
                          ? '19.5 MB'
                          : '17.8 MB'}
                      )
                    </span>
                  </>
                )}
              </div>
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đã kiểm định mã độc & tính toàn vẹn SHA-256</span>
            </div>
          </div>

          {/* Jev AI Trust Score Gauge & Thẩm Định Chi Tiết */}
          <div className="tactile-card p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-display text-primary uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>CHỈ SỐ BẢO VỆ JEV AI</span>
              </span>
              <TrustPill score={95} size="sm" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono text-emerald-400 font-tnum">95</span>
              <span className="text-sm font-mono text-muted">/ 100</span>
              <span className="ml-auto text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                AN TOÀN CAO
              </span>
            </div>

            <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '95%' }}></div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/40 text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Kho chứa có hơn 120 contributors uy tín</span>
              </div>
              <div className="flex items-center gap-2 text-secondary">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Bản phát hành cập nhật liên tục (active)</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <span className="text-[11px] font-mono text-amber-400">-5đ</span>
                <span>Yêu cầu quyền mạng UDP listening cho P2P</span>
              </div>
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
                <span className="text-primary font-bold">Rust (94.2%)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Forks:</span>
                <span className="text-primary">9.1k</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Bản phát hành:</span>
                <span className="text-primary">48 releases</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Cập nhật mới nhất:</span>
                <span className="text-emerald-400">3 ngày trước</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
