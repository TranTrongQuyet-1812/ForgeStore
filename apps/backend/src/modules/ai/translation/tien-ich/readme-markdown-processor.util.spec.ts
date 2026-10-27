import { describe, expect, it } from 'vitest';
import {
  kiemBatBienReadme,
  layLoiBatBienReadme,
  phanTichReadme,
  rapLaiReadme,
} from './readme-markdown-processor.util';

describe('ReadmeMarkdownProcessor', () => {
  it('tách chữ có vị trí và giữ nguyên code, URL, mã inline, khung bảng khi ráp lại', () => {
    const source = [
      '# Installation',
      '',
      'Use `npm install` from https://example.com/setup.',
      '',
      '| Name | Description |',
      '| --- | --- |',
      '| Forge | Open source app |',
      '',
      '```sh',
      'echo "do not translate"',
      '```',
    ].join('\n');
    const structure = phanTichReadme(source);
    expect(structure.doan).toHaveLength(3);
    const translations = new Map(
      structure.doan
        .filter((segment) => segment.canDich)
        .map((segment) => [segment.stt, segment.vanBanDaChe]),
    );
    const sentToModel = structure.doan.map((segment) => segment.vanBanDaChe).join('\n');

    expect(sentToModel).not.toContain('npm install');
    expect(sentToModel).not.toContain('https://example.com');
    expect(sentToModel).not.toContain('| --- |');

    const result = rapLaiReadme(source, structure, translations);

    expect(result).toContain('# Cài đặt');
    expect(result).toContain('`npm install`');
    expect(result).toContain('https://example.com/setup.');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('```sh\necho "do not translate"\n```');
    expect(kiemBatBienReadme(source, result).canhBao).toContain('nguong_do_dai_cho_benchmark');
  });

  it('chỉ phát hành phần chữ của link và HTML, không phát hành URL hay thuộc tính', () => {
    const source = '<p class="notice">Read [the guide](https://example.com/a) now.</p>';
    const structure = phanTichReadme(source);

    expect(structure.doan).toHaveLength(1);
    expect(structure.doan[0]?.vanBanDaChe).toContain('Read');
    expect(structure.doan[0]?.vanBanDaChe).toContain('the guide');
    expect(structure.doan[0]?.vanBanDaChe).toContain('now.');
    expect(structure.doan[0]?.vanBanDaChe).not.toContain('https://');
    expect(
      rapLaiReadme(
        source,
        structure,
        new Map(
          structure.doan.map((item) => [
            item.stt,
            item.vanBanDaChe
              .replace('Read', 'Đọc')
              .replace('the guide', 'hướng dẫn')
              .replace('now', 'ngay'),
          ]),
        ),
      ),
    ).toBe('<p class="notice">Đọc [hướng dẫn](https://example.com/a) ngay.</p>');
  });

  it('đưa cú pháp link ở đầu hoặc cuối đoạn vào khung bảo vệ thay vì cắt khỏi câu dịch', () => {
    const source = [
      '### On Ubuntu (using [bat](https://example.com/bat))',
      '',
      '[Getting started](https://example.com/start) is simple; run `bat`.',
    ].join('\n');
    const structure = phanTichReadme(source);
    const ubuntu = structure.doan[0]!;
    const linkedSentence = structure.doan[1]!;

    expect(ubuntu.vanBanGoc).toBe('On Ubuntu (using [bat](https://example.com/bat))');
    expect(ubuntu.vanBanDaChe).toContain('On Ubuntu (using ');
    expect(ubuntu.vanBanDaChe).toContain('bat');
    expect(ubuntu.vanBanDaChe).not.toContain('https://');
    expect(linkedSentence.vanBanGoc).toBe(
      '[Getting started](https://example.com/start) is simple; run `bat`.',
    );
    expect(linkedSentence.vanBanDaChe).toContain('Getting started');
    expect(linkedSentence.vanBanDaChe).toContain('is simple; run');
    expect(linkedSentence.vanBanDaChe).not.toContain('https://');

    const result = rapLaiReadme(
      source,
      structure,
      new Map([[ubuntu.stt, ubuntu.vanBanDaChe.replace('On Ubuntu', 'Trên Ubuntu')]]),
    );
    expect(result).toBe(
      '### Trên Ubuntu (using [bat](https://example.com/bat))\n\n[Getting started](https://example.com/start) is simple; run `bat`.',
    );
  });

  it('giữ alt của huy hiệu và phát hành alt ảnh nội dung để dịch', () => {
    const source =
      '![Build passing](https://img.shields.io/badge/build-passing-green)\n![Architecture](./architecture.png)\n<img alt="System diagram" src="./system.png">';
    const structure = phanTichReadme(source);

    expect(structure.doan.map((segment) => segment.vanBanGoc)).toEqual([
      'Architecture',
      'System diagram',
    ]);
  });

  it('lấy đúng vị trí alt HTML khi chính chữ alt cũng xuất hiện trong URL ảnh', () => {
    const source = '<img src="https://example.com/Downloads/banner.png" alt="Downloads">';
    const structure = phanTichReadme(source);
    const segment = structure.doan[0]!;
    const result = rapLaiReadme(
      source,
      structure,
      new Map([[segment.stt, segment.vanBanDaChe.replace('Downloads', 'Tải xuống')]]),
    );

    expect(segment.vanBanGoc).toBe('Downloads');
    expect(result).toBe('<img src="https://example.com/Downloads/banner.png" alt="Tải xuống">');
    expect(kiemBatBienReadme(source, result).canhBao).not.toContain('url_thay_doi');
  });

  it('giữ nguyên cụm nhãn chuyển ngôn ngữ thay vì phát hành để dịch', () => {
    const source =
      '[English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md) | [한국어](README.ko.md)';
    const structure = phanTichReadme(source);

    expect(structure.doan).toHaveLength(1);
    expect(structure.doan[0]?.canDich).toBe(false);
    expect(rapLaiReadme(source, structure, new Map())).toBe(source);
  });

  it('nhận diện thanh chuyển ngôn ngữ có nhãn châu Âu và giữ nguyên toàn đoạn', () => {
    const source =
      '[English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Português](README.pt.md) | [Deutsch](README.de.md) | [Русский](README.ru.md)';
    const structure = phanTichReadme(source);

    expect(structure.doan[0]?.canDich).toBe(false);
    expect(structure.doan[0]?.vanBanDaChe).toContain('Español');
  });

  it('phân mức đoạn theo tiêu đề, ghi đè cảnh báo và mã lệnh', () => {
    const source = [
      'Short introduction.',
      '',
      '## Features',
      'This explains the main features.',
      '> [!WARNING] Keep the configuration file safe.',
      '',
      'Run `npm install demo` to continue.',
      '',
      '## Installation',
      'Install the application.',
      '',
      '## Sponsors',
      'Our sponsors support this project.',
      '',
      '## Changelog',
      'Version history and release notes.',
      '',
      '## Unlisted Section',
      'This section defaults to the careful level.',
    ].join('\n');
    const structure = phanTichReadme(source);
    const bySource = new Map(structure.doan.map((segment) => [segment.vanBanGoc, segment]));
    const featuresText = structure.doan.find((segment) =>
      segment.vanBanGoc.includes('This explains the main features.'),
    );
    const warningText = structure.doan.find((segment) =>
      segment.vanBanGoc.includes('Keep the configuration file safe.'),
    );

    expect(bySource.get('Short introduction.')?.mucQuanTrong).toBe(2);
    expect(featuresText?.mucQuanTrong).toBe(2);
    expect(
      structure.doan.find((segment) => segment.vanBanGoc.includes('npm install demo'))
        ?.mucQuanTrong,
    ).toBe(1);
    expect(bySource.get('Install the application.')?.mucQuanTrong).toBe(1);
    expect(warningText?.mucQuanTrong).toBe(1);
    expect(bySource.get('Our sponsors support this project.')?.mucQuanTrong).toBe(3);
    expect(bySource.get('Version history and release notes.')?.mucQuanTrong).toBe(2);
    expect(bySource.get('This section defaults to the careful level.')?.mucQuanTrong).toBe(1);
  });

  it('mã inline thường không nâng mức, còn tiêu đề mức 3 vẫn dùng bản Việt cố định', () => {
    const source = [
      '## Features',
      'Supports `.zip` files and `tar` archives.',
      '',
      '## Sponsors',
      'Thanks to our sponsors.',
      '',
      '## Related Projects',
      'Other tools built by us.',
    ].join('\n');
    const structure = phanTichReadme(source);
    const bySource = new Map(structure.doan.map((segment) => [segment.vanBanGoc, segment]));
    const sponsorsHeading = structure.doan.find((segment) => segment.vanBanGoc === 'Sponsors');

    expect(structure.doan.find((segment) => segment.vanBanGoc.includes('.zip'))?.mucQuanTrong).toBe(
      2,
    );
    expect(bySource.get('Other tools built by us.')?.mucQuanTrong).toBe(2);
    expect(sponsorsHeading?.mucQuanTrong).toBe(3);
    expect(sponsorsHeading?.canDich).toBe(false);
    expect(sponsorsHeading?.vanBanDaChe).toBe('Nhà tài trợ');
  });

  it('báo các bất biến lỗi và không tự đặt ngưỡng độ dài', () => {
    const source = '# Guide\n- one\n- two\n\n`run` https://example.com';
    const result = kiemBatBienReadme(source, '# Hướng dẫn\n- một\n`changed` https://example.org');

    expect(result.hang).toBe('B');
    expect(result.canhBao).toContain('so_muc_danh_sach_thay_doi');
    expect(result.canhBao).toContain('url_thay_doi');
    expect(result.canhBao).toContain('ma_inline_thay_doi');
    expect(result.canhBao).toContain('nguong_do_dai_cho_benchmark');
  });

  it('từ chối lắp nếu vị trí nguồn không còn khớp', () => {
    const structure = phanTichReadme('A paragraph.');

    expect(() => rapLaiReadme('Changed paragraph.', structure, new Map([[1, 'Đã dịch']]))).toThrow(
      'Vị trí đoạn README đã thay đổi tại dòng 1',
    );
  });

  it('từ chối khi mô hình đổi thứ tự ký hiệu của phần phải giữ nguyên', () => {
    const structure = phanTichReadme('Read `code` and https://example.com now.');
    const segment = structure.doan[0]!;
    const tokens = Object.keys(segment.khungGiuNguyen);
    expect(tokens).toHaveLength(2);
    const swapped = segment.vanBanDaChe
      .replace(tokens[0]!, 'TEMP')
      .replace(tokens[1]!, tokens[0]!)
      .replace('TEMP', tokens[1]!);

    expect(() =>
      rapLaiReadme(
        'Read `code` and https://example.com now.',
        structure,
        new Map([[segment.stt, swapped]]),
      ),
    ).toThrow('Thứ tự ký hiệu giữ nguyên bị đổi');
  });

  it('khôi phục nguyên văn URL có ký hiệu dollar và bắt thay đổi khung sau khi ráp', () => {
    const source = "Run ``$& $' $` `` and [ref](https://example.com) now.";
    const structure = phanTichReadme(source);
    const segment = structure.doan[0]!;
    const result = rapLaiReadme(
      source,
      structure,
      new Map([[segment.stt, segment.vanBanDaChe.replace('Run', 'Chạy')]]),
    );

    expect(result).toBe("Chạy ``$& $' $` `` and [ref](https://example.com) now.");
    expect(kiemBatBienReadme(source, result).canhBao).not.toContain('khung_van_ban_thay_doi');
    expect(
      kiemBatBienReadme(source, result.replace('https://example.com', 'https://other.example'))
        .canhBao,
    ).toContain('khung_van_ban_thay_doi');
  });

  it('không bỏ sót câu văn bắt đầu bằng Import/Export nhưng vẫn giữ câu lệnh MDX', () => {
    const source = [
      'import the library before starting.',
      'Export your settings when finished.',
      "import { Button } from 'ui-kit';",
    ].join('\n\n');
    const structure = phanTichReadme(source);

    expect(structure.doan.map((segment) => segment.vanBanGoc)).toContain(
      'import the library before starting.',
    );
    expect(structure.doan.map((segment) => segment.vanBanGoc)).toContain(
      'Export your settings when finished.',
    );
    expect(structure.doan.map((segment) => segment.vanBanGoc)).not.toContain(
      "import { Button } from 'ui-kit';",
    );
    expect(structure.canhBao.some((warning) => warning.lyDo === 'khong_phan_loai_duoc_khoi')).toBe(
      true,
    );
  });

  it('giữ emoji và số thứ tự đầu tiêu đề khi áp dụng bản dịch cố định', () => {
    const source = '## 🚀 Features\n\n### 2. Installation\n\n#### 2.1 🚀 Quick Start';
    const structure = phanTichReadme(source);
    const result = rapLaiReadme(source, structure, new Map());

    expect(result).toBe('## 🚀 Tính năng\n\n### 2. Cài đặt\n\n#### 2.1 🚀 Bắt đầu nhanh');
  });

  it('giữ mã inline nhiều dòng và nội dung thẻ code HTML nguyên vẹn', () => {
    const source = 'Use `npm\n install` and <code>pnpm install</code> now.';
    const structure = phanTichReadme(source);
    const exposed = structure.doan.map((segment) => segment.vanBanDaChe).join(' ');

    expect(exposed).not.toContain('npm');
    expect(exposed).not.toContain('install');
    expect(exposed).toContain('Use');
    expect(exposed).toContain('now.');
  });

  it('không phát hành biểu thức JSX nằm trong văn xuôi MDX', () => {
    const structure = phanTichReadme('Display {user.profile.name} in the panel.');
    const sentToModel = structure.doan.map((segment) => segment.vanBanDaChe).join(' ');

    expect(sentToModel).not.toContain('user.profile.name');
    expect(sentToModel).toContain('Display');
    expect(sentToModel).toContain('the panel.');
  });

  it('nhận diện tiêu đề Setext và không nhầm dấu | trong mã inline thành bảng', () => {
    const source = [
      'Installation',
      '============',
      '',
      'Use `left | right` as the sample input.',
      '',
      'Heading-like text',
      '---',
    ].join('\n');
    const structure = phanTichReadme(source);
    const result = rapLaiReadme(
      source,
      structure,
      new Map(
        structure.doan.map((item) => [
          item.stt,
          item.vanBanDaChe
            .replace('Use', 'Dùng')
            .replace('as the sample input.', 'làm dữ liệu mẫu.'),
        ]),
      ),
    );

    expect(structure.nut[0]).toMatchObject({ loai: 'heading', capTieuDe: 1 });
    expect(structure.doan[0]?.vanBanDaChe).toBe('Cài đặt');
    expect(structure.doan[1]?.loai).toBe('paragraph');
    expect(structure.doan[1]?.vanBanDaChe).toContain('Use');
    expect(structure.doan[1]?.vanBanDaChe).not.toContain('left | right');
    expect(structure.nut[structure.nut.length - 1]).toMatchObject({
      loai: 'heading',
      capTieuDe: 2,
    });
    expect(result).toContain('Cài đặt\n============');
    expect(result).toContain('Dùng `left | right` làm dữ liệu mẫu.');
    expect(result).toContain('Heading-like text\n---');
  });

  it('giữ dấu | bên trong mã inline của ô bảng khi dịch hàng', () => {
    const source = '| Command | Meaning |\n| --- | --- |\n| `left | right` | Pair values |';
    const structure = phanTichReadme(source);
    const segment = structure.doan[0]!;
    const result = rapLaiReadme(
      source,
      structure,
      new Map([
        [
          segment.stt,
          segment.vanBanDaChe.replace('Meaning', 'Ý nghĩa').replace('Pair values', 'Ghép giá trị'),
        ],
      ]),
    );

    expect(segment.loai).toBe('table_cell');
    expect(segment.vanBanDaChe).not.toContain('left | right');
    expect(segment.vanBanDaChe).toContain('Meaning');
    expect(result).toBe('| Command | Ý nghĩa |\n| --- | --- |\n| `left | right` | Ghép giá trị |');
  });

  it('dịch được danh sách lồng nhau mà vẫn giữ cấu trúc dấu đầu dòng', () => {
    const source = '- Parent item\n  - Nested item\n    - Deeper item';
    const structure = phanTichReadme(source);

    expect(structure.doan.map((item) => item.vanBanGoc)).toEqual([
      'Parent item',
      'Nested item',
      'Deeper item',
    ]);
    expect(structure.doan.map((item) => item.loai)).toEqual([
      'list_item',
      'list_item',
      'list_item',
    ]);
    expect(
      rapLaiReadme(
        source,
        structure,
        new Map(structure.doan.map((item) => [item.stt, `Dịch ${item.vanBanGoc}`])),
      ),
    ).toBe('- Dịch Parent item\n  - Dịch Nested item\n    - Dịch Deeper item');
  });

  it('giữ nguyên HTML details và trộn được Markdown trong phần nội dung', () => {
    const source = [
      '<details>',
      '<summary>More information</summary>',
      '',
      'Read **the guide** at [this link](https://example.com/guide).',
      '</details>',
    ].join('\n');
    const structure = phanTichReadme(source);
    const exposed = structure.doan.map((item) => item.vanBanDaChe).join('\n');
    const result = rapLaiReadme(
      source,
      structure,
      new Map(
        structure.doan.map((item) => [
          item.stt,
          item.vanBanDaChe.replace('More information', 'Thêm thông tin').replace('Read', 'Đọc'),
        ]),
      ),
    );

    expect(exposed).toContain('More information');
    expect(exposed).toContain('the guide');
    expect(exposed).toContain('this link');
    expect(exposed).not.toContain('https://');
    expect(result).toContain('<details>\n<summary>Thêm thông tin</summary>');
    expect(result).toContain('Đọc **the guide** at [this link](https://example.com/guide).');
    expect(result.endsWith('</details>')).toBe(true);
  });

  it('giữ nguyên front matter, CRLF, khối code chưa đóng và README rỗng', () => {
    const crlf = [
      '---',
      'title: Example',
      '---',
      'Install the app.',
      '```sh',
      'echo "keep this"',
    ].join('\r\n');
    const structure = phanTichReadme(crlf);
    const result = rapLaiReadme(
      crlf,
      structure,
      new Map(structure.doan.map((item) => [item.stt, 'Cài ứng dụng.'])),
    );
    const empty = phanTichReadme('');

    expect(structure.canhBao).toContainEqual({ dong: 6, lyDo: 'khoi_code_chua_dong' });
    expect(result).toBe(
      '---\r\ntitle: Example\r\n---\r\nCài ứng dụng.\r\n```sh\r\necho "keep this"',
    );
    expect(empty).toEqual({ nut: [], doan: [], canhBao: [] });
    expect(rapLaiReadme('', empty, new Map())).toBe('');
  });

  it('tính tỷ lệ riêng cho nguồn Anh/Trung và phân biệt lỗi bất biến với cảnh báo benchmark', () => {
    const result = kiemBatBienReadme('Install app 安装', 'Cài ứng dụng Dùng', {
      doan: [
        { goc: 'Install app', dich: 'Cài ứng dụng' },
        { goc: '安装', dich: 'Dùng' },
      ],
    });

    expect(result.tiLeDoDaiEn).not.toBeNull();
    expect(result.tiLeDoDaiZh).toBe(2);
    expect(layLoiBatBienReadme(result.canhBao)).toEqual([]);
    expect(layLoiBatBienReadme(['url_thay_doi', 'nguong_do_dai_cho_benchmark'])).toEqual([
      'url_thay_doi',
    ]);
  });

  it('chỉ báo chữ Hán mới không có trong nguồn của chính đoạn được dịch', () => {
    const retainedHan = kiemBatBienReadme('README có 中文 và tên Bat', 'Bat', {
      doan: [
        { goc: 'Bat', dich: 'Bat' },
        { goc: '中文', dich: '中文' },
      ],
    });
    const introducedHan = kiemBatBienReadme('Run Bat', '运行 Bat', {
      doan: [{ goc: 'Run Bat', dich: '运行 Bat' }],
    });

    expect(retainedHan.canhBao).not.toContain('con_chu_han');
    expect(introducedHan.canhBao).toContain('con_chu_han');
  });

  it('bỏ qua khoảng trắng quanh khung giữ nguyên nhưng vẫn bắt nội dung khung bị đổi', () => {
    const source = 'Run `--help` now.';
    const translatedWithExtraWords = kiemBatBienReadme(source, 'Lệnh hỗ trợ `--help` có sẵn.');
    const translatedWithoutAdjacentSpaces = kiemBatBienReadme(source, 'Dùng`--help`để xem.');
    const changedFrame = kiemBatBienReadme(source, 'Dùng`--version`để xem.');

    expect(translatedWithExtraWords.canhBao).not.toContain('khung_van_ban_thay_doi');
    expect(translatedWithoutAdjacentSpaces.canhBao).not.toContain('khung_van_ban_thay_doi');
    expect(changedFrame.canhBao).toContain('khung_van_ban_thay_doi');
  });
});
