import React, { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTuCapNhatStore } from '../../kho-trang-thai/useTuCapNhatStore';
import { caiBanMoi, layPhienBanHienTai } from '../../dich-vu/tu-cap-nhat/tu-cap-nhat.service';

/**
 * Ô ở chân thanh bên (D-37). Bình thường chỉ ghi số phiên bản đang dùng; có bản mới thì đổi thành nút cam
 * "Có bản cập nhật", bấm vào là cập nhật luôn. Dùng token màu của app nên đúng cả nền sáng và nền tối.
 */
export const ChiBaPhienBan: React.FC = () => {
  const [phienBanApp, setPhienBanApp] = useState<string | null>(null);
  const { banMoi, dangTai, tienDo } = useTuCapNhatStore();

  useEffect(() => {
    void layPhienBanHienTai().then(setPhienBanApp);
  }, []);

  if (!banMoi) {
    return (
      <div className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-[11px] font-mono text-muted">
        <span className="text-secondary font-medium">
          {phienBanApp ? `v${phienBanApp} • FOSS` : 'FOSS'}
        </span>
        <span className="text-[10px] text-muted font-medium">Desktop</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void caiBanMoi()}
      disabled={dangTai}
      aria-label={
        dangTai ? 'Đang cập nhật ForgeStore' : `Cập nhật ForgeStore lên bản ${banMoi.version}`
      }
      className={`btn-tactile w-full relative overflow-hidden px-3 py-2.5 rounded-xl bg-accent-forge hover:bg-accent-forge-hover text-on-accent shadow-sm flex items-center justify-between gap-2 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-forge disabled:cursor-wait ${dangTai ? '' : 'chi-bao-cap-nhat'}`}
    >
      <span className="chi-bao-cap-nhat-chu flex items-center gap-1.5 min-w-0">
        {dangTai ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" strokeWidth={2.5} />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        )}
        <span className="truncate">
          {dangTai ? `Đang cập nhật${tienDo === null ? '...' : ` ${tienDo}%`}` : 'Có bản cập nhật'}
        </span>
      </span>
      <span className="chi-bao-cap-nhat-chu font-mono text-[10px] font-medium opacity-80 shrink-0">
        v{banMoi.version}
      </span>

      {dangTai && (
        <span
          aria-hidden="true"
          className="absolute left-0 bottom-0 h-[3px] bg-on-accent opacity-40 transition-[width] duration-200"
          style={{ width: `${tienDo ?? 8}%` }}
        />
      )}
    </button>
  );
};
