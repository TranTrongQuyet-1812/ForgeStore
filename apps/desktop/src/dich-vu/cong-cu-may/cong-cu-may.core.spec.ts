import { describe, expect, it } from 'vitest';
import {
  BANG_CONG_CU,
  canhBaoThieuCongCu,
  coLenhDockerCompose,
  layTrinhQuanLyCachCai,
} from './cong-cu-may.core';

describe('cong-cu-may.core (P3B-31, P3B-45)', () => {
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
    it('trả về null khi ketQua là SAN_SANG hoặc true (máy đã có công cụ)', () => {
      expect(canhBaoThieuCongCu('npm', 'SAN_SANG')).toBeNull();
      expect(canhBaoThieuCongCu('docker', 'SAN_SANG')).toBeNull();
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
      expect(canhBaoThieuCongCu('', 'CHUA_CAI')).toBeNull();
      expect(canhBaoThieuCongCu(null, 'CHUA_CAI')).toBeNull();
      expect(canhBaoThieuCongCu('cargo', 'CHUA_CAI')).toBeNull();
      expect(canhBaoThieuCongCu('go', 'CHUA_CHAY')).toBeNull();
      expect(canhBaoThieuCongCu('la_hoan_toan', false)).toBeNull();
    });

    it('trả về cảnh báo chính xác cho npm khi thiếu (CHUA_CAI và false)', () => {
      const cb = canhBaoThieuCongCu('npm', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CAI');
      expect(cb?.trinhQuanLy).toBe('npm');
      expect(cb?.tenHienThi).toBe('Node.js');
      expect(cb?.lienKetChinhThuc).toBe('https://nodejs.org/en/download');
      expect(cb?.lenhGoiY).toBe('winget install OpenJS.NodeJS.LTS');
      expect(cb?.thongDiep).toContain('Node.js');
      expect(cb?.thongDiep).toContain('Terminal mới');
      expect(canhBaoThieuCongCu('npm', false)).toEqual(cb);
    });

    it('trả về cảnh báo chính xác cho pip khi thiếu (CHUA_CAI)', () => {
      const cb = canhBaoThieuCongCu('pip', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CAI');
      expect(cb?.tenHienThi).toBe('Python');
      expect(cb?.lienKetChinhThuc).toBe('https://www.python.org/downloads/');
      expect(cb?.lenhGoiY).toBe('winget install Python.Python.3.12');
    });

    it('trả về cảnh báo CHUA_CAI cho docker: nhắc mở Docker Desktop + WSL và giữ lệnh winget', () => {
      const cb = canhBaoThieuCongCu('docker', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CAI');
      expect(cb?.tenHienThi).toBe('Docker Desktop');
      expect(cb?.lienKetChinhThuc).toBe('https://www.docker.com/products/docker-desktop/');
      expect(cb?.lenhGoiY).toBe('winget install Docker.DockerDesktop');
      expect(cb?.thongDiep).toBe(
        'Máy bạn chưa có Docker Desktop nên lệnh này có thể không chạy được. Cài xong, hãy mở Docker Desktop (lần đầu máy có thể yêu cầu bật WSL và khởi động lại) rồi chạy lại lệnh.',
      );
      expect(canhBaoThieuCongCu('docker', false)).toEqual(cb);
    });

    it('trả về cảnh báo CHUA_CHAY cho docker: nhắc mở Docker Desktop, không có link tải hay winget', () => {
      const cb = canhBaoThieuCongCu('docker', 'CHUA_CHAY');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CHAY');
      expect(cb?.trinhQuanLy).toBe('docker');
      expect(cb?.tenHienThi).toBe('Docker Desktop');
      expect(cb?.lienKetChinhThuc).toBeUndefined();
      expect(cb?.lenhGoiY).toBeUndefined();
      expect(cb?.thongDiep).toBe(
        'Máy bạn đã có Docker Desktop nhưng phần mềm chưa chạy. Hãy mở Docker Desktop, chờ khởi động xong rồi chạy lại lệnh.',
      );
    });

    it('trả về cảnh báo THIEU_WSL cho docker: nhắc chạy lệnh cài WSL bằng PowerShell Quản trị viên', () => {
      const cb = canhBaoThieuCongCu('docker', 'THIEU_WSL');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('THIEU_WSL');
      expect(cb?.trinhQuanLy).toBe('docker');
      expect(cb?.tenHienThi).toBe('Docker Desktop');
      expect(cb?.lienKetChinhThuc).toBeUndefined();
      expect(cb?.lenhGoiY).toBe('wsl --install --no-distribution');
      expect(cb?.thongDiep).toBe(
        'Máy bạn đã có Docker Desktop nhưng chưa cài WSL (môi trường chạy Linux cho Docker trên Windows). Hãy mở PowerShell bằng quyền Quản trị viên, chạy lệnh bên dưới rồi khởi động lại máy.',
      );
    });

    it('trả về null khi nhận CHUA_CHAY hoặc THIEU_WSL cho trình không phải docker', () => {
      expect(canhBaoThieuCongCu('npm', 'CHUA_CHAY')).toBeNull();
      expect(canhBaoThieuCongCu('npm', 'THIEU_WSL')).toBeNull();
      expect(canhBaoThieuCongCu('pip', 'THIEU_WSL')).toBeNull();
    });

    it('khi chính winget bị thiếu: KHÔNG gợi ý lệnh dùng winget', () => {
      const cb = canhBaoThieuCongCu('winget', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CAI');
      expect(cb?.tenHienThi).toBe('Công cụ winget (App Installer)');
      expect(cb?.lienKetChinhThuc).toBe('https://apps.microsoft.com/detail/9nblggh4nns1');
      expect(cb?.lenhGoiY).toBeUndefined();
    });

    it('khi scoop bị thiếu: không có lệnh gợi ý', () => {
      const cb = canhBaoThieuCongCu('scoop', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.trangThai).toBe('CHUA_CAI');
      expect(cb?.tenHienThi).toBe('Scoop');
      expect(cb?.lienKetChinhThuc).toBe('https://scoop.sh');
      expect(cb?.lenhGoiY).toBeUndefined();
    });

    it('chấp nhận mã trình viết hoa hoặc có khoảng trắng thừa', () => {
      const cb = canhBaoThieuCongCu('  NPM  ', 'CHUA_CAI');
      expect(cb).not.toBeNull();
      expect(cb?.tenHienThi).toBe('Node.js');
    });
  });

  describe('coLenhDockerCompose', () => {
    it('nhận diện docker compose và docker-compose (không phân biệt hoa thường)', () => {
      expect(coLenhDockerCompose([{ lenh: 'docker compose up -d' }])).toBe(true);
      expect(coLenhDockerCompose([{ lenh: 'docker-compose up' }])).toBe(true);
      expect(coLenhDockerCompose([{ lenh: 'cd app' }, { lenh: 'DOCKER COMPOSE up -d' }])).toBe(
        true,
      );
    });

    it('trả về false với lệnh docker run thường, mảng rỗng hoặc undefined', () => {
      expect(coLenhDockerCompose([{ lenh: 'docker run -it n8n' }])).toBe(false);
      expect(coLenhDockerCompose([])).toBe(false);
      expect(coLenhDockerCompose(undefined)).toBe(false);
      expect(coLenhDockerCompose(null)).toBe(false);
      expect(coLenhDockerCompose([{}])).toBe(false);
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
