import {
  HeDieuHanhCli,
  HuongDanCaiDatDto,
  CachCaiDto,
  BuocCaiDto,
  NhomCachCai,
  PhanCungYeuCau,
  coCachCaiCliHopLe,
  trichTenGoiTuLenhTho,
  boDauNhacShell,
  ghepLenhCliAnToan,
  laLenhNpmCucBo,
  MaTrinhQuanLyGoi,
} from '@forgestore/types';

/**
 * Danh sách từ khóa nhận diện mục cài đặt trong tiêu đề Markdown.
 */
const TU_KHOA_MUC_CAI_DAT = [
  'installation',
  'install',
  'getting started',
  'quick start',
  'quickstart',
  'setup',
  'usage',
  'run locally',
  'build from source',
  // Tiếng Việt (BE-01)
  'cài đặt',
  'hướng dẫn cài đặt',
  'cách cài đặt',
  'bắt đầu',
  'bắt đầu nhanh',
  'sử dụng',
  'chạy thử',
  'biên dịch',
];

/**
 * Thứ tự ưu tiên hiển thị các cách cài đặt (3.4).
 * WINGET -> SCOOP -> PIP / NPM / CARGO / GO -> CONDA -> DOCKER -> NGUON.
 */
const THU_TU_UU_TIEN: Record<NhomCachCai, number> = {
  [NhomCachCai.WINGET]: 1,
  [NhomCachCai.SCOOP]: 2,
  [NhomCachCai.PIP]: 3,
  [NhomCachCai.NPM]: 3,
  [NhomCachCai.CARGO]: 3,
  [NhomCachCai.GO]: 3,
  [NhomCachCai.CONDA]: 4,
  [NhomCachCai.DOCKER]: 5,
  [NhomCachCai.NGUON]: 6,
};

/**
 * Trích xuất mục cài đặt từ README gốc (giữ nguyên khối code và định dạng).
 * Giới hạn tối đa 6.000 ký tự (Section 3.1).
 *
 * @param rawReadme Nội dung README Markdown gốc
 * @param maxLen Giới hạn độ dài tối đa (mặc định 6000 ký tự)
 * @returns Nội dung mục cài đặt hoặc rỗng nếu không tìm thấy
 */
export function trichMucCaiDat(rawReadme: string, maxLen = 6000): string {
  if (!rawReadme || typeof rawReadme !== 'string') return '';

  const lines = rawReadme.split(/\r?\n/);
  let startIndex = -1;
  let headerLevel = 0;

  // 1. Tìm tiêu đề khớp từ khóa
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const titleLower = match[2].toLowerCase();

      const isMatch = TU_KHOA_MUC_CAI_DAT.some((keyword) => titleLower.includes(keyword));

      if (isMatch) {
        startIndex = i;
        headerLevel = level;
        break;
      }
    }
  }

  if (startIndex === -1) {
    return '';
  }

  // 2. Lấy nội dung từ tiêu đề đó đến tiêu đề cùng cấp hoặc cao hơn kế tiếp
  let endIndex = lines.length;
  let insideCodeBlock = false;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';

    // Theo dõi xem có đang trong khối code ``` không để không nhận nhầm tiêu đề bên trong code
    if (line.startsWith('```')) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    if (!insideCodeBlock) {
      const match = line.match(/^(#{1,6})\s+/);
      if (match && match[1]) {
        const level = match[1].length;
        if (level <= headerLevel) {
          endIndex = i;
          break;
        }
      }
    }
  }

  const extracted = lines.slice(startIndex, endIndex).join('\n').trim();

  // 3. Giới hạn tối đa maxLen ký tự, cắt an toàn tại \n và tự động đóng khối code nếu lẻ (BE-01)
  if (extracted.length > maxLen) {
    const rawSlice = extracted.slice(0, maxLen);
    const lastNewline = rawSlice.lastIndexOf('\n');
    let truncated = lastNewline > 0 ? rawSlice.slice(0, lastNewline) : rawSlice;

    // Đếm số lần xuất hiện của ```
    const fenceMatches = truncated.match(/```/g);
    const fenceCount = fenceMatches ? fenceMatches.length : 0;
    if (fenceCount % 2 !== 0) {
      truncated += '\n```\n';
    }

    return truncated.trim();
  }

  return extracted;
}

/**
 * Nhận diện nhóm tiền tố của câu lệnh dòng lệnh (Section 3.2).
 */
export function nhanDienNhomLenh(lenh: string): NhomCachCai | null {
  if (!lenh || typeof lenh !== 'string') return null;
  // Chuẩn hóa prompt gồm cả PowerShell có đường dẫn để README thường chép nguyên terminal.
  const l = boDauNhacShell(lenh).replace(/^#\s*/, '');

  // WINGET
  if (/^winget\s+install\b/i.test(l)) {
    return NhomCachCai.WINGET;
  }

  // SCOOP
  if (/^scoop\s+install\b/i.test(l)) {
    return NhomCachCai.SCOOP;
  }

  // PIP
  if (
    /^(pip|pip3|python\d*\s+-m\s+pip|py\s+-m\s+pip|uv\s+(?:pip|tool)|pipx)\s+install\b/i.test(l) ||
    /^(pip|pip3|pipx)\s+/i.test(l) ||
    /^uv\s+(add|run)\b/i.test(l)
  ) {
    return NhomCachCai.PIP;
  }

  // CONDA
  if (/^(conda\s+install|conda\s+create|mamba\s+install|mamba\s+create)\b/i.test(l)) {
    return NhomCachCai.CONDA;
  }

  // NPM: nhận cả cài toàn máy lẫn cài thư viện vào dự án (D-36: kho lấy cả thư viện cài bằng lệnh như axios, ioredis).
  // Lệnh gỡ và cập nhật được ghép theo đúng phạm vi ở phần gom nhóm bên dưới (cục bộ thì không dùng -g).
  if (
    /^(npm\s+i\b|npm\s+install\b|npx\b|pnpm\s+add\b|pnpm\s+i\b|pnpm\s+install\b|yarn\s+global\s+add\b|yarn\s+add\b|bun\s+add\b|bun\s+i\b)/i.test(
      l,
    )
  ) {
    return NhomCachCai.NPM;
  }

  // CARGO
  if (/^cargo\s+install\b/i.test(l)) {
    return NhomCachCai.CARGO;
  }

  // GO
  if (/^go\s+install\b/i.test(l)) {
    return NhomCachCai.GO;
  }

  // DOCKER
  if (/^(docker\s+run\b|docker\s+compose\s+up\b|docker-compose\s+up\b|docker\s+pull\b)/i.test(l)) {
    return NhomCachCai.DOCKER;
  }

  // NGUON (git clone hoặc script build)
  if (
    /^git\s+clone\b/i.test(l) ||
    /^(make\b|cmake\b|\.\/configure\b|\.\/build\b|\.\/run\b|python\d*\s+\w+\.py)/i.test(l) ||
    /\.(bat|ps1|sh|cmd)\b/i.test(l)
  ) {
    return NhomCachCai.NGUON;
  }

  return null;
}

/**
 * Xác định nhãn hệ điều hành phù hợp cho câu lệnh (Section 3.2, P3B-35 & review 11/11).
 * Chuẩn hóa luật 2 chiều:
 * (a) Lệnh đa nền tảng (pip, npm, docker, cargo, go, conda, npx...) KHÔNG BAO GIỜ nhận LINUX_MAC từ ngữ cảnh.
 * (b) Lệnh có dấu hiệu Unix (| sh, | bash, | sudo, .sh, sudo, chmod, apt, brew...) LUÔN là LINUX_MAC bất kể ngữ cảnh.
 * (c) Dấu hiệu Unix ở (b) thắng dấu hiệu Windows khi cùng một dòng (ví dụ: `brew install --cask powershell` ra LINUX_MAC).
 * Ngữ cảnh hẹp chỉ áp dụng cho nhóm NGUON hoặc lệnh không rõ.
 */
export function xacDinhHeDieuHanhLenh(lenh: string, contextText?: string): HeDieuHanhCli {
  const l = (lenh || '').toLowerCase();
  const ctx = (contextText || '').toLowerCase();

  // 1. Dấu hiệu Unix trên chính câu lệnh: luôn LINUX_MAC (P3B-35 & Mục 5, 7 review 11/11)
  const coDauHieuUnix =
    /\|\s*(?:sudo\s+)?(?:\/(?:usr\/)?(?:local\/)?(?:s?bin\/))?(?:(?:ba)?sh|zsh|dash|ash)\b/i.test(
      l,
    ) ||
    /\|\s*sudo\b/i.test(l) ||
    /\b(?:sudo|chmod|systemctl)\b/i.test(l) ||
    /\b(?:apt|apt-get|brew|yum|dnf|pacman|zypper)\b/i.test(l) ||
    /\bapk\s+add\b/i.test(l) ||
    /(?:^|\s)(?:\.\/|(?:ba)?sh\s+|source\s+)\S+\.sh\b/i.test(l) ||
    /\binstall\.sh\b/i.test(l);

  if (coDauHieuUnix) {
    return HeDieuHanhCli.LINUX_MAC;
  }

  // 2. Dấu hiệu Windows trên chính câu lệnh (chỉ khi không có dấu hiệu Unix)
  const coDauHieuWindows =
    /\b(winget|scoop|choco|chocolatey|powershell|pwsh)\b/i.test(l) || /\.(bat|ps1|cmd)\b/i.test(l);

  if (coDauHieuWindows) {
    return HeDieuHanhCli.WINDOWS;
  }

  // 3. Trình quản lý gói đa nền tảng (pip, npm, docker, cargo, go, conda, npx):
  // Tuyệt đối KHÔNG nhận nhãn LINUX_MAC từ ngữ cảnh xung quanh (tránh YAML CI/CD hoặc tiêu đề Linux kéo sai)
  const laTrinhQuanLyDaNenTang =
    /^(?:pip\d*|python\d*\s+-m\s+pip|py\s+-m\s+pip|uv\s+pip|uv\s+tool|uv\s+add|pipx|npm|pnpm|yarn|bun|npx|docker|cargo|go\s+install|conda|mamba)\b/i.test(
      l,
    );

  if (laTrinhQuanLyDaNenTang) {
    if (
      /\bwindows\b/i.test(ctx) &&
      !/\b(linux|macos|mac\s*os|darwin|ubuntu|debian|fedora|arch)\b/i.test(ctx)
    ) {
      return HeDieuHanhCli.WINDOWS;
    }
    return HeDieuHanhCli.DUNG_CHUNG;
  }

  // 4. Các lệnh nhóm NGUON hoặc lệnh không rõ: xét ngữ cảnh hẹp
  if (
    /\b(linux|macos|mac\s*os|darwin|ubuntu|debian|fedora|arch)\b/i.test(ctx) &&
    !/\bwindows\b/i.test(ctx)
  ) {
    return HeDieuHanhCli.LINUX_MAC;
  }

  if (
    /\bwindows\b/i.test(ctx) &&
    !/\b(linux|macos|mac\s*os|darwin|ubuntu|debian|fedora|arch)\b/i.test(ctx)
  ) {
    return HeDieuHanhCli.WINDOWS;
  }

  return HeDieuHanhCli.DUNG_CHUNG;
}

/**
 * Kiểm tra câu lệnh có mẫu rủi ro cao hay không (Section 3.2 & SEC-01).
 */
export function kiemTraRuiRoCao(lenh: string): { ruiRoCao: boolean; lyDo?: string } {
  if (!lenh || typeof lenh !== 'string') {
    return { ruiRoCao: false };
  }

  const l = boDauNhacShell(lenh).replace(/^#\s*/, '');

  // 1. Tải và thực thi script trực tiếp qua shell / interpreter / process substitution (SEC-01, SEC-VULN-03 & SEC-R4-04)
  if (
    /(?:curl|wget)\b.*?\|\s*(?:sudo\s+)?(?:\/(?:usr\/)?(?:local\/)?(?:s?bin\/))?(?:(?:ba)?sh|zsh|dash|ash|python\d*|perl|node|pwsh|powershell)\b/i.test(
      l,
    ) ||
    /(?:(?:\/(?:usr\/)?(?:local\/)?(?:s?bin\/))?(?:(?:ba)?sh|zsh|dash|ash))\s+<\s*\(\s*(?:curl|wget)\b/i.test(
      l,
    ) ||
    /curl\b.*?\|\s*sudo\b/i.test(l)
  ) {
    return {
      ruiRoCao: true,
      lyDo: 'Lệnh tải và thực thi script trực tiếp từ Internet vào shell/interpreter (curl/wget | sh hoặc process substitution).',
    };
  }

  // 2. Vượt rào thực thi PowerShell Invoke-Expression / EncodedCommand / ExecutionPolicy (SEC-01, SEC-VULN-03 & SEC-R4-04)
  if (
    /(iwr|irm)\b.*?\|\s*iex\b/i.test(l) ||
    /(?:iex|Invoke-Expression|[.&])\s*\(?\s*(?:iwr|irm|Invoke-WebRequest|.*?(?:DownloadString|WebClient))\b/i.test(
      l,
    ) ||
    /Invoke-Expression\b/i.test(l) ||
    /Invoke-WebRequest\b.*?\|\s*iex\b/i.test(l) ||
    /(?:powershell|pwsh)\b.*?(?:-(?:e|enc|encodedcommand|ep\s+bypass|ex(?:ecutionpolicy)?\s+bypass))\b/i.test(
      l,
    )
  ) {
    return {
      ruiRoCao: true,
      lyDo: 'Lệnh PowerShell tải thực thi trực tiếp (irm | iex hoặc iex (irm...)) hoặc dùng cờ nguy hiểm (-enc / ExecutionPolicy Bypass).',
    };
  }

  // 3. Sudo hoặc Container Privileged / Docker Socket Mount / Capabilities nhạy cảm (SEC-01 & SEC-VULN-03)
  if (
    /\bsudo\b/i.test(l) ||
    /--privileged\b/i.test(l) ||
    /\bdocker\.sock\b/i.test(l) ||
    /--cap-add(?:\s*=\s*|\s+)(?:ALL|SYS_ADMIN)\b/i.test(l) ||
    /--pid\s*=\s*host\b/i.test(l)
  ) {
    return {
      ruiRoCao: true,
      lyDo: 'Lệnh yêu cầu quyền quản trị viên cao nhất (sudo, container privileged, mount docker.sock hoặc cap-add).',
    };
  }

  // 4. Windows LoLBins (Living off the Land Binaries) tiềm ẩn tải/chạy mã độc từ xa (SEC-01 & SEC-VULN-03)
  if (
    /\bcertutil\b.*?-urlcache\b/i.test(l) ||
    /\bmshta\b/i.test(l) ||
    /\bregsvr32\b.*?(?:[/–-][sSuUiI]:?)/i.test(l) ||
    /\brundll32\b/i.test(l) ||
    /\bbitsadmin\b.*?(?:\/transfer|\/create)/i.test(l)
  ) {
    return {
      ruiRoCao: true,
      lyDo: 'Lệnh sử dụng công cụ hệ thống Windows (LoLBin: certutil, mshta, regsvr32, rundll32, bitsadmin) tiềm ẩn tải hoặc chạy mã độc ngầm.',
    };
  }

  // 5. Hạ cấp ExecutionPolicy trong PowerShell
  if (/Set-ExecutionPolicy\s+(Bypass|Unrestricted)/i.test(l)) {
    return {
      ruiRoCao: true,
      lyDo: 'Lệnh hạ cấp chính sách bảo mật thực thi PowerShell (Set-ExecutionPolicy Bypass).',
    };
  }

  return { ruiRoCao: false };
}

/**
 * Chuẩn hóa một dòng lệnh để so khớp nguyên dòng:
 * - Trim khoảng trắng
 * - Bỏ ký tự shell prompt ($ / # / >) ở đầu dòng
 * - Bỏ dấu backtick ở đầu và cuối nếu có (ví dụ: `pip install open-webui`)
 */
function chuanHoaDongLenh(line: string): string {
  let l = boDauNhacShell(line).replace(/^#\s*/, '');
  // Loại bỏ tiền tố nhãn cài đặt như "Install:", "Installation:", "Setup:", "Cài đặt:"
  l = l.replace(/^(?:install|installation|setup|cài\s*đặt)\s*:\s*/i, '');
  if (l.startsWith('`') && l.endsWith('`') && l.length >= 2) {
    l = l.slice(1, -1).trim();
  }
  return l;
}

/**
 * Ghép các dòng lệnh nối bằng `\` (hoặc PowerShell backtick ` hoặc ^) thành một dòng lệnh phẳng (P3B-34).
 * Dùng trước khi nhận diện nhóm lệnh và bóc tên gói, nhưng giữ nguyên chuỗi gốc cho hiển thị.
 */
export function ghepCacDongNoiLenh(lenh: string): string {
  if (!lenh || typeof lenh !== 'string') return '';
  return lenh
    .replace(/(?:\\|`|\^)\s*\r?\n\s*/g, ' ')
    .replace(/(?:\\|`|\^)\s*$/g, '')
    .trim();
}

/**
 * Chuẩn hóa cú pháp trình cài đặt, phiên bản và thẻ trước khi dùng bộ kiểm gói hiện có (P3B-34, P3B-35).
 * - Ghép các dòng nối bằng \, `, ^ (P3B-34 AutoGPT).
 * - Bóc tên gói PIP khi có phiên bản (==, >=, <=, ~=, !=, <, >), dấu nháy bao quanh, hoặc [extras] (P3B-35 browser-use, pr-agent).
 * - Hỗ trợ uv add và uv tool install về nhóm PIP hợp lệ.
 */
function chuanHoaLenhDeBocGoi(lenh: string): string {
  // 1. Ghép dòng nối bằng \, `, ^ trước khi phân tích
  const lenhPhang = ghepCacDongNoiLenh(lenh);
  const sach = boDauNhacShell(lenhPhang).replace(/^#\s*/, '').trim();

  // Chuẩn hóa tiền tố cài đặt Python / uv về dạng pip install
  const pipLenh = sach.replace(/^(?:python\d*|py)\s+-m\s+pip\s+install\b/i, 'pip install');
  const pipUv = pipLenh.replace(/^uv\s+tool\s+install\b/i, 'pip install');
  const pipx = pipUv.replace(/^pipx\s+install\b/i, 'pip install');
  const uvPip = pipx.replace(/^uv\s+pip\s+install\b/i, 'pip install');
  const uvAdd = uvPip.replace(/^uv\s+add\b/i, 'pip install');

  const nhanDien = nhanDienNhomLenh(sach);
  // Docker: trả về chuỗi phẳng sạch sẽ không còn ký tự nối dòng \ để trichTenGoiTuLenhTho bóc image (P3B-34)
  // Đồng thời chuẩn hóa tham số mount thư mục hiện tại (-v "$PWD":...) để không bị từ chối nhầm ở dòng đầu (vlang/v)
  if (nhanDien === NhomCachCai.DOCKER) {
    return uvAdd.replace(
      /(-v|--volume)\s+(?:"\$PWD"|'\$PWD'|\$PWD|"\$\{PWD\}"|\$\{PWD\}|"\$\(pwd\)"|\$\(pwd\))(?=[:/])/gi,
      '$1 .',
    );
  }

  if (!nhanDien || (!/^(?:npm|pnpm|yarn|bun)\b/i.test(sach) && nhanDien !== NhomCachCai.PIP)) {
    return uvAdd;
  }

  const dauLenh = uvAdd.match(/^(?:pip|npm|pnpm|yarn|bun)\s+(?:install|i|add)\b/i);
  if (!dauLenh?.[0]) return uvAdd;
  const truoc = uvAdd.slice(0, dauLenh[0].length);
  const phanSau = uvAdd.slice(dauLenh[0].length).trim();
  const tokens = phanSau.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const rawToken = tokens[i];
    if (!rawToken || rawToken.startsWith('-')) continue;

    // A. Bóc tách và làm sạch cho PIP (P3B-35)
    if (nhanDien === NhomCachCai.PIP) {
      // 1. Bỏ dấu nháy bao quanh: 'pkg', "pkg"
      let token = rawToken.replace(/^['"]|['"]$/g, '');

      // 2. Bỏ ghim phiên bản (==, >=, <=, ~=, !=, <, >, ===):
      // Ví dụ: browser-use==1.0.1 -> browser-use, pkg>=2.0.0 -> pkg
      const idxOp = token.search(/(?:===|==|>=|<=|~=|!=|<|>)/);
      if (idxOp !== -1) {
        token = token.slice(0, idxOp).trim();
      }

      // 3. Bỏ [extras]:
      // Ví dụ: pr-agent[github] -> pr-agent, pkg[extra1,extra2] -> pkg
      token = token.replace(/\[[^\]]*\]/g, '').trim();

      // 4. Bỏ @tag phiên bản nếu có (ví dụ: uv tool install ruff@latest)
      const viTriTag = token.lastIndexOf('@');
      if (viTriTag > 0) {
        token = token.slice(0, viTriTag).trim();
      }

      // Bỏ nháy còn sót nếu có
      token = token.replace(/^['"]|['"]$/g, '');

      tokens[i] = token;
      break;
    }

    // B. Bóc tách cho NPM (@tag)
    const viTriTag = rawToken.startsWith('@')
      ? rawToken.indexOf('@', rawToken.indexOf('/') + 1)
      : rawToken.lastIndexOf('@');
    if (viTriTag <= 0) break;
    const tag = rawToken.slice(viTriTag + 1);
    if (!/^(?:latest|next|beta|alpha|canary|\d+(?:\.[0-9A-Za-z_-]+)*)$/i.test(tag)) return sach;
    tokens[i] = rawToken.slice(0, viTriTag);
    break;
  }
  return `${truoc} ${tokens.join(' ')}`.trim();
}

function trichTenGoiDaChuanHoa(lenh: string) {
  return trichTenGoiTuLenhTho(chuanHoaLenhDeBocGoi(lenh));
}

/**
 * Kiểm tra xem câu lệnh có xuất hiện nguyên văn THEO NGUYÊN DÒNG trong README gốc hay không (Section 3.3 & Rule D-01).
 * Tuyệt đối không so theo chuỗi con (includes) để tránh trường hợp AI cắt xén cờ hoặc tham số lệnh.
 *
 * @param lenh Câu lệnh trích xuất
 * @param rawReadme Nội dung README gốc
 */
export function kiemTraLenhNguyenVan(lenh: string, rawReadme: string): boolean {
  if (!lenh || !rawReadme) return false;

  const normalizedReadme = rawReadme.replace(/\r\n/g, '\n');
  const normalizedLenh = lenh.replace(/\r\n/g, '\n');

  const lenhLines = normalizedLenh.split('\n').map(chuanHoaDongLenh).filter(Boolean);

  if (lenhLines.length === 0) return false;

  const readmeLines = normalizedReadme.split('\n').map(chuanHoaDongLenh);

  // 1. Lệnh 1 dòng: Phải khớp nguyên vẹn với một dòng lệnh trong README hoặc nằm trong inline code `...`
  if (lenhLines.length === 1) {
    const target = lenhLines[0];
    if (readmeLines.some((rLine) => rLine === target)) {
      return true;
    }
    // Hỗ trợ trường hợp lệnh xuất hiện nguyên vẹn trong inline code `...` trên văn xuôi README
    if (target && normalizedReadme.includes('`' + target + '`')) {
      return true;
    }
    // ARCH-04: Hỗ trợ trường hợp README bẻ dòng bằng \ nhưng lệnh đã được nối liền mạch (vẫn so khớp nguyên dòng)
    const rawReadmeLines = normalizedReadme.split('\n');
    const joinedReadmeLines: string[] = [];
    let cur = '';
    for (const r of rawReadmeLines) {
      const trimmed = r.trim();
      if (!cur) {
        cur = trimmed;
      } else {
        cur += ' ' + trimmed;
      }
      if (cur.endsWith('\\')) {
        cur = cur.slice(0, -1).trim();
      } else {
        joinedReadmeLines.push(chuanHoaDongLenh(cur));
        cur = '';
      }
    }
    if (cur) joinedReadmeLines.push(chuanHoaDongLenh(cur));

    return joinedReadmeLines.some((rLine) => rLine === target);
  }

  // 2. Lệnh nhiều dòng: Toàn bộ các dòng phải xuất hiện liên tiếp và khớp nguyên vẹn từng dòng
  const firstLine = lenhLines[0];
  for (let i = 0; i <= readmeLines.length - lenhLines.length; i++) {
    if (readmeLines[i] === firstLine) {
      let allMatch = true;
      for (let j = 1; j < lenhLines.length; j++) {
        if (readmeLines[i + j] !== lenhLines[j]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return true;
    }
  }

  return false;
}

/**
 * Sắp xếp danh sách cách cài đặt theo thứ tự ưu tiên chuẩn (Section 3.4).
 */
export function sapXepCachCai(danhSach: CachCaiDto[]): CachCaiDto[] {
  return [...danhSach].sort((a, b) => {
    const rankA = THU_TU_UU_TIEN[a.nhom] ?? 99;
    const rankB = THU_TU_UU_TIEN[b.nhom] ?? 99;
    return rankA - rankB;
  });
}

/**
 * Bộ lọc và chuẩn hóa Hướng dẫn cài đặt sau khi nhận từ AI (Section 3.3).
 * Áp dụng chốt chặn Code Thuần 100%:
 * - Loại bỏ các bước có câu lệnh không xuất hiện nguyên văn trong README.
 * - Loại bỏ các cách cài đặt không còn bước nào hợp lệ.
 * - Gắn lại cờ rủi ro cao bằng code (không tin AI tự gắn).
 * - Sắp xếp theo thứ tự ưu tiên chuẩn.
 */
export function locVaChuanHoaHuongDanCaiDat(
  huongDan: { cachCai?: CachCaiDto[] } | null | undefined,
  rawReadme: string,
  duongDanReadmeGoc?: string,
): HuongDanCaiDatDto | null {
  if (!huongDan || !Array.isArray(huongDan.cachCai) || huongDan.cachCai.length === 0) {
    return null;
  }

  let coBatKyRuiRoNao = false;
  const cachCaiHopLe: CachCaiDto[] = [];

  for (const cach of huongDan.cachCai) {
    if (!cach.buoc || !Array.isArray(cach.buoc)) continue;

    const buocHopLe: BuocCaiDto[] = [];

    for (const b of cach.buoc) {
      if (!b.lenh || typeof b.lenh !== 'string') continue;

      // 1. Kiểm tra nguyên văn: Mọi lệnh phải xuất hiện trong README gốc
      if (!kiemTraLenhNguyenVan(b.lenh, rawReadme)) {
        continue; // Loại bỏ lệnh không có thật nguyên văn
      }

      // 2. Gắn cờ rủi ro cao bằng code thuần
      const danhGiaRuiRo = kiemTraRuiRoCao(b.lenh);
      if (danhGiaRuiRo.ruiRoCao) {
        coBatKyRuiRoNao = true;
      }

      buocHopLe.push({
        moTa: b.moTa?.trim() || 'Thực thi câu lệnh',
        lenh: b.lenh.trim(),
        ruiRoCao: danhGiaRuiRo.ruiRoCao,
        canhBaoRuiRo: danhGiaRuiRo.lyDo,
      });
    }

    // Nếu cách cài bị loại hết lệnh thì loại bỏ luôn cách đó
    if (buocHopLe.length === 0) {
      continue;
    }

    // Xác định nhóm chuẩn xác nếu AI phân loại sai
    const nhomSuyDuan = nhanDienNhomLenh(buocHopLe[0]?.lenh || '') || cach.nhom;

    // P3B-16.3 & P3B-35: Bóc tách tên gói tối ưu, ưu tiên gói khớp repo và coi torch là bước chuẩn bị
    const tenRepo = layTenRepoTuDuongDan(duongDanReadmeGoc);
    const { pkgInfo, lenhChinh } = timThongTinGoiToiUu(
      buocHopLe.map((b) => b.lenh),
      tenRepo,
      layChuRepoTuDuongDan(duongDanReadmeGoc),
    );
    const trinhQuanLy = pkgInfo?.trinhQuanLy || cach.trinhQuanLy;
    const tenGoi = pkgInfo?.tenGoi || cach.tenGoi;
    let lenhCapNhat = cach.lenhCapNhat;
    let lenhGo = cach.lenhGo;

    if (trinhQuanLy && tenGoi) {
      const ghep = ghepLenhCliAnToan(
        trinhQuanLy,
        tenGoi,
        undefined,
        laLenhNpmCucBo(lenhChinh || buocHopLe[0]?.lenh),
      );
      if (ghep.hopLe) {
        lenhCapNhat = lenhCapNhat || ghep.lenhCapNhat;
        lenhGo = lenhGo || ghep.lenhGo;
      }
    }

    // P3B-35: WINGET và SCOOP là trình quản lý gói chỉ có trên Windows, luôn gán WINDOWS
    let heDieuHanh = cach.heDieuHanh || HeDieuHanhCli.DUNG_CHUNG;
    if (
      trinhQuanLy === MaTrinhQuanLyGoi.WINGET ||
      trinhQuanLy === MaTrinhQuanLyGoi.SCOOP ||
      nhomSuyDuan === NhomCachCai.WINGET ||
      nhomSuyDuan === NhomCachCai.SCOOP
    ) {
      heDieuHanh = HeDieuHanhCli.WINDOWS;
    }

    cachCaiHopLe.push({
      ten: cach.ten?.trim() || `Cài đặt (${nhomSuyDuan})`,
      nhom: nhomSuyDuan,
      heDieuHanh,
      phanCung: cach.phanCung || PhanCungYeuCau.KHONG_RO,
      yeuCau: Array.isArray(cach.yeuCau)
        ? cach.yeuCau.map((y) => String(y).trim()).filter(Boolean)
        : [],
      buoc: buocHopLe,
      trinhQuanLy,
      tenGoi,
      lenhCapNhat,
      lenhGo,
    });
  }

  if (cachCaiHopLe.length === 0) {
    return null;
  }

  return {
    cachCai: sapXepCachCai(cachCaiHopLe),
    coRuiRoCao: coBatKyRuiRoNao,
    duongDanReadmeGoc,
    nguon: 'README',
  };
}

/**
 * Lệnh chỉ cài hoặc nâng cấp công cụ đóng gói (`pip install -U pip setuptools wheel`, `npm i -g pnpm`,
 * `npm install -g yarn`) chứ không cài app.
 */
function laLenhCaiCongCu(lenh: string): boolean {
  const congCuPython = String.raw`(?:pip|setuptools|wheel|uv|pipx)`;
  const congCuNode = String.raw`(?:npm|pnpm|yarn|corepack)(?:@\S+)?`;
  return (
    new RegExp(
      String.raw`^(?:python\d*\s+-m\s+|py\s+-m\s+)?pip\d*\s+install(?:\s+(?:-U|--upgrade|--user))*` +
        String.raw`(?:\s+${congCuPython})+\s*$`,
      'i',
    ).test(lenh) ||
    new RegExp(
      String.raw`^npm\s+(?:install|i)\s+(?:-g|--global)(?:\s+${congCuNode})+\s*$`,
      'i',
    ).test(lenh)
  );
}

/** Một trong các gói đứng sau `install`/`i` (bỏ cờ và phiên bản `@...`) khớp tên repo. */
function lenhNhacTenRepo(lenh: string, tenRepo: string): boolean {
  const tu = lenh.split(/\s+/);
  const viTri = tu.findIndex((t) => /^(?:install|i)$/i.test(t));
  return tu
    .slice(viTri + 1)
    .filter((t) => t && !t.startsWith('-'))
    .some((goi) => tenGoiKhopTenRepo(goi.replace(/@[^/]*$/, ''), tenRepo));
}

/**
 * Kiểm tra xem lệnh pip có phải là bước chuẩn bị môi trường / thư viện nền tảng (P3B-35)
 * như PyTorch, TensorFlow, JAX, NumPy đi kèm index-url hoặc bản ghim GPU (+cu, +rocm) hay không.
 */
function laBuocChuanBiMoiTruong(lenh: string, tenRepo?: string): boolean {
  if (!lenh || typeof lenh !== 'string') return false;
  // Nếu chính repo là pytorch/tensorflow/jax/numpy thì không coi là bước chuẩn bị
  if (tenRepo && /^(?:pytorch|torch|tensorflow|jax|numpy)$/i.test(tenRepo)) {
    return false;
  }
  const l = lenh.toLowerCase();
  const thuVienNenTang =
    /\b(?:torch|torchaudio|torchvision|tensorflow|jax|jaxlib|numpy|triton|xformers|flash-attn|flashinfer)\b/i;
  if (!thuVienNenTang.test(l)) return false;

  // Dấu hiệu rõ ràng của bước chuẩn bị:
  // - Có cờ chỉ định index phụ: --index-url hoặc --extra-index-url
  // - Hoặc có phiên bản ghim GPU/tăng tốc: +cu, +rocm, +xpu, +cpu
  if (/--(?:extra-)?index-url\b/i.test(l) || /\+(?:cu\d+|rocm\d*(?:\.\d+)*|xpu|cpu)\b/i.test(l)) {
    return true;
  }

  // Nếu lệnh chỉ cài đặt thuần túy torch/torchaudio/torchvision mà repo không khớp tên
  const pkg = trichTenGoiDaChuanHoa(lenh);
  if (pkg && pkg.trinhQuanLy === MaTrinhQuanLyGoi.PIP) {
    if (
      ['torch', 'torchaudio', 'torchvision', 'tensorflow', 'jax', 'jaxlib', 'numpy'].includes(
        pkg.tenGoi.toLowerCase(),
      )
    ) {
      if (!tenRepo || !tenGoiKhopTenRepo(pkg.tenGoi, tenRepo)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tìm thông tin gói tối ưu nhất và lệnh đại diện từ danh sách các câu lệnh trong nhóm (P3B-35).
 * Ưu tiên:
 * 1. Khi có gói khớp tên repo (ví dụ: pip install omnivoice, f5-tts, funasr): chọn gói khớp tên repo
 *    (trừ điểm bước chuẩn bị môi trường như torch, cuda... và lệnh cài công cụ pip, setuptools...).
 * 2. Khi không có gói nào khớp tên repo: chỉ chấp nhận gói của dòng đầu tiên trong nhóm (như bản gốc).
 *    Nếu dòng đầu không bóc được gói thì nhóm không có tenGoi để đường tìm theo tên repo trong toàn README chạy.
 */
function timThongTinGoiToiUu(
  danhSachLenh: string[],
  tenRepo?: string | null,
  chuRepo?: string | null,
): { pkgInfo: { trinhQuanLy: MaTrinhQuanLyGoi; tenGoi: string } | null; lenhChinh: string } {
  if (!danhSachLenh || danhSachLenh.length === 0) {
    return { pkgInfo: null, lenhChinh: '' };
  }

  // 1. Khi có gói khớp tên repo trong nhóm: giữ cách chọn tối ưu theo điểm
  if (tenRepo) {
    let ungVienKhopRepo: {
      pkgInfo: { trinhQuanLy: MaTrinhQuanLyGoi; tenGoi: string };
      lenh: string;
      diem: number;
    } | null = null;

    for (const lenh of danhSachLenh) {
      const pkg = trichTenGoiDaChuanHoa(lenh);
      if (!pkg) continue;
      if (!goiKhopRepo(pkg, tenRepo, chuRepo)) continue;

      let diem = 110;

      // Trừ điểm mạnh nếu là bước chuẩn bị môi trường (torch, cuda...)
      if (laBuocChuanBiMoiTruong(lenh, tenRepo || undefined)) {
        diem -= 50;
      }

      // Trừ điểm nếu là lệnh cài công cụ (pip, setuptools, pnpm...)
      if (laLenhCaiCongCu(lenh)) {
        diem -= 40;
      }

      if (!ungVienKhopRepo || diem > ungVienKhopRepo.diem) {
        ungVienKhopRepo = { pkgInfo: pkg, lenh, diem };
      }
    }

    if (ungVienKhopRepo) {
      return { pkgInfo: ungVienKhopRepo.pkgInfo, lenhChinh: ungVienKhopRepo.lenh };
    }
  }

  // 2. Khi không có gói nào khớp tên repo: chỉ chấp nhận gói của dòng đầu tiên trong nhóm (như bản gốc).
  const lenhDau = danhSachLenh[0] || '';
  const pkgDau = trichTenGoiDaChuanHoa(lenhDau);
  if (pkgDau) {
    // Kiểm tra NPX: chỉ nhận khi khớp tên repo (D-38)
    if (pkgDau.trinhQuanLy === MaTrinhQuanLyGoi.NPX) {
      return { pkgInfo: null, lenhChinh: lenhDau };
    }
    return { pkgInfo: pkgDau, lenhChinh: lenhDau };
  }

  return { pkgInfo: null, lenhChinh: lenhDau };
}

/**
 * Trích xuất các khối lệnh từ code blocks Markdown mà không cần gọi LLM (Fallback / Offline Mode).
 */
export function bocTachHuongDanTuCodeBlocks(
  rawInstallSection: string,
  rawReadme: string,
  duongDanReadmeGoc?: string,
): HuongDanCaiDatDto | null {
  if (!rawInstallSection) return null;
  const tenRepo = layTenRepoTuDuongDan(duongDanReadmeGoc);

  // Tìm tất cả các code blocks: ```[lang]\n[code]\n```
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  const cacLenh: { lenh: string; lenhGoc: string; nhom: NhomCachCai; os: HeDieuHanhCli }[] = [];

  while ((match = codeBlockRegex.exec(rawInstallSection)) !== null) {
    const blockContent = match[1]?.trim() || '';
    const matchIndex = match.index;

    // P3B-35: Lấy tiêu đề / dòng mô tả ngay trước code block, tránh quét tràn cả README
    const textTruoc = rawInstallSection.slice(0, matchIndex);
    const cacDongTruoc = textTruoc
      .split(/\r?\n/)
      .map((d) => d.trim())
      .filter(Boolean);
    let tieuDeGanNhat = '';
    const doanGan = cacDongTruoc.slice(-10);
    for (let i = doanGan.length - 1; i >= 0; i--) {
      if (/^#{1,6}\s+/.test(doanGan[i]!)) {
        tieuDeGanNhat = doanGan[i]!;
        break;
      }
    }
    const dongMoTaTruoc = cacDongTruoc.slice(-2).join('\n');
    const nguCanhHep = `${tieuDeGanNhat}\n${dongMoTaTruoc}\n${blockContent}`;

    // ARCH-04 & P3B-34: Nối các dòng có ký tự ngắt dòng (\, ^, `) để không cắt cụt câu lệnh
    const rawLines = blockContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    const lines: { lenhPhang: string; lenhGoc: string }[] = [];
    let currentPhang = '';
    let currentGoc = '';

    for (const rawLine of rawLines) {
      if (!currentPhang) {
        currentPhang = rawLine;
        currentGoc = rawLine;
      } else {
        currentPhang += ' ' + rawLine;
        currentGoc += '\n' + rawLine;
      }

      if (currentPhang.endsWith('\\') || currentPhang.endsWith('^') || currentPhang.endsWith('`')) {
        currentPhang = currentPhang.slice(0, -1).trim();
      } else {
        lines.push({ lenhPhang: currentPhang, lenhGoc: currentGoc });
        currentPhang = '';
        currentGoc = '';
      }
    }
    if (currentPhang) {
      lines.push({ lenhPhang: currentPhang, lenhGoc: currentGoc });
    }

    for (const item of lines) {
      // Bỏ dấu nhắc shell (`$ `, `> `, `PS> `) để lệnh lưu và gói bóc tách là lệnh sạch
      const linePhang = boDauNhacShell(item.lenhPhang) || item.lenhPhang;
      // Lệnh chỉ cài công cụ đóng gói (`pip install -U pip`, `npm i -g pnpm`) không phải lệnh cài app; để lại thì
      // nó đứng đầu nhóm và tên gói bị đọc thành "pip"/"pnpm" (aqtinstall, etherpad). Trừ khi chính repo là công
      // cụ đó (pnpm/pnpm, astral-sh/uv); không biết repo thì giữ nguyên như cũ.
      if (tenRepo && laLenhCaiCongCu(linePhang) && !lenhNhacTenRepo(linePhang, tenRepo)) continue;
      const nhom = nhanDienNhomLenh(linePhang);
      const lineGocSach = item.lenhGoc
        .split('\n')
        .map((l) => boDauNhacShell(l) || l)
        .join('\n');
      if (nhom) {
        cacLenh.push({
          lenh: linePhang,
          lenhGoc: lineGocSach,
          nhom,
          os: xacDinhHeDieuHanhLenh(linePhang, nguCanhHep),
        });
      }
    }
  }

  if (cacLenh.length === 0) return null;

  // Gom nhóm theo tiền tố
  const mapNhom = new Map<NhomCachCai, { lenh: string; lenhGoc: string; os: HeDieuHanhCli }[]>();
  for (const item of cacLenh) {
    const list = mapNhom.get(item.nhom) || [];
    list.push({ lenh: item.lenh, lenhGoc: item.lenhGoc, os: item.os });
    mapNhom.set(item.nhom, list);
  }

  const cachCai: CachCaiDto[] = [];
  for (const [nhom, items] of mapNhom.entries()) {
    const buoc: BuocCaiDto[] = items.map((it) => {
      const rr = kiemTraRuiRoCao(it.lenh);
      return {
        moTa: `Chạy lệnh ${it.lenh.split(' ')[0] || ''}`,
        lenh: it.lenhGoc,
        ruiRoCao: rr.ruiRoCao,
        canhBaoRuiRo: rr.lyDo,
      };
    });

    // P3B-16.3 & P3B-35: Bóc tách tên gói tối ưu, ưu tiên gói khớp repo và coi torch là bước chuẩn bị
    const { pkgInfo, lenhChinh } = timThongTinGoiToiUu(
      items.map((it) => it.lenh),
      tenRepo,
      layChuRepoTuDuongDan(duongDanReadmeGoc),
    );
    let lenhCapNhat: string | undefined;
    let lenhGo: string | undefined;
    if (pkgInfo) {
      const ghep = ghepLenhCliAnToan(
        pkgInfo.trinhQuanLy,
        pkgInfo.tenGoi,
        undefined,
        laLenhNpmCucBo(lenhChinh || items[0]?.lenh),
      );
      if (ghep.hopLe) {
        lenhCapNhat = ghep.lenhCapNhat;
        lenhGo = ghep.lenhGo;
      }
    }

    const itemChinh = items.find((it) => it.lenh === lenhChinh) || items[0];

    cachCai.push({
      ten: `Cài đặt qua ${nhom}`,
      nhom,
      heDieuHanh: itemChinh?.os || HeDieuHanhCli.DUNG_CHUNG,
      phanCung: PhanCungYeuCau.KHONG_RO,
      yeuCau: [],
      buoc,
      trinhQuanLy: pkgInfo?.trinhQuanLy,
      tenGoi: pkgInfo?.tenGoi,
      lenhCapNhat,
      lenhGo,
    });
  }

  return locVaChuanHoaHuongDanCaiDat({ cachCai }, rawReadme, duongDanReadmeGoc);
}

/** Kiểm hợp lệ trả về boolean thường (không phải type guard) để không làm TypeScript thu hẹp kiểu về never ở nhánh sai. */
function laCachCaiHopLe(huongDan: HuongDanCaiDatDto): boolean {
  return coCachCaiCliHopLe(huongDan);
}

/** Lấy tên repo từ đường dẫn README gốc (https://github.com/owner/repo#readme hoặc owner/repo). */
function layTenRepoTuDuongDan(duongDan?: string): string | null {
  if (!duongDan) return null;
  const m = duongDan.match(/github\.com\/[^/\s]+\/([^/#?\s]+)/i);
  if (m?.[1]) return m[1];
  const mSlug = duongDan.match(/^[^/\s]+\/([^/#?\s]+)$/);
  return mSlug?.[1] ?? null;
}

function chuanHoaTenSoSanh(ten: string): string {
  return ten.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Tên gói khớp tên repo: bằng nhau, hoặc chứa nhau khi đủ dài (plotly.js-dist-min với plotly.js,
 * nanobot-ai với nanobot, BurntSushi.ripgrep.MSVC với ripgrep). Tên dưới 3 ký tự chỉ chấp nhận khi bằng nhau.
 */
export function tenGoiKhopTenRepo(tenGoi: string, tenRepo: string): boolean {
  const goi = chuanHoaTenSoSanh(tenGoi);
  const repo = chuanHoaTenSoSanh(tenRepo);
  if (!goi || !repo) return false;
  if (goi === repo) return true;
  if (goi.length < 3 || repo.length < 3) return false;
  return goi.includes(repo) || repo.includes(goi);
}

/** Lấy chủ sở hữu (owner) từ đường dẫn README gốc (https://github.com/owner/repo#readme hoặc owner/repo). */
function layChuRepoTuDuongDan(duongDan?: string): string | null {
  if (!duongDan) return null;
  const m = duongDan.match(/github\.com\/([^/\s]+)\/[^/#?\s]+/i);
  if (m?.[1]) return m[1];
  const mSlug = duongDan.match(/^([^/\s]+)\/[^/#?\s]+$/);
  return mSlug?.[1] ?? null;
}

/**
 * Chốt chặn D-38 cho đích dạng owner/name của 
px skills add owner/name: bắt buộc owner trùng chủ repo
 * (không phân biệt hoa thường) và name bằng tên repo hoặc bắt đầu bằng <tên-repo>- (rendercv/rendercv-skill).
 * So khớp kiểu "chứa" từng nhận nhầm ttacker/bar cho repo oo/bar và PicGo/skills cho Molunerfinn/PicGo.
 */
export function dichNpxKhopRepo(tenGoi: string, tenRepo: string, chuRepo?: string | null): boolean {
  const phan = tenGoi.trim().split('/');
  if (phan.length !== 2 || !phan[0] || !phan[1]) return tenGoiKhopTenRepo(tenGoi, tenRepo);
  if (!chuRepo || phan[0].toLowerCase() !== chuRepo.toLowerCase()) return false;
  const name = phan[1].toLowerCase();
  const repo = tenRepo.toLowerCase();
  return name === repo || name.startsWith(repo + '-');
}

/** Gói khớp repo: riêng nhóm npx (đích owner/name) phải qua chốt chặn chủ sở hữu, các nhóm khác so theo tên. */
function goiKhopRepo(
  pkg: { trinhQuanLy: string; tenGoi: string },
  tenRepo: string,
  chuRepo?: string | null,
): boolean {
  return pkg.trinhQuanLy === MaTrinhQuanLyGoi.NPX
    ? dichNpxKhopRepo(pkg.tenGoi, tenRepo, chuRepo)
    : tenGoiKhopTenRepo(pkg.tenGoi, tenRepo);
}

function locCachCaiKhopTenRepo(
  huongDan: HuongDanCaiDatDto | null,
  tenRepo: string,
  chuRepo?: string | null,
): CachCaiDto[] {
  return (huongDan?.cachCai ?? []).filter(
    (c) =>
      Boolean(c.trinhQuanLy && c.tenGoi) &&
      goiKhopRepo(
        { trinhQuanLy: String(c.trinhQuanLy), tenGoi: String(c.tenGoi) },
        tenRepo,
        chuRepo,
      ),
  );
}

/**
 * Quét cả README (khối mã và mã nội dòng, kể cả hàng bảng Markdown) và chỉ giữ cách cài có tên gói khớp tên repo.
 * Thử từng lệnh riêng vì nhóm trình quản lý lấy lệnh ĐẦU để đọc tên gói: một dòng `npx x` hay `npm install`
 * đứng trước sẽ làm hỏng cả nhóm nếu gộp chung.
 */
function trichTheoTenRepoTrongToanReadme(
  rawReadme: string,
  duongDanReadmeGoc?: string,
): HuongDanCaiDatDto | null {
  const tenRepo = layTenRepoTuDuongDan(duongDanReadmeGoc);
  if (!tenRepo) return null;

  const ungVien = new Set<string>();
  for (const khoi of rawReadme.matchAll(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g)) {
    const rawLines = (khoi[1] ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    let current = '';
    for (const rawLine of rawLines) {
      if (!current) {
        current = rawLine;
      } else {
        current += ' ' + rawLine;
      }
      if (current.endsWith('\\') || current.endsWith('^') || current.endsWith('`')) {
        current = current.slice(0, -1).trim();
      } else {
        ungVien.add(current);
        current = '';
      }
    }
    if (current) ungVien.add(current);
  }
  for (const dong of rawReadme.split(/\r?\n/)) {
    for (const m of dong.matchAll(/`([^`]{5,200})`/g)) if (m[1]) ungVien.add(m[1].trim());
  }

  const timThay = new Map<string, CachCaiDto>();
  let khung: HuongDanCaiDatDto | null = null;
  for (const lenh of [...ungVien].slice(0, 300)) {
    if (!nhanDienNhomLenh(lenh)) continue;
    const ketQua = bocTachHuongDanTuCodeBlocks(
      '```bash\n' + lenh + '\n```',
      rawReadme,
      duongDanReadmeGoc,
    );
    for (const cach of locCachCaiKhopTenRepo(
      ketQua,
      tenRepo,
      layChuRepoTuDuongDan(duongDanReadmeGoc),
    )) {
      const khoa = `${cach.trinhQuanLy}:${cach.tenGoi}`;
      if (timThay.has(khoa)) continue;
      timThay.set(khoa, cach);
      khung = khung ?? ketQua;
    }
  }
  return khung && timThay.size > 0
    ? { ...khung, cachCai: [...timThay.values()], nguon: 'README' }
    : null;
}

/**
 * Dòng mở hoặc đóng khối code rào: từ 3 dấu ` hoặc ~ trở lên. Nhận ở mọi độ thụt lề vì README hay lùi khối rào
 * vào trong mục danh sách (xgplayer, mp-html); nếu chỉ nhận tối đa 3 dấu cách như chuẩn thì khối đó bị bọc thêm rào.
 */
const DONG_RAO = /^\s*(`{3,}|~{3,})(.*)$/;
/** Thụt lề của khối code thụt lề trong Markdown: 4 dấu cách hoặc 1 tab. */
const THUT_LE_CODE = /^(?: {4}|\t)/;

/**
 * Đưa khối code rào `~~~` và khối code thụt lề (4 dấu cách hoặc tab, chuẩn Markdown) về dạng ``` mà các bước bóc
 * tách đọc được. Chỉ thêm dòng rào và bỏ phần thụt lề, không đổi chữ của lệnh, nên kiểm tên gói và chống chèn lệnh
 * vẫn giữ nguyên. Đo 05/11/2026: nhiều README (instaloader, shellharden, ungit, ffsubsync) viết lệnh cài theo hai
 * kiểu này nên bị sót. Khối thụt lề phải đứng sau dòng trống, giống luật Markdown, để không nhận nhầm đoạn văn.
 */
export function chuanHoaKhoiCode(readme: string): string {
  const dongVao = readme.split(/\r?\n/);
  const ra: string[] = [];
  let rao: string | null = null;
  let trongThutLe = false;
  dongVao.forEach((dong, i) => {
    if (rao) {
      const dong2 = dong.match(DONG_RAO);
      const dongRao =
        dong2 && dong2[1]![0] === rao[0] && dong2[1]!.length >= rao.length && !dong2[2]!.trim();
      // Dòng rào lồng bên trong (khối ```` chứa ```) đổi ` thành ' để các bước sau không tưởng là khối kết thúc
      ra.push(dongRao ? '```' : dong2 ? dong.replace(/`/g, "'") : dong);
      if (dongRao) rao = null;
      return;
    }
    const moRao = dong.match(DONG_RAO);
    if (trongThutLe && (moRao || (dong.trim() && !THUT_LE_CODE.test(dong)))) {
      ra.push('```');
      trongThutLe = false;
    }
    if (moRao) {
      rao = moRao[1]!;
      ra.push('```' + moRao[2]!.trim());
      return;
    }
    // Dòng trống giữa khối thụt lề chỉ thuộc khối nếu dòng có chữ kế tiếp vẫn thụt lề
    if (trongThutLe && !dong.trim()) {
      const keTiep = dongVao.slice(i + 1).find((d) => d.trim());
      if (!keTiep || !THUT_LE_CODE.test(keTiep)) {
        ra.push('```');
        trongThutLe = false;
      }
    }
    const truocTrong = i === 0 || !dongVao[i - 1]!.trim();
    if (!trongThutLe && dong.trim() && THUT_LE_CODE.test(dong) && truocTrong) {
      ra.push('```');
      trongThutLe = true;
    }
    ra.push(trongThutLe ? dong.replace(THUT_LE_CODE, '') : dong);
  });
  if (trongThutLe || rao) ra.push('```');
  return ra.join('\n');
}

/**
 * Trích xuất hướng dẫn cài đặt dòng lệnh hoàn toàn bằng quy tắc thuần từ README (P3B-16.3).
 * Tuyệt đối không dùng AI. Coi là gợi ý, ghi rõ nguồn là README.
 */
export function trichXuatHuongDanCliBangQuyTac(
  rawReadme: string,
  duongDanReadmeGoc?: string,
): HuongDanCaiDatDto | null {
  if (!rawReadme || typeof rawReadme !== 'string') return null;
  rawReadme = chuanHoaKhoiCode(rawReadme);

  // 1. Tìm mục cài đặt trong README
  const installSection = trichMucCaiDat(rawReadme);

  // 2. Xác định phạm vi quét an toàn:
  // - Nếu có mục cài đặt riêng: quét trọn vẹn mục đó.
  // - Nếu không có: chỉ quét tối đa 4.000 ký tự đầu của README (tránh quét mục dev/contributing phía sau).
  const targetScope = installSection || rawReadme.slice(0, 4000);

  // 3. Thử trích xuất từ các code blocks trong phạm vi quét
  let result = bocTachHuongDanTuCodeBlocks(targetScope, rawReadme, duongDanReadmeGoc);
  // Chỉ thoát sớm khi kết quả HỢP LỆ (có trình quản lý và tên gói). Khối mã đầu tiên có thể chỉ là lệnh chạy
  // (npx x) hay lệnh phát triển, nếu thoát sớm thì không bao giờ tới bước quét cả README (P3B-25.12).
  let duPhong: HuongDanCaiDatDto | null = null;
  if (result && result.cachCai.length > 0) {
    if (laCachCaiHopLe(result)) return { ...result, nguon: 'README' };
    duPhong = { ...result, nguon: 'README' };
  }

  // 4. Fallback: Quét từng dòng trong phạm vi quét an toàn
  // - Khi có installSection: chấp nhận dòng có inline code, dòng có tiền tố Install:/Setup:, hoặc dòng lệnh trực tiếp.
  // - Khi KHÔNG có installSection (chỉ trong 4.000 ký tự đầu): TUYỆT ĐỐI chỉ chấp nhận dòng có tiền tố Install:/Setup:/Cài đặt: hoặc inline code `...`
  const lines = targetScope.split(/\r?\n/);
  const matchedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // A. Kiểm tra tiền tố Install: / Installation: / Setup: / Cài đặt:
    const prefixMatch = trimmed.match(/^(?:install|installation|setup|cài\s*đặt)\s*:\s*(.+)$/i);
    // B. Kiểm tra inline code `...`
    const inlineMatch = trimmed.match(/`([^`]{5,200})`/);

    let candidate = '';
    if (prefixMatch && prefixMatch[1]) {
      candidate = prefixMatch[1].trim();
      if (candidate.startsWith('`') && candidate.endsWith('`') && candidate.length >= 2) {
        candidate = candidate.slice(1, -1).trim();
      }
    } else if (inlineMatch && inlineMatch[1]) {
      candidate = inlineMatch[1].trim();
    } else if (installSection) {
      // Khi đã ở trong mục cài đặt rõ ràng, cho phép dòng lệnh trực tiếp
      candidate = trimmed;
    }

    if (!candidate) continue;

    const nhom = nhanDienNhomLenh(candidate);
    if (nhom) {
      matchedLines.push(candidate);
    }
  }

  if (matchedLines.length > 0) {
    const syntheticSection = '```bash\n' + matchedLines.join('\n') + '\n```';
    result = bocTachHuongDanTuCodeBlocks(syntheticSection, rawReadme, duongDanReadmeGoc);
    if (result && result.cachCai.length > 0) {
      if (laCachCaiHopLe(result)) return { ...result, nguon: 'README' };
      duPhong = duPhong ?? { ...result, nguon: 'README' };
    }
  }

  // 5. Fallback cuối (P3B-25.12): các bước trên không ra cách cài hợp lệ, có thể vì lệnh nằm ngoài vùng quét
  // (VD: pandas dưới tiêu đề "Where to get it" trong khi mục "Installation from sources" mới là mục được nhận ra,
  // OmniRoute ở ký tự 61.000). Quét cả README nhưng CHỈ nhận cách cài có tên gói khớp tên repo, để lệnh của mục
  // phát triển (pip install -r requirements.txt, npm install) vẫn bị loại.
  // Không tìm thấy cách cài hợp lệ ở đâu thì giữ kết quả không hợp lệ cũ (nếu có) như trước đây.
  return trichTheoTenRepoTrongToanReadme(rawReadme, duongDanReadmeGoc) ?? duPhong;
}
