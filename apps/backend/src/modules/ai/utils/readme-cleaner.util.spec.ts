import { describe, expect, it } from 'vitest';
import { chuanHoaVanBan, kiemTraTrichDanHopLe, lamSachReadme } from './readme-cleaner.util';
import { TinhNangChiTiet } from '../dto/ai-summary.dto';

describe('readme-cleaner.util', () => {
  describe('lamSachReadme', () => {
    it('Loại bỏ badges, hình ảnh markdown, HTML tags và code block', () => {
      const input = `
# RustDesk [![Build](https://img.shields.io/badge/build-pass-green)](https://github.com)
<div align="center">
  <img src="https://example.com/logo.png" alt="logo" />
  <p>The open-source remote desktop client.</p>
</div>

![Screenshot](https://example.com/shot.png)

\`\`\`bash
cargo build --release
cargo run
\`\`\`

Here is the real feature description: Fast remote desktop control with end-to-end encryption.
      `;

      const cleaned = lamSachReadme(input);
      expect(cleaned).not.toContain('[![Build]');
      expect(cleaned).not.toContain('<div');
      expect(cleaned).not.toContain('</div>');
      expect(cleaned).not.toContain('<img');
      expect(cleaned).not.toContain('![Screenshot]');
      expect(cleaned).not.toContain('cargo build --release');
      expect(cleaned).toContain('Fast remote desktop control with end-to-end encryption');
    });

    it('Cắt ngắn nội dung nếu vượt quá maxLen', () => {
      const longText = 'A'.repeat(500);
      const cleaned = lamSachReadme(longText, 100);
      expect(cleaned.length).toBeLessThanOrEqual(150);
      expect(cleaned).toContain('...[Đã cắt ngắn để tối ưu hóa]');
    });
  });

  describe('kiemTraTrichDanHopLe (Code-Check chống bịa nội dung - P2-30.8)', () => {
    const rawReadme = `
# LocalSend
An open-source cross-platform alternative to AirDrop.
Share files with nearby devices securely on your local network. No internet required.
Supports end-to-end encryption and fast transfer speeds.
    `;

    it('Giữ lại các tính năng có trích dẫn nguyên văn chính xác từ README', () => {
      const features: TinhNangChiTiet[] = [
        {
          tieuDe: 'Chia sẻ không cần Internet',
          moTa: 'Truyền tệp an toàn qua mạng cục bộ.',
          trichDan:
            'Share files with nearby devices securely on your local network. No internet required.',
        },
        {
          tieuDe: 'Mã hóa đầu cuối',
          moTa: 'Tốc độ truyền nhanh và bảo mật cao.',
          trichDan: 'Supports end-to-end encryption',
        },
      ];

      const verified = kiemTraTrichDanHopLe(features, rawReadme);
      expect(verified).toHaveLength(2);
      expect(verified[0].tieuDe).toBe('Chia sẻ không cần Internet');
      expect(verified[1].tieuDe).toBe('Mã hóa đầu cuối');
    });

    it('Loại bỏ tính năng có trích dẫn bịa đặt hoặc không có trong README', () => {
      const features: TinhNangChiTiet[] = [
        {
          tieuDe: 'Tính năng thật',
          moTa: 'Truyền tệp không internet.',
          trichDan: 'No internet required.',
        },
        {
          tieuDe: 'Tính năng bịa (AI tự chế)',
          moTa: 'Tích hợp blockchain AI quantum computing.',
          trichDan: 'Powered by quantum computing and web3 tokens on Solana',
        },
      ];

      const verified = kiemTraTrichDanHopLe(features, rawReadme);
      expect(verified).toHaveLength(1);
      expect(verified[0].tieuDe).toBe('Tính năng thật');
    });

    it('Khớp trích dẫn bất chấp khác biệt khoảng trắng và chữ hoa thường', () => {
      const features: TinhNangChiTiet[] = [
        {
          tieuDe: 'Đa nền tảng',
          moTa: 'Giải pháp thay thế AirDrop.',
          trichDan: '  an OPEN-SOURCE   CROSS-PLATFORM alternative to airdrop. ',
        },
      ];

      const verified = kiemTraTrichDanHopLe(features, rawReadme);
      expect(verified).toHaveLength(1);
    });

    it('Trả về mảng rỗng nếu toàn bộ tính năng đều có trích dẫn sai', () => {
      const features: TinhNangChiTiet[] = [
        {
          tieuDe: 'Ảo giác 1',
          moTa: 'Không có thật.',
          trichDan: 'This sentence is completely absent from the text.',
        },
      ];

      const verified = kiemTraTrichDanHopLe(features, rawReadme);
      expect(verified).toHaveLength(0);
    });
  });

  describe('chuanHoaVanBan', () => {
    it('Loại bỏ ký tự đặc biệt và chuẩn hóa khoảng trắng', () => {
      expect(chuanHoaVanBan('Hello,   World! 123')).toBe('hello world 123');
    });
  });
});
