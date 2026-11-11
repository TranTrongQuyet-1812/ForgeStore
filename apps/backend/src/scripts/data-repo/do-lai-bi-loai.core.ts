import * as fs from 'fs';
import * as path from 'path';
import { coCachCaiCliHopLe, MaTrinhQuanLyGoi, type HuongDanCaiDatDto } from '@forgestore/types';
import { trichXuatHuongDanCliBangQuyTac } from '../../modules/ai/tien-ich/cli-guide-extractor.util';
import {
  danhGiaRelease,
  cachCaiThuocRepo,
  laThuVienLapTrinh,
  type ReleaseUngVien,
} from '../../modules/ung-dung/tien-ich/bo-loc-nap-repo.util';
import { phanLoaiTep } from '../../modules/ung-dung/tien-ich/phan-loai-tep.util';
import { docJsonl } from './data-repo.paths';

/**
 * Lõi thuần của lệnh `do-lai-bi-loai` (D-38, P3B-33.3): chọn lại các repo từng bị loại mà nay có thể đạt nhờ các
 * sửa P3B-33 đến P3B-36. Nhật ký loại chỉ lưu repo, lý do và sao (không lưu README) nên phần chạy thật phải lấy lại
 * README; phần lập kế hoạch ở đây CHỈ ĐỌC tệp cục bộ, không gọi mạng, không chạm DB.
 */

/** Ba lý do kỹ thuật có thể đạt lại sau khi sửa bộ đọc lệnh và luật ZIP. */
export const LY_DO_KY_THUAT_DO_LAI = [
  'KHONG_CO_FILE_CAI',
  'KHONG_CO_BAN_PHAT_HANH',
  'KHONG_CO_TEP_CAI_VA_LENH_CAI',
] as const;

const LY_DO_GIAY_PHEP_CAN_DUYET = 'GIAY_PHEP_CAN_DUYET';
/** Repo bị chặn có chủ ý (danh sách chặn) thì không bao giờ dò lại. */
const LY_DO_CHAN_CO_CHU_Y = 'TRONG_DANH_SACH_CHAN';
/** Giấy phép "không có" vẫn bị loại theo D-36 nên không dò lại (khớp cách ghi trong nhật ký). */
const CHI_TIET_KHONG_CO_GIAY_PHEP = 'không có';

export interface BanGhiBiLoai {
  repo: string;
  lyDo: string;
  sao?: number;
  chiTiet?: string;
}

export interface UngVienDoLai {
  repo: string;
  sao: number;
  /** Các lý do liên quan đã gộp từ mọi nhật ký loại (không trùng). */
  cacLyDo: string[];
}

/** Lý do này có đáng dò lại không (kỹ thuật, hoặc giấy phép cần duyệt nhưng KHÁC "không có"). */
function laLyDoDoLai(b: BanGhiBiLoai): boolean {
  if ((LY_DO_KY_THUAT_DO_LAI as readonly string[]).includes(b.lyDo)) return true;
  return (
    b.lyDo === LY_DO_GIAY_PHEP_CAN_DUYET && (b.chiTiet ?? '').trim() !== CHI_TIET_KHONG_CO_GIAY_PHEP
  );
}

/**
 * Gộp trùng theo repo (không phân biệt hoa thường) và chỉ giữ repo có ít nhất một lý do đáng dò lại.
 * Loại hẳn repo đã được nhận (đã nằm trong danh sách đợt), và (khi `apDungLoaiTru`) repo bị chặn có chủ ý hoặc mang
 * giấy phép "không có" ở bất kỳ nhật ký nào. Tắt `apDungLoaiTru` chỉ để đối chiếu số đo thô.
 * Kết quả sắp theo sao giảm dần để dò repo nổi tiếng trước.
 */
export function layUngVienDoLai(
  cacBanGhi: BanGhiBiLoai[],
  daNhan: ReadonlySet<string>,
  apDungLoaiTru = true,
): UngVienDoLai[] {
  const gop = new Map<string, UngVienDoLai>();
  const khongDoLai = new Set<string>();

  for (const b of cacBanGhi) {
    const khoa = b.repo.toLowerCase();
    const khongCoGiayPhep =
      b.lyDo === LY_DO_GIAY_PHEP_CAN_DUYET &&
      (b.chiTiet ?? '').trim() === CHI_TIET_KHONG_CO_GIAY_PHEP;
    if (b.lyDo === LY_DO_CHAN_CO_CHU_Y || b.lyDo === 'KHONG_CO_GIAY_PHEP' || khongCoGiayPhep) {
      khongDoLai.add(khoa);
    }
    if (!laLyDoDoLai(b)) continue;
    const cu = gop.get(khoa);
    if (!cu) {
      gop.set(khoa, { repo: b.repo, sao: b.sao ?? 0, cacLyDo: [b.lyDo] });
      continue;
    }
    cu.sao = Math.max(cu.sao, b.sao ?? 0);
    if (!cu.cacLyDo.includes(b.lyDo)) cu.cacLyDo.push(b.lyDo);
  }

  return [...gop.entries()]
    .filter(([khoa]) => !daNhan.has(khoa) && !(apDungLoaiTru && khongDoLai.has(khoa)))
    .map(([, uv]) => uv)
    .sort((a, b) => b.sao - a.sao);
}

/** Các mốc sao cộng dồn để so với số đo của Claude (từ mốc đó trở lên). */
export const MOC_SAO_KE_HOACH = [100000, 20000, 5000, 1000] as const;

export interface KeHoachDoLai {
  tongRepo: number;
  theoLyDo: Record<string, number>;
  /** Số repo có sao từ mốc trở lên (cộng dồn). */
  tuMocSao: Record<number, number>;
  soLuotReadme: number;
  /** Cận trên: chỉ repo từng bị loại vì thiếu tệp cài hoặc giấy phép cần duyệt mới cần xem danh sách Release. */
  soLuotReleaseToiDa: number;
  soLuotGithubUocToiDa: number;
}

/** Lập kế hoạch dò lại từ danh sách ứng viên (hàm thuần). */
export function lapKeHoachDoLai(cacUngVien: UngVienDoLai[]): KeHoachDoLai {
  const theoLyDo: Record<string, number> = {};
  for (const uv of cacUngVien) for (const ly of uv.cacLyDo) theoLyDo[ly] = (theoLyDo[ly] ?? 0) + 1;

  const tuMocSao: Record<number, number> = {};
  for (const moc of MOC_SAO_KE_HOACH) tuMocSao[moc] = cacUngVien.filter((u) => u.sao >= moc).length;

  const soLuotReleaseToiDa = cacUngVien.filter(canXemRelease).length;
  return {
    tongRepo: cacUngVien.length,
    theoLyDo,
    tuMocSao,
    soLuotReadme: cacUngVien.length,
    soLuotReleaseToiDa,
    soLuotGithubUocToiDa: cacUngVien.length + soLuotReleaseToiDa,
  };
}

/** Chỉ nhóm từng bị loại ở bước Release (thiếu tệp cài) hoặc chưa từng xét Release (giấy phép) mới cần danh sách Release. */
function canXemRelease(uv: UngVienDoLai): boolean {
  return uv.cacLyDo.includes('KHONG_CO_FILE_CAI') || uv.cacLyDo.includes(LY_DO_GIAY_PHEP_CAN_DUYET);
}

/** Dòng chữ in kế hoạch cho Chủ xem (không gọi mạng). */
export function inKeHoachDoLai(kh: KeHoachDoLai): string[] {
  const dong = [
    `Kế hoạch dò lại repo bị loại: ${kh.tongRepo} repo riêng.`,
    `Theo lý do (một repo có thể thuộc nhiều lý do): ${JSON.stringify(kh.theoLyDo)}`,
  ];
  for (const moc of MOC_SAO_KE_HOACH) {
    dong.push(`  từ ${moc.toLocaleString('vi-VN')} sao trở lên: ${kh.tuMocSao[moc]} repo`);
  }
  dong.push(
    `Ước lượt gọi GitHub (cận trên): ${kh.soLuotGithubUocToiDa} = ${kh.soLuotReadme} lượt README + tối đa ${kh.soLuotReleaseToiDa} lượt danh sách Release.`,
    'Chưa gọi mạng. Thêm --goi-github [--toi-da N] [--sao-tu M] để dò thật (tốn hạn mức GitHub, cần lệnh của Chủ).',
    'Ghi chú: Danh sách dò lại này chưa qua kiểm tra locCucBo (archived, ngày push cuối); khi chạy lệnh "cao" hệ thống sẽ tự động kiểm tra lại các điều kiện này.',
  );
  return dong;
}

/** Đọc mọi nhật ký loại và danh sách đã nhận của thư mục danh sách. Chỉ đọc tệp cục bộ. */
export function docNhatKyDoLai(thuMucDanhSach: string): {
  cacBanGhi: BanGhiBiLoai[];
  daNhan: Set<string>;
} {
  if (!fs.existsSync(thuMucDanhSach)) return { cacBanGhi: [], daNhan: new Set() };
  const tenTep = fs.readdirSync(thuMucDanhSach);
  const cacBanGhi = tenTep
    .filter((t) => t.endsWith('.boqua.jsonl') && !t.startsWith('do-lai-'))
    .flatMap((t) => docJsonl<BanGhiBiLoai>(path.join(thuMucDanhSach, t)));
  const daNhan = new Set<string>();
  for (const t of tenTep.filter((x) => x.endsWith('.txt'))) {
    const noiDung = fs.readFileSync(path.join(thuMucDanhSach, t), 'utf8');
    for (const dong of noiDung.split(/\r?\n/)) {
      const repo = dong.split('#')[0]?.trim();
      if (repo && repo.includes('/')) daNhan.add(repo.toLowerCase());
    }
  }
  return { cacBanGhi, daNhan };
}

// ---------------------------------------------------------------- CHẾ ĐỘ --goi-github: ĐÁNH GIÁ MỘT REPO

export type NhomVotDoLai = 'NPX_SKILL' | 'DOCKER_NHIEU_DONG' | 'PIP_GHIM' | 'ZIP_DUY_NHAT';

export interface KetQuaDanhGiaDoLai {
  vot: boolean;
  nhom: NhomVotDoLai[];
}

/** Đánh dấu cách cài trong README mà từng sửa P3B-33/34/35 mới nhận được. */
function nhanNhomTuHuongDan(huongDan: HuongDanCaiDatDto): NhomVotDoLai[] {
  const nhom = new Set<NhomVotDoLai>();
  for (const cach of huongDan.cachCai ?? []) {
    const cacLenh = (cach.buoc ?? []).map((b) => b.lenh);
    if (cach.trinhQuanLy === MaTrinhQuanLyGoi.NPX) nhom.add('NPX_SKILL');
    if (cach.trinhQuanLy === MaTrinhQuanLyGoi.DOCKER && cacLenh.some((l) => l.includes('\n')))
      nhom.add('DOCKER_NHIEU_DONG');
    if (
      cach.trinhQuanLy === MaTrinhQuanLyGoi.PIP &&
      cacLenh.some((l) => /==|>=|<=|~=|!=|\[[^\]]+\]/.test(l))
    )
      nhom.add('PIP_GHIM');
  }
  return [...nhom];
}

/** ZIP duy nhất: danhGiaRelease đạt nhưng không có tệp nào đạt theo luật cũ (xét từng tên lẻ). */
function laNhomZipDuyNhat(releases: ReleaseUngVien[]): boolean {
  const kq = danhGiaRelease(releases);
  if (!kq.dat) return false;
  const chinhThuc = releases
    .filter((r) => !r.draft && !r.prerelease)
    .sort(
      (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
    )[0];
  const theoLuatCu = (chinhThuc?.assets ?? []).some((a) => !phanLoaiTep(a.name).boQua);
  return !theoLuatCu;
}

/**
 * Chạy bộ lọc đã sửa trên README (và danh sách Release nếu có) của MỘT repo. Hàm thuần: không gọi mạng,
 * nhận dữ liệu đã lấy sẵn. Repo được vớt khi README có cách cài CLI hợp lệ hoặc Release có tệp cài hợp lệ.
 */
export function danhGiaRepoDoLai(
  fullName: string,
  readme: string | null | undefined,
  releases: ReleaseUngVien[] | null,
): KetQuaDanhGiaDoLai {
  const nhom: NhomVotDoLai[] = [];
  let vot = false;

  if (readme) {
    const huongDan = trichXuatHuongDanCliBangQuyTac(
      readme,
      `https://github.com/${fullName}#readme`,
    );
    if (
      coCachCaiCliHopLe(huongDan) &&
      !laThuVienLapTrinh(readme, fullName, huongDan.cachCai) &&
      cachCaiThuocRepo(fullName, huongDan.cachCai)
    ) {
      vot = true;
      nhom.push(...nhanNhomTuHuongDan(huongDan));
    }
  }
  if (releases && laNhomZipDuyNhat(releases)) {
    vot = true;
    nhom.push('ZIP_DUY_NHAT');
  } else if (releases && danhGiaRelease(releases).dat) {
    vot = true;
  }
  return { vot, nhom };
}

/** Repo này cần lấy thêm danh sách Release không (cùng điều kiện ước lượng ở kế hoạch). */
export function repoCanXemRelease(uv: UngVienDoLai): boolean {
  return canXemRelease(uv);
}
