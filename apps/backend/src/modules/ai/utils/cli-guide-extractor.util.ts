import {
  HeDieuHanhCli,
  HuongDanCaiDatDto,
  CachCaiDto,
  BuocCaiDto,
  NhomCachCai,
  PhanCungYeuCau,
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
  // Chuẩn hóa loại bỏ prompt shell nếu có ở đầu dòng ($, #, >) (BE-01)
  const l = lenh.trim().replace(/^[$#>]\s*/, '');

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
    /^(pip|pip3|python\d*\s+-m\s+pip|uv\s+pip|uv\s+tool|pipx)\s+install\b/i.test(l) ||
    /^(pip|pip3|pipx)\s+/i.test(l) ||
    /^uv\s+(add|run)\b/i.test(l)
  ) {
    return NhomCachCai.PIP;
  }

  // CONDA
  if (/^(conda\s+install|conda\s+create|mamba\s+install|mamba\s+create)\b/i.test(l)) {
    return NhomCachCai.CONDA;
  }

  // NPM
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
 * Xác định nhãn hệ điều hành phù hợp cho câu lệnh (Section 3.2).
 */
export function xacDinhHeDieuHanhLenh(lenh: string, contextText?: string): HeDieuHanhCli {
  const l = (lenh || '').toLowerCase();
  const ctx = (contextText || '').toLowerCase();

  // LINUX_MAC: apt, brew, yum, pacman, dnf, zypper, hoặc context có Linux/macOS
  if (
    /\b(apt|apt-get|brew|yum|pacman|dnf|zypper|apk\s+add|systemctl)\b/.test(l) ||
    (/\b(linux|macos|mac\s*os|darwin|ubuntu|debian|fedora|arch)\b/.test(ctx) &&
      !/\bwindows\b/.test(ctx))
  ) {
    return HeDieuHanhCli.LINUX_MAC;
  }

  // WINDOWS: winget, scoop, choco, .bat, .ps1, powershell, hoặc context có Windows
  if (
    /\b(winget|scoop|choco|chocolatey|powershell|pwsh)\b/.test(l) ||
    /\.(bat|ps1|cmd)\b/.test(l) ||
    (/\bwindows\b/.test(ctx) && !/\b(linux|macos)\b/.test(ctx))
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

  const l = lenh.trim().replace(/^[$#>]\s*/, '');

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

  // 2. PowerShell Invoke-Expression / EncodedCommand / ExecutionPolicy Bypass (SEC-01, SEC-VULN-03 & SEC-R4-04)
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
  let l = line.trim().replace(/^[$#>]\s*/, '');
  if (l.startsWith('`') && l.endsWith('`') && l.length >= 2) {
    l = l.slice(1, -1).trim();
  }
  return l;
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

  // 1. Lệnh 1 dòng: Phải khớp nguyên vẹn với một dòng lệnh trong README
  if (lenhLines.length === 1) {
    const target = lenhLines[0];
    return readmeLines.some((rLine) => rLine === target);
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

    cachCaiHopLe.push({
      ten: cach.ten?.trim() || `Cài đặt (${nhomSuyDuan})`,
      nhom: nhomSuyDuan,
      heDieuHanh: cach.heDieuHanh || HeDieuHanhCli.DUNG_CHUNG,
      phanCung: cach.phanCung || PhanCungYeuCau.KHONG_RO,
      yeuCau: Array.isArray(cach.yeuCau)
        ? cach.yeuCau.map((y) => String(y).trim()).filter(Boolean)
        : [],
      buoc: buocHopLe,
    });
  }

  if (cachCaiHopLe.length === 0) {
    return null;
  }

  return {
    cachCai: sapXepCachCai(cachCaiHopLe),
    coRuiRoCao: coBatKyRuiRoNao,
    duongDanReadmeGoc,
  };
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

  // Tìm tất cả các code blocks: ```[lang]\n[code]\n```
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  const cacLenh: { lenh: string; nhom: NhomCachCai; os: HeDieuHanhCli }[] = [];

  while ((match = codeBlockRegex.exec(rawInstallSection)) !== null) {
    const blockContent = match[1]?.trim() || '';
    const lines = blockContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    for (const line of lines) {
      const nhom = nhanDienNhomLenh(line);
      if (nhom) {
        cacLenh.push({
          lenh: line,
          nhom,
          os: xacDinhHeDieuHanhLenh(line, rawInstallSection),
        });
      }
    }
  }

  if (cacLenh.length === 0) return null;

  // Gom nhóm theo tiền tố
  const mapNhom = new Map<NhomCachCai, { lenh: string; os: HeDieuHanhCli }[]>();
  for (const item of cacLenh) {
    const list = mapNhom.get(item.nhom) || [];
    list.push({ lenh: item.lenh, os: item.os });
    mapNhom.set(item.nhom, list);
  }

  const cachCai: CachCaiDto[] = [];
  for (const [nhom, items] of mapNhom.entries()) {
    const buoc: BuocCaiDto[] = items.map((it) => {
      const rr = kiemTraRuiRoCao(it.lenh);
      return {
        moTa: `Chạy lệnh ${it.lenh.split(' ')[0] || ''}`,
        lenh: it.lenh,
        ruiRoCao: rr.ruiRoCao,
        canhBaoRuiRo: rr.lyDo,
      };
    });

    cachCai.push({
      ten: `Cài đặt qua ${nhom}`,
      nhom,
      heDieuHanh: items[0]?.os || HeDieuHanhCli.DUNG_CHUNG,
      phanCung: PhanCungYeuCau.KHONG_RO,
      yeuCau: [],
      buoc,
    });
  }

  return locVaChuanHoaHuongDanCaiDat({ cachCai }, rawReadme, duongDanReadmeGoc);
}
