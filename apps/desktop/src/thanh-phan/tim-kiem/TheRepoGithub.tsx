import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Star } from 'lucide-react';
import type { UngDungTomTatDto } from '@forgestore/types';
import { NhanLuuTru } from '../dung-chung/NhanLuuTru';
import { thuNhoAnhDaiDien } from '../dung-chung/anh-dai-dien.core';
import { layDuongDanKiemDinhRepo } from './tien-ich-tim-kiem';

export interface TheRepoGithubProps {
  repo: UngDungTomTatDto;
  dangKiemDinh?: boolean;
  voHieuHoa?: boolean;
  thanhCong?: boolean;
  loiKiemDinh?: string | null;
  staggerIndex?: number;
  onKiemDinh: (duongDan: string) => void;
}

function dinhDangSoSao(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return stars.toString();
}

/** Chặn kích hoạt trùng khi đang kiểm định thẻ khác hoặc đã chuẩn bị mở trang chi tiết. */
export function kichHoatKiemDinhThe(
  repo: Pick<UngDungTomTatDto, 'duongDanGithub' | 'tenRepoDayDu'>,
  voHieuHoa: boolean,
  onKiemDinh: (duongDan: string) => void,
): void {
  if (voHieuHoa) return;
  const duongDan = layDuongDanKiemDinhRepo(repo);
  if (duongDan) {
    onKiemDinh(duongDan);
  }
}

const TheRepoGithubGoc: React.FC<TheRepoGithubProps> = ({
  repo,
  dangKiemDinh = false,
  voHieuHoa = false,
  thanhCong = false,
  loiKiemDinh = null,
  staggerIndex,
  onKiemDinh,
}) => {
  const biKhoa = voHieuHoa || dangKiemDinh || thanhCong;
  const staggerClass =
    staggerIndex !== undefined && staggerIndex < 6
      ? `stagger-item stagger-${staggerIndex + 1}`
      : '';

  const xuLyChon = () => kichHoatKiemDinhThe(repo, biKhoa, onKiemDinh);

  return (
    <div
      role="article"
      tabIndex={0}
      data-ascii="surface"
      aria-label={`Kho GitHub ${repo.tenRepoDayDu}`}
      onClick={xuLyChon}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          xuLyChon();
        }
      }}
      className={`tactile-card group relative flex flex-col justify-between p-4 rounded-xl cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-accent-forge outline-none ${staggerClass}`}
    >
      <div>
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-200">
            {repo.duongDanIcon ? (
              <img
                src={thuNhoAnhDaiDien(repo.duongDanIcon, 96)}
                alt={repo.tenKhoChua}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-primary font-bold text-lg font-display">
                {repo.tenKhoChua.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold font-display text-primary truncate group-hover:text-accent-forge-text transition-colors">
                {repo.tenKhoChua}
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent-ai/20 text-accent-ai font-semibold border border-accent-ai/30 shrink-0">
                GitHub
              </span>
            </div>

            <p className="text-xs font-mono text-muted truncate mt-0.5">{repo.tenRepoDayDu}</p>

            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="flex items-center gap-1 text-secondary font-mono">
                <Star className="w-3 h-3 text-muted" />
                <span className="font-tnum">{dinhDangSoSao(repo.soSaoGithub)}</span>
              </span>
              <NhanLuuTru daLuuTru={repo.daLuuTru} />
            </div>
          </div>
        </div>

        <p className="text-xs text-secondary mt-3 line-clamp-2 leading-relaxed font-normal">
          {repo.moTaGocTiengAnh || 'Kho mã nguồn mở trên GitHub.'}
        </p>

        {loiKiemDinh && (
          <div className="mt-2.5 p-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-[11px] flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{loiKiemDinh}</span>
          </div>
        )}

        {thanhCong && (
          <div className="mt-2.5 p-2 rounded-lg bg-success/10 border border-success/30 text-success text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Đang mở trang chi tiết...</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end pt-3 mt-3 border-t border-border/40">
        <button
          type="button"
          disabled={biKhoa}
          onClick={(e) => {
            e.stopPropagation();
            xuLyChon();
          }}
          className="btn-tactile h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent-forge bg-surface-elevated group-hover:bg-accent-forge text-secondary group-hover:text-on-accent border border-border group-hover:border-accent-forge disabled:opacity-70 disabled:cursor-wait"
        >
          {dangKiemDinh ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang kiểm tra...</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm vào ForgeStore</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export const TheRepoGithub = React.memo(TheRepoGithubGoc);
