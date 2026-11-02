/**
 * Số cột của lưới thẻ theo độ rộng cửa sổ, khớp với lớp Tailwind cũ
 * `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (md = 768px, lg = 1024px).
 */
export function laySoCot(doRongCuaSo: number): number {
  if (doRongCuaSo >= 1024) return 3;
  if (doRongCuaSo >= 768) return 2;
  return 1;
}

/** Cắt danh sách thẻ thành từng hàng đủ `soCot` thẻ (hàng cuối có thể ít hơn). */
export function chiaThanhHang<T>(danhSach: readonly T[], soCot: number): T[][] {
  const soCotHopLe = Math.max(1, Math.floor(soCot));
  const hang: T[][] = [];

  for (let i = 0; i < danhSach.length; i += soCotHopLe) {
    hang.push(danhSach.slice(i, i + soCotHopLe));
  }

  return hang;
}
