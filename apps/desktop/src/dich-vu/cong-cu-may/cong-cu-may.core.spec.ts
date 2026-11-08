import { describe, expect, it } from 'vitest';
import { BANG_CONG_CU, canhBaoThieuCongCu, layTrinhQuanLyCachCai } from './cong-cu-may.core';

describe('cong-cu-may.core (P3B-31)', () => {
  describe('Bảng công cụ cố định (BANG_CONG_CU)', () => {
    it('định nghĩa đủ 5 công cụ hỗ trợ: npm, pip, docker, winget, scoop', () => {
      const danhSach = Object.keys(BANG_CONG_CU);
      expect(danhSach).toEqual(['npm', 'pip', 'docker', 'winget', 'scoop']);
    });

    it('tất cả liên kết chính thức phải bắt đầu bằng https://', () => {
      for (const [trinh, thongTin] of Object.entries(BANG_CONG_CU)) {
        expect(
          thongTin.lienKetChinhThuc.startsWith('https://'),
          `Liên kết của ${trinh} phải là HTTPS`,
        ).toBe(true);
      }
    });

    it('winget và scoop không có lệnh gợi ý cài đặt', () => {
      expect(BANG_CONG_CU.winget.lenhGoiY).toBeUndefined();
      expect(BANG_CONG_CU.scoop.lenhGoiY).toBeUndefined();
    });

    it('npm, pip, docker có lệnh gợi ý cài đặt qua winget', () => {
      expect(BANG_CONG_CU.npm.lenhGoiY).toBe('winget install OpenJS.NodeJS.LTS');
      expect(BANG_CONG_CU.pip.lenhGoiY).toBe('winget install Python.Python.3.12');
      expect(BANG_CONG_CU.docker.lenhGoiY).toBe('winget install Docker.DockerDesktop');
    });
  });

  describe('canhBaoThieuCongCu', () => {
    it('trả về null khi ketQua là true (máy đã có công cụ)', () => {
      expect(canhBaoThieuCongCu('npm', true)).toBeNull();
      expect(canhBaoThieuCongCu('pip', true)).toBeNull();
      expect(canhBaoThieuCongCu('winget', true)).toBeNull();
    });

    it('trả về null khi ketQua là null hoặc undefined (không kiểm được hoặc chưa xong)', () => {
      expect(canhBaoThieuCongCu('npm', null)).toBeNull();
      expect(canhBaoThieuCongCu('pip', undefined)).toBeNull();
      expect(canhBaoThieuCongCu('docker', null)).toBeNull();
    });

    it('trả về null khi trinhQuanLy trống hoặc không có trong bảng', () => {
      expect(canhBaoThieuCongCu('', false)).toBeNull();
      expect(canhBaoThieuCongCu(null, false)).toBeNull();
      expect(canhBaoThieuCongCu('cargo', false)).toBeNull();
      expect(canhBaoThieuCongCu('go', false)).toBeNull();
      expect(canhBaoThieuCongCu('la_hoan_toan', false)).toBeNull();
    });

    it('trả về cảnh báo chính xác cho npm khi thiếu (false)', () => {
      const cb = canhBaoThieuCongCu('npm', false);
      expect(cb).not.toBeNull();
      expect(cb?.trinhQuanLy).toBe('npm');
      expect(cb?.tenHienThi).toBe('Node.js');
      expect(cb?.lienKetChinhThuc).toBe('https://nodejs.org/en/download');
      expect(cb?.lenhGoiY).toBe('winget install OpenJS.NodeJS.LTS');
      expect(cb?.thongDiep).toContain('Node.js');
      expect(cb?.thongDiep).toContain('Terminal mới');
    });

    it('trả về cảnh báo chính xác cho pip khi thiếu (false)', () => {
      const cb = canhBaoThieuCongCu('pip', false);
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Python');
      expect(cb?.lienKetChinhThuc).toBe('https://www.python.org/downloads/');
      expect(cb?.lenhGoiY).toBe('winget install Python.Python.3.12');
    });

    it('trả về cảnh báo chính xác cho docker khi thiếu (false)', () => {
      const cb = canhBaoThieuCongCu('docker', false);
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Docker Desktop');
      expect(cb?.lienKetChinhThuc).toBe('https://www.docker.com/products/docker-desktop/');
      expect(cb?.lenhGoiY).toBe('winget install Docker.DockerDesktop');
    });

    it('khi chính winget bị thiếu: KHÔNG gợi ý lệnh dùng winget', () => {
      const cb = canhBaoThieuCongCu('winget', false);
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Công cụ winget (App Installer)');
      expect(cb?.lienKetChinhThuc).toBe('https://apps.microsoft.com/detail/9nblggh4nns1');
      expect(cb?.lenhGoiY).toBeUndefined();
    });

    it('khi scoop bị thiếu: không có lệnh gợi ý', () => {
      const cb = canhBaoThieuCongCu('scoop', false);
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Scoop');
      expect(cb?.lienKetChinhThuc).toBe('https://scoop.sh');
      expect(cb?.lenhGoiY).toBeUndefined();
    });

    it('chấp nhận mã trình viết hoa hoặc có khoảng trắng thừa', () => {
      const cb = canhBaoThieuCongCu('  NPM  ', false);
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Node.js');
    });
  });

  describe('layTrinhQuanLyCachCai', () => {
    it('ưu tiên trinhQuanLy có sẵn trên đối tượng', () => {
      expect(layTrinhQuanLyCachCai({ trinhQuanLy: 'npm' })).toBe('npm');
      expect(layTrinhQuanLyCachCai({ trinhQuanLy: 'WINGET' })).toBe('winget');
    });

    it('suy luận từ trường nhom nếu không có trinhQuanLy', () => {
      expect(layTrinhQuanLyCachCai({ nhom: 'WINGET_CLI' })).toBe('winget');
      expect(layTrinhQuanLyCachCai({ nhom: 'npm' })).toBe('npm');
      expect(layTrinhQuanLyCachCai({ nhom: 'PIP_PACKAGE' })).toBe('pip');
      expect(layTrinhQuanLyCachCai({ nhom: 'docker-compose' })).toBe('docker');
      expect(layTrinhQuanLyCachCai({ nhom: 'scoop-main' })).toBe('scoop');
    });

    it('suy luận từ lệnh thô ở bước đầu tiên nếu nhom không chứa tên trình', () => {
      expect(
        layTrinhQuanLyCachCai({
          nhom: 'CAI_DAT_CLI',
          buoc: [{ lenh: 'npm install -g @angular/cli' }],
        }),
      ).toBe('npm');
      expect(
        layTrinhQuanLyCachCai({
          nhom: 'CAI_DAT_CLI',
          buoc: [{ lenh: 'pip install open-webui' }],
        }),
      ).toBe('pip');
    });

    it('trả về undefined nếu không có thông tin hoặc đối tượng rỗng', () => {
      expect(layTrinhQuanLyCachCai(undefined)).toBeUndefined();
      expect(layTrinhQuanLyCachCai({})).toBeUndefined();
      expect(layTrinhQuanLyCachCai({ nhom: 'KHAC' })).toBeUndefined();
    });
  });
});
