import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { isTauri } from '../../dich-vu/xac-thuc/luu-tru-token';
import { BANG_CONG_CU, canhBaoThieuCongCu } from '../../dich-vu/cong-cu-may/cong-cu-may.core';

interface CanhBaoThieuCongCuProps {
  trinhQuanLy?: string;
}

/**
 * Dòng cảnh báo nhẹ khi máy chưa có công cụ chạy dòng lệnh (P3B-31).
 * Không chặn nút sao chép hay mở Terminal. Kiểm lại khi cửa sổ lấy lại tiêu điểm.
 */
export const CanhBaoThieuCongCu: React.FC<CanhBaoThieuCongCuProps> = ({ trinhQuanLy }) => {
  const maTrinh = trinhQuanLy?.trim().toLowerCase();
  const coTheKiem = Boolean(maTrinh && BANG_CONG_CU[maTrinh] && isTauri());

  const [daChepGoiY, setDaChepGoiY] = useState(false);
  const boDemChepRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: ketQuaKiemTra } = useQuery({
    queryKey: ['kiem-tra-cong-cu', maTrinh],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<boolean | null>('kiem_tra_cong_cu_may', { trinhQuanLy: maTrinh });
    },
    enabled: coTheKiem,
    staleTime: 5 * 60 * 1000,
    // Đang thiếu thì kiểm lại mỗi khi cửa sổ ForgeStore lấy lại tiêu điểm
    refetchOnWindowFocus: (query) => (query.state.data === false ? 'always' : false),
    retry: false,
  });

  const canhBao = canhBaoThieuCongCu(maTrinh, ketQuaKiemTra);
  if (!canhBao) return null;

  const xuLySaoChepLenhGoiY = (lenh: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lenh).then(() => {
        setDaChepGoiY(true);
        if (boDemChepRef.current) clearTimeout(boDemChepRef.current);
        boDemChepRef.current = setTimeout(() => setDaChepGoiY(false), 2000);
      });
    }
  };

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

      <div className="flex items-center gap-3 flex-wrap pl-6">
        <a
          href={canhBao.lienKetChinhThuc}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-tactile text-accent-ai hover:underline text-xs font-mono inline-flex items-center gap-1 font-medium"
        >
          <span>Tải {canhBao.tenHienThi}</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {canhBao.lenhGoiY && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
            <span className="text-muted">Hoặc cài nhanh:</span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-border text-primary">
              <code>{canhBao.lenhGoiY}</code>
              <button
                type="button"
                onClick={() => xuLySaoChepLenhGoiY(canhBao.lenhGoiY!)}
                className="p-0.5 text-muted hover:text-primary transition-colors inline-flex items-center"
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
      </div>
    </div>
  );
};
