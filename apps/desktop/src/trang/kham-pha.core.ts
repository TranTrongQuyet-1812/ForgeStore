interface TrangCoDuLieu<T extends { maUngDung: string }> {
  duLieu: T[];
}

export function gopTrangUngDung<T extends { maUngDung: string }>(trang: TrangCoDuLieu<T>[]): T[][] {
  const idDaGap = new Set<string>();

  // API có thể lặp ứng dụng ở ranh giới trang, nên giữ lần gặp đầu để giao diện không nhân đôi thẻ.
  return trang.map((mucTrang) =>
    mucTrang.duLieu.filter((ungDung) => {
      if (idDaGap.has(ungDung.maUngDung)) return false;
      idDaGap.add(ungDung.maUngDung);
      return true;
    }),
  );
}

interface DuLieuPhanTrang<TTrang, TThamSo> {
  pages: TTrang[];
  pageParams: TThamSo[];
}

export function rutVeTrangDau<TTrang, TThamSo>(
  data: DuLieuPhanTrang<TTrang, TThamSo> | undefined,
): DuLieuPhanTrang<TTrang, TThamSo> | undefined {
  if (!data || data.pages.length <= 1) return data;

  // Giữ trang đầu và tham số tương ứng để bộ lọc đã dùng trước đó không mở lại ở trang cũ.
  return { ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
}

/**
 * Tạo hàm ánh xạ có nhớ theo đối tượng nguồn: cùng một dữ liệu thì trả lại đúng đối tượng thẻ cũ.
 * Nhờ vậy khi tải thêm một đợt, các thẻ đã có giữ nguyên tham chiếu và React.memo bỏ qua được việc vẽ lại.
 */
export function taoAnhXaCoNho<TNguon extends object, TDich>(
  anhXa: (nguon: TNguon) => TDich,
): (nguon: TNguon) => TDich {
  const boNho = new WeakMap<TNguon, TDich>();

  return (nguon) => {
    const daCo = boNho.get(nguon);
    if (daCo !== undefined) return daCo;

    const moi = anhXa(nguon);
    boNho.set(nguon, moi);
    return moi;
  };
}

/** So sánh hai trang thẻ theo từng phần tử để trang không đổi thì không phải vẽ lại cả lưới. */
export function haiTrangGiongNhau<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((phanTu, viTri) => phanTu === b[viTri]);
}
