import { describe, expect, it } from 'vitest';
import {
  coLenhCaiTuReadme,
  cachCaiThuocRepo,
  laThuVienLapTrinh,
  danhGiaRelease,
  locCucBo,
  trongDanhSachChan,
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
