import { describe, expect, it } from 'vitest';
import {
  coLenhCaiTuReadme,
  danhGiaRelease,
  locCucBo,
  trongDanhSachChan,
  type RepoUngVien,
} from './bo-loc-nap-repo.util';

const NOW = new Date('2026-10-10T00:00:00Z');

function repo(p: Partial<RepoUngVien> = {}): RepoUngVien {
  return {
    full_name: 'o/app',
    name: 'app',
    description: 'A nice app',
    stargazers_count: 5000,
    fork: false,
    archived: false,
    pushed_at: '2026-09-01T00:00:00Z',
    license: { spdx_id: 'MIT' },
    topics: [],
    ...p,
  };
}

describe('locCucBo (P3B-06.3 bộ lọc 1 đến 5 và 7)', () => {
  it('repo tốt đạt', () => {
    expect(locCucBo(repo(), NOW).dat).toBe(true);
  });
  it('dưới 1.000 sao, fork, archived bị loại với mã đúng', () => {
    expect(locCucBo(repo({ stargazers_count: 999 }), NOW).lyDo).toBe('IT_SAO');
    expect(locCucBo(repo({ fork: true }), NOW).lyDo).toBe('LA_FORK');
    expect(locCucBo(repo({ archived: true }), NOW).lyDo).toBe('DA_LUU_TRU');
  });
  it('push quá 24 tháng bị loại', () => {
    expect(locCucBo(repo({ pushed_at: '2024-01-01T00:00:00Z' }), NOW).lyDo).toBe(
      'KHONG_CON_CAP_NHAT',
    );
  });
  it('không có giấy phép bị loại, còn NOASSERTION và other thì đạt (D-36)', () => {
    expect(locCucBo(repo({ license: null }), NOW).lyDo).toBe('KHONG_CO_GIAY_PHEP');
    expect(locCucBo(repo({ license: { spdx_id: 'NOASSERTION' } }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ license: { spdx_id: 'other' } }), NOW).dat).toBe(true);
  });
  it('7-Zip là ngoại lệ duy nhất cho repo không nhận ra giấy phép (Chủ chốt 06/11/2026)', () => {
    expect(locCucBo(repo({ full_name: 'ip7z/7zip', license: null }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ full_name: 'IP7Z/7Zip', license: null }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ full_name: 'khac/7zip', license: null }), NOW).lyDo).toBe(
      'KHONG_CO_GIAY_PHEP',
    );
  });
  it('danh sách chặn bắt crack, keygen, awesome-*, nhưng không chặn nhầm tên thường', () => {
    expect(trongDanhSachChan(repo({ name: 'photoshop-crack' }))).toBe('crack');
    expect(trongDanhSachChan(repo({ description: 'Free KeyGen for ...' }))).toMatch(/keygen/i);
    expect(trongDanhSachChan(repo({ name: 'awesome-windows' }))).toBe('awesome-*');
    expect(trongDanhSachChan(repo({ topics: ['awesome-list'] }))).not.toBeNull();
    expect(
      trongDanhSachChan(repo({ name: 'cracklib', description: 'password strength' })),
    ).toBeNull();
    expect(trongDanhSachChan(repo({ name: 'obsidian', description: 'Knowledge base' }))).toBeNull();
  });
});

describe('danhGiaRelease (bộ lọc 8 và 9)', () => {
  const rel = (p: object) => ({
    draft: false,
    prerelease: false,
    published_at: '2026-08-01T00:00:00Z',
    tag_name: 'v1.0.0',
    assets: [{ name: 'app-setup-x64.exe' }],
    ...p,
  });

  it('có tệp cài Windows trong release chính thức thì đạt', () => {
    const kq = danhGiaRelease([rel({})], NOW);
    expect(kq.dat).toBe(true);
    expect(kq.chiCoApk).toBe(false);
    expect(kq.lauChuaCapNhat).toBe(false);
  });
  it('pre-release và bản nháp không tính', () => {
    const kq = danhGiaRelease([rel({ prerelease: true }), rel({ draft: true })], NOW);
    expect(kq.lyDo).toBe('KHONG_CO_BAN_PHAT_HANH');
  });
  it('release chính thức mới nhất không có tệp cài thì bị loại', () => {
    const kq = danhGiaRelease([rel({ assets: [{ name: 'app-linux-amd64.tar.gz' }] })], NOW);
    expect(kq.lyDo).toBe('KHONG_CO_FILE_CAI');
  });
  it('P3B-36: Ghidra chỉ có một ZIP không ghi hệ điều hành thì đạt; hai ZIP thì vẫn bị loại', () => {
    const ghidra = danhGiaRelease(
      [rel({ assets: [{ name: 'ghidra_12.2_PUBLIC_20261016.zip' }] })],
      NOW,
    );
    expect(ghidra.dat).toBe(true);
    const haiZip = danhGiaRelease(
      [rel({ assets: [{ name: 'tool-1.0.zip' }, { name: 'tool-1.0-extra.zip' }] })],
      NOW,
    );
    expect(haiZip.lyDo).toBe('KHONG_CO_FILE_CAI');
  });
  it('chỉ có APK thì đạt nhưng đánh dấu chiCoApk', () => {
    const kq = danhGiaRelease([rel({ assets: [{ name: 'app-1.0.apk' }] })], NOW);
    expect(kq.dat).toBe(true);
    expect(kq.chiCoApk).toBe(true);
  });
  it('quá 36 tháng bị loại; quá 12 tháng gắn nhãn lâu chưa cập nhật', () => {
    expect(danhGiaRelease([rel({ published_at: '2023-01-01T00:00:00Z' })], NOW).lyDo).toBe(
      'KHONG_CON_CAP_NHAT',
    );
    const kq = danhGiaRelease([rel({ published_at: '2025-06-01T00:00:00Z' })], NOW);
    expect(kq.dat).toBe(true);
    expect(kq.lauChuaCapNhat).toBe(true);
  });
  it('lấy release chính thức mới nhất theo ngày', () => {
    const kq = danhGiaRelease(
      [
        rel({ tag_name: 'v1', published_at: '2026-01-01T00:00:00Z' }),
        rel({ tag_name: 'v2', published_at: '2026-06-01T00:00:00Z' }),
      ],
      NOW,
    );
    expect(kq.tenBanPhatHanh).toBe('v2');
  });
});

describe('coLenhCaiTuReadme (bộ lọc 10)', () => {
  it('README có lệnh winget trong mục cài đặt thì nhận', () => {
    const readme = '# Foo\n\n## Installation\n\n```\nwinget install Foo.Bar\n```\n';
    expect(coLenhCaiTuReadme(readme, 'o/foo')).toBe(true);
  });
  it('README không có lệnh cài thì loại', () => {
    expect(coLenhCaiTuReadme('# Foo\n\nA library for things.', 'o/foo')).toBe(false);
  });
  it('README rỗng hoặc null thì loại', () => {
    expect(coLenhCaiTuReadme('', 'o/foo')).toBe(false);
    expect(coLenhCaiTuReadme(null, 'o/foo')).toBe(false);
  });
});
