/**
 * Danh sách 9 danh mục ứng dụng chuẩn hóa của ForgeStore
 */
export const DANH_MUC_CHUAN = [
  'AI',
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

// Bảng từ khóa ánh xạ từ GitHub Topics và mô tả sang danh mục chuẩn hóa (N2)
// Mỗi từ khóa chỉ thuộc duy nhất MỘT danh mục. Đã bỏ 'windows', 'android', phân tách 'editor'.
type DanhMucThuong = Exclude<DanhMucChuan, 'AI'>;

const TU_KHOA_DANH_MUC: Record<DanhMucThuong, string[]> = {
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
    'video-editor',
    'image-editor',
    'audio-editor',
    'photo-editor',
    'graphics',
    'converter',
    'camera',
    'recorder',
    'screen-recorder',
    'obs',
    'jellyfin',
    'plex',
    'media-player',
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
    'markdown-editor',
    'note-editor',
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
    'code-editor',
    'text-editor',
    'source-code-editor',
    'source-editor',
  ],
  'Mạng & Giao tiếp': [
    'network',
    'communication',
    'chat',
    'messaging',
    'p2p',
    'peer-to-peer',
    'torrent',
    'bittorrent',
    'torrent-client',
    'media-server',
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
    'game-launcher',
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
    'anki',
    'flashcards',
  ],
  'Tiện ích hệ thống': [
    'utility',
    'utilities',
    'tool',
    'tools',
    'system',
    'helper',
    'manager',
    'cleaner',
    'tweaks',
    'app-launcher',
    '7zip',
    'compression',
    'archive',
  ],
};

/**
 * Bảng ghi đè danh mục thủ công cho các kho lưu trữ phổ biến (N2).
 */
export const BANG_DANH_MUC_THU_CONG: Record<string, DanhMucChuan> = {
  'notepad-plus-plus/notepad-plus-plus': 'Lập trình & Phát triển',
  'qbittorrent/qbittorrent': 'Mạng & Giao tiếp',
  'transmission/transmission': 'Mạng & Giao tiếp',
  'jellyfin/jellyfin': 'Đa phương tiện',
  'jellyfin/jellyfin-android': 'Đa phương tiện',
  'localsend/localsend': 'Mạng & Giao tiếp',
  'rustdesk/rustdesk': 'Mạng & Giao tiếp',
  'keepassxreboot/keepassxc': 'Bảo mật & Quyền riêng tư',
  'koreader/koreader': 'Học tập & Giáo dục',
  'ankidroid/ankidroid': 'Học tập & Giáo dục',
  'obsidianmd/obsidian-releases': 'Năng suất & Văn phòng',
  'bleachbit/bleachbit': 'Tiện ích hệ thống',
  'videolan/vlc': 'Đa phương tiện',
  'obsproject/obs-studio': 'Đa phương tiện',
  'retroarch/retroarch': 'Trò chơi & Giải trí',
  'libretro/retroarch': 'Trò chơi & Giải trí',
  'termux/termux-app': 'Lập trình & Phát triển',
  '7-zip/7-zip': 'Tiện ích hệ thống',
  'ip7z/7zip': 'Tiện ích hệ thống',
  'syncthing/syncthing': 'Mạng & Giao tiếp',
  'syncthing/syncthing-android': 'Mạng & Giao tiếp',
  'dbeaver/dbeaver': 'Lập trình & Phát triển',
  'zeromicro/go-zero': 'Lập trình & Phát triển',
  'drawdb-io/drawdb': 'Lập trình & Phát triển',
  'rustfs/rustfs': 'Tiện ích hệ thống',
  'oblien/openship': 'Tiện ích hệ thống',
  'netdata/netdata': 'Tiện ích hệ thống',
  'thejoefin/text-grab': 'Tiện ích hệ thống',
  'tesseract-ocr/tesseract': 'Năng suất & Văn phòng',
  'naptha/tesseract.js': 'Năng suất & Văn phòng',
  'opencv/opencv': 'Đa phương tiện',
  'ossrs/srs': 'Đa phương tiện',
  'wkentaro/labelme': 'Đa phương tiện',
  't8rin/imagetoolbox': 'Đa phương tiện',
  'livekit/livekit': 'Mạng & Giao tiếp',
  'anomalyco/opencode': 'AI',
  'openai/codex': 'AI',
  'earendil-works/pi': 'AI',
  'openai/whisper': 'AI',
  'colbymchenry/codegraph': 'AI',
  'cline/cline': 'AI',
  'karpathy/nanogpt': 'AI',
  'hkuds/cli-anything': 'AI',
  'oobabooga/textgen': 'AI',
  'justvugg/colibri': 'AI',
  'tashfeenahmed/freellmapi': 'AI',
  'vercel-labs/agent-browser': 'AI',
  'stanfordnlp/dspy': 'AI',
  'musistudio/claude-code-router': 'AI',
  'openai/codex-plugin-cc': 'AI',
  'yeachan-heo/oh-my-codex': 'AI',
  'allenai/olmocr': 'AI',
  'openai/tiktoken': 'AI',
  'gastownhall/gastown': 'AI',
  'huggingface/trl': 'AI',
  'huggingface/sentence-transformers': 'AI',
  'state-spaces/mamba': 'AI',
  'andrewyng/openworker': 'AI',
  'karpathy/micrograd': 'AI',
  'langchain-ai/langchainjs': 'AI',
  'avante-corp/avante.nvim': 'AI',
  'langchain-ai/openwiki': 'AI',
  'microsoft/data-formulator': 'AI',
  'lllyasviel/framepack': 'AI',
  'kittenml/kittentts': 'AI',
  'comfy-org/comfyui-manager': 'AI',
  'andrewyng/aisuite': 'AI',
  'hkuds/openharness': 'AI',
  'neonbjb/tortoise-tts': 'AI',
  'andymik90/aperant': 'AI',
};

// Chỉ các chủ đề nhận diện rõ AI mới được dùng để tránh kéo nhầm công cụ phổ thông.
const TU_KHOA_AI_COT_LOI = [
  'ai',
  'llm',
  'llms',
  'large-language-models',
  'large-language-model',
  'machine-learning',
  'deep-learning',
  'artificial-intelligence',
  'generative-ai',
  'genai',
  'ai-agents',
  'ai-agent',
  'agentic',
  'chatgpt',
  'openai',
  'claude',
  'claude-code',
  'ollama',
  'stable-diffusion',
  'diffusion',
  'image-generation',
  'comfyui',
  'rag',
  'mcp',
  'mcp-server',
  'langchain',
  'deepseek',
  'qwen',
  'llama',
  'local-llm',
  'neural-network',
  'neural-networks',
  'pytorch',
  'tensorflow',
  'transformers',
  'huggingface',
  'nlp',
  'vector-database',
  'embeddings',
  'ai-tools',
  'self-hosted-ai',
  'aigc',
] as const;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kiểm tra một topic có khớp từ khóa hay không theo nguyên tắc khớp nguyên từ (N2).
 * - Topic trùng khớp tuyệt đối: 'cli' === 'cli'
 * - Hoặc topic ghép bằng dấu gạch ngang/gạch dưới chứa từ khóa nguyên vẹn: 'cli-tool' -> ['cli', 'tool'] khớp 'cli'.
 * - KHÔNG khớp chuỗi con vô nghĩa: 'client' KHÔNG khớp 'cli'.
 */
function kiemTraTopicKhop(topic: string, keyword: string): boolean {
  if (topic === keyword) {
    return true;
  }
  if (keyword.includes('-')) {
    return topic === keyword;
  }
  const parts = topic.split(/[-_]/);
  return parts.includes(keyword);
}

/**
 * Hàm thuần ánh xạ từ topics và mô tả của GitHub repository sang danh mục chuẩn ForgeStore.
 *
 * @param topics Danh sách topics từ GitHub Repo (VD: ['remote-desktop', 'rust', 'p2p'])
 * @param moTa Mô tả ngắn bằng tiếng Anh của Repo (nếu có)
 * @param tenRepo Tên đầy đủ dạng owner/repo (nếu có để tra cứu ghi đè thủ công)
 * @returns Danh mục chuẩn tiếng Việt
 */
export function anhXaDanhMuc(
  topics: string[] = [],
  moTa?: string | null,
  tenRepo?: string | null,
): DanhMucChuan {
  // 1. Kiểm tra bảng ghi đè thủ công cho các repo nổi tiếng (N2)
  if (tenRepo) {
    const cleanRepo = tenRepo.toLowerCase().trim();
    if (BANG_DANH_MUC_THU_CONG[cleanRepo]) {
      return BANG_DANH_MUC_THU_CONG[cleanRepo];
    }
  }

  const normalizedTopics = (topics || []).map((t) => t.toLowerCase().trim());
  if (
    normalizedTopics.some((topic) =>
      TU_KHOA_AI_COT_LOI.some((keyword) => kiemTraTopicKhop(topic, keyword)),
    )
  ) {
    return 'AI';
  }

  const normalizedDesc = (moTa || '').toLowerCase();

  // Đếm điểm phù hợp cho từng danh mục
  // Phân tách điểm Topic và điểm Mô tả để giải quyết hòa điểm (N2)
  const scores: Record<DanhMucThuong, { total: number; topic: number }> = {
    'Bảo mật & Quyền riêng tư': { total: 0, topic: 0 },
    'Đa phương tiện': { total: 0, topic: 0 },
    'Năng suất & Văn phòng': { total: 0, topic: 0 },
    'Lập trình & Phát triển': { total: 0, topic: 0 },
    'Mạng & Giao tiếp': { total: 0, topic: 0 },
    'Trò chơi & Giải trí': { total: 0, topic: 0 },
    'Học tập & Giáo dục': { total: 0, topic: 0 },
    'Tiện ích hệ thống': { total: 0, topic: 0 },
  };

  for (const [danhMuc, keywords] of Object.entries(TU_KHOA_DANH_MUC) as [
    DanhMucThuong,
    string[],
  ][]) {
    for (const kw of keywords) {
      const isCompound = kw.includes('-');
      // 1. Topic khớp theo nguyên từ: topic ghép +4 điểm, topic đơn +3 điểm
      if (normalizedTopics.some((t) => kiemTraTopicKhop(t, kw))) {
        const p = isCompound ? 4 : 3;
        scores[danhMuc].total += p;
        scores[danhMuc].topic += p;
      }

      // 2. Mô tả khớp theo ranh giới từ \b: mô tả ghép +2 điểm, mô tả đơn +1 điểm
      if (normalizedDesc) {
        const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
        if (regex.test(normalizedDesc)) {
          scores[danhMuc].total += isCompound ? 2 : 1;
        }
      }
    }
  }

  // Tìm danh mục có điểm cao nhất
  // Khi hòa điểm, ưu tiên danh mục có điểm topic cao hơn (N2)
  let maxScore = 0;
  let maxTopicScore = 0;
  let bestCategory: DanhMucChuan = 'Tiện ích hệ thống';

  for (const [danhMuc, sc] of Object.entries(scores) as [
    DanhMucThuong,
    { total: number; topic: number },
  ][]) {
    if (sc.total > maxScore) {
      maxScore = sc.total;
      maxTopicScore = sc.topic;
      bestCategory = danhMuc;
    } else if (sc.total === maxScore && sc.total > 0 && sc.topic > maxTopicScore) {
      maxTopicScore = sc.topic;
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
