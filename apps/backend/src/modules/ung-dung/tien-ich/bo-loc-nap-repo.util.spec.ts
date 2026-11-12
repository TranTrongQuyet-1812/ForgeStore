import { describe, expect, it } from 'vitest';
import {
  coLenhCaiTuReadme,
  cachCaiThuocRepo,
  laThuVienLapTrinh,
  danhGiaRelease,
  locCucBo,
  trongDanhSachChan,
  zipLaUngDungDesktop,
  readmeChiChoMacTheoMoDau,
  laCongCuKhongNenNhan,
  type RepoUngVien,
} from './bo-loc-nap-repo.util';

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
  it('không có giấy phép bị loại, còn NOASSERTION và other thì đạt (D-36)', () => {
    expect(locCucBo(repo({ license: null }), NOW).lyDo).toBe('KHONG_CO_GIAY_PHEP');
    expect(locCucBo(repo({ license: { spdx_id: 'NOASSERTION' } }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ license: { spdx_id: 'other' } }), NOW).dat).toBe(true);
  });
  it('7-Zip là ngoại lệ duy nhất cho repo không nhận ra giấy phép (Chủ chốt 06/11/2026)', () => {
    expect(locCucBo(repo({ full_name: 'ip7z/7zip', license: null }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ full_name: 'IP7Z/7Zip', license: null }), NOW).dat).toBe(true);
    expect(locCucBo(repo({ full_name: 'khac/7zip', license: null }), NOW).lyDo).toBe(
      'KHONG_CO_GIAY_PHEP',
    );
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
  it('P3B-36: Ghidra chỉ có một ZIP không ghi hệ điều hành thì đạt; hai ZIP thì vẫn bị loại', () => {
    const ghidra = danhGiaRelease(
      [rel({ assets: [{ name: 'ghidra_12.2_PUBLIC_20261016.zip' }] })],
      NOW,
    );
    expect(ghidra.dat).toBe(true);
    const haiZip = danhGiaRelease(
      [rel({ assets: [{ name: 'tool-1.0.zip' }, { name: 'tool-1.0-extra.zip' }] })],
      NOW,
    );
    expect(haiZip.lyDo).toBe('KHONG_CO_FILE_CAI');
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

describe('coLenhCaiTuReadme (bộ lọc 10)', () => {
  it('README có lệnh winget trong mục cài đặt thì nhận', () => {
    const readme = '# Foo\n\n## Installation\n\n```\nwinget install Foo.Bar\n```\n';
    expect(coLenhCaiTuReadme(readme, 'o/foo')).toBe(true);
  });
  it('README không có lệnh cài thì loại', () => {
    expect(coLenhCaiTuReadme('# Foo\n\nA library for things.', 'o/foo')).toBe(false);
  });
  it('README rỗng hoặc null thì loại', () => {
    expect(coLenhCaiTuReadme('', 'o/foo')).toBe(false);
    expect(coLenhCaiTuReadme(null, 'o/foo')).toBe(false);
  });

  it('Luật 2: loại thư viện lập trình thuần (transformers, fastapi, scikit-learn, scrapy, langchain, autogen)', () => {
    const transformers =
      '# Transformers\n```bash\npip install transformers\n```\n```python\nfrom transformers import pipeline\nclassifier = pipeline("sentiment-analysis")\n```';
    expect(coLenhCaiTuReadme(transformers, 'huggingface/transformers')).toBe(false);

    const fastapi =
      '# FastAPI\n```bash\npip install fastapi\n```\n```python\nfrom fastapi import FastAPI\napp = FastAPI()\n```\n```bash\nfastapi dev main.py\n```';
    expect(coLenhCaiTuReadme(fastapi, 'fastapi/fastapi')).toBe(false);

    const scikitLearn =
      '# scikit-learn\n```bash\npip install scikit-learn\n```\n```python\nfrom sklearn import datasets\n```';
    expect(coLenhCaiTuReadme(scikitLearn, 'scikit-learn/scikit-learn')).toBe(false);

    const scrapy =
      '# Scrapy\n```bash\npip install scrapy\n```\n```python\nimport scrapy\nclass S(scrapy.Spider):\n  pass\n```\n```bash\nscrapy crawl quotes\n```';
    expect(coLenhCaiTuReadme(scrapy, 'scrapy/scrapy')).toBe(false);

    const langchain =
      '# LangChain\n```bash\nuv add langchain\n```\n```python\nfrom langchain import LLMChain\n```';
    expect(coLenhCaiTuReadme(langchain, 'langchain-ai/langchain')).toBe(false);

    const autogen =
      '# AutoGen\n```bash\npip install pyautogen\n```\n```python\nfrom autogen import AssistantAgent\n```';
    expect(coLenhCaiTuReadme(autogen, 'microsoft/autogen')).toBe(false);
  });

  it('Luật 2: giữ các ứng dụng chạy được như chương trình (py-spy, mycli, litellm, nocodb, private-gpt, browser-use)', () => {
    const pySpy =
      '# py-spy\n```bash\npip install py-spy\n```\nRun:\n```bash\npy-spy record -o profile.svg --pid 1234\n```';
    expect(coLenhCaiTuReadme(pySpy, 'benfred/py-spy')).toBe(true);

    const mycli = '# mycli\n```bash\npip install mycli\n```\n```bash\nmycli -u root\n```';
    expect(coLenhCaiTuReadme(mycli, 'dbcli/mycli')).toBe(true);

    const litellm =
      '# LiteLLM\n```bash\npip install litellm\n```\n```bash\nlitellm --model gpt-4\n```';
    expect(coLenhCaiTuReadme(litellm, 'BerriAI/litellm')).toBe(true);

    const nocodb = '# NocoDB\n```bash\ndocker run -d -p 8080:8080 nocodb/nocodb\n```';
    expect(coLenhCaiTuReadme(nocodb, 'nocodb/nocodb')).toBe(true);

    const privateGpt =
      '# PrivateGPT\n```bash\npip install private-gpt\n```\n```bash\npython -m private_gpt\n```';
    expect(coLenhCaiTuReadme(privateGpt, 'zylon-ai/private-gpt')).toBe(true);

    const browserUse =
      '<!-- mcp-name: com.browser-use/browser-use -->\n# Browser Use\n```bash\npip install browser-use\n```\n```python\nfrom browser_use import Agent\n```';
    expect(coLenhCaiTuReadme(browserUse, 'browser-use/browser-use')).toBe(true);
  });

  it('Luật 2: README viết bằng RST (không có khối ```) của framework nổi tiếng vẫn bị coi là thư viện', () => {
    const readme =
      'scikit-learn\n============\n\nInstall\n-------\n\n    pip install -U scikit-learn\n\n.. code:: python\n\n    from sklearn import svm\n';
    const cachCai = [
      {
        nhom: 'PIP',
        trinhQuanLy: 'pip',
        tenGoi: 'scikit-learn',
        buoc: [{ lenh: 'pip install -U scikit-learn' }],
      },
    ];
    expect(laThuVienLapTrinh(readme, 'scikit-learn/scikit-learn', cachCai)).toBe(true);
  });

  it('Luật 4: gói phụ trong bảng yêu cầu của README (ai-job-search, pip install pypdf) không phải cách cài của repo', () => {
    const readme = [
      '| **Python 3.10+** | For the tools in `tools/`. |',
      '| **[Bun](https://bun.sh)** | Runs the job search CLI tools. |',
      "| **pypdf** *(optional)* | `pip install pypdf` for `/apply`'s ATS parseability check. |",
    ].join('\n');
    expect(coLenhCaiTuReadme(readme, 'MadsLorentzen/ai-job-search')).toBe(false);
  });

  it('Luật 4: cachCaiThuocRepo nhận gói khớp tên repo, từ chính, chủ repo; loại gói công cụ phụ', () => {
    const pip = (tenGoi: string) => [{ nhom: 'PIP', tenGoi }];
    expect(cachCaiThuocRepo('browser-use/browser-use', pip('browser-use'))).toBe(true);
    expect(cachCaiThuocRepo('Kilo-Org/kilocode', [{ nhom: 'NPM', tenGoi: '@kilocode/cli' }])).toBe(
      true,
    );
    expect(cachCaiThuocRepo('Panniantong/Agent-Reach', pip('Panniantong/Agent-Reach'))).toBe(true);
    expect(cachCaiThuocRepo('karpathy/nanoGPT', pip('torch'))).toBe(false);
    expect(cachCaiThuocRepo('babysor/MockingBird', pip('pyqt5'))).toBe(false);
    expect(cachCaiThuocRepo('excalidraw/excalidraw', [{ nhom: 'NPM', tenGoi: 'react' }])).toBe(
      false,
    );
    expect(
      cachCaiThuocRepo('foo/bar', [{ nhom: 'PIP', tenGoi: 'torch' }, { nhom: 'DOCKER' }]),
    ).toBe(true);
  });
});

describe('laThuVienLapTrinh: dấu hiệu import ngoài khối mã và dòng lệnh thật (12/11/2026)', () => {
  // Đoạn chép nguyên văn từ README axios/axios (thư viện): import nằm ở dòng đầu, không có lệnh chạy "axios ..."
  const readmeAxios = [
    '$ npm install axios',
    "import axios from 'axios';",
    "const axios = require('axios');",
  ].join('\n');
  // Đoạn chép nguyên văn từ README pndurette/gTTS: khối thụt đầu dòng kiểu RST, có lệnh gtts-cli thật
  const readmeGtts = [
    '    $ pip install gTTS',
    "    $ gtts-cli 'hello' --output hello.mp3",
    '    >>> from gtts import gTTS',
  ].join('\n');

  it('README chỉ dạy import thì là thư viện', () => {
    const cach = [
      { nhom: 'NPM', trinhQuanLy: 'NPM', tenGoi: 'axios', buoc: [{ lenh: 'npm install axios' }] },
    ];
    expect(laThuVienLapTrinh(readmeAxios, 'axios/axios', cach)).toBe(true);
  });

  it('README có dòng lệnh gtts-cli (khối thụt đầu dòng, dấu nhắc $) thì không phải thư viện thuần', () => {
    const cach = [
      { nhom: 'PIP', trinhQuanLy: 'PIP', tenGoi: 'gTTS', buoc: [{ lenh: 'pip install gTTS' }] },
    ];
    expect(laThuVienLapTrinh(readmeGtts, 'pndurette/gTTS', cach)).toBe(false);
  });

  it('python -m của gói khác (pip, venv) không tính là chạy chương trình', () => {
    const readme = ['python -m pip install axios', "import axios from 'axios';"].join('\n');
    const cach = [{ nhom: 'NPM', tenGoi: 'axios', buoc: [{ lenh: 'npm install axios' }] }];
    expect(laThuVienLapTrinh(readme, 'axios/axios', cach)).toBe(true);
  });
});

describe('zipLaUngDungDesktop (Luật 1 bổ sung, 12/11/2026)', () => {
  // Đoạn đầu README thật của NationalSecurityAgency/ghidra và Raphire/Win11Debloat
  const readmeGhidra =
    'Ghidra is a software reverse engineering (SRE) framework created and maintained by the National Security Agency Research Directorate. Platforms including Windows, macOS, and Linux.';
  const readmeWin11Debloat =
    'Win11Debloat is a lightweight, easy to use PowerShell script that allows you to quickly declutter and customize your Windows experience, no installation required.';
  // Dòng thật từ README jordanbaird/Ice (ứng dụng chỉ có cho macOS)
  const readmeIce = [
    '![Platform](https://img.shields.io/badge/platform-macOS-blue?style=flat-square)',
    '![Requirements](https://img.shields.io/badge/requirements-macOS%2014%2B-fa4e49?style=flat-square)',
    'brew install --cask jordanbaird-ice',
  ].join('\n');

  it('nhận ghidra và Win11Debloat', () => {
    expect(zipLaUngDungDesktop(readmeGhidra, ['ghidra_12.2_PUBLIC_20261016.zip'])).toBe(true);
    expect(zipLaUngDungDesktop(readmeWin11Debloat, ['Win11Debloat.zip', 'Get.ps1'])).toBe(true);
  });

  it('nhận ZIP khi README không nhắc hệ điều hành nào (FModel, GeekDesk là app Windows thật)', () => {
    expect(zipLaUngDungDesktop('FModel is a viewer for game archives.', ['FModel.zip'])).toBe(true);
  });

  it('loại ứng dụng chỉ có cho macOS', () => {
    expect(zipLaUngDungDesktop(readmeIce, ['Ice.zip'])).toBe(false);
    expect(zipLaUngDungDesktop('Hello', ['KeyCastr.app.zip'])).toBe(false);
  });

  it('loại gói thư viện và plugin theo tên tệp cùng bản phát hành', () => {
    expect(zipLaUngDungDesktop('', ['Bogus.35.6.5.nupkg', 'Bogus.zip'])).toBe(false);
    expect(zipLaUngDungDesktop('', ['Nimble.xcframework.zip'])).toBe(false);
    expect(zipLaUngDungDesktop('', ['main.js', 'manifest.json', 'plugin-0.8.7.zip'])).toBe(false);
  });

  it('loại thư viện có lệnh thêm vào dự án, bộ chữ và tiện ích trình duyệt', () => {
    expect(zipLaUngDungDesktop('Install-Package Bogus', ['Bogus.zip'])).toBe(false);
    expect(
      zipLaUngDungDesktop('Inter font family. Download the font files. Use the font on web.', [
        'Inter-4.1.zip',
      ]),
    ).toBe(false);
    expect(zipLaUngDungDesktop('Install from the Chrome Web Store.', ['build.zip'])).toBe(false);
  });
});

describe('Luật ZIP lẻ và thư viện sau kiểm tay 339 repo (12/11/2026)', () => {
  // Các đoạn dưới đây là phần mở đầu README thật của từng repo.
  const readmeFModel =
    "FModel is an archive explorer for Unreal Engine games. It opens UE4 and UE5 game archives so you can browse their packages. It's built on two projects: [CUE4Parse](https://github.com/FabianFG/CUE4Parse), the library that parses UE archives.";
  const readmeEpubcheck =
    'EPUBCheck is the official conformance checker for EPUB publications. EPUBCheck can be run as a standalone command line tool or used as a Java library.';
  const readmeFmt =
    '{fmt} is an open source formatting library providing a fast and safe alternative to C stdio.';
  const readmeTypecho =
    'Typecho is a PHP based blog software and is designed to be the most powerful blog engine in the world.';
  const readmeLoop =
    'Loop is a macOS app that simplifies window management. Compatible with macOS 13 and later. Download for macOS.';

  it('nhận app có nhắc thư viện mà nó DÙNG (FModel) và công cụ độc lập có thể dùng như thư viện (epubcheck)', () => {
    expect(zipLaUngDungDesktop(readmeFModel, ['FModel.zip'])).toBe(true);
    expect(zipLaUngDungDesktop(readmeEpubcheck, ['epubcheck-5.4.0.zip'])).toBe(true);
  });

  it('loại ZIP của thư viện tự nhận, web PHP tự host và app Mac nói về cửa sổ (Loop)', () => {
    expect(zipLaUngDungDesktop(readmeFmt, ['fmt-12.2.1.zip'])).toBe(false);
    expect(zipLaUngDungDesktop(readmeTypecho, ['typecho.zip'])).toBe(false);
    expect(zipLaUngDungDesktop(readmeLoop, ['Loop.zip'])).toBe(false);
  });

  it('loại ZIP theo tên gói phụ, bản -src đi kèm, tệp sách/ảnh đĩa/firmware và bộ dữ liệu', () => {
    expect(zipLaUngDungDesktop('', ['specs.zip'])).toBe(false);
    expect(zipLaUngDungDesktop('', ['moonfire-nvr-ui-v0.7.33.zip'])).toBe(false);
    expect(zipLaUngDungDesktop('', ['WinSparkle-0.9.4-src.zip', 'WinSparkle-0.9.4.zip'])).toBe(
      false,
    );
    expect(zipLaUngDungDesktop('', ['Happy-LLM.pdf', 'happy-llm-ppt.zip'])).toBe(false);
    expect(
      zipLaUngDungDesktop('', ['hedgehog-26.10.0.iso.01', 'hedgehog-26.10.0.iso.02', 'x.zip']),
    ).toBe(false);
    expect(zipLaUngDungDesktop('', ['a.bin', 'b.bin', 'c.bin', 'fw.zip'])).toBe(false);
    expect(
      zipLaUngDungDesktop('', ['apple-cn.txt', 'china-list.txt', 'direct-list.txt', 'rules.zip']),
    ).toBe(false);
  });

  it('nhận công cụ độc lập gắn vào game (UEVR) nhưng loại plugin của app khác (FlowGraph)', () => {
    expect(
      zipLaUngDungDesktop(
        'UEVR\n\nUniversal Unreal Engine VR Mod (4/5)\n\nDownload for Windows x64.',
        ['UEVR.zip'],
      ),
    ).toBe(true);
    expect(
      zipLaUngDungDesktop(
        'Flow plug-in for Unreal Engine is a design agnostic event node editor.',
        ['Flow_v2.3_5.8.zip'],
      ),
    ).toBe(false);
  });

  it('README tự mô tả là gói Python thì là thư viện, kể cả khi có vài lệnh CLI phụ (faker)', () => {
    const readme = [
      'Faker is a Python package that generates fake data for you. Whether you need to bootstrap your database.',
      '$ pip install Faker',
      'faker address',
    ].join('\n');
    const cach = [
      { nhom: 'PIP', trinhQuanLy: 'PIP', tenGoi: 'Faker', buoc: [{ lenh: 'pip install Faker' }] },
    ];
    expect(laThuVienLapTrinh(readme, 'joke2k/faker', cach)).toBe(true);
  });

  it('vừa là thư viện vừa là công cụ dòng lệnh thì vẫn nhận (gTTS), thư viện để xây CLI thì loại (typer)', () => {
    const cach = [{ nhom: 'PIP', tenGoi: 'gTTS', buoc: [{ lenh: 'pip install gTTS' }] }];
    expect(
      laThuVienLapTrinh(
        "gTTS is a Python library and CLI tool to interface with Google Translate text-to-speech API.\n    $ gtts-cli 'hello' --output hello.mp3",
        'pndurette/gTTS',
        cach,
      ),
    ).toBe(false);
    expect(
      laThuVienLapTrinh(
        'Typer is a library for building CLI applications that users will love using.',
        'fastapi/typer',
        [{ nhom: 'PIP', tenGoi: 'typer', buoc: [{ lenh: 'pip install typer' }] }],
      ),
    ).toBe(true);
  });

  it('gói trùng chữ với tên chủ repo nhưng là gói khác thì không nhận (twilio-cli)', () => {
    expect(
      cachCaiThuocRepo('twilio/twilio-video-app-react', [{ nhom: 'NPM', tenGoi: 'twilio-cli' }]),
    ).toBe(false);
    expect(
      cachCaiThuocRepo('browser-use/browser-harness', [{ nhom: 'PIP', tenGoi: 'browser-use' }]),
    ).toBe(true);
  });
});

describe('Thư viện npm cài như phụ thuộc dự án (kiểm tay mẫu độc lập 12/11/2026)', () => {
  // Đoạn nguyên văn từ README thật của fastmail/Squire, robinmoisson/staticrypt, pmndrs/react-three-fiber
  const readmeSquire = [
    'Squire is an HTML5 rich text editor, which provides powerful cross-browser normalisation in a flexible lightweight package.',
    '1. Add Squire to your project: `npm install squire-rte`',
  ].join('\n');
  const readmeStaticrypt = [
    'Staticrypt is available through npm as a CLI, install with',
    'npm install staticrypt',
    'staticrypt test.html',
    'staticrypt test.html -p <long-password>',
  ].join('\n');
  const readmeR3f = [
    'react-three-fiber is a React renderer for threejs.',
    'npm install three @types/three @react-three/fiber',
    'npm install expo-cli -g',
  ].join('\n');

  it('chỉ có npm install <gói> cục bộ thì là thư viện (Squire)', () => {
    const cach = [
      {
        nhom: 'NPM',
        trinhQuanLy: 'NPM',
        tenGoi: 'squire-rte',
        buoc: [{ lenh: 'npm install squire-rte' }],
      },
    ];
    expect(laThuVienLapTrinh(readmeSquire, 'fastmail/Squire', cach)).toBe(true);
  });

  it('cùng cách cài npm nhưng README có dòng lệnh chạy chính gói đó thì là công cụ (staticrypt)', () => {
    const cach = [
      {
        nhom: 'NPM',
        trinhQuanLy: 'NPM',
        tenGoi: 'staticrypt',
        buoc: [{ lenh: 'npm install staticrypt' }],
      },
    ];
    expect(laThuVienLapTrinh(readmeStaticrypt, 'robinmoisson/staticrypt', cach)).toBe(false);
  });

  it('cài toàn cục một gói KHÁC (expo-cli) không chứng tỏ repo là ứng dụng (react-three-fiber)', () => {
    const cach = [
      {
        nhom: 'NPM',
        trinhQuanLy: 'NPM',
        tenGoi: '@react-three/fiber',
        buoc: [{ lenh: 'npm install three @types/three @react-three/fiber' }],
      },
      {
        nhom: 'NPM',
        trinhQuanLy: 'NPM',
        tenGoi: 'expo-cli',
        buoc: [{ lenh: 'npm install expo-cli -g' }],
      },
    ];
    expect(laThuVienLapTrinh(readmeR3f, 'pmndrs/react-three-fiber', cach)).toBe(true);
  });

  it('lệnh pnpm install trần (chạy từ mã nguồn) không làm repo thành thư viện', () => {
    const cach = [{ nhom: 'NPM', trinhQuanLy: 'NPM', buoc: [{ lenh: 'pnpm install' }] }];
    expect(
      laThuVienLapTrinh('A web app. Run pnpm install then pnpm dev.', 'foo/web-app', cach),
    ).toBe(false);
  });
});

describe('Thử nhỏ lô repo mới: luật vá sau kiểm tay 107 repo qua (12/11/2026)', () => {
  // Phần mở đầu README thật của getzep/graphiti, johannfaouzi/pyts, Babyhamsta/Aimmy, govijr/terminal-mac
  const readmeGraphiti =
    'Graphiti A Framework for Building Temporal Knowledge Graphs\n\ndocker run -p 6379:6379 -p 3000:3000 -it falkordb/falkordb';
  const readmePyts = [
    'pyts: a Python package for time series classification',
    'pyts is a Python package for time series classification. It aims to make time series classification easily accessible by providing preprocessing and utility tools, and implementations of state-of-the-art algorithms.',
  ].join('\n');
  const readmeAimmy =
    'Aimmy\nUniversal Second Eye for Gamers with Impairments (Universal AI Aim Alignment Mechanism)';
  const readmeTerminalMac =
    'terminal-mac\nA separate macOS desktop for computer-use agents, viewed and controlled from a terminal.';

  it("thư viện tự nhận bằng tiêu đề dù có Docker (graphiti), và 'utility tools' của chính gói không làm nó thành tiện ích (pyts)", () => {
    const cachGraphiti = [
      {
        nhom: 'PIP',
        trinhQuanLy: 'PIP',
        tenGoi: 'graphiti-core',
        buoc: [{ lenh: 'pip install graphiti-core' }],
      },
      {
        nhom: 'DOCKER',
        trinhQuanLy: 'DOCKER',
        tenGoi: 'falkordb/falkordb',
        buoc: [{ lenh: 'docker run -p 6379:6379 -p 3000:3000 -it falkordb/falkordb' }],
      },
    ];
    expect(laThuVienLapTrinh(readmeGraphiti, 'getzep/graphiti', cachGraphiti)).toBe(true);
    const cachPyts = [
      { nhom: 'PIP', trinhQuanLy: 'PIP', tenGoi: 'pyts', buoc: [{ lenh: 'pip install pyts' }] },
    ];
    expect(laThuVienLapTrinh(readmePyts, 'johannfaouzi/pyts', cachPyts)).toBe(true);
  });

  it('winget của gói khác không chứng tỏ repo là ứng dụng (robotgo cài GoLang.Go)', () => {
    expect(cachCaiThuocRepo('go-vgo/robotgo', [{ nhom: 'WINGET', tenGoi: 'GoLang.Go' }])).toBe(
      false,
    );
    expect(
      cachCaiThuocRepo('charmbracelet/crush', [{ nhom: 'WINGET', tenGoi: 'charmbracelet.crush' }]),
    ).toBe(true);
  });

  it('nhận ra công cụ gian lận game (Aimmy) và README chỉ nói về Mac (terminal-mac)', () => {
    expect(laCongCuKhongNenNhan(readmeAimmy)).toBe(true);
    expect(laCongCuKhongNenNhan('A fast video downloader built with Go')).toBe(false);
    expect(readmeChiChoMacTheoMoDau(readmeTerminalMac)).toBe(true);
    // app đa nền tảng có đoạn cài cho Mac (browser-use, aws-shell) thì không bị coi là chỉ cho Mac
    expect(
      readmeChiChoMacTheoMoDau(
        'The open source browser agent.\nOn macOS install with brew. Works on Windows and Linux too.',
      ),
    ).toBe(false);
  });
});
