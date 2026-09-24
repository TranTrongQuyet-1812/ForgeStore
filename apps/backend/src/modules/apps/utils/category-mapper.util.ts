/**
 * Danh sách 8 danh mục ứng dụng chuẩn hóa của ForgeStore
 */
export const DANH_MUC_CHUAN = [
  'Tiện ích hệ thống',
  'Bảo mật & Quyền riêng tư',
  'Đa phương tiện',
  'Năng suất & Văn phòng',
  'Lập trình & Phát triển',
  'Mạng & Giao tiếp',
  'Trò chơi & Giải trí',
  'Học tập & Giáo dục',
] as const;

export type DanhMucChuan = (typeof DANH_MUC_CHUAN)[number];

// Bảng từ khóa ánh xạ từ GitHub Topics và mô tả sang danh mục
const TU_KHOA_DANH_MUC: Record<DanhMucChuan, string[]> = {
  'Bảo mật & Quyền riêng tư': [
    'security',
    'privacy',
    'password-manager',
    'keepass',
    'vpn',
    'proxy',
    'encryption',
    'cryptography',
    'authenticator',
    '2fa',
    'totp',
    'firewall',
    'antivirus',
    'adblock',
    'adblocker',
  ],
  'Đa phương tiện': [
    'multimedia',
    'media',
    'video',
    'audio',
    'player',
    'music',
    'mpv',
    'vlc',
    'streaming',
    'image',
    'photo',
    'editor',
    'graphics',
    'converter',
    'camera',
    'recorder',
    'screen-recorder',
    'obs',
  ],
  'Năng suất & Văn phòng': [
    'productivity',
    'notes',
    'note-taking',
    'office',
    'markdown',
    'document',
    'pdf',
    'obsidian',
    'editor',
    'text-editor',
    'task',
    'todo',
    'calendar',
    'kanban',
    'mindmap',
  ],
  'Lập trình & Phát triển': [
    'developer-tools',
    'development',
    'programming',
    'git',
    'github',
    'code',
    'ide',
    'compiler',
    'terminal',
    'cli',
    'shell',
    'docker',
    'kubernetes',
    'api',
    'sdk',
    'database',
    'devtools',
    'debugger',
  ],
  'Mạng & Giao tiếp': [
    'network',
    'communication',
    'chat',
    'messaging',
    'p2p',
    'peer-to-peer',
    'torrent',
    'file-sharing',
    'localsend',
    'sync',
    'download-manager',
    'ftp',
    'ssh',
    'remote-desktop',
    'rustdesk',
    'webrtc',
  ],
  'Trò chơi & Giải trí': [
    'game',
    'gaming',
    'games',
    'emulator',
    'retroarch',
    'arcade',
    'entertainment',
    'steam',
    'launcher',
  ],
  'Học tập & Giáo dục': [
    'education',
    'learning',
    'book',
    'reader',
    'comics',
    'manga',
    'mihon',
    'tachiyomi',
    'ebook',
    'dictionary',
  ],
  'Tiện ích hệ thống': [
    'utility',
    'utilities',
    'tool',
    'tools',
    'system',
    'windows',
    'android',
    'helper',
    'manager',
    'cleaner',
    'tweaks',
    'launcher',
    '7zip',
    'compression',
    'archive',
  ],
};

/**
 * Hàm thuần ánh xạ từ topics và mô tả của GitHub repository sang danh mục chuẩn ForgeStore.
 *
 * @param topics Danh sách topics từ GitHub Repo (VD: ['remote-desktop', 'rust', 'p2p'])
 * @param moTa Mô tả ngắn bằng tiếng Anh của Repo (nếu có)
 * @returns Danh mục chuẩn tiếng Việt
 */
export function anhXaDanhMuc(topics: string[] = [], moTa?: string | null): DanhMucChuan {
  const normalizedTopics = (topics || []).map((t) => t.toLowerCase().trim());
  const normalizedDesc = (moTa || '').toLowerCase();

  // Đếm điểm phù hợp cho từng danh mục
  const scores: Record<DanhMucChuan, number> = {
    'Bảo mật & Quyền riêng tư': 0,
    'Đa phương tiện': 0,
    'Năng suất & Văn phòng': 0,
    'Lập trình & Phát triển': 0,
    'Mạng & Giao tiếp': 0,
    'Trò chơi & Giải trí': 0,
    'Học tập & Giáo dục': 0,
    'Tiện ích hệ thống': 0,
  };

  for (const [danhMuc, keywords] of Object.entries(TU_KHOA_DANH_MUC) as [
    DanhMucChuan,
    string[],
  ][]) {
    for (const kw of keywords) {
      // Topic khớp tuyệt đối hoặc chứa từ khóa: +3 điểm
      if (normalizedTopics.some((t) => t === kw || t.includes(kw))) {
        scores[danhMuc] += 3;
      }
      // Mô tả chứa từ khóa: +1 điểm
      if (normalizedDesc && normalizedDesc.includes(kw)) {
        scores[danhMuc] += 1;
      }
    }
  }

  // Tìm danh mục có điểm cao nhất
  let maxScore = 0;
  let bestCategory: DanhMucChuan = 'Tiện ích hệ thống';

  for (const [danhMuc, score] of Object.entries(scores) as [DanhMucChuan, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = danhMuc;
    }
  }

  return bestCategory;
}

/**
 * Danh sách ánh xạ package name nổi tiếng của các repo phổ biến (D-13).
 */
export const BANG_GOI_ANDROID_NOI_TIENG: Record<string, string> = {
  'rustdesk/rustdesk': 'com.carriez.rustdesk',
  'videolan/vlc': 'org.videolan.vlc',
  'localsend/localsend': 'org.localsend.localsend_app',
  'mihonapp/mihon': 'eu.kanade.tachiyomi',
  'retroarch/retroarch': 'com.retroarch',
  'keepassxreboot/keepassxc': 'keepass2android.keepass2android',
  'termux/termux-app': 'com.termux',
  'koreader/koreader': 'org.koreader.launcher',
  'revanced/revanced-manager': 'app.revanced.manager.flutter',
  'syncthing/syncthing-android': 'com.nutomic.syncthingandroid',
};

/**
 * Suy đoán package name Android từ tên repo và danh sách tên file APK.
 */
export function doanTenGoiAndroid(
  tenRepoDayDu: string,
  danhSachFileApk: string[] = [],
): string | null {
  const lowerRepo = tenRepoDayDu.toLowerCase().trim();
  if (BANG_GOI_ANDROID_NOI_TIENG[lowerRepo]) {
    return BANG_GOI_ANDROID_NOI_TIENG[lowerRepo];
  }

  // Thử trích xuất từ tên file có dạng reverse domain (VD: org.videolan.vlc_3.5.4.apk)
  const patternReverseDomain = /([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z0-9_.]+)/i;
  for (const file of danhSachFileApk) {
    const match = file.match(patternReverseDomain);
    if (match && match[1] && !match[1].endsWith('.apk')) {
      return match[1];
    }
  }

  return null;
}
