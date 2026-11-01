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
