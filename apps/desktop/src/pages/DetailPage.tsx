import React, { useState } from 'react';
import {
  ArrowLeft,
  Star,
  Heart,
  Download,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Check,
} from 'lucide-react';
import { TrustPill } from '../components/common/TrustPill';
import { useNavStore } from '../stores/useNavStore';

export const DetailPage: React.FC = () => {
  const { navigateTo } = useNavStore();
  const [isFavorited, setIsFavorited] = useState(false);
  const [installStatus, setInstallStatus] = useState<
    'idle' | 'downloading' | 'verifying' | 'installed'
  >('idle');
  const [progress, setProgress] = useState(0);

  // Giả lập tiến trình cài đặt đa trạng thái (P3-11 preview)
  const handleInstallClick = () => {
    if (installStatus === 'installed') {
      alert('Đang mở ứng dụng trên Windows!');
      return;
    }
    if (installStatus !== 'idle') return;

    setInstallStatus('downloading');
    let p = 0;
    const timer = setInterval(() => {
      p += 15;
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
    }, 250);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full select-none">
      {/* Nút quay lại */}
      <button
        onClick={() => navigateTo('explore')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary w-fit px-3 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại Khám phá</span>
      </button>

      {/* Header Thẻ App: Icon, Tên, Nút Cài đặt & Yêu thích */}
      <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-primary font-bold text-3xl font-display shadow-md">
            N
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold font-display text-primary">NewPipe</h1>
            <p className="text-xs text-muted">Bởi TeamNewPipe • Giấy phép GPL-3.0</p>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="flex items-center gap-1 text-amber-400 font-mono font-medium">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="font-tnum">32.5k sao</span>
              </span>
              <span>•</span>
              <span className="text-secondary font-mono">v0.27.0 (Mới nhất)</span>
            </div>
          </div>
        </div>

        {/* Nút hành động chính: Cài đặt đa trạng thái & Thả tim */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all ${
              isFavorited
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-surface-elevated border-border text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
            title={isFavorited ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
          >
            <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-500' : ''}`} />
          </button>

          <button
            onClick={handleInstallClick}
            disabled={installStatus === 'downloading' || installStatus === 'verifying'}
            className={`relative overflow-hidden h-11 px-6 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all duration-200 min-w-[170px] ${
              installStatus === 'installed'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : installStatus === 'verifying'
                  ? 'bg-amber-600 text-white cursor-wait'
                  : installStatus === 'downloading'
                    ? 'bg-surface-elevated text-primary cursor-wait border border-accent-forge/40'
                    : 'bg-accent-forge hover:bg-accent-forge-hover text-white shadow-orange-950/20'
            }`}
          >
            {/* Thanh tiến trình ngầm khi đang tải */}
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
                  <span>Xác minh SHA256...</span>
                </>
              ) : installStatus === 'installed' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Mở Ứng Dụng</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Cài Đặt 1-Click</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Khối Vũ Khí AI 1: Tóm Tắt Bản Địa Hóa (Gemini Flash) */}
      <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center gap-2 text-accent-ai text-sm font-semibold font-display">
          <Sparkles className="w-4 h-4" />
          <span>BỘ NÃO TRÍ TUỆ NHÂN TẠO (GEMINI EXECUTIVE SUMMARY)</span>
        </div>
        <blockquote className="text-base font-semibold text-primary italic pl-4 border-l-2 border-accent-ai">
          "Trình phát đa phương tiện tự do, tôn trọng quyền riêng tư và không quảng cáo."
        </blockquote>
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex items-start gap-2.5 text-xs text-secondary">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Nghe nhạc dưới nền và phát video dạng cửa sổ popup nổi bật trên màn hình.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-secondary">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Tải video và âm thanh với chất lượng tùy chọn lên tới độ phân giải 4K.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-secondary">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Hoạt động độc lập không phụ thuộc vào dịch vụ Google Play, bảo mật tối đa.</span>
          </div>
        </div>
      </div>

      {/* Khối Vũ Khí AI 2: Chỉ Số Uy Tín & An Toàn (Jev AI Trust Score) */}
      <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold font-display text-primary">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>CHỈ SỐ UY TÍN & BẢO VỆ (JEV AI TRUST SCORE)</span>
          </div>
          <TrustPill score={92} size="lg" showLabel />
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated/70 border border-border flex flex-col gap-2 text-xs">
          <div className="font-semibold text-primary">Chi tiết thẩm định rủi ro:</div>
          <ul className="flex flex-col gap-1.5 text-secondary pl-2">
            <li>
              • <strong>Điểm khởi đầu</strong>: 100/100
            </li>
            <li>
              • <strong>Trừ 5 điểm</strong>: Kho chứa chưa cập nhật bản phát hành trong 45 ngày qua.
            </li>
            <li>
              • <strong>Trừ 3 điểm</strong>: Số lượng lập trình viên đóng góp (contributors) dưới 5
              người.
            </li>
            <li className="text-accent-ai font-medium">
              • <strong>Jev Noul AI</strong>: Đã thẩm định quyền{' '}
              <code className="text-primary bg-surface px-1 py-0.5 rounded font-mono">
                SYSTEM_ALERT_WINDOW
              </code>{' '}
              hoàn toàn hợp lý với tính năng Popup Player (Độ tin cậy: 92%).
            </li>
          </ul>
        </div>
      </div>

      {/* Danh Sách Các Bản Phát Hành & Checksum SHA-256 */}
      <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display text-primary flex items-center gap-2">
            <FileCode className="w-4 h-4 text-muted" />
            <span>CÁC BẢN PHÁT HÀNH (RELEASES)</span>
          </h3>
          <span className="text-xs text-muted">1 bản phát hành tương thích</span>
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary font-mono">
                v0.27.0 (Mới nhất)
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                XÁC MINH SHA-256
              </span>
            </div>
            <div className="text-[11px] text-muted font-mono truncate max-w-md">
              File: NewPipe_v0.27.0.apk • Mã băm:
              e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
          </div>
          <span className="text-xs font-mono text-secondary shrink-0">12.4 MB</span>
        </div>
      </div>
    </div>
  );
};
