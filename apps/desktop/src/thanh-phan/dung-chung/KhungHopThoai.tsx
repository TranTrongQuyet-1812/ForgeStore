import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface PhanTuCoCuon {
  style: {
    overflowY: string;
  };
}

/**
 * Khóa cuộn dọc trên các vùng cuộn nền (như thẻ <main> và <body>) khi mở hộp thoại,
 * và trả về hàm khôi phục nguyên trạng khi đóng hộp thoại.
 */
export function khoaCuonVungChinh(
  danhSachPhanTu: Array<PhanTuCoCuon | null | undefined>,
): () => void {
  const trangThaiCu = danhSachPhanTu
    .filter((pt): pt is PhanTuCoCuon => Boolean(pt))
    .map((pt) => {
      const cu = pt.style.overflowY;
      pt.style.overflowY = 'hidden';
      return { pt, cu };
    });

  return () => {
    for (const { pt, cu } of trangThaiCu) {
      pt.style.overflowY = cu;
    }
  };
}

export interface KhungHopThoaiProps {
  /** Hộp thoại đang mở hay không */
  dangMo: boolean;
  /** Hàm gọi khi bấm phím Escape hoặc bấm ra vùng nền đen bên ngoài */
  khiDong: () => void;
  /** Nội dung thẻ hộp thoại bên trong */
  children: React.ReactNode;
}

/**
 * Khung phủ hộp thoại toàn màn hình:
 * - Đưa hộp thoại ra document.body bằng Portal để không bị thẻ cha có transform/scroll cắt hoặc kéo trôi.
 * - Tự động khóa cuộn vùng <main> phía sau khi đang mở và khôi phục khi đóng.
 * - Hỗ trợ đóng bằng phím Escape hoặc bấm ra ngoài nền mờ.
 */
export const KhungHopThoai: React.FC<KhungHopThoaiProps> = ({ dangMo, khiDong, children }) => {
  const nenRef = useRef<HTMLDivElement>(null);
  const khiDongRef = useRef(khiDong);
  khiDongRef.current = khiDong;

  useEffect(() => {
    if (!dangMo || typeof document === 'undefined') return;

    const vungChinh = document.querySelector('main') as HTMLElement | null;
    const khoiPhucCuon = khoaCuonVungChinh([vungChinh, document.body]);

    const xuLyPhim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        khiDongRef.current();
      }
    };
    window.addEventListener('keydown', xuLyPhim);

    return () => {
      window.removeEventListener('keydown', xuLyPhim);
      khoiPhucCuon();
    };
  }, [dangMo]);

  if (!dangMo) return null;

  const noiDung = (
    <div
      ref={nenRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overscroll-contain select-none"
      onClick={(e) => {
        if (e.target === nenRef.current) {
          khiDong();
        }
      }}
    >
      {children}
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(noiDung, document.body);
  }

  return noiDung;
};
