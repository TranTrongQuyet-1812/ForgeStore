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

  it('giữ alt của huy hiệu và phát hành alt ảnh nội dung để dịch', () => {
    const source =
      '![Build passing](https://img.shields.io/badge/build-passing-green)\n![Architecture](./architecture.png)\n<img alt="System diagram" src="./system.png">';
    const structure = phanTichReadme(source);

    expect(structure.doan.map((segment) => segment.vanBanGoc)).toEqual([
      'Architecture',
      'System diagram',
    ]);
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
});
