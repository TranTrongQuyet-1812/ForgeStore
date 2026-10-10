import { describe, expect, it } from 'vitest';
import { kiemTraDongDaDich, phanDoan, taoDongChoDich, tinhMaBam } from './data-repo.core';
import type { BanGhiDaCao, DongDich } from './data-repo.types';

const README = [
  '# Demo Tool',
  '',
  'A fast screenshot tool. See [docs](https://example.com/docs) for details.',
  '',
  '## Install',
  '',
  '```bash',
  'winget install demo.tool',
  '```',
  '',
  '## Options',
  '',
  '| Flag | Meaning |',
  '|------|---------|',
  '| `-h` | Show help |',
].join('\n');

function banCao(readme: string | null = README): BanGhiDaCao {
  return {
    repo: 'demo/tool',
    lo: 'thu',
    caoLuc: '2026-10-10T00:00:00Z',
    sao: 1200,
    moTaEn: 'A fast screenshot tool',
    readmeEn: readme,
    readmeSha: readme ? tinhMaBam(readme) : null,
    etagRepo: 'W/"a"',
    etagReleases: 'W/"b"',
    etagReadme: 'W/"c"',
  };
}

/** Dịch giả: đổi vài từ, giữ nguyên ký hiệu che và cấu trúc. */
function dichGia(dong: DongDich): DongDich {
  return {
    ...dong,
    moTaVi: 'Công cụ chụp màn hình nhanh',
    doan: dong.doan.map((d) => ({
      ...d,
      vi:
        d.vi ??
        d.vanBanDaChe
          .replace(/Install/g, 'Cài đặt')
          .replace(/Options/g, 'Tùy chọn')
          .replace(/A fast/g, 'Một'),
    })),
  };
}

describe('Data_Repo core (khớp hàm của BE)', () => {
  it('chia đoạn đúng bằng phanDoanReadme của BE và mã băm bằng tinhMaBam', () => {
    const cao = banCao();
    const dong = taoDongChoDich(cao);
    const goc = phanDoan(README);
    expect(dong.doan).toHaveLength(goc.length);
    dong.doan.forEach((d, i) => expect(d.maBam).toBe(tinhMaBam(goc[i])));
  });

  it('khối code và link được che, Anti chỉ thấy ký hiệu', () => {
    const dong = taoDongChoDich(banCao());
    const tatCa = dong.doan.map((d) => d.vanBanDaChe).join('\n');
    expect(tatCa).not.toContain('winget install');
    expect(tatCa).not.toContain('https://example.com');
    expect(tatCa).toMatch(/⟦C\d+⟧/);
  });

  it('đoạn chỉ có mã thì đã điền sẵn, không bắt Anti dịch', () => {
    const dong = taoDongChoDich(banCao('```bash\nnpm i\n```'));
    expect(dong.doan).toHaveLength(1);
    expect(dong.doan[0].canDich).toBe(false);
    expect(dong.doan[0].vi).toBe(dong.doan[0].vanBanDaChe);
  });

  it('bản dịch đạt: gỡ che đúng, ghép bằng hai dấu xuống dòng, giữ nguyên mã và link', () => {
    const cao = banCao();
    const kq = kiemTraDongDaDich(cao, dichGia(taoDongChoDich(cao)), 'antigravity/test:thu');
    expect(kq.loi).toBeNull();
    expect(kq.dat).not.toBeNull();
    const vi = kq.dat!.readmeVi!;
    expect(vi).toContain('winget install demo.tool');
    expect(vi).toContain('https://example.com/docs');
    expect(vi).toContain('Cài đặt');
    expect(vi).not.toMatch(/⟦C\d+⟧/);
    expect(kq.dat!.moTaVi).toBe('Công cụ chụp màn hình nhanh');
    expect(kq.dat!.readmeSha).toBe(tinhMaBam(README));
    expect(kq.dat!.etagReadme).toBe('W/"c"');
    // khoá lưu bộ nhớ dịch là mã băm của đoạn gốc đã trim
    kq.dat!.doan.forEach((d) => expect(d.maBam).toBe(tinhMaBam(d.goc)));
  });

  it('mất một ký hiệu che thì đoạn đó lỗi placeholders_changed, đoạn khác vẫn giữ', () => {
    const cao = banCao();
    const dich = dichGia(taoDongChoDich(cao));
    const i = dich.doan.findIndex((d) => /⟦C\d+⟧/.test(d.vanBanDaChe) && d.canDich);
    dich.doan[i].vi = dich.doan[i].vi!.replace(/⟦C\d+⟧/, '');
    const kq = kiemTraDongDaDich(cao, dich, 'x');
    expect(kq.dat).toBeNull();
    expect(kq.soDoanLoi).toBe(1);
    expect(kq.loi!.doan[i].loi).toBe('placeholders_changed');
    expect(kq.loi!.doan[i].vi).toBeNull();
  });

  it('thiếu bản dịch, chưa dịch, hoặc đổi cấu trúc đoạn đều bị bắt', () => {
    const cao = banCao();
    const thieu = dichGia(taoDongChoDich(cao));
    const j = thieu.doan.findIndex((d) => d.canDich);
    thieu.doan[j].vi = '';
    expect(kiemTraDongDaDich(cao, thieu, 'x').loi!.doan[j].loi).toBe('thieu_ban_dich');

    const chuaDich = dichGia(taoDongChoDich(cao));
    chuaDich.doan[j].vi = chuaDich.doan[j].vanBanDaChe;
    expect(kiemTraDongDaDich(cao, chuaDich, 'x').loi!.doan[j].loi).toBe('chua_dich');

    const doi = dichGia(taoDongChoDich(cao));
    doi.doan[j] = { ...doi.doan[j], maBam: 'bi-doi' };
    expect(kiemTraDongDaDich(cao, doi, 'x').loi!.doan[j].loi).toBe('doan_bi_doi');
  });

  it('mô tả thiếu hoặc quá dài bị chặn', () => {
    const cao = banCao();
    const a = dichGia(taoDongChoDich(cao));
    a.moTaVi = '';
    expect(kiemTraDongDaDich(cao, a, 'x').loi!.loiMoTa).toBe('mo_ta_thieu');
    const b = dichGia(taoDongChoDich(cao));
    b.moTaVi = 'x'.repeat(401);
    expect(kiemTraDongDaDich(cao, b, 'x').loi!.loiMoTa).toBe('mo_ta_qua_dai');
  });

  it('repo không có README vẫn nhập được (chỉ mô tả)', () => {
    const cao = banCao(null);
    const kq = kiemTraDongDaDich(cao, dichGia(taoDongChoDich(cao)), 'x');
    expect(kq.dat).not.toBeNull();
    expect(kq.dat!.readmeVi).toBeNull();
    expect(kq.dat!.doan).toHaveLength(0);
  });

  it('không có bản cào tương ứng thì lỗi khong_co_ban_cao', () => {
    const dong = taoDongChoDich(banCao());
    expect(kiemTraDongDaDich(undefined, dong, 'x').loi!.loiMoTa).toBe('khong_co_ban_cao');
  });
});
