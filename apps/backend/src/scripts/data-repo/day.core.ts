import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';
import { taoDongChoDich } from './data-repo.core';
import type { DoiTenRepo } from './hop-nhat.core';
import { MarkdownMasker } from '../../modules/ai/translation/tien-ich/markdown-masker.util';
import { StructureValidator } from '../../modules/ai/translation/tien-ich/structure-validator.util';
import {
  goKhungGiuNguyen,
  phanTichReadme,
} from '../../modules/ai/translation/tien-ich/readme-markdown-processor.util';

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

/**
 * Backend lưu bo_nho_dich_chung ở dạng còn ký hiệu khung ⟦Cn⟧ (link, mã nằm ngoài chữ dịch).
 * Ghi bản đã gỡ hết ký hiệu vào bộ nhớ thì backend bỏ qua khi README đổi và phải dịch lại bằng AI.
 * Hàm này gom bản dịch có ký hiệu theo repo; nguồn đưa sau ghi đè nguồn đưa trước (Nhom → Dot_Va → Dot_Va2).
 */
export function taoMapBanDichCoKyHieu(
  cacNguon: DongDich[][],
  doiTen: DoiTenRepo[] = [],
): Map<string, Array<string | null>> {
  const ketQua = new Map<string, Array<string | null>>();
  for (const nguon of cacNguon)
    for (const dong of nguon)
      ketQua.set(
        dong.repo.toLowerCase(),
        dong.doan.map((doan) => doan.vi),
      );
  // Repo đã đổi tên: nguồn dịch vẫn mang tên cũ nên thêm bản mang tên mới.
  for (const { tenCu, tenMoi } of doiTen) {
    const vi = ketQua.get(tenCu.toLowerCase());
    if (vi) ketQua.set(tenMoi.toLowerCase(), vi);
  }
  return ketQua;
}

/**
 * Trả về maBam → bản dịch còn ký hiệu khung ⟦Cn⟧ cho các đoạn cần dịch của một repo, đúng dạng backend lưu và dùng lại.
 * Làm đúng như bước nhập: gỡ lớp che của MarkdownMasker nhưng giữ khung. Mỗi đoạn tháo hết ký hiệu phải khớp
 * đúng bản dịch trong 04_da_kiem, nếu lệch thì dừng để khỏi ghi sai.
 */
export function layBanDichCoKyHieu(
  cao: BanGhiDaCao,
  daKiem: DongDaKiem,
  viCoKyHieu: Array<string | null> | undefined,
): Map<string, string> {
  const doanNguon = taoDongChoDich(cao).doan;
  const cauTruc = phanTichReadme(cao.readmeEn ?? '').doan;
  if (
    !viCoKyHieu ||
    viCoKyHieu.length !== doanNguon.length ||
    daKiem.doan.length !== doanNguon.length ||
    cauTruc.length !== doanNguon.length
  )
    throw new Error(`Thiếu hoặc lệch số đoạn bản dịch có ký hiệu của ${cao.repo}.`);
  const ketQua = new Map<string, string>();
  for (const [index, doan] of doanNguon.entries()) {
    if (!doan.canDich) continue;
    const vi = viCoKyHieu[index];
    if (!vi?.trim()) throw new Error(`${cao.repo} đoạn ${doan.stt} chưa có bản dịch có ký hiệu.`);
    const goc = cauTruc[index]!;
    const viSach = StructureValidator.cleanOutput(vi, doan.vanBanDaChe);
    const { placeholderMap } = MarkdownMasker.mask(
      Object.keys(goc.khungGiuNguyen).length === 0 ? goc.vanBanDaChe : doan.vanBanDaChe,
    );
    const viCheKhung = MarkdownMasker.unmask(viSach, placeholderMap);
    if (goKhungGiuNguyen(goc, viCheKhung).trim() !== daKiem.doan[index]!.dich.trim())
      throw new Error(`${cao.repo} đoạn ${doan.stt}: bản dịch có ký hiệu không khớp bản đã kiểm.`);
    ketQua.set(doan.maBam, viCheKhung);
  }
  return ketQua;
}
