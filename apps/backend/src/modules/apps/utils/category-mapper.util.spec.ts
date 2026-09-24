import { describe, it, expect } from 'vitest';
import { anhXaDanhMuc, doanTenGoiAndroid } from './category-mapper.util';

describe('category-mapper.util', () => {
  describe('anhXaDanhMuc', () => {
    it('Ánh xạ chính xác topics Bảo mật & Quyền riêng tư', () => {
      const result = anhXaDanhMuc(['keepass', 'password-manager', 'security']);
      expect(result).toBe('Bảo mật & Quyền riêng tư');
    });

    it('Ánh xạ chính xác topics Đa phương tiện', () => {
      const result = anhXaDanhMuc(['video-player', 'streaming', 'audio']);
      expect(result).toBe('Đa phương tiện');
    });

    it('Ánh xạ chính xác topics Năng suất & Văn phòng', () => {
      const result = anhXaDanhMuc(['notes', 'markdown', 'productivity']);
      expect(result).toBe('Năng suất & Văn phòng');
    });

    it('Ánh xạ chính xác topics Lập trình & Phát triển', () => {
      const result = anhXaDanhMuc(['git', 'developer-tools', 'ide']);
      expect(result).toBe('Lập trình & Phát triển');
    });

    it('Ánh xạ chính xác topics Mạng & Giao tiếp', () => {
      const result = anhXaDanhMuc(['remote-desktop', 'p2p', 'rustdesk']);
      expect(result).toBe('Mạng & Giao tiếp');
    });

    it('Ánh xạ chính xác topics Trò chơi & Giải trí', () => {
      const result = anhXaDanhMuc(['emulator', 'gaming', 'retroarch']);
      expect(result).toBe('Trò chơi & Giải trí');
    });

    it('Ánh xạ chính xác topics Học tập & Giáo dục', () => {
      const result = anhXaDanhMuc(['manga', 'reader', 'mihon']);
      expect(result).toBe('Học tập & Giáo dục');
    });

    it('Fallback về "Tiện ích hệ thống" khi không khớp topics nào', () => {
      const result = anhXaDanhMuc(['random-unknown-topic-xyz']);
      expect(result).toBe('Tiện ích hệ thống');
    });

    it('Sử dụng mô tả để trợ giúp khi topics rỗng', () => {
      const result = anhXaDanhMuc([], 'An open-source media player for all video formats');
      expect(result).toBe('Đa phương tiện');
    });
  });

  describe('doanTenGoiAndroid', () => {
    it('Khớp từ bảng repo nổi tiếng', () => {
      expect(doanTenGoiAndroid('rustdesk/rustdesk')).toBe('com.carriez.rustdesk');
      expect(doanTenGoiAndroid('videolan/vlc')).toBe('org.videolan.vlc');
      expect(doanTenGoiAndroid('localsend/localsend')).toBe('org.localsend.localsend_app');
    });

    it('Trích xuất từ file APK có chứa reverse domain format', () => {
      const result = doanTenGoiAndroid('unknown/custom-app', ['org.example.coolapp-v1.0.0.apk']);
      expect(result).toBe('org.example.coolapp');
    });

    it('Trả về null nếu không đoán được', () => {
      const result = doanTenGoiAndroid('unknown/custom-app', ['setup-v1.0.apk']);
      expect(result).toBeNull();
    });
  });
});
