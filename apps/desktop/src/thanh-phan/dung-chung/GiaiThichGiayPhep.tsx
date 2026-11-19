import React, { useId, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { giaiThichGiayPhep, LUU_Y_GIAY_PHEP } from './giai-thich-giay-phep.core';

interface GiaiThichGiayPhepProps {
  loaiGiayPhep?: string | null;
  moMacDinh?: boolean;
}

/** Khối gập mở giải thích giấy phép bằng tiếng Việt đời thường ngay trong trang chi tiết. */
export const GiaiThichGiayPhep: React.FC<GiaiThichGiayPhepProps> = ({
  loaiGiayPhep,
  moMacDinh = false,
}) => {
  const [dangMo, setDangMo] = useState(moMacDinh);
  const panelId = useId();
  const giaiThich = giaiThichGiayPhep(loaiGiayPhep);

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

          <p className="text-[11px] text-muted border-t border-border/60 pt-2">{LUU_Y_GIAY_PHEP}</p>
        </div>
      )}
    </div>
  );
};
