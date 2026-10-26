import { describe, it, expect } from 'vitest';
import { anhXaDanhMuc, doanTenGoiAndroid } from './anh-xa-danh-muc.util';

describe('category-mapper.util (N2)', () => {
  describe('anhXaDanhMuc - Cơ bản & Topics chuẩn', () => {
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

  describe('anhXaDanhMuc - N2 Edge Cases & Word Boundaries', () => {
    it('N2.1: Từ khóa "cli" KHÔNG được khớp vào "client" trong topic hoặc mô tả', () => {
      // qBittorrent hoặc Transmission có topic "bittorrent-client" hoặc mô tả chứa "client"
      const resultTopic = anhXaDanhMuc(['bittorrent-client', 'p2p']);
      expect(resultTopic).toBe('Mạng & Giao tiếp');

      const resultDesc = anhXaDanhMuc(
        [],
        'An advanced and multi-platform BitTorrent client with a nice Qt user interface',
      );
      expect(resultDesc).toBe('Mạng & Giao tiếp');
    });

    it('N2.2: Từ khóa "editor" đã phân tách, không kéo Notepad++ về Đa phương tiện', () => {
      // Notepad++ có topic text-editor hoặc source-code-editor
      const result = anhXaDanhMuc(
        ['text-editor', 'c-plus-plus'],
        'Notepad++ is a free source code editor',
      );
      expect(result).toBe('Lập trình & Phát triển');

      // Video/Audio editor vào Đa phương tiện
      const videoResult = anhXaDanhMuc(['video-editor'], 'Open-source video editing tool');
      expect(videoResult).toBe('Đa phương tiện');
    });

    it('N2.3: Topic "windows" và "android" KHÔNG làm tăng điểm Tiện ích hệ thống', () => {
      // Jellyfin Android có topic ['media', 'android']
      const result = anhXaDanhMuc(
        ['media', 'android'],
        'The Android client for the Jellyfin media server',
      );
      expect(result).toBe('Đa phương tiện');
    });

    it('N2.4: Hòa điểm thì ưu tiên danh mục khớp TOPIC hơn danh mục chỉ khớp MÔ TẢ', () => {
      // Topic khớp "notes" (Năng suất: 3đ), mô tả khớp "converter" (Đa phương tiện: 1đ), "player" (Đa phương tiện: 1đ), "audio" (Đa phương tiện: 1đ)
      // Tổng điểm: Năng suất 3đ (topic 3đ), Đa phương tiện 3đ (topic 0đ). Năng suất phải thắng!
      const result = anhXaDanhMuc(
        ['notes'],
        'A simple note app with converter, player and audio support',
      );
      expect(result).toBe('Năng suất & Văn phòng');
    });

    it('N2.5: Bổ sung từ khóa bittorrent, torrent-client, media-server cho Mạng & Giao tiếp', () => {
      expect(anhXaDanhMuc(['bittorrent'])).toBe('Mạng & Giao tiếp');
      expect(anhXaDanhMuc(['torrent-client'])).toBe('Mạng & Giao tiếp');
      expect(anhXaDanhMuc([], 'High performance media-server software')).toBe('Mạng & Giao tiếp');
    });

    it('N2.6: Bổ sung jellyfin, plex, media-player cho Đa phương tiện', () => {
      expect(anhXaDanhMuc(['jellyfin'])).toBe('Đa phương tiện');
      expect(anhXaDanhMuc(['plex'])).toBe('Đa phương tiện');
      expect(anhXaDanhMuc(['media-player'])).toBe('Đa phương tiện');
    });

    it('N2.7: Bảng ghi đè thủ công BANG_DANH_MUC_THU_CONG hoạt động chuẩn xác', () => {
      expect(anhXaDanhMuc([], null, 'notepad-plus-plus/notepad-plus-plus')).toBe(
        'Lập trình & Phát triển',
      );
      expect(anhXaDanhMuc([], null, 'qbittorrent/qbittorrent')).toBe('Mạng & Giao tiếp');
      expect(anhXaDanhMuc([], null, 'transmission/transmission')).toBe('Mạng & Giao tiếp');
      expect(anhXaDanhMuc([], null, 'jellyfin/jellyfin-android')).toBe('Đa phương tiện');
      expect(anhXaDanhMuc([], null, 'jellyfin/jellyfin')).toBe('Đa phương tiện');
      expect(anhXaDanhMuc([], null, 'koreader/koreader')).toBe('Học tập & Giáo dục');
      expect(anhXaDanhMuc([], null, 'obsidianmd/obsidian-releases')).toBe('Năng suất & Văn phòng');
    });

    it('N2.8: Nghiệm thu 4 app trọng điểm từ báo cáo Claude', () => {
      // 1. Notepad++
      expect(
        anhXaDanhMuc(
          ['editor', 'text-editor', 'notepad-plus-plus'],
          'Notepad++ official repository',
          'notepad-plus-plus/notepad-plus-plus',
        ),
      ).toBe('Lập trình & Phát triển');

      // 2. qBittorrent
      expect(
        anhXaDanhMuc(
          ['bittorrent', 'c-plus-plus', 'torrent-client', 'p2p'],
          'qBittorrent BitTorrent client',
          'qbittorrent/qbittorrent',
        ),
      ).toBe('Mạng & Giao tiếp');

      // 3. Transmission
      expect(
        anhXaDanhMuc(
          ['bittorrent', 'torrent-client'],
          'Official Transmission BitTorrent client repository',
          'transmission/transmission',
        ),
      ).toBe('Mạng & Giao tiếp');

      // 4. Jellyfin Android
      expect(
        anhXaDanhMuc(
          ['android', 'jellyfin', 'media-player'],
          'Android Client for Jellyfin',
          'jellyfin/jellyfin-android',
        ),
      ).toBe('Đa phương tiện');
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
