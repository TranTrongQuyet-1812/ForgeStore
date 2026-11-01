import { describe, expect, it } from 'vitest';
import { doBocTach, duDoanTrangThaiTuReadme } from './do-boc-tach.core';

describe('do-boc-tach.core', () => {
  it('đếm repo có lệnh quen thuộc, repo được nhận, repo bỏ sót và nhóm trình quản lý', () => {
    const result = doBocTach([
      {
        repo: 'owner/cli',
        lo: 'l001',
        caoLuc: '',
        sao: 0,
        moTaEn: null,
        readmeEn: '## Installation\n```sh\nnpm install -g tool@latest\n```',
        readmeSha: null,
        etagRepo: null,
        etagReleases: null,
        etagReadme: null,
      },
      {
        repo: 'owner/source',
        lo: 'l001',
        caoLuc: '',
        sao: 0,
        moTaEn: null,
        readmeEn: '## Installation\n```sh\nchoco install tool\n```',
        readmeSha: null,
        etagRepo: null,
        etagReleases: null,
        etagReadme: null,
      },
    ]);

    expect(result).toMatchObject({
      tongRepo: 2,
      repoCoLenh: 2,
      repoDuocNhan: 1,
      repoBoSot: 1,
      theoQuanLy: expect.objectContaining({ npm: 1, choco: 1 }),
    });
    expect(result.dongBoSot[0]).toMatchObject({ repo: 'owner/source', quanLy: 'choco' });
  });

  it('dự đoán trạng thái CLI từ README mà không phụ thuộc vào mạng', () => {
    expect(duDoanTrangThaiTuReadme('## Install\n```sh\nnpm install -g tool\n```')).toBe(
      'HOAT_DONG',
    );
    expect(duDoanTrangThaiTuReadme('# Library\nNo installer')).toBe('KHONG_CO_BAN_CAI');
  });
});
