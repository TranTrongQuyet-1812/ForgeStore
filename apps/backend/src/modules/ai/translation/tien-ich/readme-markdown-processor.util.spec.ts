import { describe, expect, it } from 'vitest';
import { kiemBatBienReadme, phanTichReadme, rapLaiReadme } from './readme-markdown-processor.util';

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
    expect(structure.doan.map((segment) => segment.vanBanGoc)).toEqual([
      'Installation',
      'Use',
      'from',
      'Name',
      'Description',
      'Forge',
      'Open source app',
    ]);
    const translations = new Map(
      structure.doan
        .filter((segment) => segment.canDich)
        .map((segment) => [segment.stt, `VI ${segment.vanBanDaChe}`]),
    );

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

    expect(structure.doan.map((segment) => segment.vanBanGoc)).toEqual([
      'Read',
      'the guide',
      'now.',
    ]);
    expect(structure.doan.every((segment) => !segment.vanBanDaChe.includes('https://'))).toBe(true);
    expect(
      rapLaiReadme(source, structure, new Map(structure.doan.map((item) => [item.stt, 'Đã dịch']))),
    ).toBe('<p class="notice">Đã dịch [Đã dịch](https://example.com/a) Đã dịch</p>');
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
});
