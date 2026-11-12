import { describe, expect, it } from 'vitest';
import { nhomTinHieuCai, taoTomTatKiemTay } from './tin-hieu-cai.core';

const rel = (...ten: string[]) => [
  { published_at: '2026-10-01T00:00:00Z', assets: ten.map((name) => ({ name })) },
];

describe('nhomTinHieuCai', () => {
  it('có tệp cài .exe hoặc .msi (tên tệp thật) là MẠNH', () => {
    expect(nhomTinHieuCai('a/b', rel('Open-LLM-VTuber-1.2.1-setup.exe', 'x.dmg'), [])).toBe('MANH');
    expect(nhomTinHieuCai('a/b', rel('SwiftFormat.amd64.msi'), [])).toBe('MANH');
  });

  it('winget/scoop đúng gói của repo là MẠNH, gói của repo khác (robotgo cài GoLang.Go) thì YẾU', () => {
    expect(
      nhomTinHieuCai('charmbracelet/crush', null, [
        { nhom: 'WINGET', tenGoi: 'charmbracelet.crush' },
      ]),
    ).toBe('MANH');
    expect(nhomTinHieuCai('go-vgo/robotgo', null, [{ nhom: 'WINGET', tenGoi: 'GoLang.Go' }])).toBe(
      'YEU',
    );
  });

  it('pip trần, npm cục bộ, ZIP lẻ, Docker, release chỉ có tệp Mac/Linux là YẾU', () => {
    expect(nhomTinHieuCai('a/b', null, [{ nhom: 'PIP', tenGoi: 'pyts' }])).toBe('YEU');
    expect(nhomTinHieuCai('a/b', null, [{ nhom: 'DOCKER', tenGoi: 'x/y' }])).toBe('YEU');
    expect(nhomTinHieuCai('a/b', rel('Wicked.Engine.zip'), [])).toBe('YEU');
    expect(nhomTinHieuCai('a/b', rel('app-macos.dmg', 'app-linux.tar.gz'), [])).toBe('YEU');
  });

  it('bỏ qua bản nháp và pre-release khi tìm tệp cài', () => {
    const releases = [
      { draft: true, published_at: '2026-10-05T00:00:00Z', assets: [{ name: 'app-setup.exe' }] },
      {
        prerelease: true,
        published_at: '2026-10-04T00:00:00Z',
        assets: [{ name: 'app-beta.msi' }],
      },
    ];
    expect(nhomTinHieuCai('a/b', releases, [])).toBe('YEU');
  });
});

describe('taoTomTatKiemTay', () => {
  it('gom tệp release, lệnh cài và đầu README thành 3 dòng, bỏ ảnh và liên kết', () => {
    const t = taoTomTatKiemTay(
      { repo: 'a/b', sao: 1234, hang: 1, nhom: ['NPX_SKILL'] },
      '# Tên\n![logo](x.png) Công cụ [dùng thử](http://x) rất nhanh',
      rel('b-setup.exe'),
      [{ nhom: 'WINGET', buoc: [{ lenh: 'winget install a.b' }] }],
      'Mô tả GitHub',
    );
    expect(t).toContain('H1 a/b (1234) [NPX_SKILL]');
    expect(t).toContain('TEP: b-setup.exe | LENH: WINGET:winget install a.b');
    expect(t).toContain('(GH) Mô tả GitHub // Tên Công cụ dùng thử rất nhanh');
    expect(t).not.toContain('x.png');
  });
});
