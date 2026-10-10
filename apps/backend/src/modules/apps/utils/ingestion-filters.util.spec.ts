import { describe, expect, it } from 'vitest';
import {
  danhGiaRelease,
  locCucBo,
  trongDanhSachChan,
  type RepoUngVien,
} from './ingestion-filters.util';

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
  it('giấy phép trống, NOASSERTION hoặc other chờ duyệt tay', () => {
    expect(locCucBo(repo({ license: null }), NOW).lyDo).toBe('GIAY_PHEP_CAN_DUYET');
    expect(locCucBo(repo({ license: { spdx_id: 'NOASSERTION' } }), NOW).lyDo).toBe(
      'GIAY_PHEP_CAN_DUYET',
    );
    expect(locCucBo(repo({ license: { spdx_id: 'other' } }), NOW).lyDo).toBe('GIAY_PHEP_CAN_DUYET');
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
