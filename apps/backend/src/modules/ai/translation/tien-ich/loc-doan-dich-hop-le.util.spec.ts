import { describe, expect, it } from 'vitest';
import {
  kiemBatBienReadme,
  layLoiBatBienReadme,
  phanTichReadme,
  rapLaiReadme,
} from './readme-markdown-processor.util';
import { locDoanDichHopLe, taoTuyChonKiemReadme } from './loc-doan-dich-hop-le.util';

const README = [
  '# Demo',
  '',
  'Run `npm install` now.',
  '',
  'Use the **fast** mode with `--turbo` flag.',
  '',
  'See [the docs](https://x.dev/docs) for more.',
  '',
].join('\n');

/** "Dịch giả" giữ nguyên ký hiệu giữ chỗ, chỉ đổi chữ hoa thường: luôn hợp lệ. */
const dichHopLe = (vanBanDaChe: string) =>
  vanBanDaChe.replace(/[A-Za-z]{3,}/g, (w) => w.toUpperCase());

function taoBanDichHopLe() {
  const cauTruc = phanTichReadme(README);
  const ban = new Map<number, string>();
  for (const doan of cauTruc.doan) if (doan.canDich) ban.set(doan.stt, dichHopLe(doan.vanBanDaChe));
  return { cauTruc, ban };
}

describe('locDoanDichHopLe: một đoạn hỏng không làm hỏng cả README (18/11/2026)', () => {
  it('toàn bộ đoạn hợp lệ thì giữ hết, không loại đoạn nào', () => {
    const { cauTruc, ban } = taoBanDichHopLe();
    const kq = locDoanDichHopLe(cauTruc, ban);
    expect(kq.boQua).toEqual([]);
    expect(kq.giu.size).toBe(ban.size);
  });

  it('một đoạn làm mất mã trong dòng thì chỉ loại đoạn đó, các đoạn khác vẫn giữ', () => {
    const { cauTruc, ban } = taoBanDichHopLe();
    const doanCoMa = cauTruc.doan.find(
      (d) => d.canDich && /⟦C\d+⟧/.test(d.vanBanDaChe) && d.vanBanGoc.includes('npm install'),
    )!;
    // bản dịch hỏng: bỏ mất ký hiệu giữ chỗ nên mã `npm install` biến mất
    ban.set(doanCoMa.stt, 'CHẠY NGAY BÂY GIỜ.');

    const kq = locDoanDichHopLe(cauTruc, ban);

    expect(kq.boQua).toEqual([doanCoMa.stt]);
    expect(kq.giu.has(doanCoMa.stt)).toBe(false);
    expect(kq.giu.size).toBe(ban.size - 1);
  });

  it('README ghép từ các đoạn còn giữ vượt bộ kiểm bất biến và đoạn bị loại giữ nguyên tiếng Anh', () => {
    const { cauTruc, ban } = taoBanDichHopLe();
    const doanHong = cauTruc.doan.find((d) => d.canDich && d.vanBanGoc.includes('npm install'))!;
    ban.set(doanHong.stt, 'CHẠY NGAY.');

    const { giu } = locDoanDichHopLe(cauTruc, ban);
    const ghep = rapLaiReadme(README, cauTruc, giu);
    const loi = layLoiBatBienReadme(
      kiemBatBienReadme(README, ghep, taoTuyChonKiemReadme(cauTruc, giu)).canhBao,
    );

    expect(loi).toEqual([]);
    expect(ghep).toContain('Run `npm install` now.');
  });

  it('không có đoạn nào để lọc thì trả rỗng, không báo lỗi', () => {
    const cauTruc = phanTichReadme(README);
    const kq = locDoanDichHopLe(cauTruc, new Map());
    expect(kq.giu.size).toBe(0);
    expect(kq.boQua).toEqual([]);
  });

  it('bản dịch làm mất ký hiệu hoặc không ghép được thì đoạn đó bị loại, không ném lỗi', () => {
    const { cauTruc, ban } = taoBanDichHopLe();
    const doan = cauTruc.doan.find((d) => d.canDich && d.vanBanGoc.includes('the docs'))!;
    ban.set(doan.stt, 'XEM TÀI LIỆU.');
    const kq = locDoanDichHopLe(cauTruc, ban);
    expect(kq.boQua).toEqual([doan.stt]);
  });
});
