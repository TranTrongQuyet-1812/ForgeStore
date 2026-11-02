import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TheUngDung, type AppCardData } from './TheUngDung';
import { chiaThanhHang, laySoCot } from './luoi-ao.core';

// Chiều cao ước tính một hàng thẻ trước khi đo thật (thẻ có hàng chip nên cao thấp khác nhau chút)
const CHIEU_CAO_HANG_UOC_TINH = 300;
// Khoảng cách giữa các hàng, bằng gap-5 của lưới thường
const KHOANG_CACH_HANG = 20;

/** Tìm khung cuộn gần nhất bao ngoài (vùng nội dung chính của ứng dụng). */
function timVungCuon(phanTu: HTMLElement | null): HTMLElement | null {
  let cha = phanTu?.parentElement ?? null;

  while (cha) {
    const kieuCuon = getComputedStyle(cha).overflowY;
    if (kieuCuon === 'auto' || kieuCuon === 'scroll') return cha;
    cha = cha.parentElement;
  }

  return null;
}

function useSoCot(): number {
  const [soCot, setSoCot] = useState(() => laySoCot(window.innerWidth));

  useEffect(() => {
    const capNhat = () => setSoCot(laySoCot(window.innerWidth));
    window.addEventListener('resize', capNhat);
    return () => window.removeEventListener('resize', capNhat);
  }, []);

  return soCot;
}

interface LuoiAoUngDungProps {
  apps: AppCardData[];
}

/**
 * Lưới thẻ "ảo": dù đã tải mấy trăm ứng dụng, trên màn hình chỉ có vài hàng thẻ thật (cộng vài hàng đệm).
 * Hàng ra khỏi tầm nhìn bị gỡ khỏi DOM nên cuộn sâu mấy cũng không nặng thêm.
 */
export const LuoiAoUngDung: React.FC<LuoiAoUngDungProps> = ({ apps }) => {
  const khungRef = useRef<HTMLDivElement>(null);
  const [vungCuon, setVungCuon] = useState<HTMLElement | null>(null);
  const [leTren, setLeTren] = useState(0);
  const soCot = useSoCot();
  const cacHang = useMemo(() => chiaThanhHang(apps, soCot), [apps, soCot]);

  // Khoảng cách từ đầu vùng cuộn tới đầu lưới (phía trên còn banner, bộ lọc, 30 thẻ đầu) để tính vị trí hàng đúng
  useLayoutEffect(() => {
    const khung = khungRef.current;
    const cuon = timVungCuon(khung);
    setVungCuon(cuon);
    if (!khung || !cuon) return;

    const tinhLeTren = () =>
      setLeTren(
        khung.getBoundingClientRect().top - cuon.getBoundingClientRect().top + cuon.scrollTop,
      );
    tinhLeTren();

    if (typeof ResizeObserver === 'undefined') return;
    const quanSat = new ResizeObserver(tinhLeTren);
    quanSat.observe(cuon);
    if (khung.parentElement) quanSat.observe(khung.parentElement);
    return () => quanSat.disconnect();
  }, []);

  const ao = useVirtualizer({
    count: cacHang.length,
    getScrollElement: () => vungCuon,
    estimateSize: () => CHIEU_CAO_HANG_UOC_TINH + KHOANG_CACH_HANG,
    overscan: 3,
    scrollMargin: leTren,
  });

  return (
    <div ref={khungRef} className="relative w-full" style={{ height: ao.getTotalSize() }}>
      {ao.getVirtualItems().map((hang) => (
        <div
          key={hang.key}
          data-index={hang.index}
          ref={ao.measureElement}
          className="absolute left-0 top-0 w-full"
          style={{
            transform: `translateY(${hang.start - leTren}px)`,
            paddingBottom: KHOANG_CACH_HANG,
          }}
        >
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: `repeat(${soCot}, minmax(0, 1fr))` }}
          >
            {cacHang[hang.index]?.map((app) => (
              <TheUngDung key={app.id} app={app} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
