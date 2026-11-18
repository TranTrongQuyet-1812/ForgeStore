import {
  goKhungGiuNguyen,
  kiemBatBienReadme,
  layLoiBatBienReadme,
  rapLaiReadme,
  type CauTrucReadme,
  type DoanDichReadme,
} from './readme-markdown-processor.util';

/**
 * Tùy chọn so sánh từng đoạn cho bộ kiểm bất biến: đoạn chưa có bản dịch thì so với chính bản gốc.
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

export interface KetQuaGhepKiem {
  noiDung: string;
  canhBao: string[];
  /** Lỗi bất biến chặn lưu; rỗng nghĩa là đạt. */
  loi: string[];
}

/**
 * Ghép bản dịch vào README gốc rồi chạy bộ kiểm bất biến. Trả null khi không ghép được
 * (ký hiệu giữ chỗ bị mất hoặc đảo làm rapLaiReadme ném lỗi) để nơi gọi coi như bản dịch hỏng.
 */
export function ghepVaKiemReadme(
  banGoc: string,
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): KetQuaGhepKiem | null {
  try {
    const noiDung = rapLaiReadme(banGoc, cauTruc, banDich);
    const kq = kiemBatBienReadme(banGoc, noiDung, taoTuyChonKiemReadme(cauTruc, banDich));
    return { noiDung, canhBao: kq.canhBao, loi: layLoiBatBienReadme(kq.canhBao) };
  } catch {
    return null;
  }
}

/**
 * Kiểm riêng một đoạn: khôi phục khung giữ nguyên rồi so bất biến trên đúng đoạn đó.
 * Cùng cách kiểm với đoạn lấy từ kho dùng chung, và chỉ tốn công theo độ dài đoạn
 * (kiểm cả README cho từng đoạn mất hơn 2 phút với README 100 nghìn ký tự).
 */
function doanDatBatBien(doan: DoanDichReadme, banDich: string): boolean {
  try {
    const daGhep = goKhungGiuNguyen(doan, banDich);
    const kq = kiemBatBienReadme(doan.vanBanGoc, daGhep, {
      doan: [
        {
          goc: doan.vanBanDaChe.replace(/⟦C\d+⟧/g, ''),
          dich: banDich.replace(/⟦C\d+⟧/g, ''),
        },
      ],
    });
    return layLoiBatBienReadme(kq.canhBao).length === 0;
  } catch {
    // Ký hiệu thiếu, thừa hoặc đảo: coi như đoạn dịch hỏng.
    return false;
  }
}

export interface KetQuaLocDoanDich {
  /** Các đoạn dịch giữ lại (đạt kiểm bất biến từng đoạn). */
  giu: Map<number, string>;
  /** Số thứ tự các đoạn bị loại: README giữ nguyên bản gốc ở những đoạn này. */
  boQua: number[];
}

/**
 * Loại riêng những đoạn dịch làm hỏng cấu trúc, giữ lại phần còn lại (Chủ chốt 18/11/2026:
 * không ai dịch đúng 100%, một đoạn hỏng không được làm hỏng cả README). Nơi gọi vẫn phải
 * kiểm lại cả README sau khi ghép các đoạn giữ lại.
 */
export function locDoanDichHopLe(
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): KetQuaLocDoanDich {
  const giu = new Map<number, string>();
  const boQua: number[] = [];
  const doanTheoStt = new Map(cauTruc.doan.map((doan) => [doan.stt, doan]));
  for (const [stt, ban] of banDich) {
    const doan = doanTheoStt.get(stt);
    if (doan && doanDatBatBien(doan, ban)) giu.set(stt, ban);
    else boQua.push(stt);
  }
  return { giu, boQua };
}
