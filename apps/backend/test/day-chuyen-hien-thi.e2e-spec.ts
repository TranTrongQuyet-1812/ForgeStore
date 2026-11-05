import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { GithubService } from '../src/modules/github/github.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { UngDungService } from '../src/modules/ung-dung/ung-dung.service';
import { DayChuyenNapRepoService } from '../src/modules/ung-dung/services/day-chuyen-nap-repo.service';
import { TheoDoiThayDoiService } from '../src/modules/ung-dung/services/theo-doi-thay-doi.service';
import { chanMoiTruongThat, lamSachDuLieu } from './tien-ich-e2e';

/**
 * P3B-25.9: test toàn dây chuyền trạng thái hiển thị trên Postgres thật, qua đúng các đường vào thật
 * (nạp tự động, job theo dõi thay đổi, đồng bộ lại). GitHub là bản giả điều khiển được từng ca.
 */

const README_CO_LENH = '# Tool\n\n## Install\n\n```sh\nnpm install -g tool\n```\n';
const README_KHONG_LENH = '# Tool\n\nA library. Read the docs.\n';

const repoGithub = (ten: string) => {
  const [owner = '', name = ''] = ten.split('/');
  return {
    id: 1,
    name,
    full_name: ten,
    owner: { login: owner },
    html_url: `https://github.com/${ten}`,
    description: 'A tool',
    stargazers_count: 5000,
    forks_count: 10,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    language: 'TypeScript',
    topics: [],
    updated_at: '2026-11-01T00:00:00Z',
    pushed_at: '2026-11-01T00:00:00Z',
    archived: false,
  };
};

const release = (tag: string, tenTep: string[] = []) => ({
  id: 1,
  tag_name: tag,
  name: tag,
  body: '',
  draft: false,
  prerelease: false,
  created_at: '2026-10-20T00:00:00Z',
  published_at: '2026-10-20T00:00:00Z',
  assets: tenTep.map((name, i) => ({
    id: i + 1,
    name,
    size: 1024,
    browser_download_url: `https://example.com/${name}`,
    content_type: 'application/octet-stream',
    download_count: 0,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  })),
});

const github = {
  layRepo: vi.fn(async (owner: string, repo: string) => repoGithub(`${owner}/${repo}`)),
  layDanhSachRelease: vi.fn(async () => [] as ReturnType<typeof release>[]),
  layReadme: vi.fn(async () => README_CO_LENH as string | null),
  graphql: vi.fn(),
  hoiCoDieuKien: vi.fn(),
  getRateLimitInfo: vi.fn(() => ({ remaining: 4900, limit: 5000, reset: 0 })),
};

const readmeGithub = (noiDung: string) => ({
  trangThai: 200,
  duLieu: { content: Buffer.from(noiDung).toString('base64'), encoding: 'base64' },
  etag: '"readme-moi"',
});

describe('Dây chuyền trạng thái hiển thị (P3B-25.9, D-30)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const trangThai = async (ten: string) =>
    (await prisma.ungDung.findUnique({ where: { tenRepoDayDu: ten } }))?.trangThai;

  beforeAll(async () => {
    chanMoiTruongThat();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GithubService)
      .useValue(github)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await lamSachDuLieu(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    github.layReadme.mockImplementation(async () => README_CO_LENH);
    github.layDanhSachRelease.mockImplementation(async () => []);
  });

  it('1. repo chỉ cài bằng lệnh mới nạp qua dây chuyền tự động thì hiện', async () => {
    await prisma.ungVienRepo.create({ data: { tenRepoDayDu: 'cli/tool', nguonKhamPha: 'e2e' } });
    github.graphql.mockResolvedValue({
      r0: {
        nameWithOwner: 'cli/tool',
        name: 'tool',
        description: 'A tool',
        stargazerCount: 5000,
        isFork: false,
        isArchived: false,
        pushedAt: new Date().toISOString(),
        licenseInfo: { spdxId: 'MIT' },
        repositoryTopics: { nodes: [] },
        latestRelease: null,
      },
    });
    const kq = await app.get(DayChuyenNapRepoService).sangLocVaNapLauNho(10, true);
    expect(kq.soLuongDaNap).toBe(1);
    expect(await trangThai('cli/tool')).toBe('HOAT_DONG');
    const uv = await prisma.ungVienRepo.findUnique({ where: { tenRepoDayDu: 'cli/tool' } });
    expect(uv?.trangThai).toBe('DA_NAP');
  });

  it('2. đồng bộ lại qua job theo dõi khi có bản mới (không có tệp cài) vẫn giữ hiện', async () => {
    github.hoiCoDieuKien
      .mockResolvedValueOnce({ trangThai: 304 })
      .mockResolvedValueOnce({ trangThai: 200, duLieu: [release('v2.0.0')], etag: '"rel"' })
      .mockResolvedValueOnce({ trangThai: 304 });
    github.layDanhSachRelease.mockImplementation(async () => [release('v2.0.0')]);
    await app.get(TheoDoiThayDoiService).quetMotLuot(10, true);
    expect(await trangThai('cli/tool')).toBe('HOAT_DONG');
    const ban = await prisma.banPhatHanh.findFirst({ where: { tenPhienBan: 'v2.0.0' } });
    expect(ban).not.toBeNull();
  });

  it('3. README đổi mất lệnh cài, không có tệp cài thì ẩn', async () => {
    await prisma.ungDung.update({
      where: { tenRepoDayDu: 'cli/tool' },
      data: { lanKiemTiepTheo: null },
    });
    github.hoiCoDieuKien
      .mockResolvedValueOnce({ trangThai: 304 })
      .mockResolvedValueOnce({ trangThai: 304 })
      .mockResolvedValueOnce(readmeGithub(README_KHONG_LENH));
    await app.get(TheoDoiThayDoiService).quetMotLuot(10, true);
    expect(await trangThai('cli/tool')).toBe('KHONG_CO_BAN_CAI');
  });

  it('4. lỗi mạng khi lấy README lúc đồng bộ lại (chưa có hướng dẫn lưu sẵn) thì giữ trạng thái cũ, không hạ', async () => {
    await prisma.ungDung.update({
      where: { tenRepoDayDu: 'cli/tool' },
      data: { trangThai: 'HOAT_DONG' },
    });
    github.layReadme.mockRejectedValue(new Error('fetch failed'));
    await app.get(UngDungService).dongBoRepo('cli', 'tool');
    expect(await trangThai('cli/tool')).toBe('HOAT_DONG');
  });

  it('5. repo vừa có tệp cài vừa có lệnh cài thì hiện, lưu tệp cài Windows', async () => {
    github.layDanhSachRelease.mockImplementation(async () => [
      release('v1.0.0', ['app-setup-x64.exe', 'app-1.0.0-src.tar.gz']),
    ]);
    await app.get(UngDungService).dongBoRepo('both', 'app');
    const ud = await prisma.ungDung.findUnique({
      where: { tenRepoDayDu: 'both/app' },
      include: { danhSachPhatHanh: { include: { danhSachTepCaiDat: true } } },
    });
    expect(ud?.trangThai).toBe('HOAT_DONG');
    expect(ud?.nenTangHoTro).toBe('WINDOWS');
    expect(ud?.danhSachPhatHanh[0]?.danhSachTepCaiDat.map((t) => t.tenTep)).toEqual([
      'app-setup-x64.exe',
    ]);
  });
});
