import React, { useId, useState } from 'react';
import { ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { giaiThichGiayPhep, LUU_Y_GIAY_PHEP } from './giai-thich-giay-phep.core';

interface GiaiThichGiayPhepProps {
  loaiGiayPhep?: string | null;
  duongDanGithub?: string | null;
  moMacDinh?: boolean;
}

interface LienKetThamKhao {
  nhan: string;
  url: string;
}

function layLienKetThamKhao(
  lienKetToanVan: string | null,
  duongDanGithub?: string | null,
): LienKetThamKhao | null {
  if (lienKetToanVan) {
    return { nhan: 'Xem toàn văn giấy phép', url: lienKetToanVan };
  }
  const duongDanSach = typeof duongDanGithub === 'string' ? duongDanGithub.trim() : '';
  if (/^https?:\/\/(?:www\.)?github\.com\/.+/i.test(duongDanSach)) {
    return { nhan: 'Xem giấy phép trên trang GitHub của dự án', url: duongDanSach };
  }
  return null;
}

// Dùng trình duyệt hệ thống giống XemMarkdown để liên kết không bị mở kẹt trong WebView.
async function moLienKetNgoai(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  try {
    await openUrl(url);
  } catch {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}

/** Khối gập mở giải thích giấy phép bằng tiếng Việt đời thường ngay trong trang chi tiết. */
export const GiaiThichGiayPhep: React.FC<GiaiThichGiayPhepProps> = ({
  loaiGiayPhep,
  duongDanGithub,
  moMacDinh = false,
}) => {
  const [dangMo, setDangMo] = useState(moMacDinh);
  const panelId = useId();
  const giaiThich = giaiThichGiayPhep(loaiGiayPhep);
  const lienKet = layLienKetThamKhao(giaiThich.lienKetToanVan, duongDanGithub);

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={dangMo}
        aria-controls={panelId}
        onClick={() => setDangMo((mo) => !mo)}
        className="btn-tactile inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-forge"
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Giấy phép này nghĩa là gì?</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            dangMo ? 'rotate-180' : ''
          }`}
        />
      </button>

      {dangMo && (
        <div
          id={panelId}
          className="mt-2 p-3.5 rounded-xl bg-surface/60 border border-border text-xs text-secondary flex flex-col gap-2.5 select-text"
        >
          <p className="font-semibold text-primary">{giaiThich.tenHienThi}</p>

          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-primary">Khi bạn dùng ứng dụng</p>
            <p className="leading-relaxed">{giaiThich.nguoiDung}</p>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-primary">Nếu bạn sửa hoặc chia sẻ lại</p>
            <p className="leading-relaxed">{giaiThich.neuSuaHoacChiaSe}</p>
          </div>

          <div className="border-t border-border/60 pt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">{LUU_Y_GIAY_PHEP}</p>
            {lienKet && (
              <a
                href={lienKet.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  void moLienKetNgoai(lienKet.url);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-forge-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-forge rounded"
              >
                <span>{lienKet.nhan}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
