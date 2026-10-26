import { describe, expect, it } from 'vitest';
import { phanLuongInput, laCumTuMoTaNhuCauTiengViet } from './smart-input-dispatcher.util';

describe('SmartInputDispatcher (P2-40)', () => {
  describe('Luồng URL GitHub (P2-40.2)', () => {
    it('1. nhận diện URL chuẩn HTTPS', () => {
      const res = phanLuongInput('https://github.com/rustdesk/rustdesk');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('rustdesk');
      expect(res.repo).toBe('rustdesk');
    });

    it('2. nhận diện URL không có https://', () => {
      const res = phanLuongInput('github.com/obsidianmd/obsidian-releases');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('obsidianmd');
      expect(res.repo).toBe('obsidian-releases');
    });

    it('3. nhận diện URL có tiền tố www.', () => {
      const res = phanLuongInput('https://www.github.com/videolan/vlc');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('videolan');
      expect(res.repo).toBe('vlc');
    });

    it('4. nhận diện URL có đuôi .git', () => {
      const res = phanLuongInput('https://github.com/7-zip/7-zip.git');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('7-zip');
      expect(res.repo).toBe('7-zip');
    });

    it('5. nhận diện URL subpath /releases', () => {
      const res = phanLuongInput('https://github.com/rustdesk/rustdesk/releases');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('rustdesk');
      expect(res.repo).toBe('rustdesk');
    });

    it('6. nhận diện URL subpath tag release chi tiết', () => {
      const res = phanLuongInput('https://github.com/rustdesk/rustdesk/releases/tag/1.3.0');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('rustdesk');
      expect(res.repo).toBe('rustdesk');
    });

    it('7. nhận diện URL subpath /tree/main/src', () => {
      const res = phanLuongInput('https://github.com/kiwix/kiwix-android/tree/main/src');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('kiwix');
      expect(res.repo).toBe('kiwix-android');
    });

    it('8. nhận diện URL có hash fragment (#readme)', () => {
      const res = phanLuongInput(
        'https://github.com/notepad-plus-plus/notepad-plus-plus#installation',
      );
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('notepad-plus-plus');
      expect(res.repo).toBe('notepad-plus-plus');
    });

    it('9. nhận diện URL có query params (?tab=readme-ov-file)', () => {
      const res = phanLuongInput('https://github.com/libreoffice/core?tab=readme-ov-file');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('libreoffice');
      expect(res.repo).toBe('core');
    });

    it('10. nhận diện URL có dấu gạch chéo cuối dòng (trailing slash)', () => {
      const res = phanLuongInput('github.com/fastfetch-cli/fastfetch/');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('fastfetch-cli');
      expect(res.repo).toBe('fastfetch');
    });
  });

  describe('Luồng Tên App (P2-40.3)', () => {
    it('11. tên app ngắn 1 từ chữ thường (vlc)', () => {
      const res = phanLuongInput('vlc');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('vlc');
    });

    it('12. tên app ngắn viết hoa (RustDesk)', () => {
      const res = phanLuongInput('RustDesk');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('RustDesk');
    });

    it('13. tên app có dấu gạch ngang (7-zip)', () => {
      const res = phanLuongInput('7-zip');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('7-zip');
    });

    it('14. tên app có ký tự cộng (notepad++)', () => {
      const res = phanLuongInput('notepad++');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('notepad++');
    });

    it('15. tên app 2 từ (Laban Key)', () => {
      const res = phanLuongInput('Laban Key');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('Laban Key');
    });

    it('16. tên app 3 từ (Google Chrome Beta)', () => {
      const res = phanLuongInput('Google Chrome Beta');
      expect(res.loai).toBe('TEN_APP');
      expect(res.tuKhoa).toBe('Google Chrome Beta');
    });
  });

  describe('Luồng Ý Định Tự Nhiên (P2-40.4 & P2-42)', () => {
    it('17. câu mô tả nhu cầu bắt đầu bằng "app"', () => {
      const res = phanLuongInput('app xem phim không quảng cáo');
      expect(res.loai).toBe('Y_DINH');
      expect(res.tuKhoa).toBe('app xem phim không quảng cáo');
    });

    it('18. câu mô tả nhu cầu bắt đầu bằng "trình"', () => {
      const res = phanLuongInput('trình ghi chú markdown');
      expect(res.loai).toBe('Y_DINH');
      expect(res.tuKhoa).toBe('trình ghi chú markdown');
    });

    it('19. câu mô tả nhu cầu bắt đầu bằng "phần mềm"', () => {
      const res = phanLuongInput('phần mềm tải video youtube');
      expect(res.loai).toBe('Y_DINH');
      expect(res.tuKhoa).toBe('phần mềm tải video youtube');
    });

    it('20. câu dài hơn 3 từ mô tả chức năng', () => {
      const res = phanLuongInput('ghi chú cá nhân bảo mật cao');
      expect(res.loai).toBe('Y_DINH');
      expect(res.tuKhoa).toBe('ghi chú cá nhân bảo mật cao');
    });

    it('21. câu có dấu hỏi nghi vấn (?)', () => {
      const res = phanLuongInput('phần mềm nào tốt?');
      expect(res.loai).toBe('Y_DINH');
    });
  });

  describe('Trường hợp biên & Vệ sinh dữ liệu (P2-40.6)', () => {
    it('22. xử lý chuỗi rỗng hoặc chỉ có khoảng trắng', () => {
      const res1 = phanLuongInput('');
      expect(res1.loai).toBe('TEN_APP');
      expect(res1.tuKhoa).toBe('');

      const res2 = phanLuongInput('    ');
      expect(res2.loai).toBe('TEN_APP');
      expect(res2.tuKhoa).toBe('');
    });

    it('23. cắt gọn chuỗi siêu dài vượt trần 200 ký tự an toàn', () => {
      const chuoiDai = 'a'.repeat(300);
      const res = phanLuongInput(chuoiDai);
      expect(res.tuKhoa.length).toBe(200);
    });

    it('24. loại bỏ khoảng trắng thừa ở hai đầu URL', () => {
      const res = phanLuongInput('   https://github.com/rustdesk/rustdesk   ');
      expect(res.loai).toBe('URL');
      expect(res.owner).toBe('rustdesk');
      expect(res.repo).toBe('rustdesk');
    });
  });
});

describe('laCumTuMoTaNhuCauTiengViet', () => {
  it('cụm 2 đến 3 từ tiếng Việt có dấu là mô tả nhu cầu', () => {
    expect(laCumTuMoTaNhuCauTiengViet('chụp màn hình')).toBe(true);
    expect(laCumTuMoTaNhuCauTiengViet('ghi chú')).toBe(true);
    expect(laCumTuMoTaNhuCauTiengViet('tải torrent')).toBe(true);
  });

  it('tên app tiếng Anh nhiều từ vẫn là tên app', () => {
    expect(laCumTuMoTaNhuCauTiengViet('visual studio')).toBe(false);
    expect(laCumTuMoTaNhuCauTiengViet('notepad plus plus')).toBe(false);
  });

  it('một từ hoặc rỗng không phải mô tả nhu cầu', () => {
    expect(laCumTuMoTaNhuCauTiengViet('vlc')).toBe(false);
    expect(laCumTuMoTaNhuCauTiengViet('ghi')).toBe(false);
    expect(laCumTuMoTaNhuCauTiengViet('')).toBe(false);
  });
});
