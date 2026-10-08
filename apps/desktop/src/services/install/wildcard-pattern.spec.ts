import { describe, it, expect } from 'vitest';
import { taoMauTenTepWildcard, khopMauTenTep, timTepTheoMauWildcard } from '@forgestore/types';

describe('WildcardPatternUtil (P3B-17.1)', () => {
  describe('taoMauTenTepWildcard', () => {
    it('thay thế số phiên bản bằng dấu wildcard * khi có phiên bản cụ thể', () => {
      expect(taoMauTenTepWildcard('SuperApp-v1.2.3-x64-setup.exe', '1.2.3')).toBe(
        'SuperApp-*-x64-setup.exe',
      );
      expect(taoMauTenTepWildcard('SuperApp-1.2.3-arm64.exe', '1.2.3')).toBe(
        'SuperApp-*-arm64.exe',
      );
      expect(taoMauTenTepWildcard('my-tool-v2.0.0-pro-portable.zip', 'v2.0.0')).toBe(
        'my-tool-*-pro-portable.zip',
      );
    });

    it('tự động nhận diện cụm phiên bản SemVer/CalVer khi không truyền phiên bản', () => {
      expect(taoMauTenTepWildcard('Rufus-4.4.exe')).toBe('Rufus-*.exe');
      expect(taoMauTenTepWildcard('rustdesk-1.2.3-x86_64.exe')).toBe('rustdesk-*-x86_64.exe');
      expect(taoMauTenTepWildcard('app-2024.10.05-win.zip')).toBe('app-*-win.zip');
    });

    it('giữ nguyên các định danh biến thể như chip, bản pro/lite, installer/portable', () => {
      const pattern1 = taoMauTenTepWildcard('Komi-v3.1.0-arm64-lite.msi', '3.1.0');
      expect(pattern1).toBe('Komi-*-arm64-lite.msi');

      const pattern2 = taoMauTenTepWildcard('Tool_2.5_x64_portable.zip');
      expect(pattern2).toBe('Tool_*_x64_portable.zip');
    });

    it('trả về chuỗi rỗng nếu đầu vào rỗng', () => {
      expect(taoMauTenTepWildcard('')).toBe('');
    });
  });

  describe('khopMauTenTep', () => {
    it('khớp chính xác các phiên bản mới hơn cùng biến thể', () => {
      const pattern = 'SuperApp-*-x64-setup.exe';
      expect(khopMauTenTep('SuperApp-v1.2.4-x64-setup.exe', pattern)).toBe(true);
      expect(khopMauTenTep('SuperApp-2.0.0-x64-setup.exe', pattern)).toBe(true);
    });

    it('từ chối tệp khác kiến trúc chip hoặc khác biến thể', () => {
      const pattern = 'SuperApp-*-x64-setup.exe';
      // Khác chip (arm64 thay vì x64)
      expect(khopMauTenTep('SuperApp-v1.2.4-arm64-setup.exe', pattern)).toBe(false);
      // Khác loại gói (portable thay vì setup)
      expect(khopMauTenTep('SuperApp-v1.2.4-x64-portable.zip', pattern)).toBe(false);
    });

    it('khớp biến thể lite/pro', () => {
      const proPattern = 'app-*-pro.exe';
      expect(khopMauTenTep('app-v2.0-pro.exe', proPattern)).toBe(true);
      expect(khopMauTenTep('app-v2.0-lite.exe', proPattern)).toBe(false);
    });
  });

  describe('timTepTheoMauWildcard', () => {
    const assets = [
      { maTep: '1', tenTep: 'app-v2.0.0-x64-setup.exe', loai: 'EXE' },
      { maTep: '2', tenTep: 'app-v2.0.0-arm64-setup.exe', loai: 'EXE' },
      { maTep: '3', tenTep: 'app-v2.0.0-x64-portable.zip', loai: 'ZIP' },
    ];

    it('tìm đúng tệp khớp với mẫu biến thể đã lưu', () => {
      const matched = timTepTheoMauWildcard(assets, 'app-*-x64-portable.zip');
      expect(matched?.maTep).toBe('3');
      expect(matched?.tenTep).toBe('app-v2.0.0-x64-portable.zip');
    });

    it('trả về null nếu không có tệp nào khớp hoặc mẫu rỗng', () => {
      expect(timTepTheoMauWildcard(assets, 'app-*-ia32.exe')).toBeNull();
      expect(timTepTheoMauWildcard(assets, null)).toBeNull();
      expect(timTepTheoMauWildcard([], 'app-*-x64.exe')).toBeNull();
    });
  });
});
