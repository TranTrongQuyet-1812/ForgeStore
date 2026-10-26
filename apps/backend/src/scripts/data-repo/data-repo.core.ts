import { ReadmeTranslationService } from '../../modules/ai/translation/services/readme-translation.service';
import { MarkdownMasker } from '../../modules/ai/translation/tien-ich/markdown-masker.util';
import { StructureValidator } from '../../modules/ai/translation/tien-ich/structure-validator.util';
import type {
  BanGhiDaCao,
  DoanChoDich,
  DongDaKiem,
  DongDich,
  LyDoLoiDong,
} from './data-repo.types';

/**
 * Lõi thuần của Data_Repo: dùng ĐÚNG hàm của BE (chia đoạn, mã băm, che/gỡ che, kiểm cấu trúc)
 * để bản dịch chuẩn bị trước khớp từng chữ với thứ BE tự tạo ra khi chạy thật.
 * Hai hàm phanDoanReadme/tinhMaBam không dùng trạng thái nên khởi tạo không cần phụ thuộc.
 */
const dichVuReadme = new ReadmeTranslationService(
  undefined as never,
  undefined as never,
  undefined as never,
  undefined as never,
);

export const MO_TA_TOI_DA = 400;
/** Bản dịch ngắn hơn 60% bản gốc (theo ký tự hoặc số dòng) là dấu hiệu bị cắt. Bản dịch tiếng Việt thường dài tương đương hoặc hơn. */
export const TI_LE_DO_DAI_TOI_THIEU = 0.6;
const KY_HIEU_CHE = /⟦C\d+⟧/;

export function tinhMaBam(text: string): string {
  return dichVuReadme.tinhMaBam(text);
}

/** Cùng công thức tinhMaBamMoTa của AppDescriptionTranslationService (SHA-256 của trim). */
export function tinhMaBamMoTa(moTa: string): string {
  return dichVuReadme.tinhMaBam(moTa);
}

export function phanDoan(readme: string | null | undefined): string[] {
  return dichVuReadme.phanDoanReadme(readme ?? '');
}

/** Đoạn còn chữ cần dịch sau khi bỏ ký hiệu che và ký tự không phải chữ. */
function conChuCanDich(daChe: string): boolean {
  const chu = daChe.replace(/⟦C\d+⟧/g, ' ').replace(/[^\p{L}]/gu, '');
  return chu.length >= 3;
}

/** Bước XUẤT: README → các đoạn đã che, sẵn cho Anti dịch. */
export function taoDongChoDich(cao: BanGhiDaCao): DongDich {
  const doan: DoanChoDich[] = phanDoan(cao.readmeEn).map((goc, i) => {
    const { maskedText } = MarkdownMasker.mask(goc);
    const canDich = conChuCanDich(maskedText);
    return {
      stt: i + 1,
      maBam: tinhMaBam(goc),
      vanBanDaChe: maskedText,
      canDich,
      vi: canDich ? null : maskedText,
    };
  });
  return {
    repo: cao.repo,
    lo: cao.lo,
    moTaEn: cao.moTaEn?.trim() ? cao.moTaEn.trim() : null,
    moTaVi: null,
    doan,
  };
}

export interface KetQuaKiem {
  dat: DongDaKiem | null;
  /** Dòng để Anti sửa lại: đoạn lỗi có vi=null kèm mã lỗi, đoạn đạt giữ nguyên bản dịch. */
  loi: DongDich | null;
  soDoanLoi: number;
}

/** Bước NHẬP: kiểm một dòng Anti trả về dựa trên bản cào gốc. */
export function kiemTraDongDaDich(
  cao: BanGhiDaCao | undefined,
  dich: DongDich,
  nguon: string,
): KetQuaKiem {
  if (!cao) {
    return {
      dat: null,
      loi: { ...dich, loiMoTa: 'khong_co_ban_cao' satisfies LyDoLoiDong },
      soDoanLoi: 0,
    };
  }

  // Cấu trúc đoạn do BE quyết định, Anti không được đổi: tính lại từ bản cào rồi đối chiếu.
  const chuan = taoDongChoDich(cao);
  const traVe = new Map(dich.doan.map((d) => [d.stt, d]));
  const goc = phanDoan(cao.readmeEn);
  const doanDat: Array<{ maBam: string; goc: string; dich: string }> = [];
  let soDoanLoi = 0;

  const doanKiem: DoanChoDich[] = chuan.doan.map((c, i) => {
    const ketQua: DoanChoDich = { ...c, vi: null };
    const t = traVe.get(c.stt);
    if (!t || t.maBam !== c.maBam) {
      ketQua.loi = 'doan_bi_doi' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    if (!t.vi || !t.vi.trim()) {
      ketQua.loi = 'thieu_ban_dich' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    const viSach = StructureValidator.cleanOutput(t.vi, c.vanBanDaChe);
    const vanDe = StructureValidator.findStructureProblem(c.vanBanDaChe, viSach);
    if (vanDe) {
      ketQua.loi = vanDe;
      soDoanLoi++;
      return ketQua;
    }
    if (c.canDich && viSach.trim() === c.vanBanDaChe.trim() && c.vanBanDaChe.length > 40) {
      ketQua.loi = 'chua_dich' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    const { placeholderMap } = MarkdownMasker.mask(goc[i] ?? '');
    const viDay = MarkdownMasker.unmask(viSach, placeholderMap);
    if (KY_HIEU_CHE.test(viDay)) {
      ketQua.loi = 'con_ky_hieu_che' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    // Bản dịch bị cắt hoặc rút gọn (validator cũ không bắt được): so độ dài và số dòng với bản gốc
    if (goc[i] && goc[i].length > 300) {
      const dongGoc = goc[i].split('\n').filter((l) => l.trim()).length;
      const dongDich = viDay.split('\n').filter((l) => l.trim()).length;
      if (
        viDay.length / goc[i].length < TI_LE_DO_DAI_TOI_THIEU ||
        dongDich / dongGoc < TI_LE_DO_DAI_TOI_THIEU
      ) {
        ketQua.loi = 'mat_noi_dung' satisfies LyDoLoiDong;
        soDoanLoi++;
        return ketQua;
      }
    }
    ketQua.vi = t.vi;
    doanDat.push({ maBam: c.maBam, goc: (goc[i] ?? '').trim(), dich: viDay });
    return ketQua;
  });

  // Mô tả ngắn
  let moTaVi: string | null = null;
  let loiMoTa: string | undefined;
  if (chuan.moTaEn) {
    const vi = dich.moTaVi?.trim();
    if (!vi) loiMoTa = 'mo_ta_thieu' satisfies LyDoLoiDong;
    else if (vi.length > MO_TA_TOI_DA) loiMoTa = 'mo_ta_qua_dai' satisfies LyDoLoiDong;
    else moTaVi = vi;
  }

  if (soDoanLoi > 0 || loiMoTa) {
    return {
      dat: null,
      loi: {
        repo: cao.repo,
        lo: cao.lo,
        moTaEn: chuan.moTaEn,
        moTaVi: dich.moTaVi,
        doan: doanKiem,
        ...(loiMoTa ? { loiMoTa } : {}),
      },
      soDoanLoi,
    };
  }

  return {
    dat: {
      repo: cao.repo,
      lo: cao.lo,
      moTaEn: chuan.moTaEn,
      moTaVi,
      readmeSha: cao.readmeSha,
      etagRepo: cao.etagRepo,
      etagReleases: cao.etagReleases,
      etagReadme: cao.etagReadme,
      doan: doanDat,
      readmeVi: doanDat.length ? doanDat.map((d) => d.dich).join('\n\n') : null,
      nguon,
    },
    loi: null,
    soDoanLoi: 0,
  };
}
