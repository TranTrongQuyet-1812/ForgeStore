import { describe, expect, it } from 'vitest';
import { timTrungLap } from './data-repo.trung-lap';

describe('timTrungLap', () => {
  it('không có trùng thì trả rỗng', () => {
    expect(
      timTrungLap([
        { repo: 'a/x', idGithub: 1, readmeSha: 'h1', readmeDai: 500 },
        { repo: 'b/y', idGithub: 2, readmeSha: 'h2', readmeDai: 500 },
      ]),
    ).toEqual([]);
  });

  it('cùng id GitHub nhưng khác tên (repo đổi tên hoặc chuyển chủ) bị bắt', () => {
    const kq = timTrungLap([
      { repo: 'old/app', idGithub: 42 },
      { repo: 'new/app', idGithub: 42 },
    ]);
    expect(kq).toEqual([{ loai: 'trung_id', khoa: '42', repo: ['old/app', 'new/app'] }]);
  });

  it('cùng tên chỉ khác hoa thường là cùng một repo, không phải trùng', () => {
    expect(timTrungLap([{ repo: 'Foo/Bar' }, { repo: 'foo/bar' }])).toEqual([]);
  });

  it('README giống hệt giữa hai repo khác nhau bị bắt', () => {
    const kq = timTrungLap([
      { repo: 'a/app', readmeSha: 'same', readmeDai: 1200 },
      { repo: 'b/app-mirror', readmeSha: 'same', readmeDai: 1200 },
    ]);
    expect(kq).toEqual([{ loai: 'trung_readme', khoa: 'same', repo: ['a/app', 'b/app-mirror'] }]);
  });

  it('README quá ngắn không tính là trùng', () => {
    expect(
      timTrungLap([
        { repo: 'a/x', readmeSha: 'tpl', readmeDai: 12 },
        { repo: 'b/y', readmeSha: 'tpl', readmeDai: 12 },
      ]),
    ).toEqual([]);
  });

  it('cùng một repo xuất hiện ở đợt và lô con không bị tính là trùng', () => {
    expect(
      timTrungLap([
        { repo: 'a/x', lo: 'dot-01', idGithub: 7, readmeSha: 'h', readmeDai: 900 },
        { repo: 'a/x', lo: 'dot-01-l001', idGithub: 7, readmeSha: 'h', readmeDai: 900 },
      ]),
    ).toEqual([]);
  });
});
