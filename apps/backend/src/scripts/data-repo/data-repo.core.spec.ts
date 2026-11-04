import { describe, expect, it } from 'vitest';
import {
  chiLaChuoiNhan,
  coCauTiengAnh,
  kiemTraDongDaDich,
  phanDoan,
  taoDongChoDich,
  tinhMaBam,
} from './data-repo.core';
import type { BanGhiDaCao, DongDich } from './data-repo.types';

const README = [
  '# Demo Tool',
  '',
  'A fast screenshot tool. See [docs](https://example.com/docs) for details.',
  'This sentence has enough words that leaving the whole source unchanged should trigger the legacy untranslated guard.',
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

/** Dịch giả: đổi vài từ trong các mẩu chữ thuần. */
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
          .replace(/A fast/g, 'Một')
          .replace(
            /This sentence has enough words that leaving the whole source unchanged should trigger the legacy untranslated guard\./g,
            'Câu này đã được dịch sang tiếng Việt.',
          ),
    })),
  };
}

describe('Data_Repo core (khớp hàm của BE)', () => {
  it('chia đoạn đúng bằng phanDoanReadme của BE và mã băm bằng tinhMaBam', () => {
    const cao = banCao();
    const dong = taoDongChoDich(cao);
    const goc = phanDoan(README);
    expect(dong.doan).toHaveLength(goc.length);
    expect(dong.doan.find((doan) => doan.vanBanDaChe.includes('Flag'))?.tieuDeMuc).toContain(
      'Options',
    );
    dong.doan.forEach((d, i) => expect(d.maBam).toBe(tinhMaBam(goc[i])));
  });

  it('khối code và URL được giữ ngoài các mẩu chữ Anti cần dịch', () => {
    const dong = taoDongChoDich(banCao());
    const tatCa = dong.doan.map((d) => d.vanBanDaChe).join('\n');
    expect(tatCa).not.toContain('winget install');
    expect(tatCa).not.toContain('https://example.com');
    expect(tatCa).not.toContain('```');
    expect(tatCa).not.toContain('|');
  });

  it('gỡ URL do MarkdownMasker che từ văn bản nguồn, không dùng lại bản đã che', () => {
    const sentence =
      'The IDE calls one local endpoint (http://localhost:20128/v1); then routes the request.';
    const cao = banCao(`<img alt="${sentence}">`);
    const daXuat = taoDongChoDich(cao);
    const doan = daXuat.doan.find((mau) => mau.vanBanDaChe.includes('⟦C1⟧'))!;
    expect(doan.vanBanDaChe).toContain('⟦C1⟧');
    expect(doan.khungGiuNguyen).toEqual({});

    const dich = {
      ...daXuat,
      moTaVi: 'Mô tả đã dịch',
      doan: daXuat.doan.map((mau) => ({
        ...mau,
        vi: mau.vanBanDaChe.replace('calls one local endpoint', 'gọi một điểm cuối cục bộ'),
      })),
    };
    const ketQua = kiemTraDongDaDich(cao, dich, 'x');

    expect(ketQua.loi).toBeNull();
    expect(ketQua.dat?.readmeVi).toContain('http://localhost:20128/v1');
    expect(ketQua.dat?.readmeVi).not.toContain('⟦C1⟧');
  });

  it('README chỉ có mã không tạo đoạn cần dịch', () => {
    const dong = taoDongChoDich(banCao('```bash\nnpm i\n```'));
    expect(dong.doan).toHaveLength(0);
    const kq = kiemTraDongDaDich(banCao('```bash\nnpm i\n```'), dichGia(dong), 'x');
    expect(kq.dat?.readmeVi).toBe('```bash\nnpm i\n```');
  });

  it('đưa chữ Hán, Nhật và Hàn ngắn từ một ký tự vào hàng cần dịch', () => {
    const readme = '文\n\nあ\n\nア\n\n한\n\n说明\n\n运行';
    const dong = taoDongChoDich(banCao(readme));

    expect(dong.doan.map((doan) => doan.vanBanDaChe)).toEqual([
      '文',
      'あ',
      'ア',
      '한',
      '说明',
      '运行',
    ]);
    expect(dong.doan.map((doan) => doan.canDich)).toEqual([true, true, true, true, true, true]);
    expect(dong.doan.map((doan) => doan.vi)).toEqual([null, null, null, null, null, null]);
  });

  it('giữ nguyên nhãn ngôn ngữ trong dữ liệu xuất và bản README nhập', () => {
    const readme =
      '[English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)';
    const cao = banCao(readme);
    const dong = taoDongChoDich(cao);
    const altered = {
      ...dong,
      moTaVi: 'Mô tả',
      doan: dong.doan.map((doan) => ({ ...doan, vi: 'Nội dung không được dùng' })),
    };
    const result = kiemTraDongDaDich(cao, altered, 'x');

    expect(dong.doan).toHaveLength(1);
    expect(dong.doan[0]?.canDich).toBe(false);
    expect(dong.doan[0]?.vi).toBe(dong.doan[0]?.vanBanDaChe);
    expect(result.dat?.readmeVi).toBe(readme);
  });

  it('đánh dấu mức quan trọng, mức 3 giữ bản gốc (tiêu đề thông dụng vẫn dùng bản Việt cố định)', () => {
    const cao = banCao('## Star History\n\nThe chart shows the star history.');
    const choDich = taoDongChoDich(cao);

    expect(choDich.doan.map((doan) => doan.mucQuanTrong)).toEqual([3, 3]);
    expect(choDich.doan.every((doan) => !doan.canDich)).toBe(true);
    expect(choDich.doan.every((doan) => doan.vi === doan.vanBanDaChe)).toBe(true);
    expect(choDich.doan[0]?.vanBanDaChe).toBe('Lịch sử sao');

    const biSua = {
      ...choDich,
      moTaVi: 'Nhà tài trợ',
      doan: choDich.doan.map((doan) => ({ ...doan, vi: 'Bản dịch không được dùng' })),
    };
    const ketQua = kiemTraDongDaDich(cao, biSua, 'x');

    expect(ketQua.dat?.readmeVi).toBe('## Lịch sử sao\n\nThe chart shows the star history.');
    expect(ketQua.dat?.doan[1]?.dich).toBe(ketQua.dat?.doan[1]?.goc);
  });

  it('bản dịch đạt: lắp chữ vào khung gốc, giữ nguyên mã và link', () => {
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
    expect(kq.dat!.hangChatLuong).toBe('B');
    expect(kq.dat!.tiLeDoDaiTong).toBeTypeOf('number');
    expect(kq.dat!.tiLeDoDaiDoan).toHaveLength(phanDoan(README).length);
    // khoá lưu bộ nhớ dịch là mã băm của đoạn gốc đã trim
    kq.dat!.doan.forEach((d) => expect(d.maBam).toBe(tinhMaBam(d.goc)));
  });

  it('từ chối README nếu bản dịch làm thay đổi tập URL', () => {
    const cao = banCao();
    const dich = dichGia(taoDongChoDich(cao));
    const muc = dich.doan.find((doan) => doan.canDich)!;
    muc.vi = `${muc.vi} https://evil.example`;

    const result = kiemTraDongDaDich(cao, dich, 'x');

    expect(result.dat).toBeNull();
    expect(result.loi?.loiReadme).toContain('url_thay_doi');
  });

  it('mất một ký hiệu che thì đoạn đó lỗi placeholders_changed, đoạn khác vẫn giữ', () => {
    const cao = banCao();
    const dich = dichGia(taoDongChoDich(cao));
    const i = dich.doan.findIndex((d) => d.canDich);
    dich.doan[i]!.vi = `${dich.doan[i]!.vi} ⟦C999⟧`;
    const kq = kiemTraDongDaDich(cao, dich, 'x');
    expect(kq.dat).toBeNull();
    expect(kq.soDoanLoi).toBe(1);
    expect(kq.loi!.doan[i].loi).toBe('placeholders_changed');
    expect(kq.loi!.doan[i].vi).toBeNull();
  });

  it('thiếu bản dịch, chưa dịch, hoặc đổi cấu trúc đoạn đều bị bắt', () => {
    const cao = banCao();
    const thieu = dichGia(taoDongChoDich(cao));
    const j = thieu.doan.findIndex((d) => d.vanBanDaChe.includes('legacy untranslated guard'));
    thieu.doan[j].vi = '';
    expect(kiemTraDongDaDich(cao, thieu, 'x').loi!.doan[j].loi).toBe('thieu_ban_dich');

    const chuaDich = dichGia(taoDongChoDich(cao));
    chuaDich.doan[j].vi = chuaDich.doan[j].vanBanDaChe;
    expect(kiemTraDongDaDich(cao, chuaDich, 'x').loi!.doan[j].loi).toBe('chua_dich');

    const doi = dichGia(taoDongChoDich(cao));
    doi.doan[j] = { ...doi.doan[j], maBam: 'bi-doi' };
    expect(kiemTraDongDaDich(cao, doi, 'x').loi!.doan[j].loi).toBe('doan_bi_doi');
  });

  it('chuỗi nhãn (huy hiệu, thanh ngôn ngữ) không bị báo chua_dich, câu tiếng Anh thì vẫn bị', () => {
    // mẫu thật từ lobehub, career-ops, ultralytics, nerd-fonts, tldr
    expect(
      chiLaChuoiNhan('⟦C1⟧github-release-shield⟦C2⟧github-release-link⟦C3⟧docker-size-shield⟦C4⟧'),
    ).toBe(true);
    expect(
      chiLaChuoiNhan('⟦C1⟧English⟦C2⟧Español⟦C3⟧日本語⟦C4⟧Português (Brasil)⟦C5⟧한국어⟦C6⟧'),
    ).toBe(true);
    expect(chiLaChuoiNhan('Node.js⟦C1⟧Go⟦C2⟧Playwright⟦C3⟧Bubble Tea⟦C4⟧MIT')).toBe(true);
    expect(
      chiLaChuoiNhan('⟦C1⟧GitHub release⟦C2⟧Gitter⟦C3⟧Code of Conduct⟦C4⟧PRs Welcome⟦C5⟧'),
    ).toBe(true);
    // đoạn chỉ có khoảng trắng HTML (amark/gun)
    expect(
      chiLaChuoiNhan(
        '⟦C1⟧&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;⟦C2⟧&nbsp;&nbsp;⟦C3⟧',
      ),
    ).toBe(true);
    // câu thật chưa dịch vẫn phải bị bắt
    expect(
      chiLaChuoiNhan('Use ⟦C1⟧npm⟦C2⟧ to install the package and then run ⟦C3⟧init⟦C4⟧ now'),
    ).toBe(false);
    expect(chiLaChuoiNhan('Download the latest ⟦C1⟧release⟦C2⟧.')).toBe(false);
    expect(
      chiLaChuoiNhan('A fast screenshot tool, see ⟦C1⟧docs⟦C2⟧ for the details of usage'),
    ).toBe(false);
  });

  it('phiên gõ lệnh, kết quả lệnh và tên riêng không bị coi là câu tiếng Anh, câu thật thì có', () => {
    // mẫu thật từ rush, kubeinvaders, glances, react-markdown-editor-lite
    expect(
      coCauTiengAnh("$ seq 1 3 ⟦C1⟧ rush 'echo ⟦C2⟧' -k\n        1\n        2\n        3"),
    ).toBe(false);
    expect(coCauTiengAnh('$ for var in a b; do ⟦C1⟧\n        $   seq 1 3 ⟦C2⟧ rush -k')).toBe(
      false,
    );
    expect(
      coCauTiengAnh('real    0m1.010s\n        user    0m0.005s\n        sys     0m0.007s'),
    ).toBe(false);
    expect(coCauTiengAnh('⟦C1⟧ LILiS - Linux Day 2023 Benevento ⟦C2⟧')).toBe(false);
    expect(coCauTiengAnh('DevNation RedHat Developer: ⟦C1⟧Twitter⟦C2⟧')).toBe(false);
    expect(coCauTiengAnh('HarryChen0506 ⟦C1⟧github/HarryChen0506⟦C2⟧')).toBe(false);
    expect(
      coCauTiengAnh('Use ⟦C1⟧npm⟦C2⟧ to install the package and then run ⟦C3⟧init⟦C4⟧ now'),
    ).toBe(true);
    expect(coCauTiengAnh('Download the latest ⟦C1⟧release⟦C2⟧.')).toBe(true);
    expect(coCauTiengAnh('A fast screenshot tool, see ⟦C1⟧docs⟦C2⟧ for the details of usage')).toBe(
      true,
    );
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
