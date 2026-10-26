import React from 'react';
import { Star, Download, Check, Loader2 } from 'lucide-react';
import { TrustPill } from './NhanTinCay';
import { useNavStore } from '../../kho-trang-thai/useDieuHuongStore';
import { useDeviceInstalledApps } from '../../hooks/useDeviceInstalledApps';

export interface AppCardData {
  id: string;
  tenApp: string;
  repoHandle?: string; // ví dụ: rustdesk/rustdesk
  tacGia: string;
  moTaNgan: string;
  iconUrl?: string | null;
  soSaoGithub: number;
  starDelta?: string; // ví dụ: +1.2k tuần này
  phienBanMoiNhat?: string;
  kichThuocFile?: string; // ví dụ: 18.2 MB
  dinhDangFile?: string[]; // ví dụ: ['EXE', 'MSI']
  kienTruc?: string[]; // ví dụ: ['x64', 'ARM64']
  diemUyTin?: number | null;
  danhMucChinh: string;
  giayPhep?: string; // ví dụ: GPL-3.0, MIT
  isVerifiedFoss?: boolean;
}

interface AppCardProps {
  app: AppCardData;
  staggerIndex?: number;
}

export const AppCard: React.FC<AppCardProps> = ({ app, staggerIndex }) => {
  const { openAppDetail } = useNavStore();
  const { layTrangThaiCaiDat } = useDeviceInstalledApps();
  const trangThaiCaiDat = layTrangThaiCaiDat(app.id, app.repoHandle);

  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  const staggerClass =
    staggerIndex !== undefined && staggerIndex < 6
      ? `stagger-item stagger-${staggerIndex + 1}`
      : '';

  return (
    <div
      role="article"
      tabIndex={0}
      aria-label={`Ứng dụng ${app.tenApp}`}
      onClick={() => openAppDetail(app.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAppDetail(app.id);
        }
      }}
      className={`tactile-card group relative flex flex-col justify-between p-4 rounded-xl cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-accent-forge outline-none ${staggerClass}`}
    >
      <div>
        {/* Phần đầu: Icon, Tên, Repo Handle, Giấy phép, Sao */}
        <div className="flex items-start gap-3.5">
          {/* App Icon với bóng đổ tinh tế */}
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-200">
            {app.iconUrl ? (
              <img src={app.iconUrl} alt={app.tenApp} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-primary font-bold text-lg font-display">
                {app.tenApp.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold font-display text-primary truncate group-hover:text-accent-forge transition-colors">
                {app.tenApp}
              </h3>
              {app.isVerifiedFoss && (
                <span title="Xác minh mã nguồn mở minh bạch" className="text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              )}
            </div>

            <p className="text-[11px] font-mono text-muted truncate">
              {app.repoHandle || app.tacGia}
            </p>

            <div className="flex items-center gap-2 mt-1 text-[11px]">
              <span className="flex items-center gap-1 text-amber-400 font-mono font-semibold">
                <Star className="w-3 h-3 fill-amber-400" />
                <span className="font-tnum">{formatStars(app.soSaoGithub)}</span>
              </span>
              {app.giayPhep && (
                <>
                  <span className="text-muted">•</span>
                  <span className="text-muted text-[10px] font-mono uppercase bg-surface-elevated px-1.5 py-0.2 rounded border border-border/50">
                    {app.giayPhep}
                  </span>
                </>
              )}
              {app.phienBanMoiNhat && (
                <>
                  <span className="text-muted">•</span>
                  <span className="text-[10px] text-muted font-mono">{app.phienBanMoiNhat}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mô tả ứng dụng */}
        <p className="text-xs text-secondary mt-3 line-clamp-2 leading-relaxed font-normal">
          {app.moTaNgan}
        </p>

        {/* Chips định dạng và kiến trúc tệp */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {(app.dinhDangFile ?? []).map((ext) => (
            <span
              key={ext}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-elevated text-secondary border border-border/60"
            >
              .{ext.toLowerCase()}
            </span>
          ))}
          {(app.kienTruc ?? []).map((arch) => (
            <span
              key={arch}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono text-muted bg-surface-elevated/50 border border-border/40"
            >
              {arch}
            </span>
          ))}
          {app.kichThuocFile && (
            <span className="ml-auto text-[10px] font-mono text-muted">{app.kichThuocFile}</span>
          )}
        </div>
      </div>

      {/* Chân card: Trust Pill & Nút Cài đặt / Đã cài (L-02) */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
        <TrustPill score={app.diemUyTin} size="sm" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            openAppDetail(app.id);
          }}
          className={`h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 shadow-sm outline-none focus-visible:ring-2 ${
            trangThaiCaiDat.trangThai === 'DA_CAI_DAT'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 focus-visible:ring-emerald-400'
              : trangThaiCaiDat.trangThai === 'DANG_TAI' ||
                  trangThaiCaiDat.trangThai === 'XAC_MINH' ||
                  trangThaiCaiDat.trangThai === 'DANG_CAI_DAT'
                ? 'bg-accent-forge/20 text-accent-forge border border-accent-forge/40 focus-visible:ring-accent-forge'
                : 'bg-surface-elevated group-hover:bg-accent-forge text-secondary group-hover:text-white border border-border group-hover:border-accent-forge focus-visible:ring-accent-forge'
          }`}
          title={
            trangThaiCaiDat.trangThai === 'DA_CAI_DAT'
              ? 'Ứng dụng đã được cài đặt trên máy này'
              : 'Xem chi tiết và cài đặt'
          }
        >
          {trangThaiCaiDat.trangThai === 'DA_CAI_DAT' ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{trangThaiCaiDat.label}</span>
            </>
          ) : trangThaiCaiDat.trangThai === 'DANG_TAI' ||
            trangThaiCaiDat.trangThai === 'XAC_MINH' ||
            trangThaiCaiDat.trangThai === 'DANG_CAI_DAT' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{trangThaiCaiDat.label}</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>{trangThaiCaiDat.label}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
