import React from 'react';
import { Star, Download } from 'lucide-react';
import { TrustPill } from './TrustPill';
import { useNavStore } from '../../stores/useNavStore';

export interface AppCardData {
  id: string;
  tenApp: string;
  tacGia: string;
  moTaNgan: string;
  iconUrl?: string | null;
  soSaoGithub: number;
  phienBanMoiNhat?: string;
  diemUyTin: number;
  danhMucChinh: string;
}

interface AppCardProps {
  app: AppCardData;
}

export const AppCard: React.FC<AppCardProps> = ({ app }) => {
  const { openAppDetail } = useNavStore();

  // Định dạng số sao (VD: 32.5k)
  const formatStars = (stars: number) => {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
    return stars.toString();
  };

  return (
    <div
      onClick={() => openAppDetail(app.id)}
      className="group relative flex flex-col justify-between p-4 rounded-xl bg-surface border border-border hover:border-border-focus hover:bg-surface-hover hover:shadow-lg hover:shadow-black/20 transition-all duration-200 cursor-pointer min-h-[170px]"
    >
      <div>
        {/* Phần đầu: Icon, Tên, Tác giả, Sao */}
        <div className="flex items-start gap-3">
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
            <h3 className="text-sm font-semibold font-display text-primary truncate group-hover:text-accent-forge transition-colors">
              {app.tenApp}
            </h3>
            <p className="text-xs text-muted truncate">bởi {app.tacGia}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-secondary">
              <span className="flex items-center gap-0.5 text-amber-400 font-mono font-medium">
                <Star className="w-3 h-3 fill-amber-400" />
                <span className="font-tnum">{formatStars(app.soSaoGithub)}</span>
              </span>
              <span>•</span>
              <span className="px-1.5 py-0.2 rounded bg-surface-elevated text-[10px] text-muted font-medium">
                {app.danhMucChinh}
              </span>
            </div>
          </div>
        </div>

        {/* Phần mô tả ngắn / slogan */}
        <p className="text-xs text-secondary mt-3 line-clamp-2 leading-relaxed">{app.moTaNgan}</p>
      </div>

      {/* Phần chân Card: Trust Pill và Nút hành động */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50">
        <TrustPill score={app.diemUyTin} size="sm" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            openAppDetail(app.id);
          }}
          className="h-7 px-3 rounded-lg bg-surface-elevated group-hover:bg-accent-forge group-hover:text-white text-secondary hover:text-white border border-border group-hover:border-accent-forge text-xs font-medium flex items-center gap-1.5 transition-all duration-150"
        >
          <Download className="w-3 h-3" />
          <span>Cài đặt</span>
        </button>
      </div>
    </div>
  );
};
