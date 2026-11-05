import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import {
  AppTheoDoi,
  KetQuaQuet,
  TheoDoiThayDoiService,
  tenBanMoiNhat,
  tinhMucDoNong,
} from './theo-doi-thay-doi.service';

const now = new Date('2026-11-06T00:00:00Z');
const ngayTruoc = (n: number) => new Date(now.getTime() - n * 86400000);

const app = (ghiDe: Partial<AppTheoDoi> = {}): AppTheoDoi => ({
  maUngDung: 'app-1',
  tenRepoDayDu: 'chu/ung-dung',
  trangThai: 'HOAT_DONG',
  readmeSha: 'sha-cu',
  moTaGocTiengAnh: 'Old description',
  loaiGiayPhep: 'MIT License',
  daLuuTru: false,
  soSaoGithub: 5000,
  pushedAt: ngayTruoc(10),
  etagRepo: '"r1"',
  etagReleases: '"l1"',
  etagReadme: '"m1"',
  danhSachPhatHanh: [{ tenPhienBan: 'v1.0.0', ngayPhatHanh: ngayTruoc(90) }],
  _count: { danhSachDaCai: 0, danhSachYeuThich: 0 },
  ...ghiDe,
});

describe('tinhMucDoNong và tenBanMoiNhat (P3B-07.9)', () => {
  it('nóng khi có bản mới trong 30 ngày, có người dùng, hoặc rất nhiều sao; lạnh khi 180 ngày không push', () => {
    expect(
      tinhMucDoNong(
        app({ danhSachPhatHanh: [{ tenPhienBan: 'v2', ngayPhatHanh: ngayTruoc(5) }] }),
        now,
      ),
    ).toBe('NONG');
    expect(tinhMucDoNong(app({ _count: { danhSachDaCai: 1, danhSachYeuThich: 0 } }), now)).toBe(
      'NONG',
    );
    expect(tinhMucDoNong(app({ soSaoGithub: 25000 }), now)).toBe('NONG');
    expect(tinhMucDoNong(app({ pushedAt: ngayTruoc(400) }), now)).toBe('LANH');
    expect(tinhMucDoNong(app(), now)).toBe('AM');
  });

  it('bản mới nhất bỏ bản nháp, xét theo ngày đăng', () => {
    const r = (tag: string, ngay: string, draft = false) =>
      ({ tag_name: tag, published_at: ngay, draft }) as never;
    expect(
      tenBanMoiNhat([r('v1', '2026-01-01'), r('v3', '2026-03-01', true), r('v2', '2026-02-01')]),
    ).toBe('v2');
    expect(tenBanMoiNhat([])).toBeNull();
  });
});

describe('TheoDoiThayDoiService.kiemMotApp (P3B-07)', () => {
  const prisma = {
    ungDung: { update: vi.fn(), findMany: vi.fn() },
    banDichReadme: { updateMany: vi.fn() },
    phanTichAI: { updateMany: vi.fn() },
    tepCaiDat: { count: vi.fn() },
    ungVienRepo: { createMany: vi.fn() },
  };
  const github = { hoiCoDieuKien: vi.fn(), getRateLimitInfo: vi.fn() };
  const cache = { xoaTheoPrefix: vi.fn(), tangSo: vi.fn() };
  const apps = { dongBoRepo: vi.fn() };
  const config = { get: vi.fn((_k: string, d: unknown) => d) };
  let service: TheoDoiThayDoiService;
  let ketQua: KetQuaQuet;

  const repoGithub = (ghiDe: Record<string, unknown> = {}) => ({
    full_name: 'chu/ung-dung',
    description: 'Old description',
    archived: false,
    stargazers_count: 5100,
    forks_count: 10,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    pushed_at: ngayTruoc(1).toISOString(),
    ...ghiDe,
  });
  /** Trả lần lượt cho 3 nguồn: thông tin repo, bản phát hành, README. */
  const traVe = (...kq: unknown[]) =>
    kq.forEach((k) => github.hoiCoDieuKien.mockResolvedValueOnce(k));
  const khongDoi = { trangThai: 304 };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.banDichReadme.updateMany.mockResolvedValue({ count: 0 });
    service = new TheoDoiThayDoiService(
      prisma as never,
      github as never,
      cache as never,
      apps as never,
      config as never,
    );
    ketQua = { soApp: 0, soKhongDoi: 0, soCoDoi: 0, soYeuCau: 0, so304: 0 };
  });

  it('cả 3 nguồn trả 304: không đổi gì ngoài lịch quét kế tiếp, gửi đúng ETag đã lưu trong DB', async () => {
    traVe(khongDoi, khongDoi, khongDoi);
    expect(await service.kiemMotApp(app(), ketQua)).toBe(false);
    expect(github.hoiCoDieuKien.mock.calls.map((c) => c[1])).toEqual(['"r1"', '"l1"', '"m1"']);
    expect(ketQua).toMatchObject({ soYeuCau: 3, so304: 3 });
    expect(prisma.ungDung.update).toHaveBeenCalledTimes(1);
    expect(prisma.ungDung.update.mock.calls[0]![0].data).toEqual({
      mucDoNong: 'AM',
      lanKiemTiepTheo: expect.any(Date),
    });
    expect(cache.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('repo bị xóa (404): ẩn khỏi Store, không xóa dữ liệu, dừng các nguồn còn lại', async () => {
    traVe({ trangThai: 404 });
    expect(await service.kiemMotApp(app(), ketQua)).toBe(true);
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { trangThai: 'REPO_DA_XOA' },
    });
    expect(github.hoiCoDieuKien).toHaveBeenCalledTimes(1);
    expect(cache.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
  });

  it('repo đổi tên: ẩn bản cũ và đưa tên mới vào hàng chờ ưu tiên 1', async () => {
    traVe({ trangThai: 200, duLieu: repoGithub({ full_name: 'chu-moi/ten-moi' }), etag: '"r2"' });
    await service.kiemMotApp(app(), ketQua);
    expect(prisma.ungVienRepo.createMany).toHaveBeenCalledWith({
      data: [{ tenRepoDayDu: 'chu-moi/ten-moi', nguonKhamPha: 'doi_ten', doUuTien: 1 }],
      skipDuplicates: true,
    });
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { trangThai: 'REPO_DOI_TEN' },
    });
  });

  it('mất giấy phép: ẩn; archive: chỉ đặt cờ và vẫn hiện (D-29), xóa cache để thấy nhãn ngay', async () => {
    traVe({ trangThai: 200, duLieu: repoGithub({ license: null }) });
    await service.kiemMotApp(app(), ketQua);
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { trangThai: 'KHONG_CON_GIAY_PHEP' },
    });

    vi.clearAllMocks();
    prisma.banDichReadme.updateMany.mockResolvedValue({ count: 0 });
    traVe(
      { trangThai: 200, duLieu: repoGithub({ archived: true }), etag: '"r2"' },
      khongDoi,
      khongDoi,
    );
    expect(await service.kiemMotApp(app(), ketQua)).toBe(true);
    expect(prisma.ungDung.update.mock.calls[0]![0].data).toMatchObject({
      daLuuTru: true,
      etagRepo: '"r2"',
    });
    expect(prisma.ungDung.update.mock.calls[0]![0].data.trangThai).toBeUndefined();
    expect(cache.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:detail:app-1');
  });

  it('mô tả đổi: lưu mô tả mới (dịch lại tự chạy vì mã băm lệch) và xóa cache; chỉ đổi sao thì không xóa cache', async () => {
    traVe(
      { trangThai: 200, duLieu: repoGithub({ description: 'New description' }), etag: '"r2"' },
      khongDoi,
      khongDoi,
    );
    await service.kiemMotApp(app(), ketQua);
    expect(prisma.ungDung.update.mock.calls[0]![0].data.moTaGocTiengAnh).toBe('New description');
    expect(cache.xoaTheoPrefix).toHaveBeenCalled();

    vi.clearAllMocks();
    traVe({ trangThai: 200, duLieu: repoGithub(), etag: '"r2"' }, khongDoi, khongDoi);
    expect(await service.kiemMotApp(app(), ketQua)).toBe(false);
    expect(cache.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('có bản phát hành mới: đồng bộ lại qua dongBoRepo và lưu ETag mới', async () => {
    traVe(
      khongDoi,
      {
        trangThai: 200,
        duLieu: [{ tag_name: 'v2.0.0', published_at: '2026-11-01', draft: false }],
        etag: '"l2"',
      },
      khongDoi,
    );
    expect(await service.kiemMotApp(app(), ketQua)).toBe(true);
    expect(apps.dongBoRepo).toHaveBeenCalledWith('chu', 'ung-dung');
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { etagReleases: '"l2"' },
    });
  });

  it('README đổi: đánh dấu bản dịch khác mã băm mới là DA_CU và lưu mã băm mới', async () => {
    const noiDung = '# New README\n';
    traVe(khongDoi, khongDoi, {
      trangThai: 200,
      duLieu: { content: Buffer.from(noiDung).toString('base64'), encoding: 'base64' },
      etag: '"m2"',
    });
    prisma.banDichReadme.updateMany.mockResolvedValue({ count: 1 });
    prisma.tepCaiDat.count.mockResolvedValue(1); // còn tệp cài nên vẫn hiện
    expect(await service.kiemMotApp(app(), ketQua)).toBe(true);
    const sha = createHash('sha256').update(noiDung.trim()).digest('hex');
    expect(prisma.banDichReadme.updateMany).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1', trangThai: 'HOAN_TAT', readmeSha: { not: sha } },
      data: { trangThai: 'DA_CU' },
    });
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { etagReadme: '"m2"', readmeSha: sha },
    });
  });

  it('P3B-25.9: README đổi mất lệnh cài và không có tệp cài thì ẩn; README thêm lệnh cài thì hiện lại', async () => {
    const readme = (s: string) => ({
      trangThai: 200,
      duLieu: { content: Buffer.from(s).toString('base64'), encoding: 'base64' },
      etag: '"m2"',
    });
    prisma.tepCaiDat.count.mockResolvedValue(0);
    traVe(khongDoi, khongDoi, readme('# Tool\nNo install section any more.'));
    expect(await service.kiemMotApp(app(), ketQua)).toBe(true);
    expect(prisma.phanTichAI.updateMany.mock.calls[0]![0].data.huongDanCaiDat).toMatchObject({
      khongCoHuongDan: true,
    });
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { trangThai: 'KHONG_CO_BAN_CAI' },
    });

    vi.clearAllMocks();
    prisma.banDichReadme.updateMany.mockResolvedValue({ count: 0 });
    prisma.tepCaiDat.count.mockResolvedValue(0);
    traVe(khongDoi, khongDoi, readme('# Tool\n## Install\n```sh\nnpm install -g ung-dung\n```'));
    await service.kiemMotApp(app({ trangThai: 'KHONG_CO_BAN_CAI' }), ketQua);
    expect(prisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: { trangThai: 'HOAT_DONG' },
    });
  });

  it('quetMotLuot: công tắc tắt thì không quét; hạn mức core dưới ngưỡng thì dừng', async () => {
    expect((await service.quetMotLuot()).daNhayQua).toBe(true);
    prisma.ungDung.findMany.mockResolvedValue([app()]);
    github.getRateLimitInfo.mockReturnValue({ remaining: 500 });
    const kq = await service.quetMotLuot(10, true);
    expect(kq.dungVi).toBe('github_rate_limited');
    expect(github.hoiCoDieuKien).not.toHaveBeenCalled();
  });
});
