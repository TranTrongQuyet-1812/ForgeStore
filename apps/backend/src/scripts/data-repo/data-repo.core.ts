import { ReadmeTranslationService } from '../../modules/ai/translation/services/readme-translation.service';
import { MarkdownMasker } from '../../modules/ai/translation/tien-ich/markdown-masker.util';
import { StructureValidator } from '../../modules/ai/translation/tien-ich/structure-validator.util';
import {
  goKhungGiuNguyen,
  kiemBatBienReadme,
  layLoiBatBienReadme,
  phanTichReadme,
  rapLaiReadme,
} from '../../modules/ai/translation/tien-ich/readme-markdown-processor.util';
import type {
  BanGhiDaCao,
  DoanChoDich,
  DongDaKiem,
  DongDich,
  LyDoLoiDong,
} from './data-repo.types';

/**
 * Lõi thuần của Data_Repo dùng chung bộ phân tích, mã băm, che/gỡ che và bộ kiểm với luồng BE.
 * Chỉ các mẩu chữ được xuất cho người dịch; README hoàn chỉnh được lắp lại theo offset nguồn.
 */
const dichVuReadme = new ReadmeTranslationService(
  undefined as never,
  undefined as never,
  undefined as never,
  undefined as never,
);

export const MO_TA_TOI_DA = 400;
const KY_HIEU_CHE = /⟦C\d+⟧/;

export function tinhMaBam(text: string): string {
  return dichVuReadme.tinhMaBam(text);
}

/** Cùng công thức tinhMaBamMoTa của AppDescriptionTranslationService (SHA-256 của trim). */
export function tinhMaBamMoTa(moTa: string): string {
  return dichVuReadme.tinhMaBam(moTa);
}

export function phanDoan(readme: string | null | undefined): string[] {
  return phanTichReadme(readme ?? '').doan.map((doan) => doan.vanBanGoc);
}

/** Chữ CJK chỉ cần một ký tự; văn bản dùng chữ Latin vẫn giữ ngưỡng hiện tại. */
function conChuCanDich(daChe: string): boolean {
  const chu = daChe.replace(/⟦C\d+⟧/g, ' ').replace(/[^\p{L}]/gu, '');
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(chu))
    return true;
  return chu.length >= 3;
}

const TU_CAU_TIENG_ANH =
  /\b(the|an?|to|and|or|is|are|for|with|in|on|from|by|this|that|you|your|we|our|it|be|can|will)\b/i;

/**
 * Đoạn chỉ gồm huy hiệu, nhãn liên kết hoặc thanh chọn ngôn ngữ (từ 3 ký hiệu che trở lên, giữa chúng
 * chỉ là nhãn ngắn không có từ nối câu): không có câu để dịch nên giữ nguyên là đúng, không báo chua_dich.
 * shortcut: dựa vào độ dài nhãn và từ nối tiếng Anh, câu ngắn không có từ nối sẽ lọt; nâng cấp nếu thấy đoạn bị bỏ sót.
 */
export function chiLaChuoiNhan(daChe: string): boolean {
  // Đoạn chỉ gồm ký hiệu che, thực thể HTML (&nbsp;...) và khoảng trắng thì không có chữ nào để dịch
  if (!/\p{L}/u.test(daChe.replace(/⟦C\d+⟧/g, ' ').replace(/&#?\w+;/g, ' '))) return true;
  if ((daChe.match(/⟦C\d+⟧/g) ?? []).length < 3) return false;
  const nhan = daChe
    .split(/⟦C\d+⟧/)
    .map((x) => x.trim())
    .filter(Boolean);
  const laNhan = (x: string) =>
    // "README in English", "README en Español": thanh chọn ngôn ngữ, giữ nguyên là đúng
    (/\bREADME\b/.test(x) && x.length <= 40 && !/[.!?]$/.test(x)) ||
    (x.length <= 30 &&
      x.split(/\s+/).length <= 3 &&
      !/[.!?]$/.test(x) &&
      !TU_CAU_TIENG_ANH.test(x));
  const soNhan = nhan.filter(laNhan).length;
  // Danh sách dài (người đóng góp, nhà tài trợ): vài tên có "from", "da" hay viết tắt "Marco P." vẫn là danh sách tên
  return soNhan === nhan.length || (nhan.length >= 20 && soNhan / nhan.length >= 0.9);
}

const TU_NOI_TIENG_ANH = new RegExp(`^${TU_CAU_TIENG_ANH.source.replace(/\\b/g, '')}$`, 'i');

/**
 * Đoạn có câu tiếng Anh thật: ba từ liền nhau trên một dòng, trong đó có một từ nối (the, to, for...).
 * Phiên gõ lệnh (`$ ...`), kết quả lệnh, tên riêng và đường dẫn thì không có, giữ nguyên là đúng.
 * shortcut: câu chỉ gồm từ ngắn lạ không có từ nối sẽ lọt; nâng cấp nếu thấy đoạn bị bỏ sót.
 */
export function coCauTiengAnh(daChe: string): boolean {
  if (/^\s*\$\s/.test(daChe)) return false;
  const viTri = /(?=(\b[A-Za-z]{2,}\b[ \t]+\b[A-Za-z]{2,}\b[ \t]+\b[A-Za-z]{2,}\b))/g;
  return daChe
    .replace(/⟦C\d+⟧/g, '|')
    .split('\n')
    .some((dong) =>
      [...dong.matchAll(viTri)].some((m) =>
        m[1]!.split(/\s+/).some((tu) => TU_NOI_TIENG_ANH.test(tu)),
      ),
    );
}

/** Bước XUẤT: README → các đoạn đã che, sẵn cho Anti dịch. */
export function taoDongChoDich(cao: BanGhiDaCao): DongDich {
  const doan: DoanChoDich[] = phanTichReadme(cao.readmeEn ?? '').doan.map((nut, i) => {
    const goc = nut.vanBanGoc;
    const { maskedText: vanBanDaChe } = MarkdownMasker.mask(nut.vanBanDaChe);
    const canDich = nut.canDich && conChuCanDich(vanBanDaChe);
    const maskedText = canDich ? vanBanDaChe : nut.vanBanDaChe;
    return {
      stt: i + 1,
      maBam: tinhMaBam(goc),
      mucQuanTrong: nut.mucQuanTrong,
      vanBanDaChe: maskedText,
      canDich: canDich && nut.mucQuanTrong !== 3,
      vi: canDich && nut.mucQuanTrong !== 3 ? null : maskedText,
      tieuDeMuc: nut.tieuDeMuc,
      khungGiuNguyen: nut.khungGiuNguyen,
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
  const cauTruc = phanTichReadme(cao.readmeEn ?? '');
  const goc = cauTruc.doan.map((doan) => doan.vanBanGoc);
  const doanDat: Array<{ maBam: string; goc: string; dich: string }> = [];
  const banDichTheoDoan = new Map<number, string>();
  let soDoanLoi = 0;

  const doanKiem: DoanChoDich[] = chuan.doan.map((c, i) => {
    const ketQua: DoanChoDich = { ...c, vi: null };
    const t = traVe.get(c.stt);
    if (!t || t.maBam !== c.maBam) {
      ketQua.loi = 'doan_bi_doi' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    const banDauVao = c.canDich ? t.vi : c.vanBanDaChe;
    if (!banDauVao || !banDauVao.trim()) {
      ketQua.loi = 'thieu_ban_dich' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    const viSach = StructureValidator.cleanOutput(banDauVao, c.vanBanDaChe);
    const vanDe = StructureValidator.findStructureProblem(c.vanBanDaChe, viSach);
    if (vanDe) {
      ketQua.loi = vanDe;
      soDoanLoi++;
      return ketQua;
    }
    if (
      c.canDich &&
      viSach.trim() === c.vanBanDaChe.trim() &&
      c.vanBanDaChe.length > 40 &&
      !chiLaChuoiNhan(c.vanBanDaChe) &&
      coCauTiengAnh(c.vanBanDaChe)
    ) {
      ketQua.loi = 'chua_dich' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    const doanNguon = cauTruc.doan[i]!;
    const { placeholderMap } = MarkdownMasker.mask(
      Object.keys(doanNguon.khungGiuNguyen).length === 0 ? doanNguon.vanBanDaChe : c.vanBanDaChe,
    );
    const viDayChe = MarkdownMasker.unmask(viSach, placeholderMap);
    let viDay: string;
    try {
      viDay = goKhungGiuNguyen(cauTruc.doan[i]!, viDayChe);
    } catch {
      ketQua.loi = 'placeholders_changed' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    if (KY_HIEU_CHE.test(viDay)) {
      ketQua.loi = 'con_ky_hieu_che' satisfies LyDoLoiDong;
      soDoanLoi++;
      return ketQua;
    }
    ketQua.vi = c.canDich ? t.vi : c.vanBanDaChe;
    doanDat.push({ maBam: c.maBam, goc: (goc[i] ?? '').trim(), dich: viDay });
    banDichTheoDoan.set(c.stt, viDayChe);
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

  const readmeVi = cao.readmeEn ? rapLaiReadme(cao.readmeEn, cauTruc, banDichTheoDoan) : null;
  const chatLuong = kiemBatBienReadme(cao.readmeEn ?? '', readmeVi ?? '', {
    ...(chuan.moTaEn && moTaVi ? { moTaNgan: { goc: chuan.moTaEn, dich: moTaVi } } : {}),
    doan: cauTruc.doan.map((doan) => ({
      goc: doan.vanBanDaChe.replace(/⟦C\d+⟧/g, ''),
      dich: (
        banDichTheoDoan.get(doan.stt) ??
        (doan.vanBanDaChe !== doan.vanBanGoc ? doan.vanBanDaChe : doan.vanBanGoc)
      ).replace(/⟦C\d+⟧/g, ''),
    })),
  });
  const canhBaoChatLuong = [
    ...chatLuong.canhBao,
    ...cauTruc.canhBao.map((warning) => `${warning.lyDo}_dong_${warning.dong}`),
  ];
  const loiBatBien = layLoiBatBienReadme(chatLuong.canhBao);
  if (loiBatBien.length > 0) {
    return {
      dat: null,
      loi: {
        repo: cao.repo,
        lo: cao.lo,
        moTaEn: chuan.moTaEn,
        moTaVi: dich.moTaVi,
        doan: doanKiem.map((doan) => ({ ...doan, vi: banDichTheoDoan.get(doan.stt) ?? doan.vi })),
        loiReadme: `readme_bat_bien:${loiBatBien.join(',')}`,
      },
      soDoanLoi: 1,
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
      readmeVi,
      hangChatLuong: canhBaoChatLuong.length === 0 ? 'A' : chatLuong.hang === 'C' ? 'C' : 'B',
      canhBaoChatLuong,
      tiLeDoDaiTong: chatLuong.tiLeDoDaiTong,
      tiLeDoDaiDoan: chatLuong.tiLeDoDaiDoan,
      tiLeDoDaiMoTa: chatLuong.tiLeDoDaiMoTa,
      tiLeDoDaiEn: chatLuong.tiLeDoDaiEn,
      tiLeDoDaiZh: chatLuong.tiLeDoDaiZh,
      ngonNguNguon: chatLuong.ngonNguNguon,
      nguon,
    },
    loi: null,
    soDoanLoi: 0,
  };
}
