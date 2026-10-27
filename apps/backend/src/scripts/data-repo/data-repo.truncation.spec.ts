import { describe, expect, it } from 'vitest';
import { kiemTraDongDaDich, taoDongChoDich, tinhMaBam } from './data-repo.core';
import type { BanGhiDaCao, DongDich } from './data-repo.types';

const DAI =
  'This README paragraph contains enough source text to measure a translation ratio. '.repeat(12);
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

describe('Đo tỷ lệ độ dài bản dịch để chờ benchmark chốt ngưỡng', () => {
  it('ghi nhận tỷ lệ ngắn mà không tự đặt ngưỡng loại', () => {
    const cao = banCao();
    const dong: DongDich = taoDongChoDich(cao);
    dong.moTaVi = 'Một công cụ';
    const doanDai = dong.doan.find((d) => d.canDich && d.vanBanDaChe.length > 300)!;
    for (const doan of dong.doan) {
      if (doan.canDich) doan.vi = doan === doanDai ? 'Bản dịch ngắn.' : 'Công cụ';
    }
    const kq = kiemTraDongDaDich(cao, dong, 'x');
    const tiLeDuKien =
      'Bản dịch ngắn.'.replace(/\s/g, '').length / doanDai.vanBanDaChe.replace(/\s/g, '').length;
    expect(kq.dat).not.toBeNull();
    expect(kq.dat!.tiLeDoDaiDoan[doanDai.stt - 1]).toBeCloseTo(tiLeDuKien);
    expect(kq.dat!.canhBaoChatLuong).toContain('nguong_do_dai_cho_benchmark');
  });

  it('bản dịch đủ dài và đúng cấu trúc đạt', () => {
    const cao = banCao();
    const dong = taoDongChoDich(cao);
    dong.moTaVi = 'Một công cụ';
    for (const d of dong.doan) {
      if (!d.canDich) continue;
      d.vi =
        d.vanBanDaChe.length > 300
          ? 'Bản dịch đầy đủ theo từng dòng. '.repeat(30)
          : d.vanBanDaChe.replace(/Tool/g, 'Công cụ');
    }
    expect(kiemTraDongDaDich(cao, dong, 'x').dat).not.toBeNull();
  });
});
