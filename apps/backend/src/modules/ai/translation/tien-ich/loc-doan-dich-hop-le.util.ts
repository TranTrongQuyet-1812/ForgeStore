import {
  kiemBatBienReadme,
  layLoiBatBienReadme,
  rapLaiReadme,
  type CauTrucReadme,
} from './readme-markdown-processor.util';

/**
 * Tùy chọn so sánh từng đoạn cho bộ kiểm bất biến: đoạn chưa có bản dịch thì so với chính bản gốc.
 * Dùng chung cho kiểm toàn README và cho bước lọc đoạn hỏng để hai nơi kiểm giống hệt nhau.
 */
export function taoTuyChonKiemReadme(
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): { doan: Array<{ goc: string; dich: string }> } {
  return {
    doan: cauTruc.doan.map((doan) => ({
      goc: doan.vanBanDaChe.replace(/⟦C\d+⟧/g, ''),
      dich: (
        banDich.get(doan.stt) ??
        (doan.vanBanDaChe !== doan.vanBanGoc ? doan.vanBanDaChe : doan.vanBanGoc)
      ).replace(/⟦C\d+⟧/g, ''),
    })),
  };
}

function datBatBien(
  banGoc: string,
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): boolean {
  try {
    const ghep = rapLaiReadme(banGoc, cauTruc, banDich);
    const kq = kiemBatBienReadme(banGoc, ghep, taoTuyChonKiemReadme(cauTruc, banDich));
    return layLoiBatBienReadme(kq.canhBao).length === 0;
  } catch {
    // Ký hiệu thiếu hoặc đảo làm không ghép được: coi như đoạn đó hỏng.
    return false;
  }
}

export interface KetQuaLocDoanDich {
  /** Các đoạn dịch giữ lại: ghép vào README vẫn đạt bộ kiểm bất biến. */
  giu: Map<number, string>;
  /** Số thứ tự các đoạn bị loại: README giữ nguyên bản gốc ở những đoạn này. */
  boQua: number[];
}

/**
 * Loại riêng những đoạn dịch làm hỏng cấu trúc README, giữ lại phần còn lại (Chủ chốt 18/11/2026:
 * không ai dịch đúng 100%, một đoạn hỏng không được làm hỏng cả README).
 *
 * Cách làm: thử từng đoạn một mình (đoạn nào làm hỏng cấu trúc thì loại), rồi ghép các đoạn đạt;
 * nếu ghép chung vẫn hỏng (đoạn tương tác với nhau) thì thêm dần từng đoạn và chỉ giữ đoạn không gây hỏng.
 */
export function locDoanDichHopLe(
  banGoc: string,
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): KetQuaLocDoanDich {
  const boQua: number[] = [];
  const dat: Array<[number, string]> = [];
  for (const [stt, ban] of banDich) {
    if (datBatBien(banGoc, cauTruc, new Map([[stt, ban]]))) dat.push([stt, ban]);
    else boQua.push(stt);
  }

  const giu = new Map<number, string>(dat);
  if (giu.size === 0 || datBatBien(banGoc, cauTruc, giu)) return { giu, boQua };

  const giuTungDoan = new Map<number, string>();
  for (const [stt, ban] of dat) {
    const thu = new Map(giuTungDoan).set(stt, ban);
    if (datBatBien(banGoc, cauTruc, thu)) giuTungDoan.set(stt, ban);
    else boQua.push(stt);
  }
  return { giu: giuTungDoan, boQua };
}
