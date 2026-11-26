import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { isTauri } from '../../dich-vu/xac-thuc/luu-tru-token';
import {
  canhBaoThieuCongCu,
  chuanHoaMaCongCuKiemTra,
  type TrangThaiCongCuMay,
} from '../../dich-vu/cong-cu-may/cong-cu-may.core';
import { layLienKetHuongDanCli } from '../../dich-vu/huong-dan/huong-dan.core';
import { moLienKetNgoai } from '../../dich-vu/lien-ket/mo-lien-ket-ngoai';

interface CanhBaoThieuCongCuProps {
  trinhQuanLy?: string;
}

/**
 * Dòng cảnh báo nhẹ khi máy chưa có công cụ dòng lệnh hoặc Docker Desktop chưa chạy (P3B-31, P3B-45, P3B-45.3d).
 * Không chặn nút sao chép hay mở Terminal. Kiểm lại khi cửa sổ lấy lại tiêu điểm.
 */
export const CanhBaoThieuCongCu: React.FC<CanhBaoThieuCongCuProps> = ({ trinhQuanLy }) => {
  const maTrinh = chuanHoaMaCongCuKiemTra(trinhQuanLy);
  const coTheKiem = Boolean(maTrinh && isTauri());

  const [daChepGoiY, setDaChepGoiY] = useState(false);
  const boDemChepRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: ketQuaKiemTra,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['kiem-tra-cong-cu', maTrinh],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<TrangThaiCongCuMay | null>('kiem_tra_cong_cu_may', { trinhQuanLy: maTrinh });
    },
    enabled: coTheKiem,
    staleTime: 5 * 60 * 1000,
    // Đang thiếu, thiếu WSL hoặc chưa chạy thì kiểm lại mỗi khi cửa sổ ForgeStore lấy lại tiêu điểm
    refetchOnWindowFocus: (query) => {
      const duLieu = query.state.data as TrangThaiCongCuMay | boolean | null | undefined;
      return duLieu === 'CHUA_CAI' ||
        duLieu === 'CHUA_CHAY' ||
        duLieu === 'THIEU_WSL' ||
        duLieu === false
        ? 'always'
        : false;
    },
    retry: false,
  });

  const canhBao = canhBaoThieuCongCu(maTrinh, ketQuaKiemTra);
  if (!canhBao) return null;

  const lienKetHuongDan = layLienKetHuongDanCli(maTrinh);

  const xuLySaoChepLenhGoiY = (lenh: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lenh).then(() => {
        setDaChepGoiY(true);
        if (boDemChepRef.current) clearTimeout(boDemChepRef.current);
        boDemChepRef.current = setTimeout(() => setDaChepGoiY(false), 2000);
      });
    }
  };

  const xuLyMoLink = (url: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    void moLienKetNgoai(url);
  };

  const nutKiemTraLai = (
    <button
      type="button"
      onClick={() => void refetch()}
      disabled={isFetching}
      className="btn-tactile px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-elevated border border-warning/40 text-warning font-semibold text-xs font-mono inline-flex items-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-wait"
    >
      <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
      <span>{isFetching ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
    </button>
  );

  return (
    <div
      role="status"
      className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs flex flex-col gap-2.5 text-secondary"
    >
      <div className="flex items-start gap-2 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="text-primary font-medium">{canhBao.thongDiep}</span>
        </div>
      </div>

      {canhBao.trangThai === 'CHUA_CAI' ? (
        <div className="flex items-center gap-3 flex-wrap pl-6">
          {canhBao.lienKetChinhThuc && (
            <a
              href={canhBao.lienKetChinhThuc}
              target="_blank"
              rel="noopener noreferrer"
              onClick={xuLyMoLink(canhBao.lienKetChinhThuc)}
              className="btn-tactile text-warning font-semibold underline decoration-warning/60 underline-offset-2 hover:opacity-85 text-xs font-mono inline-flex items-center gap-1"
            >
              <span>Tải {canhBao.tenHienThi}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {canhBao.lenhGoiY && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono max-w-full">
              <span className="text-muted">{canhBao.nhanLenhGoiY ?? 'Hoặc cài nhanh:'}</span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-border text-primary max-w-full">
                <code className="break-all">{canhBao.lenhGoiY}</code>
                <button
                  type="button"
                  onClick={() => xuLySaoChepLenhGoiY(canhBao.lenhGoiY!)}
                  className="p-0.5 text-muted hover:text-primary transition-colors inline-flex items-center shrink-0"
                  title="Sao chép lệnh gợi ý"
                >
                  {daChepGoiY ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {nutKiemTraLai}

          <a
            href={lienKetHuongDan}
            target="_blank"
            rel="noopener noreferrer"
            onClick={xuLyMoLink(lienKetHuongDan)}
            className="btn-tactile text-warning font-semibold underline decoration-warning/60 underline-offset-2 hover:opacity-85 text-xs font-mono inline-flex items-center gap-1"
          >
            <span>Xem hướng dẫn</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : canhBao.trangThai === 'THIEU_WSL' ? (
        <div className="flex items-center gap-3 flex-wrap pl-6">
          {canhBao.lenhGoiY && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono max-w-full">
              <span className="text-muted">Chạy bằng PowerShell (Quản trị viên):</span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-border text-primary max-w-full">
                <code className="break-all">{canhBao.lenhGoiY}</code>
                <button
                  type="button"
                  onClick={() => xuLySaoChepLenhGoiY(canhBao.lenhGoiY!)}
                  className="p-0.5 text-muted hover:text-primary transition-colors inline-flex items-center shrink-0"
                  title="Sao chép lệnh cài WSL"
                >
                  {daChepGoiY ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {nutKiemTraLai}

          <a
            href={lienKetHuongDan}
            target="_blank"
            rel="noopener noreferrer"
            onClick={xuLyMoLink(lienKetHuongDan)}
            className="btn-tactile text-warning font-semibold underline decoration-warning/60 underline-offset-2 hover:opacity-85 text-xs font-mono inline-flex items-center gap-1"
          >
            <span>Xem hướng dẫn Docker &amp; WSL</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap pl-6">
          {nutKiemTraLai}

          <a
            href={lienKetHuongDan}
            target="_blank"
            rel="noopener noreferrer"
            onClick={xuLyMoLink(lienKetHuongDan)}
            className="btn-tactile text-warning font-semibold underline decoration-warning/60 underline-offset-2 hover:opacity-85 text-xs font-mono inline-flex items-center gap-1"
          >
            <span>Xem hướng dẫn Docker</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
