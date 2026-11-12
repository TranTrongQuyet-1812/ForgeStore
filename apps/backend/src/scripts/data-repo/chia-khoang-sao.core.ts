/**
 * Chia khoảng sao thích ứng (D-39, P3B-37.1). Mỗi truy vấn Search GitHub chỉ trả tối đa 1.000 kết quả, nên với một
 * khoảng sao có nhiều hơn 1.000 repo ta chia đôi cho tới khi mọi khoảng đều ≤ 1.000: không còn bị cắt theo thiết kế.
 * Hàm thuần: việc đếm (gọi GitHub, giãn tốc độ 30 lượt/phút) do phía gọi truyền vào qua `demTong`.
 */

/** Trần kết quả của một truy vấn Search GitHub. */
export const TRAN_KET_QUA_SEARCH = 1000;

export interface KhoangSao {
  tu: number;
  den: number;
  /** Số repo đếm được trong khoảng (đã áp bộ lọc của truy vấn đếm). */
  tong: number;
}

export interface KetQuaChiaKhoangSao {
  /** Các khoảng lấy hết được bằng một truy vấn, sao giảm dần. */
  khoang: KhoangSao[];
  /** Một mức sao duy nhất mà vẫn > trần: cần chia thêm theo ngày push (bước sau). */
  khoangDonQuaLon: KhoangSao[];
  soLuotDem: number;
}

/** Điểm chia khoảng [tu, den] (tu < den): trung bình nhân vì phân bố sao lệch rất mạnh, luôn nằm trong [tu, den - 1]. */
export function diemChia(tu: number, den: number): number {
  const mid = Math.floor(Math.sqrt(tu * den));
  return Math.min(Math.max(mid, tu), den - 1);
}

/**
 * Chia khoảng sao [tu, den] thành các khoảng có tổng ≤ `tran`. Duyệt nửa sao cao trước nên kết quả đã sắp giảm dần.
 * Số lượt đếm tối đa xấp xỉ 2 × số khoảng × log2(den / tu), nên luôn dừng.
 */
export async function chiaKhoangSaoThichUng(
  demTong: (tu: number, den: number) => Promise<number>,
  tu: number,
  den: number,
  tran: number = TRAN_KET_QUA_SEARCH,
): Promise<KetQuaChiaKhoangSao> {
  const ketQua: KetQuaChiaKhoangSao = { khoang: [], khoangDonQuaLon: [], soLuotDem: 0 };

  async function xet(a: number, b: number): Promise<void> {
    const tong = await demTong(a, b);
    ketQua.soLuotDem++;
    if (tong === 0) return;
    if (tong <= tran) {
      ketQua.khoang.push({ tu: a, den: b, tong });
      return;
    }
    if (a === b) {
      ketQua.khoangDonQuaLon.push({ tu: a, den: b, tong });
      return;
    }
    const mid = diemChia(a, b);
    await xet(mid + 1, b); // nửa sao cao trước
    await xet(a, mid);
  }

  await xet(tu, den);
  return ketQua;
}
