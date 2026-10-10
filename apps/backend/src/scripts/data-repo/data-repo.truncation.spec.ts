import { describe, expect, it } from 'vitest';
import { kiemTraDongDaDich, taoDongChoDich, tinhMaBam } from './data-repo.core';
import type { BanGhiDaCao, DongDich } from './data-repo.types';

const DAI = Array.from(
  { length: 30 },
  (_, i) => `    -opt${i}, --option-${i}   Mô tả tùy chọn số ${i} dài để đủ ngưỡng kiểm.`,
).join('\n');
const README = ['# Tool', '', DAI].join('\n');

function banCao(): BanGhiDaCao {
  return {
    repo: 'o/tool',
    lo: 'thu',
    caoLuc: '2026-10-10T00:00:00Z',
    sao: 2000,
    moTaEn: 'A tool',
    readmeEn: README,
    readmeSha: tinhMaBam(README),
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
  };
}

describe('Kiểm bản dịch bị cắt (mat_noi_dung)', () => {
  it('bản dịch rút gọn còn dưới 60% bị bắt dù cấu trúc đúng', () => {
    const cao = banCao();
    const dong: DongDich = taoDongChoDich(cao);
    dong.moTaVi = 'Một công cụ';
    const doanDai = dong.doan.find((d) => d.canDich && d.vanBanDaChe.length > 300)!;
    // Giữ đúng số tiêu đề (1) để chỉ còn lỗi cắt cụt
    doanDai.vi = '# Công cụ\n\nTùy chọn chung: xem trợ giúp.';
    const kq = kiemTraDongDaDich(cao, dong, 'x');
    expect(kq.dat).toBeNull();
    expect(kq.loi!.doan.find((d) => d.stt === doanDai.stt)!.loi).toBe('mat_noi_dung');
  });

  it('bản dịch đủ dài và đúng cấu trúc đạt', () => {
    const cao = banCao();
    const dong = taoDongChoDich(cao);
    dong.moTaVi = 'Một công cụ';
    for (const d of dong.doan) {
      if (d.canDich) d.vi = d.vanBanDaChe.replace(/Mô tả/g, 'Mô tả (đã dịch)');
    }
    expect(kiemTraDongDaDich(cao, dong, 'x').dat).not.toBeNull();
  });
});
