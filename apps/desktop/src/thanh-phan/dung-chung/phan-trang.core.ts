/**
 * Dãy nút số trang gọn: luôn có trang đầu, trang cuối và trang hiện tại cùng hai trang kề bên.
 * Chỗ trống từ hai trang trở lên hiện bằng `null` (dấu "..."); chỗ trống đúng một trang thì hiện luôn số đó.
 */
export function taoDanhSachSoTrang(hienTai: number, tongSoTrang: number): Array<number | null> {
  if (tongSoTrang < 1) return [];

  const giuLai = new Set([1, tongSoTrang, hienTai - 1, hienTai, hienTai + 1]);
  const soTrang = [...giuLai].filter((so) => so >= 1 && so <= tongSoTrang).sort((a, b) => a - b);
  const ketQua: Array<number | null> = [];

  soTrang.forEach((so, viTri) => {
    const truoc = soTrang[viTri - 1];
    if (truoc !== undefined) {
      if (so - truoc === 2) ketQua.push(truoc + 1);
      else if (so - truoc > 2) ketQua.push(null);
    }
    ketQua.push(so);
  });

  return ketQua;
}

/** Khoảng thứ tự ứng dụng đang hiện ("31 đến 60"), kẹp theo tổng số để trang cuối không vượt quá. */
export function tinhKhoangDangXem(
  trangHienTai: number,
  kichThuocTrang: number,
  tongSo: number,
): { tu: number; den: number } {
  if (tongSo <= 0) return { tu: 0, den: 0 };

  const tu = (trangHienTai - 1) * kichThuocTrang + 1;
  return { tu, den: Math.min(trangHienTai * kichThuocTrang, tongSo) };
}
