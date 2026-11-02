import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { taoDanhSachSoTrang, tinhKhoangDangXem } from './phan-trang.core';

interface ThanhPhanTrangProps {
  trangHienTai: number;
  tongSoTrang: number;
  tongSo: number;
  kichThuocTrang: number;
  dangTai?: boolean;
  onChuyenTrang: (trang: number) => void;
}

const LOP_NUT =
  'btn-tactile h-9 min-w-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border outline-none focus-visible:ring-2 focus-visible:ring-accent-forge disabled:opacity-50 disabled:cursor-not-allowed';

/** Thanh chuyển trang dưới danh sách: Trước, các số trang, Sau và dòng "Đang xem 31–60 trên 809". */
export const ThanhPhanTrang: React.FC<ThanhPhanTrangProps> = ({
  trangHienTai,
  tongSoTrang,
  tongSo,
  kichThuocTrang,
  dangTai = false,
  onChuyenTrang,
}) => {
  const { tu, den } = tinhKhoangDangXem(trangHienTai, kichThuocTrang, tongSo);
  const soTrang = taoDanhSachSoTrang(trangHienTai, tongSoTrang);

  return (
    <nav
      aria-label="Chuyển trang danh sách ứng dụng"
      className="flex flex-col items-center gap-3 py-3"
    >
      <p className="text-xs text-muted" aria-live="polite">
        Đang xem {tu}–{den} trên {tongSo} ứng dụng
      </p>

      {tongSoTrang > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onChuyenTrang(trangHienTai - 1)}
            disabled={dangTai || trangHienTai <= 1}
            className={`${LOP_NUT} bg-surface-elevated hover:bg-surface-hover text-primary border-border`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Trước
          </button>

          {soTrang.map((so, viTri) =>
            so === null ? (
              <span key={`cach-${viTri}`} className="px-1 text-xs text-muted" aria-hidden="true">
                ...
              </span>
            ) : (
              <button
                key={so}
                type="button"
                onClick={() => onChuyenTrang(so)}
                disabled={dangTai}
                aria-label={`Trang ${so}`}
                aria-current={so === trangHienTai ? 'page' : undefined}
                className={`${LOP_NUT} ${
                  so === trangHienTai
                    ? 'bg-accent-forge text-on-accent border-accent-forge'
                    : 'bg-surface-elevated hover:bg-surface-hover text-primary border-border'
                }`}
              >
                {so}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onChuyenTrang(trangHienTai + 1)}
            disabled={dangTai || trangHienTai >= tongSoTrang}
            className={`${LOP_NUT} bg-surface-elevated hover:bg-surface-hover text-primary border-border`}
          >
            Sau
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
};
