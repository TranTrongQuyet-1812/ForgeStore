export interface DongBaoCaoLuuTru {
  repo: string;
  loai: string;
  archived?: boolean;
}

export function taoMapTrangThaiLuuTru(danhSach: DongBaoCaoLuuTru[]): Map<string, boolean> {
  return new Map(
    danhSach.map((dong) => [
      dong.repo.toLowerCase(),
      dong.loai === 'luu_tru' || dong.archived === true,
    ]),
  );
}

export function layCapNhatLuuTru(
  repo: string,
  trangThai?: Map<string, boolean>,
): { daLuuTru?: boolean } {
  const daLuuTru = trangThai?.get(repo.toLowerCase());
  return daLuuTru === undefined ? {} : { daLuuTru };
}
