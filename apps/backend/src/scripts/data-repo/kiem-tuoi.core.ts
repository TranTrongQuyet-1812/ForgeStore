import { createHash } from 'node:crypto';
import type { BanGhiDaCao, DongDaKiem } from './data-repo.types';

export type LoaiKiemTuoi =
  | 'khong_doi'
  | 'da_xoa'
  | 'doi_ten'
  | 'luu_tru'
  | 'rieng_tu_hoac_bi_chan'
  | 'readme_doi_nhe'
  | 'readme_doi_nhieu'
  | 'loi_goi_api';

export interface BaoCaoKiemTuoi {
  repo: string;
  loai: LoaiKiemTuoi;
  lyDo?: string;
  statusRepo?: number;
  statusReadme?: number;
  tenMoi?: string | null;
  archived?: boolean;
  disabled?: boolean;
  private?: boolean;
  fork?: boolean;
  saoHienTai?: number | null;
  pushedAt?: string | null;
  readmeShaMoi?: string | null;
  soDoanGiuNguyen?: number;
  soDoanMoi?: number;
  soDoanXoa?: number;
  tiLeDoi?: number | null;
}

interface RepoGithub {
  full_name?: string;
  archived?: boolean;
  disabled?: boolean;
  private?: boolean;
  fork?: boolean;
  stargazers_count?: number;
  pushed_at?: string | null;
}

interface ReadmeGithub {
  sha?: string;
  content?: string;
  encoding?: string;
}

export interface KetQuaHttp {
  response: Response;
  dungLuongConLai: number | null;
  thoiDiemReset: number | null;
}

export type YeuCauHttp = (url: string, etag: string | null) => Promise<KetQuaHttp>;
export type TaoDoanTuReadme = (cao: BanGhiDaCao) => Array<{ maBam: string }>;

export interface TienDoKiemTuoi {
  cao: BanGhiDaCao;
  daKiem: DongDaKiem | undefined;
}

export interface KetQuaKiemMotRepo {
  baoCao?: BaoCaoKiemTuoi;
  readmeMoi: string | null;
  dungLuongConLai: number | null;
  thoiDiemReset: number | null;
  canDungTruocKhiXong?: boolean;
}

function demDoanChung(cu: string[], moi: string[]): { giu: number; them: number; xoa: number } {
  const demCu = new Map<string, number>();
  const demMoi = new Map<string, number>();
  for (const maBam of cu) demCu.set(maBam, (demCu.get(maBam) ?? 0) + 1);
  for (const maBam of moi) demMoi.set(maBam, (demMoi.get(maBam) ?? 0) + 1);
  let giu = 0;
  for (const [maBam, soLuong] of demCu) giu += Math.min(soLuong, demMoi.get(maBam) ?? 0);
  return { giu, them: moi.length - giu, xoa: cu.length - giu };
}

function tinhTiLeDoi(them: number, xoa: number, tongCu: number): number | null {
  if (!tongCu) return them ? 1 : 0;
  // Một đoạn sửa được tính là một thay đổi dù nó đồng thời tạo đoạn mới và xóa đoạn cũ.
  return Math.max(them, xoa) / tongCu;
}

function tinhShaReadme(readme: string): string {
  return createHash('sha256').update(readme.trim()).digest('hex');
}

export function phanLoaiRepo(repo: string, data: RepoGithub): BaoCaoKiemTuoi {
  const tenMoi = data.full_name ?? null;
  const doiTen = Boolean(tenMoi && tenMoi.toLowerCase() !== repo.toLowerCase());
  const coBan: BaoCaoKiemTuoi = {
    repo,
    loai: 'khong_doi',
    tenMoi,
    archived: data.archived ?? false,
    disabled: data.disabled ?? false,
    private: data.private ?? false,
    fork: data.fork ?? false,
    saoHienTai: data.stargazers_count ?? null,
    pushedAt: data.pushed_at ?? null,
  };
  if (doiTen) return { ...coBan, loai: 'doi_ten' };
  if (data.archived) return { ...coBan, loai: 'luu_tru' };
  if (data.private || data.disabled) return { ...coBan, loai: 'rieng_tu_hoac_bi_chan' };
  return coBan;
}

function taoBaoCaoLoi(repo: string, lyDo: string): BaoCaoKiemTuoi {
  return { repo, loai: 'loi_goi_api', lyDo };
}

async function layJson<T>(ketQua: KetQuaHttp): Promise<T | null> {
  if ([301, 304, 404].includes(ketQua.response.status)) return null;
  if (!ketQua.response.ok) throw new Error(`HTTP ${ketQua.response.status}`);
  return (await ketQua.response.json()) as T;
}

function giaiMaReadme(data: ReadmeGithub | null): string | null {
  if (!data?.content || data.encoding !== 'base64') return null;
  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

export async function kiemTraMotRepo(
  cao: BanGhiDaCao,
  cu: DongDaKiem | undefined,
  yeuCau: YeuCauHttp,
  taoDongMoi: TaoDoanTuReadme,
): Promise<KetQuaKiemMotRepo> {
  if (!cao.idGithub)
    return {
      baoCao: taoBaoCaoLoi(cao.repo, 'Thiếu idGithub trong dữ liệu cào.'),
      readmeMoi: null,
      dungLuongConLai: null,
      thoiDiemReset: null,
    };
  let conLai: number | null = null;
  let reset: number | null = null;
  let statusRepo: number | undefined;
  let statusReadme: number | undefined;
  try {
    const repoHttp = await yeuCau(
      `https://api.github.com/repositories/${cao.idGithub}`,
      cao.etagRepo,
    );
    statusRepo = repoHttp.response.status;
    conLai = repoHttp.dungLuongConLai;
    reset = repoHttp.thoiDiemReset;
    if (conLai !== null && conLai < 200)
      return {
        readmeMoi: null,
        dungLuongConLai: conLai,
        thoiDiemReset: reset,
        canDungTruocKhiXong: true,
      };
    if (repoHttp.response.status === 404)
      return {
        baoCao: { repo: cao.repo, loai: 'da_xoa', statusRepo },
        readmeMoi: null,
        dungLuongConLai: conLai,
        thoiDiemReset: reset,
      };
    const repoData = await layJson<RepoGithub>(repoHttp);
    const redirect = repoHttp.response.headers.get('location');
    const tenRedirect = redirect?.match(/\/repos\/([^/]+\/[^/?#]+)/)?.[1];
    const metadata = repoData
      ? phanLoaiRepo(cao.repo, repoData)
      : tenRedirect
        ? phanLoaiRepo(cao.repo, { full_name: tenRedirect })
        : { repo: cao.repo, loai: 'khong_doi' as const };
    const metadataCoStatus = { ...metadata, statusRepo };
    const tenApi = repoData?.full_name ?? metadata.tenMoi ?? cao.repo;
    const readmeHttp = await yeuCau(
      `https://api.github.com/repos/${tenApi}/readme`,
      cao.etagReadme,
    );
    statusReadme = readmeHttp.response.status;
    conLai = readmeHttp.dungLuongConLai ?? conLai;
    reset = readmeHttp.thoiDiemReset ?? reset;
    if (readmeHttp.response.status === 404)
      return {
        baoCao: {
          ...metadataCoStatus,
          statusReadme,
          loai: metadata.loai === 'khong_doi' ? 'loi_goi_api' : metadata.loai,
          ...(metadata.loai === 'khong_doi'
            ? { lyDo: 'README không tồn tại hoặc không truy cập được.' }
            : {}),
        },
        readmeMoi: null,
        dungLuongConLai: conLai,
        thoiDiemReset: reset,
      };
    if (readmeHttp.response.status === 304)
      return {
        baoCao: { ...metadataCoStatus, statusReadme },
        readmeMoi: null,
        dungLuongConLai: conLai,
        thoiDiemReset: reset,
      };
    const readmeData = await layJson<ReadmeGithub>(readmeHttp);
    const readmeMoi = giaiMaReadme(readmeData);
    if (!readmeMoi)
      return {
        baoCao: {
          ...metadataCoStatus,
          statusReadme,
          loai: 'loi_goi_api',
          lyDo: 'API không trả nội dung README dạng base64.',
        },
        readmeMoi: null,
        dungLuongConLai: conLai,
        thoiDiemReset: reset,
      };
    const dongMoi = taoDongMoi({ ...cao, repo: tenApi, readmeEn: readmeMoi });
    const dem = demDoanChung(
      cu?.doan.map((doan) => doan.maBam) ?? [],
      dongMoi.map((doan) => doan.maBam),
    );
    const tiLeDoi = tinhTiLeDoi(dem.them, dem.xoa, cu?.doan.length ?? 0);
    const loaiReadme: LoaiKiemTuoi = (tiLeDoi ?? 0) < 0.05 ? 'readme_doi_nhe' : 'readme_doi_nhieu';
    const baoCao =
      metadata.loai === 'khong_doi' ? { ...metadataCoStatus, loai: loaiReadme } : metadataCoStatus;
    return {
      baoCao: {
        ...baoCao,
        statusReadme,
        readmeShaMoi: tinhShaReadme(readmeMoi),
        soDoanGiuNguyen: dem.giu,
        soDoanMoi: dem.them,
        soDoanXoa: dem.xoa,
        tiLeDoi,
      },
      readmeMoi,
      dungLuongConLai: conLai,
      thoiDiemReset: reset,
    };
  } catch (error) {
    const lyDo = error instanceof Error ? error.message : 'Lỗi không xác định.';
    return {
      baoCao: {
        ...taoBaoCaoLoi(cao.repo, lyDo),
        ...(statusRepo ? { statusRepo } : {}),
        ...(statusReadme ? { statusReadme } : {}),
      },
      readmeMoi: null,
      dungLuongConLai: conLai,
      thoiDiemReset: reset,
    };
  }
}

export interface TienIchChayKiemTuoi {
  yeuCau: YeuCauHttp;
  taoDongMoi: TaoDoanTuReadme;
  ngu: (ms: number) => Promise<void>;
}

export async function chayKiemTuoi(
  danhSach: TienDoKiemTuoi[],
  daCo: Set<string>,
  tienIch: TienIchChayKiemTuoi,
  ghiNhan: (ketQua: Awaited<ReturnType<typeof kiemTraMotRepo>>, cao: BanGhiDaCao) => void,
  capSoRepo = Number.POSITIVE_INFINITY,
): Promise<{ daXuLy: number; dungViHanMuc: boolean; thoiDiemReset: number | null }> {
  let daXuLy = 0;
  let dungViHanMuc = false;
  let thoiDiemReset: number | null = null;
  const choXuLy = danhSach
    .filter((muc) => !daCo.has(muc.cao.repo.toLowerCase()))
    .slice(0, capSoRepo);
  let viTri = 0;
  const congNhan = async () => {
    while (!dungViHanMuc) {
      const muc = choXuLy[viTri++];
      if (!muc) return;
      const ketQua = await kiemTraMotRepo(muc.cao, muc.daKiem, tienIch.yeuCau, tienIch.taoDongMoi);
      if (ketQua.baoCao) {
        ghiNhan(ketQua, muc.cao);
        daXuLy++;
      }
      if (ketQua.dungLuongConLai !== null && ketQua.dungLuongConLai < 200) {
        dungViHanMuc = true;
        thoiDiemReset = ketQua.thoiDiemReset;
      }
      if (ketQua.canDungTruocKhiXong) {
        dungViHanMuc = true;
        thoiDiemReset = ketQua.thoiDiemReset;
      }
      await tienIch.ngu(0);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, choXuLy.length) }, congNhan));
  return { daXuLy, dungViHanMuc, thoiDiemReset };
}

export function layChuaXuLy(danhSach: TienDoKiemTuoi[], daCo: Set<string>): TienDoKiemTuoi[] {
  return danhSach.filter((muc) => !daCo.has(muc.cao.repo.toLowerCase()));
}

export function thongKeDoanCuMoi(
  cu: string[],
  moi: string[],
): { giu: number; them: number; xoa: number; tiLeDoi: number | null } {
  const dem = demDoanChung(cu, moi);
  return { ...dem, tiLeDoi: tinhTiLeDoi(dem.them, dem.xoa, cu.length) };
}
