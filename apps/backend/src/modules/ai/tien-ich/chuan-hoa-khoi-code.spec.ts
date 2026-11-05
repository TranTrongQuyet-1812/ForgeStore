import { describe, expect, it } from 'vitest';
import { chuanHoaKhoiCode, trichXuatHuongDanCliBangQuyTac } from './cli-guide-extractor.util';

/** Lấy các cặp [trình quản lý, tên gói] bóc tách được, như trang chi tiết dùng. */
const goiCuaReadme = (readme: string, repo: string) =>
  (trichXuatHuongDanCliBangQuyTac(readme, `https://github.com/${repo}#readme`)?.cachCai ?? [])
    .filter((c) => c.trinhQuanLy && c.tenGoi)
    .map((c) => [c.trinhQuanLy, c.tenGoi]);

describe('chuanHoaKhoiCode (bộ bóc tách phiên bản 6)', () => {
  it('đổi rào ~~~ sang ``` và giữ ngôn ngữ', () => {
    expect(chuanHoaKhoiCode('a\n~~~bash\npip install x\n~~~\nb')).toBe(
      'a\n```bash\npip install x\n```\nb',
    );
  });

  it('bọc khối thụt lề 4 dấu cách hoặc tab sau dòng trống, bỏ phần thụt lề', () => {
    expect(chuanHoaKhoiCode('Install:\n\n    $ pip3 install x\n    x --help\n\nDone')).toBe(
      'Install:\n\n```\n$ pip3 install x\nx --help\n```\n\nDone',
    );
    expect(chuanHoaKhoiCode('Type:\n\n\tnpm install -g y\n')).toBe(
      'Type:\n\n```\nnpm install -g y\n```\n',
    );
  });

  it('khối rào 4 dấu ` lồng khối 3 dấu: dòng rào bên trong không làm kết thúc sớm', () => {
    const vao = ['````markdown', '```sh', 'npm install -g a', '```', '````', 'sau'].join('\n');
    const ra = chuanHoaKhoiCode(vao).split('\n');
    expect(ra).toEqual(['```markdown', "'''sh", 'npm install -g a', "'''", '```', 'sau']);
  });

  it('không đụng nội dung trong khối ``` (kể cả dòng thụt lề) và dòng thụt lề không đứng sau dòng trống', () => {
    const trongRao = '```sh\n    npm install -g z\n```';
    expect(chuanHoaKhoiCode(trongRao)).toBe(trongRao);
    const vanXuoi = '- item one\n    continued text of the item';
    expect(chuanHoaKhoiCode(vanXuoi)).toBe(vanXuoi);
  });
});

describe('README thật bị sót ở phiên bản 5, nay nhận được', () => {
  it('khối thụt lề có dấu nhắc shell (instaloader)', () => {
    const readme =
      '# Instaloader\n\nInstallation\n------------\n\n::\n\n    $ pip3 install instaloader\n';
    expect(goiCuaReadme(readme, 'instaloader/instaloader')).toContainEqual(['pip', 'instaloader']);
  });

  it('khối thụt lề bằng tab (ungit) và 4 dấu cách (miniserve qua scoop)', () => {
    expect(
      goiCuaReadme(
        '# ungit\n\nTo install ungit just type:\n\n\tnpm install -g ungit\n',
        'FredrikNoren/ungit',
      ),
    ).toContainEqual(['npm', 'ungit']);
    expect(
      goiCuaReadme(
        '# miniserve\n\nAlternatively install with Scoop:\n\n    scoop install miniserve\n',
        'svenstaro/miniserve',
      ),
    ).toContainEqual(['scoop', 'miniserve']);
  });

  it('rào ~~~ (ffsubsync)', () => {
    const readme =
      '# ffsubsync\n\n## Install\n\nNext, grab the package:\n~~~\npip install ffsubsync\n~~~\n';
    expect(goiCuaReadme(readme, 'smacke/ffsubsync')).toContainEqual(['pip', 'ffsubsync']);
  });

  it('vẫn loại lệnh phát triển trong khối thụt lề', () => {
    const readme = '# app\n\n## Install\n\n    pip install -r requirements.txt\n';
    expect(goiCuaReadme(readme, 'someone/app')).toEqual([]);
  });

  it('bỏ dòng chỉ cài công cụ đóng gói đứng đầu nhóm (aqtinstall), không nhận "pnpm" làm app (etherpad)', () => {
    const aqt = [
      '# aqt',
      '',
      '## Install',
      '',
      '    pip install -U pip',
      '    pip install aqtinstall',
      '',
    ].join('\n');
    expect(goiCuaReadme(aqt, 'miurahr/aqtinstall')).toEqual([['pip', 'aqtinstall']]);
    const ether = [
      '# etherpad',
      '',
      '## Install',
      '',
      '```sh',
      'npm install -g pnpm',
      'pnpm i',
      '```',
    ].join('\n');
    expect(goiCuaReadme(ether, 'ether/etherpad')).toEqual([]);
  });

  it('giữ lệnh cài công cụ khi chính repo là công cụ đó (pnpm, uv)', () => {
    const pnpm = ['# pnpm', '', '## Install', '', '```sh', 'npm install -g pnpm', '```'].join('\n');
    expect(goiCuaReadme(pnpm, 'pnpm/pnpm')).toEqual([['npm', 'pnpm']]);
    const uv = ['# uv', '', '## Install', '', '```sh', 'pip install uv', '```'].join('\n');
    expect(goiCuaReadme(uv, 'astral-sh/uv')).toEqual([['pip', 'uv']]);
  });
});
